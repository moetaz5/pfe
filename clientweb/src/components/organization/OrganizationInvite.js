import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import "../style/createTransaction.css";

import {
  CheckCircle,
  XCircle,
  Loader,
  Building2
} from "lucide-react";

const OrganizationInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);

  // 🔍 Charger infos invitation
  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await axios.get(
          `http://51.178.39.67.nip.io/api/organizations/invite/${token}`,
          { withCredentials: true }
        );

        setInvite(res.data);
      } catch (err) {
        setError(
          err.response?.data?.message || "Invitation invalide ou expirée"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    setDecisionLoading(true);
    try {
      await axios.post(
        `http://51.178.39.67.nip.io/api/organizations/invite/${token}/accept`,
        {},
        { withCredentials: true }
      );

      alert("Invitation acceptée !");
      navigate("/dashboard");
    } catch (err) {
      alert(err.response?.data?.message || "Erreur acceptation");
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleReject = async () => {
    setDecisionLoading(true);
    try {
      await axios.post(
        `http://51.178.39.67.nip.io/api/organizations/invite/${token}/reject`,
        {},
        { withCredentials: true }
      );

      alert("Invitation refusée");
      navigate("/dashboard");
    } catch (err) {
      alert(err.response?.data?.message || "Erreur refus");
    } finally {
      setDecisionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="create-card" style={{ textAlign: "center" }}>
          <Loader size={40} className="spin" />
          <h3>Chargement de l'invitation...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div
          className="create-card"
          style={{ textAlign: "center", color: "crimson" }}
        >
          <XCircle size={50} />
          <h3>{error}</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="create-card" style={{ textAlign: "center" }}>
        <Building2 size={50} color="#0247AA" />

        <h2>Invitation Organisation</h2>

        <p>
          Vous avez été invité à rejoindre :
          <br />
          <strong>{invite?.organization_name}</strong>
        </p>

        <div style={{ marginTop: 20, display: "flex", gap: 20, justifyContent: "center" }}>
          <button
            className="btn btn-primary"
            onClick={handleAccept}
            disabled={decisionLoading}
          >
            <CheckCircle size={18} />
            {decisionLoading ? "Traitement..." : "Accepter"}
          </button>

          <button
            className="btn btn-outline"
            style={{ borderColor: "crimson", color: "crimson" }}
            onClick={handleReject}
            disabled={decisionLoading}
          >
            <XCircle size={18} />
            Refuser
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrganizationInvite;