import { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../style/createTransaction.css";

import {
  Save,
  Mail,
  Building2,
  Hash,
  MapPin,
  Phone,
  Users,
  X,
  Info,
} from "lucide-react";

import { FaHome } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* ================= SMALL COMPONENTS ================= */

const SectionTitle = ({ icon, title, subtitle }) => (
  <div style={{ marginBottom: 10 }}>
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

const MiniItem = ({ email, onRemove }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 8,
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      marginTop: 6,
    }}
  >
    <span>{email}</span>
    <X size={16} style={{ cursor: "pointer" }} onClick={onRemove} />
  </div>
);

/* ================= MAIN COMPONENT ================= */

const CreationOrganization = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    matricule_fiscale: "",
    adresse: "",
    ville: "",
    code_postal: "",
    telephone: "",
    email: "",
    fax: "",
    invitedUsers: [],
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [alreadyInOrg, setAlreadyInOrg] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ================= CHECK ORG ================= */
  useEffect(() => {
    const checkOrganization = async () => {
      try {
        const res = await axios.get(
          "http://localhost:5000/api/organizations/mine",
          { withCredentials: true }
        );

        if (Array.isArray(res.data) && res.data.length > 0) {
          setAlreadyInOrg(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    checkOrganization();
  }, []);

  const handleChange = (e) => {
    if (alreadyInOrg) return;
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const addInvite = () => {
    if (alreadyInOrg) return;
    if (!inviteEmail) return;

    if (!form.invitedUsers.includes(inviteEmail)) {
      setForm({
        ...form,
        invitedUsers: [...form.invitedUsers, inviteEmail],
      });
    }

    setInviteEmail("");
  };

  const removeInvite = (index) => {
    const updated = [...form.invitedUsers];
    updated.splice(index, 1);
    setForm({ ...form, invitedUsers: updated });
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (alreadyInOrg) return;

    setIsSubmitting(true);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/organizations",
        form,
        { withCredentials: true }
      );

      toast.success(res.data.message);

      // Emails ajoutés
      if (res.data.added?.length) {
        res.data.added.forEach((email) =>
          toast.success(`✅ ${email} ajouté`)
        );
      }

      // Emails refusés
      if (res.data.rejected?.length) {
        res.data.rejected.forEach((msg) =>
          toast.warning(`⚠ ${msg}`)
        );
      }

      setTimeout(() => {
        navigate("/dashboard");
      }, 1800);

    } catch (err) {
      if (err.response?.data?.message) {
        toast.error(err.response.data.message);
      } else {
        toast.error("Erreur lors de la création");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <p>Chargement...</p>;

  return (
    <div className="page">
      <ToastContainer position="top-right" />

      <div className="full-width-container">
        <div className="page-head">
          <div>
            <h2>Créer une organisation</h2>
            <p>Créer et gérer votre structure professionnelle.</p>
          </div>

          <Link to="/dashboard" className="btn btn-outline">
            <FaHome style={{ marginRight: 8 }} />
            Accueil
          </Link>
        </div>

        <div className="create-card">
          <div className="create-card-title">
            <Building2 size={18} color="#0247AA" />
            Nouvelle organisation
          </div>

          {alreadyInOrg && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                padding: 12,
                borderRadius: 12,
                marginBottom: 14,
                color: "#991b1b",
                fontWeight: 600,
              }}
            >
              ⚠ Vous êtes déjà membre d'une organisation.
              <br />
              Vous ne pouvez pas en créer une nouvelle.
            </div>
          )}

          <div style={{ opacity: alreadyInOrg ? 0.5 : 1 }}>
            <form onSubmit={handleSubmit}>
              <SectionTitle
                icon={<Info size={18} />}
                title="Informations générales"
              />

              <div className="form-grid">
                <div className="field">
                  <label>Nom</label>
                  <input name="name" className="input" onChange={handleChange} required />
                </div>

                <div className="field">
                  <label>Matricule fiscale</label>
                  <input name="matricule_fiscale" className="input" onChange={handleChange} required />
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>Adresse</label>
                  <input name="adresse" className="input" onChange={handleChange} required />
                </div>

                <div className="field">
                  <label>Ville</label>
                  <input name="ville" className="input" onChange={handleChange} required />
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>Code postal</label>
                  <input name="code_postal" className="input" onChange={handleChange} required />
                </div>

                <div className="field">
                  <label>Téléphone</label>
                  <input name="telephone" className="input" onChange={handleChange} required />
                </div>
              </div>

              <SectionTitle
                icon={<Users size={18} />}
                title="Inviter des membres"
              />

              <div className="form-grid">
                <input
                  className="input"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email utilisateur"
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={addInvite}
                >
                  Ajouter
                </button>
              </div>

              {form.invitedUsers.map((email, index) => (
                <MiniItem
                  key={index}
                  email={email}
                  onRemove={() => removeInvite(index)}
                />
              ))}

              <div className="form-actions" style={{ marginTop: 18 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || alreadyInOrg}
                >
                  <Save size={16}/>
                  {isSubmitting ? "Création..." : "Créer Organisation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreationOrganization;
