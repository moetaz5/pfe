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

//* ADMIN : telecharger le fichier zip complet d'une transaction sans check user_id
app.get(
  "/api/admin/transactions/:id/zip",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    const { id } = req.params;

    try {
      const [txRows] = await db
        .promise()
        .query("SELECT * FROM transactions WHERE id = ?", [id]);
      if (!txRows.length)
        return res.status(404).json({ message: "Transaction non trouvée" });

      const [docs] = await db
        .promise()
        .query(`SELECT * FROM transaction_documents WHERE transaction_id = ?`, [
          id,
        ]);

      const zip = new JSZip();

      for (const d of docs) {
        let xmlToUse = d.xml_file;
        if (d.statut === "signée_ttn" && d.xml_signed_ttn)
          xmlToUse = d.xml_signed_ttn;
        else if (
          (d.statut === "signée" || d.statut === "refusée par TTN") &&
          d.xml_signed
        )
          xmlToUse = d.xml_signed;

        zip.file(`${d.filename}.pdf`, Buffer.from(d.pdf_file, "base64"));
        zip.file(`${d.filename}.xml`, Buffer.from(xmlToUse, "base64"));
      }

      const content = await zip.generateAsync({ type: "nodebuffer" });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=transaction_admin_${id}.zip`,
      );
      res.send(content);
    } catch (err) {
      console.error("ADMIN ZIP ERROR:", err);
      res
        .status(500)
        .json({ message: "Erreur lors de la génération du ZIP Admin" });
    }
  },
);

app.post(
  "/api/admin/transactions/:id/resend-ttn",
  verifyToken,
  handleResendTTNCore,
);

/////////////////////////////////////////////////////////////ADMINNNN/////////////////////////////////////µ

// 🚀 ADMIN - RENVOYER À LA TTN
app.post(
  "/api/admin/transactions/:id/resend-ttn",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    const { id } = req.params;

    try {
      const [txRows] = await db
        .promise()
        .query(
          "SELECT id, user_id, statut, client_email, qr_config, ref_config FROM transactions WHERE id = ?",
          [id],
        );

      if (!txRows.length)
        return res.status(404).json({ message: "Transaction introuvable" });

      const transaction = txRows[0];

      const allowed = ["signée", "refusée par TTN"];
      if (!allowed.includes(transaction.statut)) {
        return res.status(400).json({
          message: `Le statut '${transaction.statut}' ne permet pas le renvoi TTN.`,
        });
      }

      const [docs] = await db
        .promise()
        .query(
          "SELECT id, filename, xml_file, pdf_file, xml_signed FROM transaction_documents WHERE transaction_id = ?",
          [id],
        );

      if (!docs.length)
        return res.status(404).json({ message: "Documents introuvables" });

      const signedDocs = docs.map((d) => ({
        id: d.id,
        filename: d.filename,
        pdf_file: d.pdf_file,
        xml_signed: d.xml_signed,
      }));

      await db
        .promise()
        .query(
          "UPDATE transactions SET statut='Renvoi TTN en cours...' WHERE id=?",
          [id],
        );

      res.json({
        message: "Processus de renvoi TTN lancé par l'administrateur.",
      });

      processTTNSubmission(
        id,
        signedDocs,
        transaction.user_id,
        transaction.client_email,
        transaction.qr_config,
        transaction.ref_config,
      ).catch((e) => console.error("ADMIN RESEND TTN BG ERROR:", e));
    } catch (err) {
      console.error("ADMIN RESEND TTN ERROR:", err);
      res
        .status(500)
        .json({ message: "Erreur serveur lors du renvoi TTN Admin" });
    }
  },
);

/* ===================== ADMIN - LIST USERS (filters) ===================== */
app.get("/api/admin/users", verifyToken, verifyRole(["ADMIN"]), (req, res) => {
  const { name = "", email = "", phone = "" } = req.query;

  const sql = `
    SELECT id, name, email, role, phone, address, is_verified, statut
    FROM users
    WHERE (? = '' OR name LIKE ?)
      AND (? = '' OR email LIKE ?)
      AND (? = '' OR phone LIKE ?)
    ORDER BY id DESC
  `;

  const params = [name, `%${name}%`, email, `%${email}%`, phone, `%${phone}%`];

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("ADMIN USERS ERROR:", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
    res.json(results || []);
  });
});

/* ===================== ADMIN - UPDATE ROLE ===================== */
app.put(
  "/api/admin/users/:id/role",
  verifyToken,
  verifyRole(["ADMIN"]),
  (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!["USER", "ADMIN"].includes(role)) {
      return res.status(400).json({ message: "Rôle invalide" });
    }

    db.query("UPDATE users SET role = ? WHERE id = ?", [role, id], (err) => {
      if (err) {
        console.error("UPDATE ROLE ERROR:", err);
        return res.status(500).json({ message: "Erreur serveur" });
      }
      res.json({ message: "Rôle mis à jour" });
    });
  },
);

/* ===================== ADMIN - TOGGLE ACTIVE/DISABLED ===================== */
app.put(
  "/api/admin/users/:id/status",
  verifyToken,
  verifyRole(["ADMIN"]),
  (req, res) => {
    const { id } = req.params;
    const { statut } = req.body; // 1 ou 0

    db.query(
      "UPDATE users SET statut = ? WHERE id = ?",
      [statut ? 1 : 0, id],
      (err) => {
        if (err) {
          console.error("STATUS UPDATE ERROR:", err);
          return res.status(500).json({ message: "Erreur serveur" });
        }
        res.json({ message: "Statut compte mis à jour" });
      },
    );
  },
);

/* ===================== ADMIN - UPDATE USER INFO ===================== */
app.put(
  "/api/admin/users/:id",
  verifyToken,
  verifyRole(["ADMIN"]),
  (req, res) => {
    const { id } = req.params;
    const { name, phone, address } = req.body;

    if (!name) return res.status(400).json({ message: "Nom obligatoire" });

    db.query(
      "UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?",
      [name, phone || null, address || null, id],
      (err) => {
        if (err) {
          console.error("ADMIN UPDATE USER ERROR:", err);
          return res.status(500).json({ message: "Erreur serveur" });
        }
        res.json({ message: "Utilisateur mis à jour" });
      },
    );
  },
);

/* ===================== ADMIN - CHANGE USER PASSWORD ===================== */
app.put(
  "/api/admin/users/:id/password",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        return res
          .status(400)
          .json({ message: "Mot de passe min 8 caractères" });
      }

      const hashed = await bcrypt.hash(newPassword, 10);

      db.query(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashed, id],
        (err) => {
          if (err) {
            console.error("ADMIN PASSWORD ERROR:", err);
            return res.status(500).json({ message: "Erreur serveur" });
          }
          res.json({ message: "Mot de passe modifié" });
        },
      );
    } catch (e) {
      console.error("ADMIN PASSWORD SERVER ERROR:", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - DELETE USER ===================== */
app.delete(
  "/api/admin/users/:id",
  verifyToken,
  verifyRole(["ADMIN"]),
  (req, res) => {
    const { id } = req.params;

    db.query("DELETE FROM users WHERE id = ?", [id], (err) => {
      if (err) {
        console.error("DELETE USER ERROR:", err);
        return res.status(500).json({ message: "Erreur serveur" });
      }
      res.json({ message: "Utilisateur supprimé" });
    });
  },
);

/* ===================== ADMIN - LIST ALL TRANSACTIONS ===================== */
app.get(
  "/api/admin/transactions/all",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(`
        SELECT t.*, u.name as user_name, u.email as user_email
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        ORDER BY t.date_creation DESC
      `);
      res.json(rows);
    } catch (err) {
      console.error("ADMIN GET ALL TX ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - LIST ALL INVOICES ===================== */
app.get(
  "/api/admin/invoices/all",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(`
        SELECT td.*, u.name as user_name, u.email as user_email, t.facture_number as tx_number
        FROM transaction_documents td
        JOIN transactions t ON t.id = td.transaction_id
        JOIN users u ON u.id = t.user_id
        ORDER BY td.created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      console.error("ADMIN GET ALL INVOICES ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - LIST ALL ORGANIZATIONS ===================== */
app.get(
  "/api/admin/organizations/all",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(`
        SELECT o.*, u.name as owner_name, u.email as owner_email,
               (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id) as members_count
        FROM organizations o
        JOIN users u ON u.id = o.owner_id
        ORDER BY o.created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      console.error("ADMIN GET ALL ORGS ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - GET ORGANIZATION MEMBERS ===================== */
app.get(
  "/api/admin/organizations/:id/members",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [members] = await db
        .promise()
        .query(
          "SELECT om.role, u.id, u.name, u.email FROM organization_members om JOIN users u ON u.id = om.user_id WHERE om.organization_id = ?",
          [id],
        );
      res.json(members);
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - GET ORGANIZATION TRANSACTIONS ===================== */
app.get(
  "/api/admin/organizations/:id/transactions",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [txs] = await db.promise().query(
        `SELECT t.*, u.name as user_name 
         FROM transactions t 
         JOIN users u ON u.id = t.user_id 
         JOIN organization_members om ON om.user_id = t.user_id 
         WHERE om.organization_id = ? 
         ORDER BY t.date_creation DESC`,
        [id],
      );
      res.json(txs);
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - UPDATE TRANSACTION STATUS ===================== */
app.put(
  "/api/admin/transactions/:id/status",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { statut } = req.body;
      await db
        .promise()
        .query("UPDATE transactions SET statut = ? WHERE id = ?", [statut, id]);
      res.json({ message: "Statut transaction mis à jour" });
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - GET TRANSACTION DOCUMENTS ===================== */
app.get(
  "/api/admin/transactions/:id/documents",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [docs] = await db
        .promise()
        .query(
          "SELECT id, filename, statut, invoice_number, signed_at, created_at FROM transaction_documents WHERE transaction_id = ?",
          [id],
        );
      res.json(docs);
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - DELETE ORGANIZATION ===================== */
app.delete(
  "/api/admin/organizations/:id",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      await db.promise().query("DELETE FROM organizations WHERE id = ?", [id]);
      res.json({ message: "Organisation supprimée" });
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== JETON - LISTE ADMIN ===================== */
app.get("/api/admin/jeton", verifyToken, verifyRole(["ADMIN"]), (req, res) => {
  const status = String(req.query.status || "")
    .toLowerCase()
    .trim();
  const hasFilter = [
    "payment_pending",
    "payment_submitted",
    "pending",
    "approved",
    "rejected",
  ].includes(status);

  const sql = `
      SELECT
        tr.id,
        tr.user_id,
        tr.pack_name,
        tr.tokens,
        tr.price_tnd,
        tr.contact_info,
        tr.request_source,
        tr.status,
        tr.admin_note,
        tr.created_at,
        tr.payment_uploaded_at,
        tr.decided_at,
        tr.decided_by,
        tr.payment_proof_name,
        tr.payment_proof_mime,
        CASE WHEN tr.payment_proof IS NULL THEN 0 ELSE 1 END AS has_payment_proof,
        u.name AS user_name,
        u.email AS user_email
      FROM jeton tr
      JOIN users u ON u.id = tr.user_id
      ${hasFilter ? "WHERE tr.status = ?" : ""}
      ORDER BY tr.created_at DESC
    `;

  const params = hasFilter ? [status] : [];
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("TOKEN REQUEST ADMIN LIST ERROR:", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }

    res.json(results || []);
  });
});

/* ===================== JETON - TELECHARGER PREUVE ADMIN ===================== */
app.get(
  "/api/admin/jeton/:id/proof",
  verifyToken,
  verifyRole(["ADMIN"]),
  (req, res) => {
    const { id } = req.params;

    const sql = `
      SELECT payment_proof, payment_proof_mime, payment_proof_name
      FROM jeton
      WHERE id = ?
    `;

    db.query(sql, [id], (err, results) => {
      if (err || !results.length) {
        return res.status(404).json({ message: "Preuve introuvable" });
      }

      const row = results[0];
      if (!row.payment_proof) {
        return res.status(404).json({ message: "Preuve introuvable" });
      }

      const contentType = row.payment_proof_mime || "application/octet-stream";
      const filename = row.payment_proof_name || `preuve_${id}`;
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.send(row.payment_proof);
    });
  },
);

/* ===================== JETON - DECISION ADMIN ===================== */
app.put(
  "/api/admin/jeton/:id/decision",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    const { id } = req.params;
    const { decision, admin_note } = req.body;

    const nextStatus = String(decision || "")
      .toLowerCase()
      .trim();

    if (!["payment_pending", "approved", "rejected"].includes(nextStatus)) {
      return res.status(400).json({ message: "Decision invalide" });
    }

    try {
      const [rows] = await db.promise().query(
        `
        SELECT tr.*, u.email AS user_email
        FROM jeton tr
        JOIN users u ON u.id = tr.user_id
        WHERE tr.id = ?
        `,
        [id],
      );

      if (!rows.length) {
        return res.status(404).json({ message: "Demande introuvable" });
      }

      const tokenRequest = rows[0];

      await db.promise().query(
        `
        UPDATE jeton
        SET status = ?, admin_note = ?, decided_by = ?, decided_at = NOW()
        WHERE id = ?
        `,
        [nextStatus, admin_note || null, req.user.id, id],
      );

      // 🔔 Notification pour l'Utilisateur
      let notificationTitle = "";
      let notificationMessage = "";
      let notificationType = "info";

      if (nextStatus === "payment_pending") {
        notificationTitle = "Paiement requis";
        notificationMessage = `Votre demande de jetons #${id} a été validée. Veuillez envoyer la preuve de paiement.`;
        notificationType = "warning";
      } else if (nextStatus === "approved") {
        notificationTitle = "Demande approuvée";
        notificationMessage = `Votre demande #${id} a été approuvée. ${tokenRequest.tokens} jetons ont été ajoutés.`;
        notificationType = "success";
      } else if (nextStatus === "rejected") {
        notificationTitle = "Demande refusée";
        notificationMessage = `Votre demande #${id} a été refusée.`;
        notificationType = "error";
      }

      if (notificationTitle) {
        await createNotification(
          tokenRequest.user_id,
          notificationTitle,
          notificationMessage,
          notificationType,
        );
      }

      /* ================= EMAIL ENVOI ================= */

      if (nextStatus === "payment_pending") {
        await sendTokenRequestPaymentPendingEmail({
          toEmail: tokenRequest.user_email,
          packName: tokenRequest.pack_name,
          tokens: tokenRequest.tokens,
          priceTnd: tokenRequest.price_tnd,
          adminNote: admin_note,
        });
      }

      if (nextStatus === "approved") {
        // 🔥 Ajouter jetons
        await db.promise().query(
          `
          UPDATE users
          SET total_jetons = total_jetons + ?
          WHERE id = ?
          `,
          [tokenRequest.tokens, tokenRequest.user_id],
        );
        await createNotification(
          tokenRequest.user_id,
          "Jetons approuvés",
          `${tokenRequest.tokens} jetons ont été ajoutés à votre compte`,
          "success",
        );
        await sendTokenRequestDecisionEmail({
          toEmail: tokenRequest.user_email,
          packName: tokenRequest.pack_name,
          tokens: tokenRequest.tokens,
          priceTnd: tokenRequest.price_tnd,
          decision: "approved",
          adminNote: admin_note,
        });
      }

      if (nextStatus === "rejected") {
        await createNotification(
          tokenRequest.user_id,
          "Demande rejetée",
          "Votre demande de jetons a été refusée",
          "error",
        );
        await sendTokenRequestDecisionEmail({
          toEmail: tokenRequest.user_email,
          packName: tokenRequest.pack_name,
          tokens: tokenRequest.tokens,
          priceTnd: tokenRequest.price_tnd,
          decision: "rejected",
          adminNote: admin_note,
        });
      }

      res.json({
        message: "Decision enregistrée + email envoyé",
      });
    } catch (err) {
      console.error("TOKEN DECISION ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN ROUTES API ===================== */
app.get("/api/admin/routes", verifyToken, verifyRole(["ADMIN"]), (req, res) => {
  db.query("SELECT * FROM api_routes ORDER BY path ASC", (err, results) => {
    if (err) {
      console.error("DB ROUTE ERROR:", err);
      return res
        .status(500)
        .json({ error: "Erreur lors de la lecture des routes depuis la base" });
    }

    const grouped = {};
    results.forEach((r) => {
      if (!grouped[r.path]) grouped[r.path] = { methods: [], role: r.role };
      grouped[r.path].methods.push(r.method);
    });

    const routes = Object.keys(grouped).map((path) => ({
      path,
      methods: grouped[path].methods,
      role: grouped[path].role,
    }));

    res.status(200).json({ routes });
  });
});
};
