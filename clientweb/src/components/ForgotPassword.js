import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "./style/login.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSend = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/api/auth/forgot-password", {
        email,
      });

      setMsg(res.data.message);

      setTimeout(() => {
        navigate("/ResetPassword", { state: { email } });
      }, 800);
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Mot de passe oublié</h2>
        <p className="subtitle">Recevez un code par email</p>

        {error && <div className="error">{error}</div>}
        {msg && <div className="success">{msg}</div>}

        <form onSubmit={handleSend}>
          <div className="input-group">
            <input
              type="email"
              placeholder="Votre email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Envoi..." : "Envoyer le code"}
          </button>
        </form>

        <div className="register-link">
          <Link to="/login">Retour login</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
