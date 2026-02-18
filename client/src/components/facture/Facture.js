import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { FaFilePdf, FaDownload, FaSearch } from "react-icons/fa";
import "../style/information.css";
import "../style/facture.css";

const Facture = () => {
  const { user } = useContext(AuthContext);

  const [factures, setFactures] = useState([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");

  // ===================== FETCH =====================
  useEffect(() => {
    if (user) fetchFactures();
  }, [user]);

  const fetchFactures = async () => {
    try {
      const res = await fetch(
        "http://localhost:5000/api/my-transaction-factures",
        { credentials: "include" }
      );

      const data = await res.json();
      setFactures(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  // ===================== SEARCH =====================
  const filteredFactures = factures.filter((f) =>
    f.invoice_number?.toLowerCase().includes(search.toLowerCase())
  );

  // ===================== DOWNLOAD =====================
  const handleDownload = async (docId, filename) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/my-transaction-factures/${docId}/pdf`,
        { credentials: "include" }
      );

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  // ===================== CONSULT =====================
  const handleConsult = async (docId) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/my-transaction-factures/${docId}/pdf`,
        { credentials: "include" }
      );

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      setPdfPreviewUrl(url);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Consult error:", error);
    }
  };

  // ===================== STATUS =====================
  const renderStatus = (statut) => {
    if (statut === "créé")
      return <span className="status processing">En transaction</span>;

    if (statut === "signée")
      return <span className="status signed">Signée</span>;

    if (statut === "signée par TTN")
      return <span className="status ttn-signed">Signée par TTN</span>;

    return <span className="status other">{statut}</span>;
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Mes Factures (Transactions)</h2>
        <p>Factures issues de vos transactions.</p>
      </div>

      <div className="profile-grid">
        <div className="profile-card">

          <div className="search-bar">
            <FaSearch />
            <input
              placeholder="Rechercher par numéro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filteredFactures.length === 0 && (
            <p style={{ padding: "20px" }}>
              Aucune facture issue de vos transactions.
            </p>
          )}

          {filteredFactures.map((f) => (
            <div key={f.id} className="info-row">
              <span>
                📄 {f.invoice_number}{" "}
                {renderStatus(f.statut)}
              </span>

              <div className="action-buttons">
                <button
                  className="btn primary"
                  onClick={() => handleDownload(f.id, f.filename)}
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
      </div>

      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <span
              className="close-btn"
              onClick={() => {
                setIsModalOpen(false);
                window.URL.revokeObjectURL(pdfPreviewUrl);
              }}
            >
              &times;
            </span>
            <iframe src={pdfPreviewUrl} title="PDF" className="modal-pdf" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Facture;
