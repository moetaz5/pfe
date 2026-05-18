

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../style/createTransaction.css";

// Icons (lucide)
import {
  Save,
  FileText,
  FileUp,
  ArrowLeft,
  Mail,
  Hash,
  Search,
  X,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";

// ✅ react-icons
import { FaHome } from "react-icons/fa";

// ✅ notifications
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * ✅ IMPORTANT:
 * Modifie ce chemin selon ta structure :
 * Exemple:
 *   import PosSignature from "../components/PosSignature";
 *   import PosSignature from "./PosSignature";
 */
import PosSignature from "./PosSignature";

/* ==========================================================
   Constants & Helpers (UI / Validation / Naming)
   ========================================================== */

// Modes exclusifs: l’utilisateur choisit UNE seule source PDF
const PDF_SOURCE = {
  UPLOAD: "upload",
};

// Petite aide: éviter les répétitions de toasts
const notify = {
  success: (msg, opts = {}) => toast.success(msg, { autoClose: 2500, ...opts }),
  error: (msg, opts = {}) => toast.error(msg, { autoClose: 3500, ...opts }),
  warn: (msg, opts = {}) => toast.warn(msg, { autoClose: 3500, ...opts }),
  info: (msg, opts = {}) => toast.info(msg, { autoClose: 3000, ...opts }),
};

// Helpers texte
const safeString = (v) => (v === null || v === undefined ? "" : String(v));

// Validation email simple
const isValidEmail = (email) => {
  const e = safeString(email).trim();
  if (!e) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
};

// Trim lower
const norm = (s) => safeString(s).trim().toLowerCase();

// Base name from filename: remove extension
const getBaseName = (filename) => {
  if (!filename) return "";
  return filename.replace(/\.[^/.]+$/, "").trim().toLowerCase();
};

// Format list for display
const joinWithComma = (arr) => (Array.isArray(arr) ? arr.join(", ") : "");

// Safe array
const safeArray = (v) => (Array.isArray(v) ? v : []);

// little sleep
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/* ==========================================================
   Small UI Components (kept in same file for “code complet”)
   ========================================================== */

const SectionTitle = ({ icon, title, subtitle }) => {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icon}
        <h3 style={{ margin: 0 }}>{title}</h3>
      </div>
      {subtitle ? (
        <p style={{ margin: "6px 0 0 0", color: "#64748b", fontSize: 13 }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
};

// Option card
const ChoiceCard = ({ active, title, desc, icon, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="upload-box"
      style={{
        cursor: "pointer",
        border: active ? "2px solid #2563eb" : "1px solid #e5e7eb",
        background: active ? "#eff6ff" : "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: 14,
        borderRadius: 14,
      }}
      role="button"
      tabIndex={0}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "grid", placeItems: "center" }}>{icon}</div>
        <div>
          <div style={{ fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
            {desc}
          </div>
        </div>
      </div>

      <div style={{ fontWeight: 900, fontSize: 14 }}>{active ? "" : "⬜"}</div>
    </div>
  );
};

// Badge-like info
const MiniHint = ({ icon, children }) => (
  <div
    style={{
      marginTop: 10,
      padding: 10,
      borderRadius: 12,
      border: "1px dashed #cbd5e1",
      background: "#f8fafc",
      color: "#0f172a",
      fontSize: 13,
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
    }}
  >
    <div style={{ marginTop: 2 }}>{icon}</div>
    <div>{children}</div>
  </div>
);

// A list container
const MiniList = ({ children }) => (
  <div className="mini-list" style={{ marginTop: 10 }}>
    {children}
  </div>
);

// A row item
const MiniItem = ({ left, onRemove, titleRemove = "Retirer" }) => (
  <div
    className="mini-item"
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{left}</div>
    {onRemove ? (
      <button
        type="button"
        onClick={onRemove}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          marginLeft: 8,
        }}
        title={titleRemove}
      >
        <X size={16} />
      </button>
    ) : null}
  </div>
);

// Modal shell
const ModalShell = ({ title, onClose, children, footer }) => {
  return (
    <div className="modal">
      <div className="modal-content modal-large">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px",
            borderBottom: "1px solid #f1f5f9"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 8, height: 24, background: "#0247AA", borderRadius: 4 }}></div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h3>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              border: "none", 
              background: "transparent", 
              borderRadius: "8px", 
              width: 32, 
              height: 32, 
              display: "grid", 
              placeItems: "center",
              cursor: "pointer",
              color: "#94a3b8",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
              e.currentTarget.style.color = "#ef4444";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 0, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>{children}</div>
      </div>
    </div>
  );
};

