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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 1;

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
  const pdfUrlBase = selectedDocId
    ? `http://localhost:5000/api/public/docs/${selectedDocId}/pdf`
    : firstDocId
    ? `http://localhost:5000/api/public/docs/${firstDocId}/pdf`
    : "";
  
  // Add params to hide toolbar and fit page
  const pdfUrl = pdfUrlBase ? `${pdfUrlBase}#toolbar=0&navpanes=0&scrollbar=0&view=FitH` : "";

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDocs = docs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(docs.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    // Auto-select the document on the new page
    const nextDoc = docs[pageNumber - 1];
    if (nextDoc) setSelectedDocId(nextDoc.id);
  };

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
      setError("Code PIN incorrect");
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
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* =================== SUCCÈS =================== */
  if (signed) {
    return (
      <div className="signature-success-container">
        <div className="signature-success-card">
          <div className="success-lottie-wrap">
             <FaCheckCircle className="success-check-icon" />
          </div>

          <h2 className="success-title">Transaction Finalisée</h2>
          <p className="success-desc">
            Toutes les factures de cette transaction ont été signées numériquement avec succès. 
            Les documents sont désormais disponibles dans votre espace personnel.
          </p>

          <button
            className="success-home-btn"
            onClick={() => navigate("/dashboard")}
          >
            <FaHome /> <span>Retour au Tableau de Bord</span>
          </button>
        </div>
      </div>
    );
  }

  /* =================== PAGE SIGNATURE =================== */
  return (
    <div className="sig-page">
      <div className="sig-container">
        {/* SIDEBAR GAUCHE : DOCUMENTS */}
        <div className="sig-sidebar">
           <div className="sig-sidebar-header">
              <h3>Documents</h3>
              <span className="sig-badge">{docs.length} fichiers</span>
           </div>
           
           <div className="sig-doc-list">
              {loadingDocs ? (
                <div className="sig-loading">Chargement...</div>
              ) : docs.length ? (
                <>
                  <div className="sig-doc-items-container">
                    {currentDocs.map((d, index) => {
                      const actualIndex = (currentPage - 1) * itemsPerPage + index + 1;
                      return (
                        <div 
                          key={d.id} 
                          className={`sig-doc-item ${selectedDocId === d.id || (!selectedDocId && actualIndex === 1) ? 'active' : ''}`}
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
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div className="sig-pagination">
                      <button 
                        className="sig-pag-btn" 
                        disabled={currentPage === 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                        title="Page précédente"
                      >
                        <FaChevronLeft /> <span>Back</span>
                      </button>
                      <div className="sig-pag-dots">
                        {Array.from({ length: totalPages }, (_, i) => (
                          <div 
                            key={i} 
                            className={`sig-pag-dot ${currentPage === i + 1 ? 'active' : ''}`}
                            onClick={() => handlePageChange(i + 1)}
                          />
                        ))}
                      </div>
                      <button 
                        className="sig-pag-btn" 
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
                        title="Page suivante"
                      >
                        <span>Next</span> <FaChevronRight />
                      </button>
                    </div>
                  )}
                </>
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
                <div className="sig-input-wrapper">
                  <input
                    type="password"
                    placeholder="Code PIN"
                    className="sig-pin-input"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </div>

                {!pinValid ? (
                  <button className="sig-btn sig-btn-secondary" onClick={checkPin} disabled={!pin}>
                    Vérifier le PIN
                  </button>
                ) : (
                  <button
                    className="sig-btn sig-btn-primary"
                    onClick={handleSign}
                    disabled={loading || docs.length === 0}
                  >
                    {loading ? (
                      <span className="loader-span">Signature...</span>
                    ) : (
                      "Signer la Transaction"
                    )}
                  </button>
                )}

                {error && (
                  <div className="sig-error-msg">
                    <FaExclamationCircle /> {error}
                  </div>
                )}
                
                {pinValid && !signed && !error && (
                   <div className="sig-valid-msg">
                      <FaCheckCircle /> PIN validé. Prêt à signer.
                   </div>
                )}
              </div>
           </div>
        </div>

        {/* CONTENU DROITE : VIEWER */}
        <div className="sig-viewer">
          {loadingDocs ? (
            <div className="sig-viewer-empty">
               <div className="sig-spinner"></div>
               <p>Préparation de l'aperçu...</p>
            </div>
          ) : pdfUrl ? (
            <div className="sig-iframe-wrapper">
              <iframe
                src={pdfUrl}
                title="Facture PDF"
                className="sig-pdf-iframe"
              />
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
