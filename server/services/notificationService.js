const db = require("../db");

/*notification*/
const createNotification = async (userId, title, message, type = "info") => {
  try {
    await db.promise().query(
      `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
      `,
      [userId, title, message, type],
    );
  } catch (err) {
    console.error("NOTIFICATION ERROR:", err);
  }
};

const notifyAdmins = async (title, message, type = "info") => {
  try {
    const [admins] = await db
      .promise()
      .query("SELECT id FROM users WHERE role = 'ADMIN'");
    for (const admin of admins) {
      await createNotification(admin.id, title, message, type);
    }
  } catch (err) {
    console.error("NOTIFY ADMINS ERROR:", err);
  }
};

module.exports = {
  createNotification,
  notifyAdmins
};
