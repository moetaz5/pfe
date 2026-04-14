const db = require("../db");
const { createNotification } = require("../services/notificationService");
const { debugPrint } = require("../utils/helpers");

/**
 * List user notifications
 */
const listNotifications = async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Mark a notification as read
 */
const markAsRead = async (req, res) => {
  try {
    await db.promise().query(
      `
      UPDATE notifications 
      SET is_read = 1 
      WHERE id = ? AND user_id = ?
      `,
      [req.params.id, req.user.id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Register FCM token
 */
const registerFcm = async (req, res) => {
  try {
    const { fcm_token, device_name } = req.body;

    if (!fcm_token) {
      return res.status(400).json({ message: "Token FCM requis" });
    }

    // Ensure column exists (self-healing)
    db.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(500)`,
      (err) => {
        if (err && !err.message.includes("exists")) {
          console.error("FCM Column error:", err);
        }
      },
    );

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
};

/**
 * Send a test notification
 */
const sendTestNotification = async (req, res) => {
  try {
    const testNotification = {
      title: "Notification de test",
      message: "🎉 Les notifications fonctionnent correctement !",
      type: "success",
    };

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
};

/**
 * Update notification preferences
 */
const updatePreferences = async (req, res) => {
  try {
    const preferences = req.body;

    // Ensure column exists
    db.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSON`,
      (err) => {
        if (err && !err.message.includes("exists")) {
          console.error("Prefs Column error:", err);
        }
      },
    );

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
};

module.exports = {
  listNotifications,
  markAsRead,
  registerFcm,
  sendTestNotification,
  updatePreferences,
};
