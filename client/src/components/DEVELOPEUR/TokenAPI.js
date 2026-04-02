import { useEffect, useState } from "react";
import { FaKey, FaCopy, FaSyncAlt, FaExclamationTriangle } from "react-icons/fa";
import Swal from "sweetalert2";
import "../style/tokenapi.css";

const TokenAPI = () => {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🔐 Charger ou générer automatiquement
  useEffect(() => {
    const loadToken = async () => {
      const res = await fetch("http://localhost:5000/api/my-api-token", {
        credentials: "include",
      });

      const data = await res.json();

      if (data.apiToken) {
        setToken(data.apiToken);
      } else {
        const gen = await fetch(
          "http://localhost:5000/api/generate-api-token",
          {
            method: "POST",
            credentials: "include",
          }
        );
        const genData = await gen.json();
        setToken(genData.apiToken);
      }
    };

    loadToken();
  }, []);

  // 📋 Copier token
  const copyToken = async () => {
    await navigator.clipboard.writeText(token);

    Swal.fire({
      icon: "success",
      title: "Copié !",
      text: "Le token a été copié dans le presse-papier.",
      confirmButtonColor: "#0247AA",
      showCloseButton: true,
    });
  };

  // 🔄 Régénérer token
  const regenerateToken = async () => {
    const result = await Swal.fire({
      title: "Régénérer le token ?",
      text: "L'ancien token deviendra invalide immédiatement.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#0247AA",
      cancelButtonColor: "#d33",
      confirmButtonText: "Oui, régénérer",
      cancelButtonText: "Annuler",
      showCloseButton: true,
    });

    if (!result.isConfirmed) return;

    setLoading(true);

    const res = await fetch(
      "http://localhost:5000/api/regenerate-api-token",
      {
        method: "POST",
        credentials: "include",
      }
    );

    const data = await res.json();
    setToken(data.apiToken);
    setLoading(false);

    Swal.fire({
      icon: "success",
      title: "Token régénéré",
      text: "Un nouveau token JWT a été généré avec succès.",
      confirmButtonColor: "#0247AA",
      showCloseButton: true,
    });
  };

  return (
    <div className="page">
      <div className="full-width-container">

        {/* HEADER */}
        <div className="page-head">
          <div className="page-head-left">
            <h2>API Token</h2>
            <p>
              Ce token JWT permet à vos applications externes d'accéder à l’API.
            </p>
          </div>

          <button
            className="btn btn-outline"
            onClick={regenerateToken}
            disabled={loading}
          >
            <FaSyncAlt />
            {loading ? "Régénération..." : "Régénérer"}
          </button>
        </div>

        {/* CARD */}
        <div className="create-card">
          <div className="create-card-title">
            <FaKey />
            Votre Token API
          </div>

          <div className="warning-box">
            <FaExclamationTriangle />
            Ne partagez jamais ce token publiquement.
          </div>

          {token && (
            <div className="field full">
              <label>Token JWT</label>
              <textarea
                className="input token-area"
                value={token}
                readOnly
              />
            </div>
          )}

          <div className="form-actions">
            <button className="btn btn-primary" onClick={copyToken}>
              <FaCopy />
              Copier
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TokenAPI;