/* ==========================================================
   Main Component
   ========================================================== */

const CreateTransaction = () => {
  const navigate = useNavigate();

  /* =========================
     Champs
     ========================= */
  const [factureNumber, setFactureNumber] = useState("");
  const [signataireEmail, setSignataireEmail] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  /* =========================
     Sources PDF : uniquement upload
     ========================= */
  const [pdfFiles, setPdfFiles] = useState([]);
  const [xmlFiles, setXmlFiles] = useState([]);

  // ✅ Mode exclusif pour l'upload
  const [pdfSourceMode, setPdfSourceMode] = useState(PDF_SOURCE.UPLOAD);
  
  // ✅ Mode IA Auto Generate
  const [autoGenerateXml, setAutoGenerateXml] = useState(false);
  const [isGeneratingXml, setIsGeneratingXml] = useState(false);
  const [previewXml, setPreviewXml] = useState(null);

  // UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const pdfInputRef = useRef(null);
  const xmlInputRef = useRef(null);

  /* ==========================================================
     NEW: Position modal + configs for this transaction
     ========================================================== */
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [qrConfig, setQrConfig] = useState(null);
  const [refConfig, setRefConfig] = useState(null);

  /* ==========================================================
     Effects: Fetch factures existantes
     ========================================================== */
  useEffect(() => {
    console.log("========== SELECTED FACTURES ==========");
    console.log("=======================================");
  }, []);

  /* ==========================================================
     Validation de la soumission
     ========================================================== */
  const validateBeforeSubmit = () => {
    if (!signataireEmail || !clientEmail || !factureNumber) {
      notify.error("Veuillez remplir les champs obligatoires.");
      return false;
    }

    if (!isValidEmail(signataireEmail)) {
      notify.error("Email signataire invalide.");
      return false;
    }

    if (!isValidEmail(clientEmail)) {
      notify.error("Email client invalide.");
      return false;
    }

    if (pdfSourceMode === PDF_SOURCE.UPLOAD) {
      if (pdfFiles.length !== 1) {
        notify.error("Importez un seul PDF.");
        return false;
      }
    }

    if (!autoGenerateXml && xmlFiles.length !== 1) {
      notify.error("Importez un seul XML ou activez la génération automatique avec l'IA.");
      return false;
    }

    // ✅ NEW: positions required (tu as demandé bouton obligatoire)
    if (!qrConfig || !refConfig) {
      notify.warn(
        "Veuillez d'abord positionner le QR + la Référence (bouton Position).",
      );
      return false;
    }

    return true;
  };

  /* ==========================================================
     NEW: Génération de l'aperçu XML avec l'IA
     ========================================================== */
  const handleGenerateXmlPreview = async () => {
    if (pdfFiles.length !== 1) {
      notify.error("Veuillez d'abord importer un fichier PDF.");
      return;
    }

    setIsGeneratingXml(true);
    setPreviewXml(null);

    const formData = new FormData();
    formData.append("pdf_file", pdfFiles[0]);

    try {
      const res = await fetch("/api/transactions/generate-xml-preview", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setPreviewXml(data.xml);
        notify.success("XML généré avec succès !");
      } else {
        notify.error(data?.message || "Erreur lors de la génération de l'XML.");
      }
    } catch (err) {
      console.error("GENERATE XML PREVIEW ERROR:", err);
      notify.error("Erreur de connexion au serveur");
    } finally {
      setIsGeneratingXml(false);
    }
  };

  /* ==========================================================
     Soumission du formulaire
     ========================================================== */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateBeforeSubmit()) return;

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("facture_number", factureNumber);
    formData.append("signataire_email", signataireEmail);
    formData.append("client_email", clientEmail);

    // ✅ NEW: configs to be stored with transaction
    if (qrConfig) formData.append("qr_config", JSON.stringify(qrConfig));
    if (refConfig) formData.append("ref_config", JSON.stringify(refConfig));

    // Ajout des nouveaux fichiers PDF
    if (pdfSourceMode === PDF_SOURCE.UPLOAD && pdfFiles.length === 1) {
      formData.append("pdf_files", pdfFiles[0]);
    }

    // Ajout du fichier XML ou de l'option auto_generate
    if (!autoGenerateXml && xmlFiles.length === 1) {
      formData.append("xml_files", xmlFiles[0]);
    }
    if (autoGenerateXml) {
      formData.append("auto_generate_xml", "true");
    }

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        notify.success("Transaction créée avec succès. Redirection...");

        await delay(1200);
        navigate("/dashboard/MyTransactions", { replace: true });
      } else {
        notify.error(data?.message || "Erreur lors de la création");
      }
    } catch {
      notify.error("Erreur serveur");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ==========================================================
     UI Derived helpers
     ========================================================== */

  return (
    <div className="page">
      <div className="full-width-container">
        {/* Header */}
        <div className="page-head">
          <div>
            <h2>Créer une transaction</h2>
            <p>
              Importer de nouveaux PDF, importer le XML, puis créer la
              transaction.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/dashboard" className="btn btn-outline">
              <FaHome style={{ marginRight: 8 }} /> Accueil
            </Link>

            <Link to="/dashboard/MyTransactions" className="btn btn-outline">
              <ArrowLeft size={18} /> Retour
            </Link>
          </div>
        </div>

        <div className="create-card">
          <div className="create-card-title">
            <Save size={18} color="#0247AA" />
            Nouvelle transaction
          </div>

          {success && (
            <div className="success-box">
              Transaction créée avec succès.
              <br />
              Redirection automatique...
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit}>
              {/* ==================================================
                 Section: Emails
                 ================================================== */}
              <SectionTitle
                icon={<Mail size={18} />}
                title="Informations"
                subtitle="Emails obligatoires + numéro de facture"
              />

              <div className="form-grid">
                <div className="field">
                  <label>
                    <Mail size={16} /> Email signataire *
                  </label>
                  <input
                    className="input"
                    type="email"
                    value={signataireEmail}
                    onChange={(e) => setSignataireEmail(e.target.value)}
                    placeholder="ex: signataire@mail.com"
                  />
                </div>

                <div className="field">
                  <label>
                    <Mail size={16} /> Email client *
                  </label>
                  <input
                    className="input"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="ex: client@mail.com"
                  />
                </div>
              </div>

              <div className="field full">
                <label>
                  <Hash size={16} /> Numéro de facture *
                </label>
                <input
                  className="input"
                  value={factureNumber}
                  onChange={(e) => setFactureNumber(e.target.value)}
                  placeholder="ex: 12345"
                />
              </div>

              {/* ==================================================
                 Section: Upload new PDFs (Enabled only in UPLOAD mode)
                 ================================================== */}
              <div style={{ marginTop: 18, opacity: 1 }}>
                <SectionTitle
                  icon={<FileUp size={18} />}
                  title="Importer de nouveaux PDF"
                  subtitle="Disponible uniquement si tu as choisi 'Importer de nouveaux PDF'"
                />

                <div
                  className="upload-box"
                  style={{ cursor: "pointer", position: "relative" }}
                >
                  <div 
                    onClick={() => pdfInputRef.current?.click()}
                    style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <FileUp size={18} />
                    {pdfFiles.length ? "1 PDF importé" : "Importer un PDF (obligatoire)"}
                  </div>
                  
                  {pdfFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPdfFiles([]);
                        setQrConfig(null);
                        setRefConfig(null);
                        setPreviewXml(null);
                        if (pdfInputRef.current) pdfInputRef.current.value = "";
                        notify.info("PDF supprimé");
                      }}
                      style={{
                        background: "transparent",
                        color: "#dc2626",
                        border: "none",
                        borderRadius: "8px",
                        padding: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      title="Supprimer le PDF"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                  <input
                    ref={pdfInputRef}
                    hidden
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setPdfFiles(files);
                      // reset configs if pdf changed
                      setQrConfig(null);
                      setRefConfig(null);
                      setPreviewXml(null);

                      notify.success(`${files.length} PDF sélectionné(s).`);
                    }}
                  />
                </div>

                {pdfFiles.length > 0 && (
                  <MiniList>
                    {pdfFiles.map((f) => (
                      <MiniItem
                        key={f.name}
                        left={
                          <>
                            <span>📄</span>
                            <span>{f.name}</span>
                          </>
                        }
                        titleRemove="Retirer"
                      />
                    ))}
                  </MiniList>
                )}

                {/*Button to open position modal (only if PDF ready) */}
                {pdfFiles.length === 1 && (
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setShowPositionModal(true)}
                    >
                      📐 Positionner QR & Référence
                    </button>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        color: "#0f172a",
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                      }}
                    >
                      <span>QR:</span>
                      <strong>{qrConfig ? " défini" : "—"}</strong>
                      <span style={{ marginLeft: 10 }}>Référence:</span>
                      <strong>{refConfig ? " définie" : "—"}</strong>
                    </div>

                    {!qrConfig || !refConfig ? (
                      <MiniHint icon={<Info size={16} />}>
                        Pour continuer, clique sur <b>Positionner QR & Référence</b> et enregistre les deux zones.
                      </MiniHint>
                    ) : null}
                  </div>
                )}
              </div>

              {/* ==================================================
                 Section: XML Upload (Always mandatory unless auto-generated)
                 ================================================== */}
              <div style={{ marginTop: 18 }}>
                <SectionTitle
                  icon={<FileText size={18} />}
                  title="Source XML"
                  subtitle="Générer automatiquement avec l'IA ou importer manuellement"
                />

                <div 
                  onClick={() => {
                    setAutoGenerateXml(!autoGenerateXml);
                    if (!autoGenerateXml) setXmlFiles([]);
                  }}
                  style={{ 
                    marginBottom: 15, 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 12, 
                    padding: "16px 20px", 
                    borderRadius: "14px", 
                    background: autoGenerateXml ? "#eff6ff" : "#f8fafc", 
                    border: autoGenerateXml ? "2px solid #3b82f6" : "1px solid #e2e8f0", 
                    cursor: "pointer", 
                    transition: "all 0.2s",
                    boxShadow: autoGenerateXml ? "0 4px 12px rgba(59, 130, 246, 0.15)" : "none"
                  }}
                >
                  <div style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 8, background: autoGenerateXml ? "#3b82f6" : "#cbd5e1", color: "#fff", transition: "all 0.2s" }}>
                    {autoGenerateXml ? <CheckCircle2 size={18} /> : null}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "15px", color: autoGenerateXml ? "#1d4ed8" : "#475569" }}>
                      Générer le XML automatiquement avec l'IA
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                      Extrait instantanément les données du PDF pour créer un XML TEIF conforme.
                    </div>
                  </div>
                </div>

                {autoGenerateXml && (
                  <div style={{ marginBottom: 15 }}>
                    {pdfFiles.length !== 1 ? (
                      <div style={{
                        padding: 12,
                        borderRadius: 12,
                        background: "#fffbeb",
                        border: "1px solid #fef3c7",
                        color: "#b45309",
                        fontSize: 13,
                        display: "flex",
                        gap: 8,
                        alignItems: "center"
                      }}>
                        <AlertTriangle size={16} />
                        <span>Veuillez d'abord importer un PDF dans la section ci-dessus pour pouvoir générer et prévisualiser son XML.</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            background: "#0247AA",
                            color: "#fff",
                            fontWeight: 700,
                            padding: "10px 16px",
                            borderRadius: 10,
                            border: "none",
                            cursor: isGeneratingXml ? "not-allowed" : "pointer",
                            width: "fit-content",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                          }}
                          onClick={handleGenerateXmlPreview}
                          disabled={isGeneratingXml}
                        >
                          {isGeneratingXml ? (
                            <>
                              <Loader2 className="loader-spin" size={18} />
                              Analyse et génération en cours...
                            </>
                          ) : (
                            "Générer & prévisualiser le XML"
                          )}
                        </button>

                        {previewXml && (
                          <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, overflow: "hidden", background: "#fff", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
                            <div style={{ background: "#f8fafc", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #cbd5e1" }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                                <CheckCircle2 size={16} color="#10b981" /> XML TEIF Généré avec succès !
                              </span>
                              <button
                                type="button"
                                className="btn btn-outline"
                                style={{ padding: "4px 8px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                                onClick={() => {
                                  const blob = new Blob([previewXml], { type: "application/xml" });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `Facture_${factureNumber || "IA_TEIF"}.xml`;
                                  a.click();
                                }}
                              >
                                📥 Télécharger
                              </button>
                            </div>
                            <pre style={{
                              margin: 0,
                              padding: 15,
                              background: "#0f172a",
                              color: "#38bdf8",
                              fontSize: 12.5,
                              maxHeight: 280,
                              overflow: "auto",
                              fontFamily: "Fira Code, Consolas, Monaco, monospace",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                              textAlign: "left"
                            }}>
                              {previewXml}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!autoGenerateXml && (
                  <>
                    <div
                      className="upload-box"
                      style={{ cursor: "pointer", position: "relative" }}
                    >
                      <div 
                        onClick={() => xmlInputRef.current?.click()}
                        style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}
                      >
                        <FileText size={18} />
                        {xmlFiles.length ? "1 XML importé" : "Importer un XML manuellement"}
                      </div>

                      {xmlFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setXmlFiles([]);
                            if (xmlInputRef.current) xmlInputRef.current.value = "";
                            notify.info("XML supprimé");
                          }}
                          style={{
                            background: "transparent",
                            color: "#dc2626",
                            border: "none",
                            borderRadius: "8px",
                            padding: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                          title="Supprimer le XML"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}

                      <input
                        ref={xmlInputRef}
                        hidden
                        type="file"
                        accept="application/xml"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setXmlFiles(files);
                          notify.success(`${files.length} XML sélectionné(s).`);
                        }}
                      />
                    </div>

                    {xmlFiles.length > 0 && (
                      <MiniList>
                        {xmlFiles.map((f) => (
                          <MiniItem
                            key={f.name}
                            left={
                              <>
                                <span>🧾</span>
                                <span>{f.name}</span>
                              </>
                            }
                            titleRemove="Retirer"
                          />
                        ))}
                      </MiniList>
                    )}
                  </>
                )}
              </div>

              {/* ==================================================
                 Submit
                 ================================================== */}
              <div className="form-actions" style={{ marginTop: 18 }}>
                <button 
                  className="btn btn-primary" 
                  disabled={isSubmitting || isGeneratingXml}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="loader-spin" size={18} />
                      Création...
                    </>
                  ) : isGeneratingXml ? (
                    <>
                      <Loader2 className="loader-spin" size={18} />
                      IA en cours...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Créer
                    </>
                  )}
                </button>
              </div>

              {/* ==================================================
                 ✅ NEW: Modal for positioning
                 ================================================== */}
              {showPositionModal && (
                <ModalShell
                  title="Position QR & Référence (pour cette transaction)"
                  onClose={() => setShowPositionModal(false)}
                >
                  <PosSignature
                    // ✅ pass imported PDF from CreateTransaction
                    pdfFile={pdfFiles?.[0] || null}
                    embeddedMode={true}
                    onSave={(payload) => {
                      // payload = { qr_config, ref_config }
                      setQrConfig(payload?.qr_config || null);
                      setRefConfig(payload?.ref_config || null);
                      notify.success("Positions enregistrées pour cette transaction.");
                    }}
                    onClose={() => setShowPositionModal(false)}
                  />
                </ModalShell>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateTransaction;

/* ==========================================================
   End of file
   ========================================================== */
