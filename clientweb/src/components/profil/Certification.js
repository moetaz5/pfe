import { useState, useEffect } from "react";
import axios from "axios";
import "../style/certification.css";

const API_URL = "http://medicasign.medicacom.tn";

const Certification = () => {

  const [form, setForm] = useState({
    matricule_fiscale: "",
    adresse: "",
    ville: "",
    code_postal: "",
    ttn_login: "",
    ttn_password: "",
  });

  const [certified, setCertified] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 TOUJOURS charger les infos certification
  const fetchCertification = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/api/auth/certification-info`,
        { withCredentials: true }
      );

      setForm({
        matricule_fiscale: res.data.matricule_fiscale || "",
        adresse: res.data.adresse || "",
        ville: res.data.ville || "",
        code_postal: res.data.code_postal || "",
        ttn_login: res.data.ttn_login || "",
        ttn_password: "", // jamais afficher
      });

      setCertified(res.data.certified === 1);

    } catch (e) {
      console.log("LOAD CERTIFICATION ERROR:", e);
    }
  };

  useEffect(() => {
    fetchCertification();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const certifyAccount = async () => {
    try {
      setLoading(true);
      setErr("");
      setMsg("");

      const res = await axios.post(
        `${API_URL}/api/auth/certify`,
        form,
        { withCredentials: true }
      );

      setMsg(res.data.message);
      setCertified(true);

      // 🔥 IMPORTANT → recharger les données après update
      fetchCertification();

    } catch (error) {
      setErr(error?.response?.data?.message || "Erreur certification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-left">
          <h2>
            Certification du compte
            {certified && (
              <span className="certified-badge">
                ✔ Compte certifié
              </span>
            )}
          </h2>
          <p>Informations TTN</p>
        </div>
      </div>

      <div className="create-card">

        {err && <div className="error-box">{err}</div>}
        {msg && <div className="success-box">{msg}</div>}

        <div className="form-grid">

          <div className="field">
            <label>Matricule fiscale</label>
            <input
              className="input"
              name="matricule_fiscale"
              value={form.matricule_fiscale}
              onChange={handleChange}
            />
          </div>

          <div className="field">
            <label>Adresse</label>
            <input
              className="input"
              name="adresse"
              value={form.adresse}
              onChange={handleChange}
            />
          </div>

          <div className="field">
            <label>Ville</label>
            <input
              className="input"
              name="ville"
              value={form.ville}
              onChange={handleChange}
            />
          </div>

          <div className="field">
            <label>Code postal</label>
            <input
              className="input"
              name="code_postal"
              value={form.code_postal}
              onChange={handleChange}
            />
          </div>

          <div className="field">
            <label>Login TTN</label>
            <input
              className="input"
              name="ttn_login"
              value={form.ttn_login}
              onChange={handleChange}
            />
          </div>

          <div className="field">
            <label>Nouveau mot de passe TTN</label>
            <input
              type="password"
              className="input"
              name="ttn_password"
              value={form.ttn_password}
              onChange={handleChange}
              placeholder="Laisser vide pour ne pas modifier"
            />
          </div>

        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={certifyAccount}
            disabled={loading}
          >
            {loading
              ? "Enregistrement..."
              : certified
              ? "Mettre à jour"
              : "Certifier le compte"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Certification;
