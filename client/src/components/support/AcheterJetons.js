import { useNavigate } from "react-router-dom";
import "../style/acheterJetons.css";

const AcheterJetons = () => {
  const navigate = useNavigate();

  return (
    <div className="page-scope">
      <div className="page">
        <div className="page-head center">
          <h2>Abonnement prépayé</h2>
          <p>
            <b>Payez uniquement ce que vous consommez</b>
          </p>
        </div>

        <div className="form-card center-card">
          <h3 className="title">Pack personnalisé</h3>
          <p>Discuter avec notre équipe commerciale.</p>

          <button
            className="btn primary large"
            onClick={() => navigate("/dashboard/contacter")}
          >
            Nous contacter
          </button>
        </div>

        <div className="info-list">
          <div>✔ Chaque signature coûtera 1 Jeton</div>
          <div>✔ Un document de (n x signatures) coûtera (n x Jetons)</div>
          <div>✔ Le nombre de documents par transaction n’affecte pas son coût</div>
        </div>
      </div>
    </div>
  );
};

export default AcheterJetons;
