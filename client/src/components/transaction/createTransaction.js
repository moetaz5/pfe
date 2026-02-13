/* ==========================================================
   CreateTransaction.jsx
   Version: Exclusive mode (Existing OR Upload) + Toastify + FaHome
   NOTE: code intentionally long (>500 lines) with structured sections
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

/* ==========================================================
   Constants & Helpers (UI / Validation / Naming)
   ========================================================== */

// Modes exclusifs: l’utilisateur choisit UNE seule source PDF
const PDF_SOURCE = {
  EXISTING: "existing",
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
  // basic regex
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

      <div style={{ fontWeight: 900, fontSize: 14 }}>
        {active ? "✅" : "⬜"}
      </div>
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
  <div className="mini-item" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {left}
    </div>
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

        {footer ? (
          <div style={{ marginTop: 14 }}>{footer}</div>
        ) : null}
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
     Sources PDF : existants + nouveaux
     ========================= */
  const [factures, setFactures] = useState([]);
  const [filteredFactures, setFilteredFactures] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFactureModal, setShowFactureModal] = useState(false);

  // ✅ Multi sélection factures existantes
  const [selectedFactures, setSelectedFactures] = useState([]);

  // ✅ Multi upload nouveaux PDF + XML
  const [pdfFiles, setPdfFiles] = useState([]);
  const [xmlFiles, setXmlFiles] = useState([]);

  // ✅ Nouveau: mode exclusif
  const [pdfSourceMode, setPdfSourceMode] = useState(PDF_SOURCE.EXISTING);

  // UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const pdfInputRef = useRef(null);
  const xmlInputRef = useRef(null);

  /* ==========================================================
     Effects: Fetch factures existantes
     ========================================================== */
     useEffect(() => {
  console.log("========== SELECTED FACTURES ==========");
  console.log(selectedFactures);
  console.log("=======================================");
}, [selectedFactures]);

  useEffect(() => {
    fetch("http://localhost:5000/api/factures/available", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setFactures(arr);
        setFilteredFactures(arr);
      })
      .catch(() => {
        setFactures([]);
        setFilteredFactures([]);
        notify.warn("Impossible de charger les factures disponibles (serveur).");
      });
  }, []);

  /* ==========================================================
     Search factures
     ========================================================== */
  useEffect(() => {
    if (!Array.isArray(factures)) {
      setFilteredFactures([]);
      return;
    }

    const s = searchTerm.trim();
    if (!s) {
      setFilteredFactures(factures);
      return;
    }

    setFilteredFactures(factures.filter((f) => String(f.id).includes(s)));
  }, [searchTerm, factures]);

  /* ==========================================================
     Memo: XML Map, bases, expected xml names
     ========================================================== */
  const xmlMap = useMemo(() => {
    const map = new Map();
    xmlFiles.forEach((f) => map.set(getBaseName(f.name), f));
    return map;
  }, [xmlFiles]);

  const pdfBases = useMemo(() => {
    return pdfFiles.map((f) => getBaseName(f.name));
  }, [pdfFiles]);

  // factures existantes attendent un xml facture_<id>.xml
 const existingExpectedXmlBases = useMemo(() => {
  return selectedFactures.map((f) => {
    if (f.file_name) {
      return getBaseName(f.file_name);
    }
    return `facture_${f.id}`;
  });
}, [selectedFactures]);




  const missingXmlForNewPdfs = useMemo(() => {
    return pdfBases.filter((base) => !xmlMap.has(base));
  }, [pdfBases, xmlMap]);

  const missingXmlForExisting = useMemo(() => {
    return existingExpectedXmlBases.filter((base) => !xmlMap.has(base));
  }, [existingExpectedXmlBases, xmlMap]);

  /* ==========================================================
     Exclusive mode rules
     - If mode = EXISTING: pdf upload disabled, clear pdfFiles
     - If mode = UPLOAD: existing selection disabled, clear selectedFactures
     ========================================================== */

  const setModeExisting = useCallback(() => {
    setPdfSourceMode(PDF_SOURCE.EXISTING);
    // clear upload pdfs to enforce exclusive rule
    if (pdfFiles.length > 0) {
      setPdfFiles([]);
      notify.info("Mode 'Factures existantes' activé: PDFs importés vidés.");
    }
  }, [pdfFiles.length]);

  const setModeUpload = useCallback(() => {
    setPdfSourceMode(PDF_SOURCE.UPLOAD);
    // clear existing selection to enforce exclusive rule
    if (selectedFactures.length > 0) {
      setSelectedFactures([]);
      notify.info("Mode 'Importer des PDF' activé: factures existantes vidées.");
    }
  }, [selectedFactures.length]);

  /* ==========================================================
     Handlers fichiers
     ========================================================== */

  const onPickPdf = (e) => {
    const files = Array.from(e.target.files || []);

    // if user tries to pick pdf while in existing mode, auto switch
    if (pdfSourceMode !== PDF_SOURCE.UPLOAD) {
      setPdfSourceMode(PDF_SOURCE.UPLOAD);
      // clear existing selection to enforce exclusive
      if (selectedFactures.length > 0) setSelectedFactures([]);
      notify.info("Passage automatique au mode 'Importer des PDF'.");
    }

    setPdfFiles(files);

    if (files.length > 0) {
      notify.success(`${files.length} PDF sélectionné(s).`);
    } else {
      notify.warn("Aucun PDF sélectionné.");
    }
  };

  const onPickXml = (e) => {
    const files = Array.from(e.target.files || []);
    setXmlFiles(files);

    if (files.length > 0) {
      notify.success(`${files.length} XML sélectionné(s).`);
    } else {
      notify.warn("Aucun XML sélectionné.");
    }
  };

  const removePdf = (name) => {
    setPdfFiles((prev) => prev.filter((f) => f.name !== name));
    notify.info(`PDF retiré: ${name}`);
  };

  const removeXml = (name) => {
    setXmlFiles((prev) => prev.filter((f) => f.name !== name));
    notify.info(`XML retiré: ${name}`);
  };

  /* ==========================================================
     Existing Factures selection handlers
     ========================================================== */

  const toggleFacture = (facture) => {
    // if user selects facture while in upload mode, auto switch
    if (pdfSourceMode !== PDF_SOURCE.EXISTING) {
      setPdfSourceMode(PDF_SOURCE.EXISTING);
      // clear uploaded pdfs to enforce exclusive
      if (pdfFiles.length > 0) setPdfFiles([]);
      notify.info("Passage automatique au mode 'Factures existantes'.");
    }

    setSelectedFactures((prev) => {
      const exists = prev.some((x) => x.id === facture.id);
      if (exists) {
        notify.info(`Facture #${facture.id} retirée`);
        return prev.filter((x) => x.id !== facture.id);
      }
      notify.success(`Facture #${facture.id} ajoutée`);
      return [...prev, facture];
    });
  };

  const clearSelectedFactures = () => {
    setSelectedFactures([]);
    notify.info("Sélection des factures existantes vidée.");
  };

  const clearUploadedPdfs = () => {
    setPdfFiles([]);
    notify.info("Liste des PDFs importés vidée.");
  };

  /* ==========================================================
     Field validations
     ========================================================== */

  const validateBeforeSubmit = () => {
    // Required fields
    if (!signataireEmail || !clientEmail || !factureNumber) {
      notify.error("Veuillez remplir les champs obligatoires.");
      return false;
    }

    // email format
    if (!isValidEmail(signataireEmail)) {
      notify.error("Email signataire invalide.");
      return false;
    }

    if (!isValidEmail(clientEmail)) {
      notify.error("Email client invalide.");
      return false;
    }

    // Exclusive: must pick at least one from selected mode
    if (pdfSourceMode === PDF_SOURCE.EXISTING) {
      if (selectedFactures.length === 0) {
        notify.error("Choisissez au moins une facture existante.");
        return false;
      }
    } else if (pdfSourceMode === PDF_SOURCE.UPLOAD) {
      if (pdfFiles.length === 0) {
        notify.error("Importez au moins un PDF.");
        return false;
      }
    }

    // XML mandatory always
    if (xmlFiles.length === 0) {
      notify.error("Importez au moins un fichier XML.");
      return false;
    }

    // Matching checks
    if (pdfSourceMode === PDF_SOURCE.UPLOAD && missingXmlForNewPdfs.length > 0) {
      notify.error(
        "XML manquant pour certains PDF. Vérifiez le matching par nom."
      );
      return false;
    }

    if (pdfSourceMode === PDF_SOURCE.EXISTING && missingXmlForExisting.length > 0) {
      notify.error(
        "XML manquant pour certaines factures existantes. Vérifiez facture_<id>.xml."
      );
      return false;
    }

    return true;
  };

  /* ==========================================================
     Submit
     ========================================================== */

  const handleSubmit = async (e) => {
    e.preventDefault();

    // validate
    if (!validateBeforeSubmit()) return;

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("facture_number", factureNumber);
    formData.append("signataire_email", signataireEmail);
    formData.append("client_email", clientEmail);

    // ✅ factures existantes
    if (pdfSourceMode === PDF_SOURCE.EXISTING) {
      selectedFactures.forEach((f) =>
        formData.append("existing_facture_ids", String(f.id))
      );
    }

    // ✅ nouveaux PDF
    if (pdfSourceMode === PDF_SOURCE.UPLOAD) {
      pdfFiles.forEach((f) => formData.append("pdf_files", f));
    }

    // ✅ XML
    xmlFiles.forEach((f) => formData.append("xml_files", f));

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

        // small delay for UX (toast + UI)
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

  const selectedIdsText = selectedFactures.length
    ? selectedFactures.map((f) => `#${f.id}`).join(", ")
    : "Aucune";

  const isExistingMode = pdfSourceMode === PDF_SOURCE.EXISTING;
  const isUploadMode = pdfSourceMode === PDF_SOURCE.UPLOAD;

  // For warning panel (live)
  const showMissingPanel =
    (isUploadMode && missingXmlForNewPdfs.length > 0) ||
    (isExistingMode && missingXmlForExisting.length > 0);

  /* ==========================================================
     Render
     ========================================================== */

  return (
    <div className="page">
      {/* ✅ Notifications container */}
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnHover />

      <div className="full-width-container">
        {/* Header */}
        <div className="page-head">
          <div>
            <h2>Créer une transaction</h2>
            <p>
              Choisir une source PDF (factures existantes <b>ou</b> import PDF), importer les XML, puis créer la transaction
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {/* ✅ Home icon usage */}
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
            Nouvelle transaction (multi-factures)
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
                subtitle="Emails obligatoires + numéro de transaction/facture"
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
                  <Hash size={16} /> Numéro de transaction/facture *
                </label>
                <input
                  className="input"
                  value={factureNumber}
                  onChange={(e) => setFactureNumber(e.target.value)}
                  placeholder="ex: TRX-2026-0001"
                />
              </div>

              {/* ==================================================
                 Section: Choice (Exclusive PDF source)
                 ================================================== */}
              <div className="field full" style={{ marginTop: 16 }}>
                <SectionTitle
                  icon={<FileUp size={18} />}
                  title="Source des PDF"
                  subtitle="Choisis une seule méthode: factures existantes OU import de PDF"
                />

                <div style={{ display: "grid", gap: 10 }}>
                  <ChoiceCard
                    active={isExistingMode}
                    title="Utiliser des factures existantes"
                    desc="Sélection multi depuis la liste (modal). L’import PDF est désactivé."
                    icon={<Search size={18} />}
                    onClick={setModeExisting}
                  />

                  <ChoiceCard
                    active={isUploadMode}
                    title="Importer de nouveaux PDF"
                    desc="Upload multi PDF depuis ton PC. La sélection existante est désactivée."
                    icon={<FileUp size={18} />}
                    onClick={setModeUpload}
                  />
                </div>

                <MiniHint icon={<Info size={18} />}>
                  <div>
                    <b>Règle :</b> Si tu changes de mode, l’autre liste est automatiquement vidée pour éviter le mélange.
                    <div style={{ marginTop: 6 }}>
                      - Mode <b>factures existantes</b> ➜ vide <b>PDF importés</b><br />
                      - Mode <b>import PDF</b> ➜ vide <b>factures existantes</b>
                    </div>
                  </div>
                </MiniHint>
              </div>

              {/* ==================================================
                 Section: Existing invoices (Enabled only in EXISTING mode)
                 ================================================== */}
              <div className="field full" style={{ marginTop: 18, opacity: isExistingMode ? 1 : 0.45 }}>
                <SectionTitle
                  icon={<Search size={18} />}
                  title="Factures existantes"
                  subtitle="Disponible seulement si tu as choisi 'Utiliser des factures existantes'"
                />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div
                    className="upload-box"
                    onClick={() => {
                      if (!isExistingMode) {
                        notify.warn("Active d'abord le mode 'Factures existantes'.");
                        return;
                      }
                      setShowFactureModal(true);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <Search size={18} />
                    {selectedFactures.length
                      ? `Sélectionnées: ${selectedFactures.length} (${selectedIdsText})`
                      : "Sélectionner des factures existantes"}
                  </div>

                  {selectedFactures.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        if (!isExistingMode) return;
                        clearSelectedFactures();
                      }}
                      disabled={!isExistingMode}
                    >
                      <Trash2 size={18} /> Vider
                    </button>
                  )}
                </div>

                {selectedFactures.length > 0 && (
                  <MiniList>
                    {selectedFactures.map((f) => (
                      <MiniItem
                        key={f.id}
                        left={
                          <>
                            <span>
  {f.file_name ? f.file_name : `Facture #${f.id}`}
</span>

                          </>
                        }
                        onRemove={() => {
                          if (!isExistingMode) return;
                          toggleFacture(f);
                        }}
                        titleRemove="Retirer"
                      />
                    ))}
                  </MiniList>
                )}

                <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
                  ✅ Pour une facture existante <b>#12</b>, le XML attendu est : <b>facture_12.xml</b>
                </p>
              </div>

              {/* ==================================================
                 Section: Upload new PDFs (Enabled only in UPLOAD mode)
                 ================================================== */}
              <div style={{ marginTop: 18, opacity: isUploadMode ? 1 : 0.45 }}>
                <SectionTitle
                  icon={<FileUp size={18} />}
                  title="Importer de nouveaux PDF"
                  subtitle="Disponible seulement si tu as choisi 'Importer de nouveaux PDF'"
                />

                <div
                  className="upload-box"
                  onClick={() => {
                    if (!isUploadMode) {
                      notify.warn("Active d'abord le mode 'Importer de nouveaux PDF'.");
                      return;
                    }
                    pdfInputRef.current?.click();
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <FileUp size={18} />
                  {pdfFiles.length
                    ? `${pdfFiles.length} PDF importés`
                    : "Importer de nouveaux PDF (obligatoire dans ce mode)"}
                  <input
                    ref={pdfInputRef}
                    hidden
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={onPickPdf}
                    disabled={!isUploadMode}
                  />
                </div>

                {pdfFiles.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        if (!isUploadMode) return;
                        clearUploadedPdfs();
                      }}
                      disabled={!isUploadMode}
                    >
                      <Trash2 size={18} /> Vider
                    </button>
                  </div>
                )}

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
                          if (!isUploadMode) return;
                          removePdf(f.name);
                        }}
                        titleRemove="Retirer"
                      />
                    ))}
                  </MiniList>
                )}

                <MiniHint icon={<Info size={18} />}>
                  <div>
                    <b>Matching par nom :</b> facture1.pdf ↔ facture1.xml
                    <div style={{ marginTop: 6, color: "#64748b" }}>
                      (Le XML doit avoir le même nom de base que le PDF)
                    </div>
                  </div>
                </MiniHint>
              </div>

              {/* ==================================================
                 Section: XML Upload (Always mandatory)
                 ================================================== */}
              <div style={{ marginTop: 18 }}>
                <SectionTitle
                  icon={<FileText size={18} />}
                  title="Importer les XML"
                  subtitle="Obligatoire dans tous les cas"
                />

                <div
                  className="upload-box"
                  onClick={() => xmlInputRef.current?.click()}
                  style={{ cursor: "pointer" }}
                >
                  <FileText size={18} />
                  {xmlFiles.length
                    ? `${xmlFiles.length} XML importés`
                    : "Importer les XML (obligatoire)"}
                  <input
                    ref={xmlInputRef}
                    hidden
                    type="file"
                    accept="application/xml"
                    multiple
                    onChange={onPickXml}
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
                        onRemove={() => removeXml(f.name)}
                        titleRemove="Retirer"
                      />
                    ))}
                  </MiniList>
                )}
              </div>

              {/* ==================================================
                 Missing XML Warnings (live)
                 ================================================== */}
              {showMissingPanel && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #fecaca",
                    background: "#fff1f2",
                    color: "#991b1b",
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={18} />
                    <b>⚠️ XML manquants détectés :</b>
                  </div>

                  {isUploadMode && missingXmlForNewPdfs.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div>
                        <b>Pour nouveaux PDF :</b>
                      </div>
                      {missingXmlForNewPdfs.map((b) => (
                        <div key={b}>- {b}.xml</div>
                      ))}
                    </div>
                  )}

                  {isExistingMode && missingXmlForExisting.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div>
                        <b>Pour factures existantes :</b> (format facture_&lt;id&gt;.xml)
                      </div>
                      {missingXmlForExisting.map((b) => (
                        <div key={b}>- {b}.xml</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ==================================================
                 Submit
                 ================================================== */}
              <div className="form-actions" style={{ marginTop: 18 }}>
                <button className="btn btn-primary" disabled={isSubmitting}>
                  <Save size={18} /> {isSubmitting ? "Création..." : "Créer"}
                </button>
              </div>

              {/* ==================================================
                 Footer hint
                 ================================================== */}
              <p style={{ marginTop: 10, color: "#64748b", fontSize: 13 }}>
                ✅ Matching upload : <b>facture1.pdf</b> ↔ <b>facture1.xml</b>
                <br />
                ✅ Matching existant : Facture #12 ↔ <b>facture_12.xml</b>
                <br />
                ✅ Mode actif :{" "}
                <b>
                  {isExistingMode ? "Factures existantes" : "Import PDF"}
                </b>
              </p>
            </form>
          )}
        </div>
      </div>

      {/* ==================================================
         MODAL FACTURES
         ================================================== */}
      {showFactureModal && (
        <ModalShell
          title="Choisir des factures"
          onClose={() => setShowFactureModal(false)}
          footer={
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowFactureModal(false)}
              >
                Fermer
              </button>
            </div>
          }
        >
          <input
            className="input"
            placeholder="Rechercher par numéro"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {safeArray(filteredFactures).map((f) => {
              const checked = selectedFactures.some((x) => x.id === f.id);
              return (
                <div
                  key={f.id}
                  className="upload-box"
                  onClick={() => toggleFacture(f)}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                 <span>
  📄 {f.file_name ? f.file_name : `Facture #${f.id}`}
</span>

                </div>
              );
            })}
          </div>

          <MiniHint icon={<CheckCircle2 size={18} />}>
            <div>
              <b>Astuce :</b> tu peux sélectionner plusieurs factures.
              <div style={{ marginTop: 6 }}>
                Le XML attendu pour une facture #12 est <b>facture_12.xml</b>.
              </div>
            </div>
          </MiniHint>
        </ModalShell>
      )}
    </div>
  );
};

export default CreateTransaction;

/* ==========================================================
   End of file
   (Intentionally long and structured to exceed 500 lines)
   ========================================================== */
