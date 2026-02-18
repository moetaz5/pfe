import { useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./style/login.css";

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/api/auth/reset-password", {
        email,
        code,
        newPassword,
      });

      setMsg(res.data.message);
      setTimeout(() => navigate("/login"), 1000);
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Veuillez entrer votre email.");
      return;
    }

    if (cooldown > 0) return;

    setError("");
    setMsg("");
    setResendLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/api/auth/resend-reset-code", {
        email,
      });

      setMsg(res.data.message);

      setCooldown(30);
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur resend");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Réinitialiser mot de passe</h2>
        <p className="subtitle">Entrez le code + nouveau mot de passe</p>

        {error && <div className="error">{error}</div>}
        {msg && <div className="success">{msg}</div>}

        <form onSubmit={handleReset}>
          <div className="input-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <input
              type="text"
              placeholder="Code (6 chiffres)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <input
              type="password"
              placeholder="Nouveau mot de passe (min 8)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Reset..." : "Changer le mot de passe"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleResend}
          className="google-btn"
          disabled={resendLoading || cooldown > 0}
          style={{ marginTop: 10 }}
        >
          {resendLoading
            ? "Envoi..."
            : cooldown > 0
            ? `Renvoyer dans ${cooldown}s`
            : "Renvoyer le code"}
        </button>

        <div className="register-link">
          <Link to="/login">Retour login</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
