const crypto = require("crypto");
const db = require("../db");
const { createNotification } = require("../services/notificationService");
const { sendOrganizationInviteEmail } = require("../services/emailService");

/**
 * Create an organization
 */
const createOrganization = async (req, res) => {
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

    if (!name || !matricule_fiscale || !adresse || !ville || !code_postal || !telephone) {
      return res.status(400).json({ message: "Champs obligatoires manquants" });
    }

    const [alreadyMember] = await db
      .promise()
      .query(`SELECT organization_id FROM organization_members WHERE user_id = ?`, [req.user.id]);

    if (alreadyMember.length) {
      return res.status(409).json({ message: "Vous êtes déjà membre d'une organisation" });
    }

    const [orgResult] = await db.promise().query(
      `INSERT INTO organizations 
       (name, matricule_fiscale, adresse, ville, code_postal, telephone, email, fax, owner_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, matricule_fiscale, adresse, ville, code_postal, telephone, email || null, fax || null, req.user.id],
    );

    const organizationId = orgResult.insertId;

    await db.promise().query(
      `INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, 'OWNER')`,
      [organizationId, req.user.id],
    );

    const added = [];
    const rejected = [];

    for (const userEmail of invitedUsers) {
      const [users] = await db.promise().query("SELECT id FROM users WHERE email = ?", [userEmail]);
      if (!users.length) {
        rejected.push(`${userEmail} : utilisateur introuvable`);
        continue;
      }

      const userId = users[0].id;
      const [existingMembership] = await db.promise().query(
        `SELECT organization_id FROM organization_members WHERE user_id = ?`,
        [userId],
      );

      if (existingMembership.length) {
        rejected.push(`${userEmail} : déjà membre d'une organisation`);
        continue;
      }

      await db.promise().query(
        `INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, 'MEMBER')`,
        [organizationId, userId],
      );

      await createNotification(userId, "Nouvelle organisation", `Vous avez été ajouté à l'organisation "${name}"`, "info");
      added.push(userEmail);
    }

    res.status(201).json({ message: "Organisation créée avec succès", organizationId, added, rejected });
  } catch (err) {
    console.error("CREATE ORGANIZATION ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Delete an organization (Owner only)
 */
const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const [check] = await db.promise().query(
      `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`,
      [id, req.user.id],
    );

    if (!check.length || check[0].role !== "OWNER") {
      return res.status(403).json({ message: "Seul le OWNER peut supprimer l'organisation" });
    }

    await db.promise().query(`DELETE FROM organization_members WHERE organization_id = ?`, [id]);
    await db.promise().query(`DELETE FROM organization_invitations WHERE organization_id = ?`, [id]);
    await db.promise().query(`DELETE FROM organizations WHERE id = ?`, [id]);

    res.json({ message: "Organisation supprimée avec succès" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Leave organization (Member)
 */
const leaveOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const [check] = await db.promise().query(
      `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`,
      [id, req.user.id],
    );

    if (!check.length) return res.status(404).json({ message: "Vous n'êtes pas membre" });
    if (check[0].role === "OWNER") return res.status(403).json({ message: "Le OWNER ne peut pas quitter." });

    await db.promise().query(
      `DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?`,
      [id, req.user.id],
    );
    res.json({ message: "Vous avez quitté l'organisation" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * List my organizations
 */
const listMyOrganizations = async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT o.* FROM organizations o 
       JOIN organization_members om ON om.organization_id = o.id 
       WHERE om.user_id = ? ORDER BY o.id DESC`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Get organization details
 */
const getOrganizationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const [memberCheck] = await db.promise().query(
      `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`,
      [id, req.user.id],
    );

    if (!memberCheck.length) return res.status(403).json({ message: "Accès refusé" });

    const [orgRows] = await db.promise().query("SELECT * FROM organizations WHERE id = ?", [id]);
    const [members] = await db.promise().query(
      `SELECT u.id, u.name, u.email, om.role FROM organization_members om 
       JOIN users u ON u.id = om.user_id WHERE om.organization_id = ?`,
      [id],
    );

    res.json({ organization: orgRows[0], members, myRole: memberCheck[0].role });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Update organization
 */
const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const [check] = await db.promise().query(
      `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`,
      [id, req.user.id],
    );

    if (!check.length || check[0].role !== "OWNER") return res.status(403).json({ message: "Accès refusé" });

    await db.promise().query(
      `UPDATE organizations SET name=?, matricule_fiscale=?, adresse=?, ville=?, 
       code_postal=?, telephone=?, email=?, fax=? WHERE id=?`,
      [req.body.name, req.body.matricule_fiscale, req.body.adresse, req.body.ville, req.body.code_postal, req.body.telephone, req.body.email || null, req.body.fax || null, id],
    );
    res.json({ message: "Organisation mise à jour" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Add member to organization
 */
const addMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email requis" });

    const [check] = await db.promise().query(
      `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`,
      [id, req.user.id],
    );
    if (!check.length || check[0].role !== "OWNER") return res.status(403).json({ message: "Accès refusé" });

    const [userRows] = await db.promise().query("SELECT id FROM users WHERE email = ?", [email]);
    if (!userRows.length) return res.status(404).json({ message: "Utilisateur introuvable" });

    const userId = userRows[0].id;
    const [existing] = await db.promise().query(`SELECT organization_id FROM organization_members WHERE user_id = ?`, [userId]);
    if (existing.length) return res.status(409).json({ message: "Déjà membre d'une organisation" });

    await db.promise().query(`INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, 'MEMBER')`, [id, userId]);
    res.json({ message: `${email} ajouté avec succès` });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Invite member via email
 */
const inviteMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email requis" });

    const [check] = await db.promise().query(
      `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`,
      [id, req.user.id],
    );
    if (!check.length || check[0].role !== "OWNER") return res.status(403).json({ message: "Accès refusé" });

    const [users] = await db.promise().query("SELECT id FROM users WHERE email = ?", [email]);
    if (!users.length) return res.status(404).json({ message: "Utilisateur introuvable" });

    const invitedUserId = users[0].id;
    const [existingMember] = await db.promise().query(`SELECT id FROM organization_members WHERE user_id = ?`, [invitedUserId]);
    if (existingMember.length) return res.status(409).json({ message: "Déjà membre" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await db.promise().query(
      `INSERT INTO organization_invitations (organization_id, invited_user_id, invited_email, token, expires_at) VALUES (?, ?, ?, ?, ?)`,
      [id, invitedUserId, email, token, expiresAt],
    );

    const inviteLink = `http://51.178.39.67/organization/invite/${token}`;
    await sendOrganizationInviteEmail(email, inviteLink);

    res.json({ message: "Invitation envoyée par email" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Get invitation details
 */
const getInvitation = async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT oi.*, o.name AS organization_name FROM organization_invitations oi 
       JOIN organizations o ON o.id = oi.organization_id WHERE oi.token = ? AND oi.status='pending'`,
      [req.params.token],
    );
    if (!rows.length) return res.status(404).json({ message: "Invitation invalide" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Accept invitation
 */
const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    const [rows] = await db.promise().query(`SELECT * FROM organization_invitations WHERE token = ? AND status='pending'`, [token]);
    if (!rows.length) return res.status(404).json({ message: "Invitation invalide" });

    const invite = rows[0];
    if (new Date(invite.expires_at) < new Date()) {
      await db.promise().query(`UPDATE organization_invitations SET status='expired' WHERE id=?`, [invite.id]);
      return res.status(410).json({ message: "Invitation expirée" });
    }

    const [already] = await db.promise().query(`SELECT id FROM organization_members WHERE user_id=?`, [invite.invited_user_id]);
    if (already.length) return res.status(409).json({ message: "Déjà membre" });

    await db.promise().query(`INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, 'MEMBER')`, [invite.organization_id, invite.invited_user_id]);
    await db.promise().query(`UPDATE organization_invitations SET status='accepted', accepted_at=NOW() WHERE id=?`, [invite.id]);

    res.json({ message: "Invitation acceptée" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * List my invitations
 */
const listMyInvitations = async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT oi.*, o.name AS organization_name FROM organization_invitations oi 
       JOIN organizations o ON o.id = oi.organization_id 
       WHERE oi.invited_user_id = ? AND oi.status='pending' ORDER BY oi.created_at DESC`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Reject invitation
 */
const rejectInvitation = async (req, res) => {
  try {
    await db.promise().query(`UPDATE organization_invitations SET status='rejected' WHERE token=? AND status='pending'`, [req.params.token]);
    res.json({ message: "Invitation refusée" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Remove member
 */
const removeMember = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const [check] = await db.promise().query(`SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`, [id, req.user.id]);
    if (!check.length || check[0].role !== "OWNER") return res.status(403).json({ message: "Accès refusé" });

    await db.promise().query(`DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?`, [id, userId]);
    res.json({ message: "Membre supprimé" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * List organization transactions
 */
const listOrgTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const [memberCheck] = await db.promise().query(`SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`, [id, req.user.id]);
    if (!memberCheck.length) return res.json([]);

    const [rows] = await db.promise().query(
      `SELECT t.id, t.facture_number, t.statut, t.date_creation, u.name AS user_name 
       FROM transactions t JOIN users u ON u.id = t.user_id 
       JOIN organization_members om ON om.user_id = t.user_id 
       WHERE om.organization_id = ? ORDER BY t.date_creation DESC`,
      [id],
    );
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
};

module.exports = {
  createOrganization,
  deleteOrganization,
  leaveOrganization,
  listMyOrganizations,
  getOrganizationDetails,
  updateOrganization,
  addMember,
  inviteMember,
  getInvitation,
  acceptInvitation,
  listMyInvitations,
  rejectInvitation,
  removeMember,
  listOrgTransactions,
};
