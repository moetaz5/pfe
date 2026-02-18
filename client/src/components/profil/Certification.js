import { useState } from "react";
import axios from "axios";
import "../style/dashboard.css";

const API_URL = "http://localhost:5000"; // Changez l'URL si nécessaire

const Certification = () => {
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const certifyAccount = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/api/auth/certify`, {}, { withCredentials: true });
      setStatus(res.data?.status || "Votre compte est maintenant certifié.");
      setMsg("Compte certifié !");
    } catch (error) {
      setErr(error?.response?.data?.message || "Erreur lors de la certification du compte.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Certifier mon compte</h2>
        <p>Complétez le processus de certification pour valider votre compte.</p>
      </div>

      <div className="form-card">
        {err && <div className="alert error">{err}</div>}
        {msg && <div className="alert success">{msg}</div>}

        <div className="form-grid">
          <div className="field full">
            <label>Statut de certification</label>
            <div className="status-display">
              {status ? <p>{status}</p> : <p>Votre compte n'est pas certifié. Cliquez sur le bouton ci-dessous pour certifier.</p>}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn primary" onClick={certifyAccount} disabled={loading}>
            {loading ? "Certification..." : "Certifier le compte"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Certification;
