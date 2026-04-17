module.exports = function(app, locals) {
  const {
    db, jwt, bcrypt, multer, nodemailer, JSZip, axios, fs, path, crypto, express,
  googleExchangeTokens, TTN_URL, TTN_LOGIN, TTN_PASSWORD, TTN_MATRICULE,
  sleep, cleanBase64, extractSoapReturn, extractSoapFault, saveEfactTTN, consultEfactTTN,
  processTTNSubmission, QRCode, safeJsonParse, resolveConfig, decodeXmlB64, extractReferenceCEVFromXml, extractReferenceTTNFromXml,
  generateQrPngBase64, stampPdfWithTTN, bufferToB64, b64ToBuffer, ensureBase64String,
  createNotification, notifyAdmins, sendSignatureEmail, sendSignedPdfsToClient,
  sendRejectionEmailToClient, allowedOrigins, transporter, sendVerificationEmail,
  EMAIL_REGEX, isValidEmail, sanitizeEmailHtml, sendTokenRequestPaymentPendingEmail, sendTokenRequestDecisionEmail,
  verifyToken, verifyRole, verifyApiToken, storage, upload, handleResendTTNCore, passport
  } = locals;

/* ===================== DASHBOARD STATS ===================== */
app.get("/api/dashboard/stats", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (isAdmin) {
      // 🌍 STATS GLOBALES (ADMIN)
      const [txResult, userResult, orgResult] = await Promise.all([
        db.promise().query(
          `
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN (statut LIKE '%signe%' OR statut LIKE '%signé%') THEN 1 ELSE 0 END) as signed
          FROM transactions 
          `,
        ),
        db.promise().query(
          `
          SELECT 
            SUM(total_jetons) as total_jetons,
            COUNT(*) as total_users
          FROM users
          `,
        ),
        db.promise().query(
          `
          SELECT COUNT(*) as total FROM organizations
          `,
        ),
      ]);

      return res.json({
        transactions: txResult[0][0].total || 0,
        signatures: userResult[0][0].total_users || 0, // Dans le grid admin on affiche users
        factures: txResult[0][0].signed || 0, // Dans le grid admin on affiche signées
        totalJetons: userResult[0][0].total_jetons || 0,
        organizations: orgResult[0][0].total || 0,
      });
    }

    // 👤 STATS PERSONNELLES (USER)
    const [txResult, docsResult, userResult] = await Promise.all([
      db.promise().query(
        `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN (statut LIKE '%signe%' OR statut LIKE '%signé%') THEN 1 ELSE 0 END) as signed
        FROM transactions 
        WHERE user_id = ?
      `,
        [userId],
      ),
      db.promise().query(
        `
        SELECT COUNT(*) as total 
        FROM transaction_documents td
        JOIN transactions t ON t.id = td.transaction_id
        WHERE t.user_id = ?
      `,
        [userId],
      ),
      db.promise().query(
        `
        SELECT total_jetons FROM users WHERE id = ?
      `,
        [userId],
      ),
    ]);

    res.json({
      transactions: txResult[0][0].total || 0,
      signatures: txResult[0][0].signed || 0,
      factures: docsResult[0][0].total || 0,
      totalJetons: userResult[0][0].total_jetons || 0,
    });
  } catch (err) {
    console.error("DASHBOARD STATS ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/api/statistiquesUSER", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const normalizeStatus = (value) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    const [
      txTotalResult,
      txByStatusResult,
      docsByStatusResult,
      txByMonthResult,
    ] = await Promise.all([
      // Total transactions
      db
        .promise()
        .query("SELECT COUNT(*) AS total FROM transactions WHERE user_id = ?", [
          userId,
        ]),

      // Transactions par statut
      db.promise().query(
        `
        SELECT statut, COUNT(*) AS total
        FROM transactions
        WHERE user_id = ?
        GROUP BY statut
        `,
        [userId],
      ),

      // Documents (factures) par statut
      db.promise().query(
        `
        SELECT td.statut, COUNT(*) AS total
        FROM transaction_documents td
        JOIN transactions t ON t.id = td.transaction_id
        WHERE t.user_id = ?
        GROUP BY td.statut
        `,
        [userId],
      ),

      // Transactions par mois
      db.promise().query(
        `
        SELECT MONTH(date_creation) AS mois, COUNT(*) AS total
        FROM transactions
        WHERE user_id = ?
        GROUP BY MONTH(date_creation)
        ORDER BY mois
        `,
        [userId],
      ),
    ]);

    const txTotal = txTotalResult[0][0]?.total || 0;
    const txByStatus = txByStatusResult[0];
    const docsByStatus = docsByStatusResult[0];
    const txByMonth = txByMonthResult[0];

    // =============================
    // TRANSACTIONS
    // =============================
    let transactionsCreees = 0;
    let transactionsSignees = 0;
    let transactionsAutres = 0;

    txByStatus.forEach((row) => {
      const status = normalizeStatus(row.statut);
      const total = Number(row.total || 0);

      if (status.includes("cree")) transactionsCreees += total;
      else if (status.includes("sign")) transactionsSignees += total;
      else transactionsAutres += total;
    });

    // =============================
    // DOCUMENTS (FACTURES)
    // =============================
    let facturesCreees = 0;
    let facturesSignees = 0;
    let facturesAutres = 0;

    docsByStatus.forEach((row) => {
      const status = normalizeStatus(row.statut);
      const total = Number(row.total || 0);

      if (status.includes("cree")) facturesCreees += total;
      else if (status.includes("sign")) facturesSignees += total;
      else facturesAutres += total;
    });

    const stats = {
      totalTransactions: txTotal,
      transactionsCreees,
      transactionsSignees,
      transactionsEnAttente: transactionsCreees + transactionsAutres,

      totalFactures: facturesCreees + facturesSignees + facturesAutres,
      facturesCreees,
      facturesSignees,
      facturesEnAttente: facturesCreees + facturesAutres,

      transactionsParMois: txByMonth.map((row) => ({
        mois: "M" + row.mois,
        total: Number(row.total || 0),
      })),
    };

    res.json(stats);
  } catch (err) {
    console.error("STAT USER ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

//*****************STATISTIQUE ADMIN****//////////////////////// */
app.get("/api/statistiqueadmin", verifyToken, async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "admin" && role !== "superadmin")
      return res.status(403).json({ message: "Accès refusé" });

    const normalizeStatus = (value) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    const [
      usersCountResult,
      txRowsResult,
      docsRowsResult,
      txByMonthResult,
      organizationsCountResult,
      utilisateursListeResult,
    ] = await Promise.all([
      // Total users
      db.promise().query("SELECT COUNT(*) AS total FROM users"),

      // Transactions + user
      db.promise().query(`
        SELECT 
          t.id, t.facture_number, t.signataire_email, t.client_email, t.user_id, t.statut, t.date_creation, t.signed_at,
          u.name AS user_name, u.email AS user_email
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        ORDER BY t.date_creation DESC
      `),

      // Documents (Exclure les BLOBs pour éviter de crasher l'app mobile par saturation JSON)
      db.promise().query(`
        SELECT 
          td.id, td.transaction_id, td.filename, td.invoice_number, td.statut, td.created_at, td.signed_at, td.signed_ttn_at,
          t.user_id, u.name AS user_name
        FROM transaction_documents td
        JOIN transactions t ON t.id = td.transaction_id
        JOIN users u ON u.id = t.user_id
        ORDER BY td.created_at DESC
      `),

      // Transactions par mois
      db.promise().query(`
        SELECT MONTH(date_creation) AS mois, COUNT(*) AS total
        FROM transactions
        GROUP BY MONTH(date_creation)
        ORDER BY mois
      `),

      // Total organizations
      db.promise().query("SELECT COUNT(*) AS total FROM organizations"),

      // Liste des utilisateurs (colonnes sûres uniquement)
      db
        .promise()
        .query(
          "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC",
        ),
    ]);

    const usersCount = usersCountResult[0][0]?.total || 0;
    const txRows = txRowsResult[0];
    const docsRows = docsRowsResult[0];
    const txByMonth = txByMonthResult[0];
    const organizationsCount = organizationsCountResult[0][0]?.total || 0;
    const utilisateursListe = utilisateursListeResult[0] || [];

    let transactionsCreees = 0;
    let transactionsSignees = 0;

    txRows.forEach((row) => {
      const status = normalizeStatus(row.statut);
      if (status.includes("cree")) transactionsCreees++;
      else if (status.includes("sign")) transactionsSignees++;
    });

    let facturesCreees = 0;
    let facturesSignees = 0;

    docsRows.forEach((row) => {
      const status = normalizeStatus(row.statut);
      if (status.includes("cree")) facturesCreees++;
      else if (status.includes("sign")) facturesSignees++;
    });

    // Online Users (active in the last 5 minutes) — safe fallback if column missing
    let onlineUsersCount = 0;
    try {
      const [onlineUsersResult] = await db
        .promise()
        .query(
          "SELECT COUNT(*) AS total FROM users WHERE last_activity >= NOW() - INTERVAL 5 MINUTE",
        );
      onlineUsersCount = onlineUsersResult[0]?.total || 0;
    } catch (e) {
      console.warn("⚠️ last_activity column not available:", e.message);
    }

    const stats = {
      utilisateurs: usersCount,
      onlineUsers: onlineUsersCount,
      totalOrganizations: organizationsCount,

      totalTransactions: txRows.length,
      transactionsCreees,
      transactionsSignees,
      transactionsEnAttente:
        transactionsCreees +
        (txRows.length - transactionsCreees - transactionsSignees),

      totalFactures: docsRows.length,
      facturesCreees,
      facturesSignees,
      facturesEnAttente:
        facturesCreees + (docsRows.length - facturesCreees - facturesSignees),

      transactionsParMois: txByMonth.map((row) => ({
        mois: "M" + row.mois,
        total: Number(row.total || 0),
      })),

      transactionsListe: txRows,
      facturesListe: docsRows,
      utilisateursListe: utilisateursListe,
    };

    res.json(stats);
  } catch (err) {
    console.error("STAT ADMIN ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
};
