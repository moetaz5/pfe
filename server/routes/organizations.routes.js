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

///////*=========ORGANIZATION++++++++++++++*/
app.post("/api/organizations", verifyToken, async (req, res) => {
  try {
    const {
      name,
      matricule_fiscale,
      adresse,
      ville,
      code_postal,
      telephone,
      email,
      fax,
      invitedUsers = [],
    } = req.body;

    // ================= VALIDATION =================
    if (
      !name ||
      !matricule_fiscale ||
      !adresse ||
      !ville ||
      !code_postal ||
      !telephone
    ) {
      return res.status(400).json({
        message: "Champs obligatoires manquants",
      });
    }

    // ================= CHECK SI USER DEJA MEMBRE =================
    const [alreadyMember] = await db
      .promise()
      .query(
        `SELECT organization_id FROM organization_members WHERE user_id = ?`,
        [req.user.id],
      );

    if (alreadyMember.length) {
      return res.status(409).json({
        message: "Vous êtes déjà membre d'une organisation",
      });
    }

    // ================= CREATION ORGANISATION =================
    const [orgResult] = await db.promise().query(
      `
      INSERT INTO organizations
      (name, matricule_fiscale, adresse, ville, code_postal, telephone, email, fax, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name,
        matricule_fiscale,
        adresse,
        ville,
        code_postal,
        telephone,
        email || null,
        fax || null,
        req.user.id,
      ],
    );

    const organizationId = orgResult.insertId;

    // ================= AJOUT OWNER =================
    await db.promise().query(
      `
      INSERT INTO organization_members
      (organization_id, user_id, role)
      VALUES (?, ?, 'OWNER')
      `,
      [organizationId, req.user.id],
    );

    // ================= INVITATIONS =================
    const added = [];
    const rejected = [];

    for (const userEmail of invitedUsers) {
      const [users] = await db
        .promise()
        .query("SELECT id FROM users WHERE email = ?", [userEmail]);

      if (!users.length) {
        rejected.push(`${userEmail} : utilisateur introuvable`);
        continue;
      }

      const userId = users[0].id;

      const [existingMembership] = await db
        .promise()
        .query(
          `SELECT organization_id FROM organization_members WHERE user_id = ?`,
          [userId],
        );

      if (existingMembership.length) {
        rejected.push(`${userEmail} : déjà membre d'une organisation`);
        continue;
      }

      await db.promise().query(
        `
        INSERT INTO organization_members
        (organization_id, user_id, role)
        VALUES (?, ?, 'MEMBER')
        `,
        [organizationId, userId],
      );

      // 🔥 NOTIFICATION CORRIGÉE
      await createNotification(
        userId,
        "Nouvelle organisation",
        `Vous avez été ajouté à l'organisation "${name}"`,
        "info",
      );

      added.push(userEmail);
    }

    res.status(201).json({
      message: "Organisation créée avec succès",
      organizationId,
      added,
      rejected,
    });
  } catch (err) {
    console.error("CREATE ORGANIZATION ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ===================== DELETE ORGANIZATION (OWNER ONLY) ===================== */
app.delete("/api/organizations/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 🔐 Vérifier que l'utilisateur est OWNER
    const [check] = await db.promise().query(
      `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
      [id, req.user.id],
    );

    if (!check.length || check[0].role !== "OWNER") {
      return res.status(403).json({
        message: "Seul le OWNER peut supprimer l'organisation",
      });
    }

    // 🧹 Supprimer membres
    await db
      .promise()
      .query(`DELETE FROM organization_members WHERE organization_id = ?`, [
        id,
      ]);

    // 🧹 Supprimer invitations
    await db
      .promise()
      .query(`DELETE FROM organization_invitations WHERE organization_id = ?`, [
        id,
      ]);

    // 🗑 Supprimer organisation
    await db.promise().query(`DELETE FROM organizations WHERE id = ?`, [id]);

    res.json({ message: "Organisation supprimée avec succès" });
  } catch (err) {
    console.error("DELETE ORG ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ===================== LEAVE ORGANIZATION (MEMBER) ===================== */
app.delete("/api/organizations/:id/leave", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [check] = await db.promise().query(
      `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
      [id, req.user.id],
    );

    if (!check.length) {
      return res.status(404).json({
        message: "Vous n'êtes pas membre de cette organisation",
      });
    }

    // ❌ OWNER ne peut pas quitter (il doit supprimer l'organisation)
    if (check[0].role === "OWNER") {
      return res.status(403).json({
        message:
          "Le OWNER ne peut pas quitter. Supprimez l'organisation si nécessaire.",
      });
    }

    // ✅ Supprimer membre
    await db.promise().query(
      `
      DELETE FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
      [id, req.user.id],
    );

    res.json({ message: "Vous avez quitté l'organisation" });
  } catch (err) {
    console.error("LEAVE ORG ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*========================lister les organization============*/ app.get(
  "/api/organizations/mine",
  verifyToken,
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(
        `
      SELECT o.*
      FROM organizations o
      JOIN organization_members om ON om.organization_id = o.id
      WHERE om.user_id = ?
      ORDER BY o.id DESC
      `,
        [req.user.id],
      );

      res.json(rows);
    } catch (err) {
      console.error("LIST ORGANIZATIONS ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/*========================Détails organisation + membres ==================*/
app.get("/api/organizations/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [memberCheck] = await db.promise().query(
      `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
      [id, req.user.id],
    );

    if (!memberCheck.length) {
      return res
        .status(403)
        .json({ message: "Vous n'êtes pas membre de cette organisation" });
    }

    const [orgRows] = await db
      .promise()
      .query("SELECT * FROM organizations WHERE id = ?", [id]);

    const [members] = await db.promise().query(
      `
      SELECT u.id, u.name, u.email, om.role
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = ?
      `,
      [id],
    );

    res.json({
      organization: orgRows[0],
      members,
      myRole: memberCheck[0].role,
    });
  } catch (err) {
    console.error("ORG DETAIL ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*=======================modifier une organisation============*/
app.put("/api/organizations/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [check] = await db.promise().query(
      `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
      [id, req.user.id],
    );

    if (!check.length || check[0].role !== "OWNER") {
      return res
        .status(403)
        .json({ message: "Seul le propriétaire peut modifier" });
    }

    await db.promise().query(
      `
      UPDATE organizations
      SET name=?, matricule_fiscale=?, adresse=?, ville=?,
          code_postal=?, telephone=?, email=?, fax=?
      WHERE id=?
      `,
      [
        req.body.name,
        req.body.matricule_fiscale,
        req.body.adresse,
        req.body.ville,
        req.body.code_postal,
        req.body.telephone,
        req.body.email || null,
        req.body.fax || null,
        id,
      ],
    );

    res.json({ message: "Organisation mise à jour" });
  } catch (err) {
    console.error("UPDATE ORG ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*====================ajouter un memebre a une organization=============*/
app.post("/api/organizations/:id/add-member", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }

    // 🔐 Vérifier que l'utilisateur actuel est OWNER
    const [check] = await db.promise().query(
      `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
      [id, req.user.id],
    );

    if (!check.length || check[0].role !== "OWNER") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    // 🔎 Vérifier si user existe
    const [userRows] = await db
      .promise()
      .query("SELECT id FROM users WHERE email = ?", [email]);

    if (!userRows.length) {
      return res.status(404).json({
        message: `❌ ${email} : utilisateur introuvable`,
      });
    }

    const userId = userRows[0].id;

    // 🔥 Vérifier si déjà membre d'une organisation
    const [existingMembership] = await db.promise().query(
      `
      SELECT organization_id FROM organization_members
      WHERE user_id = ?
      `,
      [userId],
    );

    if (existingMembership.length) {
      return res.status(409).json({
        message: `⚠ ${email} est déjà membre d'une autre organisation`,
      });
    }

    // ✅ Ajouter membre
    await db.promise().query(
      `
      INSERT INTO organization_members
      (organization_id, user_id, role)
      VALUES (?, ?, 'MEMBER')
      `,
      [id, userId],
    );

    res.json({
      message: `${email} ajouté avec succès`,
    });
  } catch (err) {
    console.error("ADD MEMBER ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.post("/api/organizations/:id/invite", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email requis" });

    // 🔐 Vérifier OWNER
    const [check] = await db.promise().query(
      `SELECT role FROM organization_members 
       WHERE organization_id = ? AND user_id = ?`,
      [id, req.user.id],
    );

    if (!check.length || check[0].role !== "OWNER")
      return res.status(403).json({ message: "Accès refusé" });

    // 🔎 Vérifier utilisateur existe
    const [users] = await db
      .promise()
      .query("SELECT id FROM users WHERE email = ?", [email]);

    if (!users.length)
      return res.status(404).json({ message: "Utilisateur introuvable" });

    const invitedUserId = users[0].id;

    // 🔥 Vérifier pas déjà membre
    const [existingMember] = await db
      .promise()
      .query(`SELECT id FROM organization_members WHERE user_id = ?`, [
        invitedUserId,
      ]);

    if (existingMember.length)
      return res
        .status(409)
        .json({ message: "Déjà membre d'une organisation" });

    // 🔥 Vérifier pas déjà invité
    const [existingInvite] = await db.promise().query(
      `SELECT id FROM organization_invitations
       WHERE organization_id = ? AND invited_user_id = ? AND status='pending'`,
      [id, invitedUserId],
    );

    if (existingInvite.length)
      return res.status(409).json({ message: "Invitation déjà envoyée" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    await db.promise().query(
      `
      INSERT INTO organization_invitations
      (organization_id, invited_user_id, invited_email, token, expires_at)
      VALUES (?, ?, ?, ?, ?)
      `,
      [id, invitedUserId, email, token, expiresAt],
    );

    const inviteLink = `https://medicasign.medicacom.tn/organization/invite/${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Invitation organisation",
      html: `
        <h2>Invitation à rejoindre une organisation</h2>
        <p>Vous avez été invité à rejoindre une organisation.</p>

        <a href="${inviteLink}"
           style="padding:12px 20px;background:#0247AA;color:#fff;text-decoration:none;border-radius:6px;">
           Accepter l'invitation
        </a>

        <p>Ce lien expire dans 48 heures.</p>
      `,
    });

    res.json({ message: "Invitation envoyée par email" });
  } catch (err) {
    console.error("INVITE ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/api/organizations/invite/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const [rows] = await db.promise().query(
      `
      SELECT oi.*, o.name AS organization_name
      FROM organization_invitations oi
      JOIN organizations o ON o.id = oi.organization_id
      WHERE oi.token = ? AND oi.status='pending'
      `,
      [token],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Invitation invalide" });

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.post("/api/organizations/invite/:token/accept", async (req, res) => {
  try {
    const { token } = req.params;

    const [rows] = await db.promise().query(
      `
      SELECT *
      FROM organization_invitations
      WHERE token = ? AND status='pending'
      `,
      [token],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Invitation invalide" });

    const invite = rows[0];

    // 🔥 Vérifier expiration
    if (new Date(invite.expires_at) < new Date()) {
      await db
        .promise()
        .query(
          `UPDATE organization_invitations SET status='expired' WHERE id=?`,
          [invite.id],
        );
      return res.status(410).json({ message: "Invitation expirée" });
    }

    // 🔥 Vérifier que l'utilisateur existe
    const [userRows] = await db
      .promise()
      .query(`SELECT id FROM users WHERE id=?`, [invite.invited_user_id]);

    if (!userRows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const userId = invite.invited_user_id;

    // 🔥 Vérifier pas déjà membre
    const [alreadyMember] = await db
      .promise()
      .query(`SELECT id FROM organization_members WHERE user_id=?`, [userId]);

    if (alreadyMember.length) {
      return res.status(409).json({
        message: "Déjà membre d'une organisation",
      });
    }

    // ✅ Ajouter membre
    await db.promise().query(
      `
      INSERT INTO organization_members (organization_id, user_id, role)
      VALUES (?, ?, 'MEMBER')
      `,
      [invite.organization_id, userId],
    );

    // ✅ Marquer invitation acceptée
    await db.promise().query(
      `
      UPDATE organization_invitations
      SET status='accepted', accepted_at=NOW()
      WHERE id=?
      `,
      [invite.id],
    );

    res.json({ message: "Invitation acceptée avec succès" });
  } catch (err) {
    console.error("ACCEPT ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get(
  "/api/organizations/invitations/mine",
  verifyToken,
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(
        `
      SELECT oi.*, o.name AS organization_name
      FROM organization_invitations oi
      JOIN organizations o ON o.id = oi.organization_id
      WHERE oi.invited_user_id = ? AND oi.status='pending'
      ORDER BY oi.created_at DESC
      `,
        [req.user.id],
      );

      res.json(rows);
    } catch (err) {
      console.error("LIST INVITE ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

app.post("/api/organizations/invite/:token/reject", async (req, res) => {
  try {
    const { token } = req.params;

    const [rows] = await db.promise().query(
      `SELECT id FROM organization_invitations
       WHERE token=? AND status='pending'`,
      [token],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Invitation invalide" });

    await db.promise().query(
      `UPDATE organization_invitations
       SET status='rejected'
       WHERE token=?`,
      [token],
    );

    res.json({ message: "Invitation refusée" });
  } catch (err) {
    console.error("REJECT ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*=========Supprimer un membre========*/
app.delete(
  "/api/organizations/:id/member/:userId",
  verifyToken,
  async (req, res) => {
    try {
      const { id, userId } = req.params;

      const [check] = await db.promise().query(
        `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
        [id, req.user.id],
      );

      if (!check.length || check[0].role !== "OWNER") {
        return res.status(403).json({ message: "Accès refusé" });
      }

      await db.promise().query(
        `
      DELETE FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
        [id, userId],
      );

      res.json({ message: "Membre supprimé" });
    } catch (err) {
      console.error("REMOVE MEMBER ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ORGANIZATION - LIST TRANSACTIONS ===================== */
app.get(
  "/api/organizations/:id/transactions",
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Vérifier membership
      const [memberCheck] = await db.promise().query(
        `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
        [id, req.user.id],
      );

      if (!memberCheck.length) {
        // 🔥 IMPORTANT → renvoyer tableau vide au lieu d'objet
        return res.json([]);
      }

      const [rows] = await db.promise().query(
        `
      SELECT 
        t.id,
        t.facture_number,
        t.statut,
        t.date_creation,
        u.name AS user_name
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      JOIN organization_members om ON om.user_id = t.user_id
      WHERE om.organization_id = ?
      ORDER BY t.date_creation DESC
      `,
        [id],
      );

      // 🔥 Toujours tableau
      return res.json(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("ORG TX ERROR:", err);
      // 🔥 Toujours tableau même en erreur
      return res.json([]);
    }
  },
);
};
