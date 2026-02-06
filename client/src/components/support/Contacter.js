import { useState } from "react";
import axios from "axios";
import "../style/contacter.css";

const API_URL = "http://localhost:5000";

const Contacter = () => {
  const [form, setForm] = useState({ type: "", message: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!form.type) return setErr("Veuillez choisir le type de demande.");
    if (!form.message.trim()) return setErr("Veuillez écrire votre message.");

    try {
      setLoading(true);

      const res = await axios.post(
        `${API_URL}/api/support/contact`,
        {
          type: form.type,
          message: form.message.trim(),
        },
        { withCredentials: true }
      );

      setMsg(res.data?.message || "✅ Demande envoyée avec succès !");
      setForm({ type: "", message: "" });
    } catch (e2) {
      setErr(e2?.response?.data?.message || "❌ Erreur lors de l'envoi.");
    } finally {
      setLoading(false);
    }
  };

  const onReset = () => {
    setMsg("");
    setErr("");
    setForm({ type: "", message: "" });
  };

  return (
    <div className="contact-scope">
      <div className="page">
        <div className="page-head">
          <div>
            <h2>Contacter le support</h2>
            <p>Veuillez décrire votre demande ci-dessous.</p>
          </div>
        </div>

        <form className="form-card" onSubmit={onSubmit}>
          {err && <div className="alert error">{err}</div>}
          {msg && <div className="alert success">{msg}</div>}

          <div className="form-grid">
            <div className="field full">
              <label>Type de demande</label>
              <select name="type" value={form.type} onChange={onChange}>
                <option value="">-- Sélectionner --</option>
                <option value="technique">Demande technique</option>
                <option value="commerciale">Demande commerciale</option>
                <option value="autre">Autre</option>
              </select>
            </div>

            <div className="field full">
              <label>Message</label>
              <textarea
                name="message"
                rows="6"
                value={form.message}
                onChange={onChange}
                placeholder="Décrivez votre problème..."
              />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? "Envoi..." : "Envoyer"}
            </button>

            <button
              className="btn ghost"
              type="button"
              onClick={onReset}
              disabled={loading}
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Contacter;
