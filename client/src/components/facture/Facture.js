import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { 
  FaFileInvoice, 
  FaDownload, 
  FaSearch, 
  FaFilePdf, 
  FaRegFileAlt, 
  FaCheckCircle, 
  FaTimesCircle,
  FaFilter,
  FaArrowRight,
  FaChevronLeft,
  FaChevronRight
} from "react-icons/fa";
import "../style/facture.css";

const Facture = () => {
  const { user } = useContext(AuthContext);

  const [factures, setFactures] = useState([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // ===================== FETCH =====================
  useEffect(() => {
    if (user) fetchFactures();
  }, [user]);

  const fetchFactures = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        "http://localhost:5000/api/my-transaction-factures",
        { credentials: "include" }
      );

      const data = await res.json();
      setFactures(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // ===================== SEARCH =====================
  const filteredFactures = factures.filter((f) =>
    f.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    f.filename?.toLowerCase().includes(search.toLowerCase())
  );

  // ===================== PAGINATION LOGIC =====================
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredFactures.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredFactures.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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
      a.download = `${filename || 'facture'}.pdf`;
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
    const s = String(statut || "").toLowerCase();
    
    if (s.includes("créé") || s.includes("trans"))
      return <span className="inv-status processing">En traitement</span>;

    if (s === "signée")
      return <span className="inv-status signed">Signée</span>;

    if (s.includes("ttn"))
      return <span className="inv-status ttn">Signée par TTN</span>;

    return <span className="inv-status other">{statut}</span>;
  };

  // Stats calculation
  const totalInvoices = factures.length;
  const signedInvoices = factures.filter(f => String(f.statut).toLowerCase().includes('sign')).length;
  const processingInvoices = totalInvoices - signedInvoices;

  return (
    <div className="invoice-page">
      <div className="invoice-container">
        
        {/* Header */}
        <div className="invoice-header">
          <div>
            <h2>Mes Factures Numérique</h2>
            <p>Gérez et consultez vos factures issues de vos transactions sécurisées.</p>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="invoice-stats-grid">
          <div className="invoice-stat-card">
            <div className="invoice-stat-icon" style={{ background: '#0247AA' }}>
              <FaFileInvoice />
            </div>
            <div className="invoice-stat-info">
              <h4>Total Factures</h4>
              <p>{isLoading ? "..." : totalInvoices}</p>
            </div>
          </div>
          
          <div className="invoice-stat-card">
            <div className="invoice-stat-icon" style={{ background: '#10b981' }}>
              <FaCheckCircle />
            </div>
            <div className="invoice-stat-info">
              <h4>Signées</h4>
              <p>{isLoading ? "..." : signedInvoices}</p>
            </div>
          </div>

          <div className="invoice-stat-card">
            <div className="invoice-stat-icon" style={{ background: '#f59e0b' }}>
              <FaArrowRight />
            </div>
            <div className="invoice-stat-info">
              <h4>En cours</h4>
              <p>{isLoading ? "..." : processingInvoices}</p>
            </div>
          </div>
        </div>

        {/* Main List Area */}
        <div className="invoice-main-card">
          <div className="invoice-card-header">
            <div className="invoice-search-container">
              <div className="invoice-search-wrapper">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Rechercher par numéro ou nom de fichier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="clear-search" onClick={() => setSearch("")}>
                    <FaTimesCircle />
                  </button>
                )}
              </div>
              
              <div className="invoice-filters">
                <div className="filter-group">
                  <FaFilter size={12} />
                  <select>
                    <option value="all">Tous les statuts</option>
                    <option value="signed">Signées</option>
                    <option value="pending">En cours</option>
                  </select>
                </div>
                <div className="results-badge">
                   {filteredFactures.length} document{filteredFactures.length > 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <div className="invoice-actions-group">
                <button className="inv-btn sec-refresh" onClick={fetchFactures} title="Actualiser la liste">
                    <FaArrowRight className="refresh-icon" />
                    <span>Rafraîchir</span>
                </button>
            </div>
          </div>

          <div className="invoice-list">
            {isLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                Chargement de vos documents...
              </div>
            ) : filteredFactures.length === 0 ? (
              <div className="invoice-empty">
                <FaRegFileAlt size={48} color="#e2e8f0" />
                <p>Aucune facture trouvée.</p>
              </div>
            ) : (
              <>
                {currentItems.map((f) => (
                  <div key={f.id} className="invoice-row">
                    <div className="invoice-info">
                      <div className="invoice-icon-wrap">
                        <FaFilePdf size={18} />
                      </div>
                      <div className="invoice-details">
                        <span className="invoice-number">FACT#{f.invoice_number || f.id}</span>
                        <span className="invoice-date">Reference: {f.filename}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {renderStatus(f.statut)}
                    </div>

                    <div className="inv-actions">
                      <button
                        className="inv-btn sec"
                        onClick={() => handleConsult(f.id)}
                        title="Consulter"
                      >
                        <FaSearch /> Détails
                      </button>
                      <button
                        className="inv-btn prim"
                        onClick={() => handleDownload(f.id, f.filename)}
                        title="Télécharger"
                      >
                        <FaDownload /> PDF
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Pagination UI */}
                {totalPages > 1 && (
                  <div className="pagination-container">
                    <button 
                      className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <FaChevronLeft />
                    </button>
                    
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i + 1}
                        className={`pagination-number ${currentPage === i + 1 ? 'active' : ''}`}
                        onClick={() => handlePageChange(i + 1)}
                      >
                        {i + 1}
                      </button>
                    ))}

                    <button 
                      className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <FaChevronRight />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal View */}
      {isModalOpen && (
        <div className="modal" style={{ zIndex: 3000 }}>
          <div className="modal-content" style={{ maxWidth: '1000px', height: '90vh' }}>
            <div style={{ 
                padding: '16px 24px', 
                borderBottom: '1px solid #e2e8f0', 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h3 style={{ margin: 0, fontWeight: 800 }}>Aperçu Document</h3>
                <button 
                    onClick={() => {
                        setIsModalOpen(false);
                        window.URL.revokeObjectURL(pdfPreviewUrl);
                    }}
                    style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}
                >
                    <FaTimesCircle color="#64748b" />
                </button>
            </div>
            <div style={{ flex: 1, padding: '10px', background: '#e2e8f0' }}>
               <iframe src={pdfPreviewUrl} title="PDF" className="inv-modal-pdf" style={{ height: '100%', width: '100%', border: 'none' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Facture;
