import { useState, useContext, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "./style/login.css";

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

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loadingForm, setLoadingForm] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, loading } = useContext(AuthContext);

  /* ================= GOOGLE CALLBACK ERROR HANDLING ================= */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorParam = params.get("error");

    if (errorParam === "disabled") {
      setError("Votre compte est désactivé. Contactez l’administrateur.");
    }

    if (errorParam === "google_failed") {
      setError("Échec de connexion avec Google.");
    }

    if (errorParam === "auth_failed") {
      setError("Erreur d’authentification Google.");
    }

    if (errorParam === "server") {
      setError("Erreur serveur. Veuillez réessayer.");
    }
  }, [location.search]);

  /* ================= AUTO REDIRECT IF CONNECTED ================= */
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

  /* ================= GOOGLE LOGIN ================= */
  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:5000/api/auth/google";
  };

  /* ================= LOGIN FORM ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoadingForm(true);

    try {
      await axios.post(
        "http://localhost:5000/api/auth/login",
        { email, password },
        { withCredentials: true }
      );

      const res = await axios.get(
        "http://localhost:5000/api/auth/me",
        { withCredentials: true }
      );

      setUser(res.data);
      navigate("/dashboard", { replace: true });

    } catch (err) {
      setError(
        err?.response?.data?.message ||
        "Email ou mot de passe incorrect"
      );
    } finally {
      setLoadingForm(false);
    }
  };

  if (loading) return <p className="loading">Chargement...</p>;

  return (
    <div className="login-container">
      <div className="back-home">
        <Link to="/" className="back-button">
          ← Accueil
        </Link>
      </div>

      <div className="login-card">
        <h2>Connexion</h2>
        <p className="subtitle">Accédez à votre espace</p>

        {error && <div className="error">{error}</div>}

        <button
          type="button"
          className="google-btn"
          onClick={handleGoogleLogin}
        >
          <GoogleIcon />
          Continuer avec Google
        </button>

        <div className="divider">OU</div>

        <form onSubmit={handleSubmit}>
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
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loadingForm}>
            {loadingForm ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="register-link">
          <span>Pas encore de compte ? </span>
          <Link to="/register">S’inscrire</Link>
        </div>

        <div className="register-link" style={{ marginTop: 10 }}>
          <Link to="/ForgotPassword">
            Mot de passe oublié ?
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
