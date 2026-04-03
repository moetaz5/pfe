import { useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";

const GoogleCallback = () => {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Vérifier si on a un exchange_token dans l'URL
        // (flux cross-domain OAuth: nip.io → IP directe)
        const urlParams = new URLSearchParams(window.location.search);
        const exchangeToken = urlParams.get("exchange_token");

        if (exchangeToken) {
          // Échanger le token temporaire contre un cookie de session sur le bon domaine
          const res = await axios.post(
            "/api/auth/exchange-google-token",
            { exchange_token: exchangeToken },
            { withCredentials: true }
          );
          setUser(res.data);
          navigate("/dashboard", { replace: true });
        } else {
          // Fallback: vérifier la session existante
          const res = await axios.get("/api/auth/me", {
            withCredentials: true,
          });
          setUser(res.data);
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        navigate("/login", { replace: true });
      }
    };

    handleCallback();
  }, [navigate, setUser]);

  return (
    <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "1.1rem" }}>
      ⏳ Connexion Google en cours...
    </p>
  );
};

export default GoogleCallback;
