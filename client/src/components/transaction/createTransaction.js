import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../style/createTransaction.css";
import {
  Save,
  FileText,
  FileUp,
  ArrowLeft,
  Mail,
  Hash,
  Search,
  X,
} from "lucide-react";

const CreateTransaction = () => {
  const navigate = useNavigate();

  const [useExistingPdf, setUseExistingPdf] = useState(true);

  const [factures, setFactures] = useState([]);
  const [filteredFactures, setFilteredFactures] = useState([]);
  const [selectedFacture, setSelectedFacture] = useState(null);

  const [showFactureModal, setShowFactureModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [factureNumber, setFactureNumber] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [xmlFile, setXmlFile] = useState(null);

  const [signataireEmail, setSignataireEmail] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const pdfInputRef = useRef(null);
  const xmlInputRef = useRef(null);

  /* ================= FETCH FACTURES ================= */
  useEffect(() => {
    if (!useExistingPdf) return;

    fetch("http://localhost:5000/api/factures/available", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFactures(data);
          setFilteredFactures(data);
        } else {
          setFactures([]);
          setFilteredFactures([]);
        }
      })
      .catch(() => {
        setFactures([]);
        setFilteredFactures([]);
      });
  }, [useExistingPdf]);

  /* ================= SEARCH ================= */
  useEffect(() => {
    if (!Array.isArray(factures)) {
      setFilteredFactures([]);
      return;
    }

    setFilteredFactures(
      factures.filter((f) =>
        f.id.toString().includes(searchTerm.trim())
      )
    );
  }, [searchTerm, factures]);

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (
      !signataireEmail ||
      !clientEmail ||
      !factureNumber ||
      !xmlFile ||
      (useExistingPdf && !selectedFacture) ||
      (!useExistingPdf && !pdfFile)
    ) {
      alert("Veuillez remplir tous les champs obligatoires.");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append("facture_number", factureNumber);
    formData.append("signataire_email", signataireEmail);
    formData.append("client_email", clientEmail);
    formData.append("xml_file", xmlFile);

    if (useExistingPdf) {
      formData.append("facture_id", selectedFacture.id);
    } else {
      formData.append("pdf_file", pdfFile);
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

        // ⏱️ REDIRECTION AUTO APRÈS 3s
        setTimeout(() => {
          navigate("/dashboard/MyTransactions", { replace: true });
        }, 3000);
      } else {
        alert(data.message || "Erreur lors de la création");
      }
    } catch {
      alert("Erreur serveur");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="full-width-container">
        <div className="page-head">
          <div>
            <h2>Créer une transaction</h2>
            <p>Configurer une facture pour signature électronique</p>
          </div>
          <Link to="/dashboard/MyTransactions" className="btn btn-outline">
            <ArrowLeft size={18} /> Retour
          </Link>
        </div>

        <div className="create-card">
          <div className="create-card-title">
            <Save size={18} color="#0247AA" />
            Nouvelle transaction
          </div>

          {/* ✅ MESSAGE SUCCÈS */}
          {success && (
            <div className="success-box">
              ✅ Transaction créée avec succès.<br />
              Redirection automatique en cours...
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit}>
              {/* EMAILS */}
              <div className="form-grid">
                <div className="field">
                  <label><Mail size={16}/> Email signataire *</label>
                  <input
                    className="input"
                    type="email"
                    value={signataireEmail}
                    onChange={(e)=>setSignataireEmail(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label><Mail size={16}/> Email client *</label>
                  <input
                    className="input"
                    type="email"
                    value={clientEmail}
                    onChange={(e)=>setClientEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* NUM FACTURE */}
              <div className="field full">
                <label><Hash size={16}/> Numéro de facture *</label>
                <input
                  className="input"
                  value={factureNumber}
                  onChange={(e)=>setFactureNumber(e.target.value)}
                />
              </div>

              {/* SWITCH */}
              <div className="field full">
                <label>Source du PDF</label>
                <label>
                  <input
                    type="radio"
                    checked={useExistingPdf}
                    onChange={()=>setUseExistingPdf(true)}
                  /> PDF existant
                </label>
                <label>
                  <input
                    type="radio"
                    checked={!useExistingPdf}
                    onChange={()=>setUseExistingPdf(false)}
                  /> Nouveau PDF
                </label>
              </div>

              {/* SELECT FACTURE */}
              {useExistingPdf && (
                <div className="upload-box" onClick={()=>setShowFactureModal(true)}>
                  <Search size={18}/> {selectedFacture ? `Facture #${selectedFacture.id}` : "Sélectionner une facture"}
                </div>
              )}

              {/* PDF UPLOAD */}
              {!useExistingPdf && (
                <div className="upload-box" onClick={()=>pdfInputRef.current.click()}>
                  <FileUp size={18}/> {pdfFile ? pdfFile.name : "Importer PDF"}
                  <input
                    ref={pdfInputRef}
                    hidden
                    type="file"
                    accept="application/pdf"
                    onChange={(e)=>setPdfFile(e.target.files[0])}
                  />
                </div>
              )}

              {/* XML */}
              <div className="upload-box" onClick={()=>xmlInputRef.current.click()}>
                <FileText size={18}/> {xmlFile ? xmlFile.name : "Importer XML"}
                <input
                  ref={xmlInputRef}
                  hidden
                  type="file"
                  accept="application/xml"
                  onChange={(e)=>setXmlFile(e.target.files[0])}
                />
              </div>

              <div className="form-actions">
                <button className="btn btn-primary" disabled={isSubmitting}>
                  <Save size={18}/> {isSubmitting ? "Création..." : "Créer"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* MODAL */}
      {showFactureModal && (
        <div className="modal">
          <div className="modal-content">
            <X onClick={()=>setShowFactureModal(false)} />
            <input
              className="input"
              placeholder="Rechercher par numéro"
              value={searchTerm}
              onChange={(e)=>setSearchTerm(e.target.value)}
            />
            {filteredFactures.map(f=>(
              <div
                key={f.id}
                className="upload-box"
                onClick={()=>{
                  setSelectedFacture(f);
                  setShowFactureModal(false);
                }}
              >
                📄 Facture #{f.id}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateTransaction;
