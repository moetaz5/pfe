import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import "../style/createTransaction.css";

import {
  Save,
  Building2,
  Mail,
  Phone,
  MapPin,
  Users,
  Shield,
  X,
} from "lucide-react";

import { FaHome } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* ================= SMALL COMPONENT ================= */

const SectionTitle = ({ icon, title, subtitle }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {icon}
      <h3 style={{ margin: 0 }}>{title}</h3>
    </div>
    {subtitle && (
      <p style={{ margin: "6px 0 0 0", color: "#64748b", fontSize: 13 }}>
        {subtitle}
      </p>
    )}
  </div>
);

const MiniMember = ({ member, isOwner, onRemove }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 10,
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      marginBottom: 8,
    }}
  >
    <div>
      <strong>{member.name}</strong>
      <div style={{ fontSize: 13, color: "#64748b" }}>
        {member.email} — {member.role}
      </div>
    </div>

    {isOwner && member.role !== "OWNER" && (
      <X
        size={18}
        style={{ cursor: "pointer", color: "crimson" }}
        onClick={() => onRemove(member.id)}
      />
    )}
  </div>
);

/* ================= MAIN COMPONENT ================= */

const OrganizationDetail = () => {
  const { id } = useParams();

  const [organization, setOrganization] = useState(null);
  const [members, setMembers] = useState([]);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [myRole, setMyRole] = useState("");
  const [loading, setLoading] = useState(true);

  const isOwner = String(myRole).toUpperCase() === "OWNER";

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/organizations/${id}`,
        { withCredentials: true },
      );

      setOrganization(res.data.organization);
      setMembers(res.data.members || []);
      setMyRole(res.data.myRole || "");
    } catch (e) {
      toast.error("Erreur chargement organisation");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleChange = (e) => {
    if (!isOwner) return;
    setOrganization({
      ...organization,
      [e.target.name]: e.target.value,
    });
  };

  const updateOrganization = async () => {
    if (!isOwner) return;

    try {
      await axios.put(
        `http://localhost:5000/api/organizations/${id}`,
        organization,
        { withCredentials: true },
      );

      toast.success("Organisation mise à jour !");
    } catch {
      toast.error("Erreur mise à jour");
    }
  };

  // 🔥 SEULE MODIFICATION IMPORTANTE : addMember()

  const addMember = async () => {
    if (!isOwner || !newMemberEmail) return;

    try {
      const res = await axios.post(
        `http://localhost:5000/api/organizations/${id}/add-member`,
        { email: newMemberEmail },
        { withCredentials: true },
      );

      toast.success(res.data.message);
      setNewMemberEmail("");
      fetchData();
    } catch (err) {
      if (err.response?.data?.message) {
        toast.error(err.response.data.message);
      } else {
        toast.error("Erreur ajout membre");
      }
    }
  };

  const removeMember = async (userId) => {
    try {
      await axios.delete(
        `http://localhost:5000/api/organizations/${id}/member/${userId}`,
        { withCredentials: true },
      );

      toast.success("Membre supprimé");
      fetchData();
    } catch {
      toast.error("Erreur suppression");
    }
  };

  if (loading) return <p>Chargement...</p>;
  if (!organization) return <p>Organisation introuvable</p>;

  return (
    <div className="page">
      <ToastContainer position="top-right" />

      <div className="full-width-container">
        {/* HEADER */}
        <div className="page-head">
          <div>
            <h2>Détail Organisation</h2>
            <p>Consultez et gérez votre organisation.</p>
          </div>

          <Link to="/dashboard" className="btn btn-outline">
            <FaHome style={{ marginRight: 8 }} />
            Accueil
          </Link>
        </div>

        <div className="create-card">
          <div className="create-card-title">
            <Building2 size={18} color="#0247AA" />
            Informations Organisation
          </div>

          {/* ROLE BADGE */}
          <div style={{ marginBottom: 14 }}>
            <span
              style={{
                background: isOwner ? "#dcfce7" : "#f1f5f9",
                padding: "6px 14px",
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              <Shield size={14} style={{ marginRight: 6 }} />
              {myRole}
            </span>
          </div>

          <SectionTitle
            icon={<Building2 size={18} />}
            title="Informations générales"
          />

          <div className="form-grid">
            {[
              "name",
              "matricule_fiscale",
              "adresse",
              "ville",
              "code_postal",
              "telephone",
              "email",
              "fax",
            ].map((field) => (
              <div className="field" key={field}>
                <label>{field}</label>
                <input
                  className="input"
                  name={field}
                  value={organization[field] || ""}
                  onChange={handleChange}
                  disabled={!isOwner}
                />
              </div>
            ))}
          </div>

          {isOwner && (
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={updateOrganization}>
                <Save size={16} />
                Enregistrer
              </button>
            </div>
          )}
        </div>

        {/* ================= MEMBERS ================= */}
        <div className="create-card" style={{ marginTop: 20 }}>
          <SectionTitle icon={<Users size={18} />} title="Membres" />

          {members.map((member) => (
            <MiniMember
              key={member.id}
              member={member}
              isOwner={isOwner}
              onRemove={removeMember}
            />
          ))}

          {isOwner && (
            <>
              <div style={{ marginTop: 14 }}>
                <input
                  className="input"
                  placeholder="Email utilisateur"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                />
              </div>

              <div className="form-actions" style={{ marginTop: 10 }}>
                <button className="btn btn-outline" onClick={addMember}>
                  Ajouter membre
                </button>
              </div>
            </>
          )}

          {!isOwner && (
            <div style={{ marginTop: 10, color: "#64748b" }}>
              Seul le OWNER peut modifier l'organisation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizationDetail;
