import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import {
  FaUserCircle,
  FaEnvelope,
  FaPhoneAlt,
  FaMapMarkerAlt,
  FaIdBadge,
} from "react-icons/fa";
import "../style/information.css";

const InformationProfil = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-title">
          <h2>Mes informations</h2>
          <p>Consultez et vérifiez vos informations personnelles.</p>
        </div>

        <div className="profile-avatar" aria-label="User avatar">
          {String(user.name || "U")
            .trim()
            .slice(0, 1)
            .toUpperCase()}
        </div>
      </div>

      <div className="profile-grid">
        {/* Carte principale */}
        <div className="profile-card">
          <div className="profile-card-title">
            <FaUserCircle />
            <h3>Informations personnelles</h3>
          </div>

          <InfoRow
            icon={<FaUserCircle />}
            label="Nom complet"
            value={user.name}
          />
          <InfoRow icon={<FaEnvelope />} label="Email" value={user.email} />
          <InfoRow icon={<FaIdBadge />} label="Rôle" value={user.role} />
          <InfoRow
            icon={<FaPhoneAlt />}
            label="Téléphone"
            value={user.phone || "Non renseigné"}
            muted={!user.phone}
          />
          <InfoRow
            icon={<FaMapMarkerAlt />}
            label="Adresse"
            value={user.address || "Non renseigné"}
            muted={!user.address}
          />
        </div>

        {/* Carte secondaire */}
        <div className="profile-card soft">
          <h3>Conseils</h3>
          <ul className="profile-tips">
            <li>
              Vérifiez que votre email est correct pour recevoir les
              notifications.
            </li>
            <li>
              Ajoutez un numéro de téléphone pour renforcer la sécurité du
              compte.
            </li>
            <li>
              Gardez vos informations à jour pour éviter les erreurs de
              facturation.
            </li>
          </ul>

          <button
            className="btn primary profile-btn"
            type="button"
            onClick={() => navigate("/dashboard/profil/ProfilEdit")}
          >
            Mettre à jour
          </button>
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ icon, label, value, muted }) => {
  return (
    <div className="info-row">
      <div className="info-left">
        <span className="info-icon">{icon}</span>
        <span className="info-label">{label}</span>
      </div>
      <div className={`info-value ${muted ? "muted" : ""}`}>{value}</div>
    </div>
  );
};

export default InformationProfil;
