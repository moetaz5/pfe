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

/* ===================== NOTIFICATIONS ROUTES ===================== */
app.get("/api/notifications", verifyToken, async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
        [req.user.id],
      );
    res.json(rows);
  } catch (err) {
    console.error("GET NOTIFS ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.put("/api/notifications/:id/read", verifyToken, async (req, res) => {
  try {
    await db
      .promise()
      .query(
        "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
        [req.params.id, req.user.id],
      );
    res.json({ message: "Succès" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.put("/api/notifications/read-all", verifyToken, async (req, res) => {
  try {
    await db
      .promise()
      .query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [
        req.user.id,
      ]);
    res.json({ message: "Succès" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.delete("/api/notifications/:id", verifyToken, async (req, res) => {
  try {
    await db
      .promise()
      .query("DELETE FROM notifications WHERE id = ? AND user_id = ?", [
        req.params.id,
        req.user.id,
      ]);
    res.json({ message: "Succès" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ===================== NOTIFICATIONS ===================== */
// Récupérer les notifications de l'utilisateur
app.get("/api/notifications", verifyToken, async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
        [req.user.id],
      );
    res.json(rows);
  } catch (err) {
    console.error("GET NOTIFICATIONS ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Marquer une notification comme lue
app.put("/api/notifications/:id/read", verifyToken, async (req, res) => {
  try {
    await db
      .promise()
      .query(
        `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id],
      );
    res.json({ message: "Notification marquée comme lue" });
  } catch (err) {
    console.error("READ NOTIFICATION ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Marquer toutes les notifications comme lues
app.put("/api/notifications/read-all", verifyToken, async (req, res) => {
  try {
    await db
      .promise()
      .query(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [
        req.user.id,
      ]);
    res.json({ message: "Toutes les notifications marquées comme lues" });
  } catch (err) {
    console.error("READ ALL NOTIFICATIONS ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Supprimer une notification
app.delete("/api/notifications/:id", verifyToken, async (req, res) => {
  try {
    await db
      .promise()
      .query(`DELETE FROM notifications WHERE id = ? AND user_id = ?`, [
        req.params.id,
        req.user.id,
      ]);
    res.json({ message: "Notification supprimée" });
  } catch (err) {
    console.error("DELETE NOTIFICATION ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*=============notification=============*/
app.get("/api/notifications", verifyToken, async (req, res) => {
  const [rows] = await db.promise().query(
    `
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
    `,
    [req.user.id],
  );

  res.json(rows);
});

app.put("/api/notifications/:id/read", verifyToken, async (req, res) => {
  await db.promise().query(
    `
    UPDATE notifications
    SET is_read = 1
    WHERE id = ? AND user_id = ?
    `,
    [req.params.id, req.user.id],
  );

  res.json({ success: true });
});

/* ===================== FCM / PUSH NOTIFICATIONS ===================== */

/// Enregistre le token FCM mobile auprès du serveur
app.post("/api/notifications/register-fcm", verifyToken, async (req, res) => {
  try {
    const { fcm_token, device_name } = req.body;

    if (!fcm_token) {
      return res.status(400).json({ message: "Token FCM requis" });
    }

    // Ajouter colonne fcm_token à la table users si elle n'existe pas
    db.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(500)`,
      (err) => {
        if (err && !err.message.includes("exists")) {
          console.error("FCM Column error:", err);
        }
      },
    );

    // Sauvegarder le token FCM
    await db
      .promise()
      .query(`UPDATE users SET fcm_token = ? WHERE id = ?`, [
        fcm_token,
        req.user.id,
      ]);

    debugPrint(`✅ Token FCM enregistré pour utilisateur ${req.user.id}`);

    return res.json({
      message: "Token FCM enregistré avec succès",
      device_name,
    });
  } catch (err) {
    console.error("REGISTER FCM ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur FCM" });
  }
});

/// Envoie une notification de test
app.post("/api/notifications/test", verifyToken, async (req, res) => {
  try {
    const testNotification = {
      title: "Notification de test",
      message: "🎉 Les notifications fonctionnent correctement !",
      type: "success",
    };

    // Créer une notification test
    await createNotification(
      req.user.id,
      testNotification.title,
      testNotification.message,
      testNotification.type,
    );

    return res.json({
      message: "Notification de test envoyée",
      notification: testNotification,
    });
  } catch (err) {
    console.error("TEST NOTIFICATION ERROR:", err);
    return res
      .status(500)
      .json({ message: "Erreur lors de l'envoi de notification" });
  }
});

/// Met à jour les préférences de notifications
app.put("/api/notifications/preferences", verifyToken, async (req, res) => {
  try {
    const preferences = req.body; // { email: true, push: true, sms: false }

    // Ajouter colonne notification_preferences si elle n'existe pas
    db.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSON`,
      (err) => {
        if (err && !err.message.includes("exists")) {
          console.error("Prefs Column error:", err);
        }
      },
    );

    // Sauvegarder les préférences
    await db
      .promise()
      .query(`UPDATE users SET notification_preferences = ? WHERE id = ?`, [
        JSON.stringify(preferences),
        req.user.id,
      ]);

    return res.json({
      message: "Préférences de notification mises à jour",
      preferences,
    });
  } catch (err) {
    console.error("UPDATE PREFERENCES ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});
};
