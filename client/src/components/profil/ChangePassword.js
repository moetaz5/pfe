import { useState } from "react";
import axios from "axios";
import "../style/dashboard.css";

const API_URL = "http://localhost:5000"; // ⬅️ change si nécessaire

const ChangePassword = () => {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!form.current || !form.next || !form.confirm)
      return setErr("Veuillez remplir tous les champs.");

    if (form.next.length < 8)
      return setErr("Le mot de passe doit contenir au moins 8 caractères.");

    if (form.next !== form.confirm)
      return setErr("La confirmation ne correspond pas.");

    try {
      setLoading(true);

      const res = await axios.post(
        `${API_URL}/api/auth/change-password`,
        {
          currentPassword: form.current,
          newPassword: form.next
        },
        { withCredentials: true }
      );

      setMsg(res.data?.message || "✅ Mot de passe changé.");
      setForm({ current: "", next: "", confirm: "" });
    } catch (e2) {
      setErr(e2?.response?.data?.message || "❌ Erreur lors du changement du mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Changer le mot de passe</h2>
          <p>Choisissez un mot de passe fort et unique.</p>
        </div>
      </div>

      <form className="form-card" onSubmit={onSubmit}>
        {err && <div className="alert error">{err}</div>}
        {msg && <div className="alert success">{msg}</div>}

        <div className="form-grid">
          <div className="field full">
            <label>Mot de passe actuel</label>
            <input
              type="password"
              name="current"
              value={form.current}
              onChange={onChange}
              placeholder="••••••••"
            />
          </div>

          <div className="field">
            <label>Nouveau mot de passe</label>
            <input
              type="password"
              name="next"
              value={form.next}
              onChange={onChange}
              placeholder="Minimum 8 caractères"
            />
          </div>

          <div className="field">
            <label>Confirmer</label>
            <input
              type="password"
              name="confirm"
              value={form.confirm}
              onChange={onChange}
              placeholder="Répéter le mot de passe"
            />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? "Mise à jour..." : "Mettre à jour"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChangePassword;
