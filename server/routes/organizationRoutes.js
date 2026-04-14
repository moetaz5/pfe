const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organizationController");
const { verifyToken } = require("../middleware/auth");

router.post("/", verifyToken, organizationController.createOrganization);
router.get("/mine", verifyToken, organizationController.listMyOrganizations);
router.get("/invitations/mine", verifyToken, organizationController.listMyInvitations);

// Invitations (token based, some are public)
router.get("/invite/:token", organizationController.getInvitation);
router.post("/invite/:token/accept", organizationController.acceptInvitation);
router.post("/invite/:token/reject", organizationController.rejectInvitation);

// Organization specific actions
router.get("/:id", verifyToken, organizationController.getOrganizationDetails);
router.put("/:id", verifyToken, organizationController.updateOrganization);
router.delete("/:id", verifyToken, organizationController.deleteOrganization);
router.delete("/:id/leave", verifyToken, organizationController.leaveOrganization);
router.post("/:id/add-member", verifyToken, organizationController.addMember);
router.post("/:id/invite", verifyToken, organizationController.inviteMember);
router.delete("/:id/member/:userId", verifyToken, organizationController.removeMember);
router.get("/:id/transactions", verifyToken, organizationController.listOrgTransactions);

module.exports = router;
