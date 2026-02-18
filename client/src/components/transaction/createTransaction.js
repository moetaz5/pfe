/* ==========================================================
   CreateTransaction.jsx
   Version: Exclusive mode (Upload Only) + Toastify + FaHome
   + NEW: Modal Position (QR + REF) applied to current imported PDF
   ========================================================== */

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

      <div style={{ fontWeight: 900, fontSize: 14 }}>{active ? "✅" : "⬜"}</div>
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
      <div className="modal-content">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <h3 style={{ margin: 0 }}>{title}</h3>
          <X onClick={onClose} style={{ cursor: "pointer" }} />
        </div>

        <div style={{ marginTop: 12 }}>{children}</div>

        {footer ? <div style={{ marginTop: 14 }}>{footer}</div> : null}
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

    if (xmlFiles.length !== 1) {
      notify.error("Importez un seul XML.");
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

    // Ajout du fichier XML
    if (xmlFiles.length === 1) {
      formData.append("xml_files", xmlFiles[0]);
    }

    try {
      const res = await fetch("http://localhost:5000/api/transactions", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        notify.success("✅ Transaction créée avec succès. Redirection...");

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
      {/* ✅ Notifications container */}
      <ToastContainer
        position="top-right"
        newestOnTop
        closeOnClick
        pauseOnHover
      />

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
              ✅ Transaction créée avec succès.
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
                  onClick={() => {
                    pdfInputRef.current?.click();
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <FileUp size={18} />
                  {pdfFiles.length ? "1 PDF importé" : "Importer un PDF (obligatoire)"}
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
                        onRemove={() => {
                          setPdfFiles((prev) =>
                            prev.filter((file) => file.name !== f.name),
                          );
                          // reset configs if pdf removed
                          setQrConfig(null);
                          setRefConfig(null);

                          notify.info(`PDF retiré: ${f.name}`);
                        }}
                        titleRemove="Retirer"
                      />
                    ))}
                  </MiniList>
                )}

                {/* ✅ NEW: Button to open position modal (only if PDF ready) */}
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
                      <strong>{qrConfig ? "✅ défini" : "—"}</strong>
                      <span style={{ marginLeft: 10 }}>Référence:</span>
                      <strong>{refConfig ? "✅ définie" : "—"}</strong>
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
                 Section: XML Upload (Always mandatory)
                 ================================================== */}
              <div style={{ marginTop: 18 }}>
                <SectionTitle
                  icon={<FileText size={18} />}
                  title="Importer le XML"
                  subtitle="Obligatoire dans tous les cas"
                />

                <div
                  className="upload-box"
                  onClick={() => xmlInputRef.current?.click()}
                  style={{ cursor: "pointer" }}
                >
                  <FileText size={18} />
                  {xmlFiles.length ? "1 XML importé" : "Importer un XML (obligatoire)"}
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
                        onRemove={() => {
                          setXmlFiles((prev) =>
                            prev.filter((file) => file.name !== f.name),
                          );
                          notify.info(`XML retiré: ${f.name}`);
                        }}
                        titleRemove="Retirer"
                      />
                    ))}
                  </MiniList>
                )}
              </div>

              {/* ==================================================
                 Submit
                 ================================================== */}
              <div className="form-actions" style={{ marginTop: 18 }}>
                <button className="btn btn-primary" disabled={isSubmitting}>
                  <Save size={18} /> {isSubmitting ? "Création..." : "Créer"}
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
                      notify.success("✅ Positions enregistrées pour cette transaction.");
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
