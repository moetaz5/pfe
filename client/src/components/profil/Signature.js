import { useState } from "react";
import axios from "axios";
import "../style/dashboard.css";

const API_URL = "http://localhost:5000"; // Changez l'URL si nécessaire

const Signature = () => {
  const [signature, setSignature] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const getSignature = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/auth/signature`, { withCredentials: true });
      setSignature(res.data?.signature || "Aucune signature disponible.");
    } catch (error) {
      setErr(error?.response?.data?.message || "Erreur de récupération de la signature.");
    } finally {
      setLoading(false);
    }
  };

  const createSignature = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/api/auth/signature`, {}, { withCredentials: true });
      setSignature(res.data?.signature || "Signature créée avec succès.");
      setMsg("Signature créée !");
    } catch (error) {
      setErr(error?.response?.data?.message || "Erreur lors de la création de la signature.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Ma signature</h2>
        <p>Consultez ou créez votre signature électronique.</p>
      </div>

      <div className="form-card">
        {err && <div className="alert error">{err}</div>}
        {msg && <div className="alert success">{msg}</div>}

        <div className="form-grid">
          <div className="field full">
            <label>Votre signature</label>
            <div className="signature-display">
              {signature ? (
                <p>{signature}</p>
              ) : (
                <p>Pas de signature disponible. Créez-en une ci-dessous.</p>
              )}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn primary" onClick={getSignature} disabled={loading}>
            {loading ? "Chargement..." : "Voir ma signature"}
          </button>
          <button className="btn secondary" onClick={createSignature} disabled={loading}>
            {loading ? "Création..." : "Créer une signature"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Signature;
