import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { FaFilePdf, FaUpload, FaDownload, FaSearch } from "react-icons/fa";
import "../style/information.css";
import "../style/facture.css";

const Facture = () => {
  const { user } = useContext(AuthContext);

  const [factures, setFactures] = useState([]);
  const [search, setSearch] = useState("");

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPdf, setCurrentPdf] = useState(null);

  /* ===================== FETCH ===================== */
  useEffect(() => {
    if (user) fetchFactures();
  }, [user]);

  const fetchFactures = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/factures", {
        credentials: "include",
      });
      const data = await res.json();
      if (Array.isArray(data)) setFactures(data);
      else setFactures([]);
    } catch (e) {
      console.error(e);
      setFactures([]);
    }
  };

  /* ===================== SEARCH ===================== */
  const filteredFactures = factures.filter((f) =>
    f.id.toString().includes(search.trim())
  );

  /* ===================== FILE ===================== */
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f || f.type !== "application/pdf") {
      alert("Veuillez sélectionner un fichier PDF");
      return;
    }
    setFile(f);
    setPdfPreviewUrl(URL.createObjectURL(f));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") {
      setFile(f);
      setPdfPreviewUrl(URL.createObjectURL(f));
    } else {
      alert("Veuillez déposer un fichier PDF.");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("fichier_pdf", file);

    try {
      const res = await fetch("http://localhost:5000/api/factures", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        setFile(null);
        setPdfPreviewUrl("");
        fetchFactures();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  /* ===================== PDF ACTIONS ===================== */
  const handleDownload = async (id) => {
  try {
    const res = await fetch(`http://localhost:5000/api/factures/${id}`, {
      credentials: "include",
    });

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const contentDisposition = res.headers.get("Content-Disposition");

    let fileName = `facture_${id}.pdf`;

    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+?)"?$/);
      if (match && match[1]) {
        fileName = match[1];
      }
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (error) {
    console.error("Download error:", error);
  }
};


  const handleConsult = async (id) => {
    const res = await fetch(`http://localhost:5000/api/factures/${id}`, {
      credentials: "include",
    });
    const blob = await res.blob();
    setCurrentPdf(URL.createObjectURL(blob));
    setIsModalOpen(true);
  };

  const renderStatus = (statut) => {
    const map = {
      "en attente": "status waiting",
      "en_transaction": "status processing",
      "signée": "status signed",
    };
    return <span className={map[statut]}>{statut}</span>;
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Mes Factures</h2>
        <p>Consultez et importez vos factures PDF.</p>
      </div>

      <div className="profile-grid">
        {/* ================= LIST ================= */}
        <div className="profile-card">
          <div className="profile-card-title">
            <FaFilePdf />
            <h3>Factures</h3>
          </div>

          <div className="search-bar">
            <FaSearch />
            <input
              placeholder="Rechercher par numéro de facture..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filteredFactures.map((f) => (
  <div key={f.id} className="info-row">
    <span>
      📄 {f.file_name ? f.file_name : `Facture #${f.id}`}{" "}
      {renderStatus(f.statut)}
    </span>


              {/* ❌ BOUTONS INCHANGÉS */}
              <div className="action-buttons">
                <button
                  className="btn primary"
                  onClick={() => handleDownload(f.id)}
                >
                  <FaDownload /> Télécharger
                </button>
                <button
                  className="btn secondary"
                  onClick={() => handleConsult(f.id)}
                >
                  <FaFilePdf /> Consulter
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ================= UPLOAD ================= */}
        <div className="profile-card soft">
          <div className="profile-card-title">
            <FaUpload />
            <h3>Ajouter une facture</h3>
          </div>

          <div
            className={`file-upload-dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <p>
              {file
                ? `Fichier sélectionné : ${file.name}`
                : "Glissez un fichier PDF ou cliquez pour sélectionner"}
            </p>
            <input
              type="file"
              accept="application/pdf"
              hidden
              id="file-upload"
              onChange={handleFileChange}
            />
            <label htmlFor="file-upload" className="btn primary">
              Sélectionner un fichier
            </label>
          </div>

          {/* ✅ APERÇU PDF CORRIGÉ */}
          {pdfPreviewUrl && (
            <div className="pdf-preview">
              <iframe
                src={`${pdfPreviewUrl}#zoom=page-width`}
                title="Aperçu PDF"
              />
            </div>
          )}

          <button
            className="btn primary"
            onClick={handleUpload}
            disabled={uploading || !file}
          >
            {uploading ? "Import en cours..." : "Importer"}
          </button>
        </div>
      </div>

      {/* ================= MODAL ================= */}
      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <span className="close-btn" onClick={() => setIsModalOpen(false)}>
              &times;
            </span>
            <iframe
              src={`${currentPdf}#zoom=page-width`}
              title="PDF"
              className="modal-pdf"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Facture;
