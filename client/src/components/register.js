import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "./style/login.css"; // 🔥 نفس style

const GoogleIcon = () => (
  <svg className="google-icon" viewBox="0 0 48 48">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.7 1.22 9.2 3.6l6.9-6.9C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.3l8 6.2C12.5 13.1 17.8 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.8h12.5c-.6 3-2.4 5.6-5.2 7.3l8 6.2c4.7-4.3 7.8-10.7 7.8-18.2z"
    />
    <path
      fill="#FBBC05"
      d="M10.6 28.6c-.5-1.5-.8-3.1-.8-4.6s.3-3.1.8-4.6l-8-6.2C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l8-6.2z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.4 0 11.9-2.1 15.9-5.7l-8-6.2c-2.2 1.5-5 2.4-7.9 2.4-6.2 0-11.5-3.6-13.4-8.8l-8 6.2C6.5 42.6 14.6 48 24 48z"
    />
    <path fill="none" d="M0 0h48v48H0z" />
  </svg>
);

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleGoogleRegister = () => {
    window.location.href = "http://localhost:5000/api/auth/google";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/api/auth/register", {
        name,
        email,
        password,
        phone,
        address,
      });

      navigate("/verify-email", { state: { email: res.data.email } });
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Inscription</h2>
        <p className="subtitle">Créez votre compte maintenant</p>

        {error && <div className="error">{error}</div>}

        <button type="button" className="google-btn" onClick={handleGoogleRegister}>
          <GoogleIcon />
          Continuer avec Google
        </button>

        <div className="divider">OU</div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              placeholder="Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

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
              type="password"
              placeholder="Mot de passe (min 8 caractères)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <input
              type="text"
              placeholder="Téléphone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="input-group">
            <input
              type="text"
              placeholder="Adresse"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Inscription..." : "S'inscrire"}
          </button>
        </form>

        <div className="login-link">
          <span>Vous avez déjà un compte ? </span>
          <Link to="/login">Se connecter</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
