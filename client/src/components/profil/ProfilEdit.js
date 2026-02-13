import { useContext, useEffect, useState } from "react";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";
import "../style/information.css";

const API_URL = "http://localhost:5000"; // ⬅️ change si ton backend est sur un autre port

const ProfilEdit = () => {
  const { user, setUser } = useContext(AuthContext); // ✅ setUser doit exister dans ton context
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Remplir le form quand user arrive
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        phone: user.phone || "",
        address: user.address || ""
      });
    }
  }, [user]);

  const onChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!form.name.trim()) return setErr("Le nom est obligatoire.");

    try {
      setLoading(true);

      const res = await axios.put(
        `${API_URL}/api/auth/profile`,
        {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          address: form.address.trim() || null
        },
        { withCredentials: true }
      );

      // backend renvoie: { message, user }
      setMsg(res.data?.message || "✅ Profil mis à jour.");

      if (res.data?.user && setUser) {
        setUser(res.data.user); // ✅ met à jour le context
      }
    } catch (e2) {
      setErr(e2?.response?.data?.message || "❌ Erreur lors de la mise à jour.");
    } finally {
      setLoading(false);
    }
  };

  const onReset = () => {
    setMsg("");
    setErr("");
    setForm({
      name: user?.name || "",
      phone: user?.phone || "",
      address: user?.address || ""
    });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Modifier profil</h2>
          <p>Mettez à jour vos informations personnelles.</p>
        </div>
      </div>

      <form className="form-card" onSubmit={onSubmit}>
        {err && <div className="alert error">{err}</div>}
        {msg && <div className="alert success">{msg}</div>}

        <div className="form-grid">
          <div className="field">
            <label>Nom complet</label>
            <input
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder="Votre nom"
            />
          </div>

          <div className="field">
            <label>Téléphone</label>
            <input
              name="phone"
              value={form.phone}
              onChange={onChange}
              placeholder="Ex: +216 ..."
            />
          </div>

          <div className="field full">
            <label>Adresse</label>
            <input
              name="address"
              value={form.address}
              onChange={onChange}
              placeholder="Adresse complète"
            />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>

          <button className="btn ghost" type="button" onClick={onReset} disabled={loading}>
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfilEdit;
