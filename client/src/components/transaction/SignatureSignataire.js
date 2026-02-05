import React, { useState } from "react";
import { useParams } from "react-router-dom";
import "../style/SignatureSignataire.css";

const SignatureSignataire = () => {
  const { id } = useParams();

  const [accepted, setAccepted] = useState(false);
  const [signed, setSigned] = useState(false);
  const [loading, setLoading] = useState(false);

  const pdfUrl = `http://localhost:5000/api/public/transactions/${id}/pdf`;

  const handleSign = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/public/transactions/${id}/sign`,
        { method: "POST" }
      );

      if (res.ok) {
        setSigned(true);
      } else {
        alert("Erreur lors de la signature");
      }
    } catch {
      alert("Erreur serveur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signature-page">
      <div className="signature-wrapper">
        <div className="signature-header">
          <h2>Signature électronique</h2>
          <p>
            Veuillez consulter le document ci-dessous et confirmer votre accord
            avant signature.
          </p>
        </div>

        {/* PDF */}
        <div className="signature-pdf-wrapper">
          <iframe
            src={`${pdfUrl}#zoom=page-width`}
            title="Document PDF"
            className="signature-pdf"
          />
        </div>

        {!signed ? (
          <>
            {/* ACCEPTATION */}
            <div className="signature-checkbox">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <label>
                J’ai lu le document et j’accepte les termes et conditions
              </label>
            </div>

            {/* SIGNATURE */}
            <div className="signature-actions">
              <select className="signature-select" disabled>
                <option>Signature sécurisée (SSCD)</option>
              </select>

              <button
                className="signature-button"
                onClick={handleSign}
                disabled={!accepted || loading}
              >
                {loading ? "Signature en cours..." : "Signer le document"}
              </button>
            </div>
          </>
        ) : (
          <div className="signature-success">
            <span>✔</span>
            <p>Document signé avec succès</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignatureSignataire;
