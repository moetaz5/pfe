import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaHome } from "react-icons/fa";
import "../style/SignatureSignataire.css";

const SignatureSignataire = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pin, setPin] = useState("");
  const [pinValid, setPinValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(false);
  const [docs, setDocs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);

  // Load docs list
  useEffect(() => {
    const load = async () => {
      setLoadingDocs(true);
      try {
        const res = await fetch(
          `http://localhost:5000/api/public/transactions/${id}/docs`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Erreur chargement docs");
        setDocs(Array.isArray(data) ? data : []);
      } catch (e) {
        setError("❌ " + e.message);
      } finally {
        setLoadingDocs(false);
      }
    };
    load();
  }, [id]);

  // Handle selection of a document
  const handleSelectDoc = (docId) => {
    setSelectedDocId(docId);
  };

  const firstDocId = docs?.[0]?.id;
  const pdfUrl = selectedDocId
    ? `http://localhost:5000/api/public/docs/${selectedDocId}/pdf`
    : firstDocId
    ? `http://localhost:5000/api/public/docs/${firstDocId}/pdf`
    : "";

  /* 🔐 Vérification du PIN */
  const checkPin = async () => {
    setError("");
    setPinValid(false);

    try {
      const res = await fetch(
        `http://localhost:5000/api/public/transactions/${id}/check-pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }
      );
      if (!res.ok) throw new Error();
      setPinValid(true);
    } catch {
      setError("❌ Code PIN incorrect");
    }
  };

  /* ✍️ Signature (toute la transaction) */
  const handleSign = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `http://localhost:5000/api/public/transactions/${id}/sign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Erreur de signature");
      }

      setSigned(true);
    } catch (e) {
      setError("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  };

  /* =================== SUCCÈS =================== */
  if (signed) {
    return (
      <div className="signature-success-page">
        <div className="success-icon">✓</div>

        <h2>Transaction signée avec succès</h2>
        <p>
          Toutes les factures de cette transaction ont été signées.
          <br />
          Vous pouvez retourner au tableau de bord.
        </p>

        <button
          className="home-btn"
          onClick={() => navigate("/dashboard")}
          title="Retour au tableau de bord"
        >
          <FaHome />
        </button>
      </div>
    );
  }

  /* =================== PAGE SIGNATURE =================== */
  return (
    <div className="signature-page">
      <div className="signature-layout">
        {/* GAUCHE : PDF preview (premier doc) */}
        <div className="signature-left">
          {loadingDocs ? (
            <div style={{ padding: 20 }}>Chargement PDF...</div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="Facture PDF"
              className="signature-pdf-iframe"
            />
          ) : (
            <div style={{ padding: 20 }}>Aucun document</div>
          )}
        </div>

        {/* DROITE : ACTIONS */}
        <div className="signature-right">
          <div className="signature-card">
            <header className="signature-header">
              <h2>Signature électronique</h2>
              <p>Un seul PIN signera toutes les factures de la transaction</p>
            </header>

            {/* Liste docs */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: "10px 0", fontWeight: 700 }}>
                Factures dans cette transaction :
              </p>
              {loadingDocs ? (
                <p>Chargement...</p>
              ) : docs.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {docs.map((d, index) => (
                    <div
                      key={d.id}
                      onClick={() => handleSelectDoc(d.id)}
                      style={{
                        padding: "8px 10px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        background: "#fff",
                        fontSize: 13,
                        display: "flex",
                        justifyContent: "space-between",
                        cursor: "pointer",
                      }}
                    >
                      <span>📄 Facture {index + 1}: {d.filename}</span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: d.statut === "signée" ? "#16a34a" : "#64748b",
                        }}
                      >
                        {d.statut}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Aucun document.</p>
              )}
            </div>

            <div className="signature-form">
              <input
                type="password"
                placeholder="Entrer votre code PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />

              <button className="btn ghost" onClick={checkPin} disabled={!pin}>
                Vérifier le PIN
              </button>

              <button
                className="btn primary"
                onClick={handleSign}
                disabled={!pinValid || loading || docs.length === 0}
              >
                {loading ? "Signature en cours..." : "Signer toute la transaction"}
              </button>

              {error && <p className="error">{error}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureSignataire;
