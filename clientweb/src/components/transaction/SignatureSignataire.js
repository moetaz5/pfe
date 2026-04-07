import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaHome, FaFilePdf, FaLock, FaCheckCircle, FaExclamationCircle, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
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
          `/api/public/transactions/${id}/docs`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Erreur chargement docs");
        const documents = Array.isArray(data) ? data : [];
        setDocs(documents);
        if (documents.length > 0 && !selectedDocId) {
          setSelectedDocId(documents[0].id);
        }
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
  const pdfUrlBase = selectedDocId
    ? `/api/public/docs/${selectedDocId}/pdf`
    : firstDocId
    ? `/api/public/docs/${firstDocId}/pdf`
    : "";
  
  const pdfUrl = pdfUrlBase ? `${pdfUrlBase}#toolbar=0&navpanes=0&scrollbar=0&view=FitH` : "";

  /* 🔐 Vérification du PIN */
  const checkPin = async () => {
    setError("");
    setPinValid(false);

    try {
      const res = await fetch("http://127.0.0.1:9000/sign/xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          checkOnly: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === "TOKEN_NOT_FOUND") throw new Error("Veuillez insérer votre clé TunTrust.");
        if (data.error === "PIN_INCORRECT") throw new Error("Le code PIN saisi est incorrect.");
        throw new Error(data.message || "Erreur moteur local");
      }
      setPinValid(true);
    } catch (e) {
      if (e instanceof TypeError) {
        setError("❌ Veuillez installer et lancer votre moteur de signature local.");
      } else {
        setError("❌ " + e.message);
      }
    }
  };

  /* ✍️ Signature */
  const handleSign = async () => {
    setLoading(true);
    setError("");

    try {
      const resData = await fetch(`/api/public/transactions/${id}/prepare-signature`);
      if (!resData.ok) {
        if (resData.status === 402) throw new Error("Solde insuffisant. Veuillez acheter des jetons.");
        throw new Error("Erreur de préparation des documents.");
      }
      const { docsToSign } = await resData.json();
      const signedResults = [];

      for (const doc of docsToSign) {
        try {
          const signRes = await fetch("http://127.0.0.1:9000/sign/xml", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pin,
              xmlBase64: doc.xmlBase64,
            }),
          });

          if (!signRes.ok) {
            const errData = await signRes.json();
            throw new Error(errData.message || `Erreur signature : ${doc.filename}`);
          }

          const signData = await signRes.json();
          signedResults.push({
            id: doc.id,
            xmlSigned: signData.signedXmlBase64,
          });
        } catch (e) {
           throw e;
        }
      }

      const finalRes = await fetch(`/api/public/transactions/${id}/finalize-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedResults }),
      });

      if (!finalRes.ok) throw new Error("Erreur lors de la finalisation.");
      setSigned(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (signed) {
    return (
      <div className="signature-success-container">
        <div className="signature-success-card">
          <FaCheckCircle className="success-check-icon" />
          <h2 className="success-title">Transaction Signée !</h2>
          <p className="success-desc">
            Toutes les factures ont été signées avec succès. 
            Les documents sont maintenant archivés et sécurisés.
          </p>
          <button className="success-home-btn" onClick={() => navigate("/dashboard")}>
            <FaHome /> <span>Mon Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sig-page">
      <div className="sig-container">
        {/* SIDEBAR : DOCUMENTS LIST */}
        <div className="sig-sidebar">
           <div className="sig-sidebar-header">
              <h3>Documents</h3>
              <span className="sig-badge">{docs.length} fichiers</span>
           </div>
           
           <div className="sig-doc-list">
              {loadingDocs ? (
                <div className="sig-loading">Préparation...</div>
              ) : docs.length ? (
                <div className="sig-doc-items-container">
                  {docs.map((d, idx) => (
                    <div 
                      key={d.id} 
                      className={`sig-doc-item ${selectedDocId === d.id ? 'active' : ''}`}
                      onClick={() => handleSelectDoc(d.id)}
                    >
                      <div className="sig-doc-icon">
                        <FaFilePdf />
                      </div>
                      <div className="sig-doc-info">
                        <p className="sig-doc-name">{d.filename}</p>
                        <p className="sig-doc-status">{d.statut}</p>
                      </div>
                      {d.statut === "signée" && <FaCheckCircle className="sig-signed-icon" />}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sig-no-docs">Aucun document.</p>
              )}
           </div>

           <div className="sig-action-card">
              <div className="sig-pin-header">
                  <FaLock className="lock-icon" />
                  <h4>Validation Sécurisée</h4>
              </div>
              <div className="sig-form">
                <input
                  type="password"
                  placeholder="Code PIN"
                  className="sig-pin-input"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />

                {!pinValid ? (
                  <button className="sig-btn sig-btn-secondary" onClick={checkPin} disabled={!pin}>
                    Vérifier le PIN
                  </button>
                ) : (
                  <button className="sig-btn sig-btn-primary" onClick={handleSign} disabled={loading || docs.length === 0}>
                    {loading ? "Calcul des signatures..." : "Tout Signer"}
                  </button>
                )}

                {error && <div className="sig-error-msg"><FaExclamationCircle /> {error}</div>}
                {pinValid && !signed && !error && <div className="sig-valid-msg"><FaCheckCircle /> PIN validé. Prêt à signer.</div>}
              </div>
           </div>
        </div>

        {/* VIEWER CONTENT */}
        <div className="sig-viewer">
          {loadingDocs ? (
            <div className="sig-viewer-empty">
               <p>Chargement du document...</p>
            </div>
          ) : pdfUrl ? (
            <div className="sig-iframe-wrapper">
              <iframe src={pdfUrl} title="Aperçu PDF" className="sig-pdf-iframe" />
            </div>
          ) : (
            <div className="sig-viewer-empty">
              <FaFilePdf size={48} />
              <p>Aucun document sélectionné</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignatureSignataire;
