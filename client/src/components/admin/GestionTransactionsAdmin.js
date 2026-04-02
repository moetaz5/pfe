import React, { useEffect, useState } from "react";
import axios from "axios";
import { 
  FaFileAlt, 
  FaSearch, 
  FaCheckCircle, 
  FaClock, 
  FaExclamationTriangle,
  FaFilter,
  FaTrashAlt,
  FaEye,
  FaDownload,
  FaTimes,
  FaUser,
  FaEnvelope,
  FaCalendarCheck,
  FaCogs,
  FaSync,
  FaChevronLeft,
  FaChevronRight
} from "react-icons/fa";
import { toast } from "react-toastify";
import "../style/gestionUtilisateur.css";

const GestionTransactionsAdmin = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [searchGlobal, setSearchGlobal] = useState("");
  const [searchId, setSearchId] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Modal details
  const [showModal, setShowModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [txDocs, setTxDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await axios.get("http://localhost:5000/api/admin/transactions/all", { withCredentials: true });
      setTransactions(res.data || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await axios.put(`http://localhost:5000/api/admin/transactions/${id}/status`, 
        { statut: newStatus }, 
        { withCredentials: true }
      );
      toast.success("Statut mis à jour");
      fetchTransactions();
    } catch (err) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const viewDetails = async (tx) => {
    setSelectedTx(tx);
    setShowModal(true);
    setLoadingDocs(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/admin/transactions/${tx.id}/documents`, { withCredentials: true });
      setTxDocs(res.data || []);
    } catch (err) {
      toast.error("Erreur chargement documents");
    } finally {
      setLoadingDocs(false);
    }
  };

  const exportCSV = () => {
     const headers = ["ID", "Facture", "Client Name", "Client Email", "Signataire", "Date", "Statut"];
     const rows = filteredTransactions.map(tx => [
       tx.id,
       tx.facture_number,
       tx.user_name,
       tx.user_email,
       tx.signataire_email,
       new Date(tx.date_creation).toLocaleDateString(),
       tx.statut
     ]);

     let csvContent = "data:text/csv;charset=utf-8," 
       + headers.join(",") + "\n"
       + rows.map(r => r.join(",")).join("\n");

     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `export_transactions_${new Date().toISOString().split('T')[0]}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  const filteredTransactions = transactions.filter(tx => {
    const term = searchGlobal.toLowerCase();
    const matchesGlobal = 
       (tx.user_email && tx.user_email.toLowerCase().includes(term)) ||
       (tx.user_name && tx.user_name.toLowerCase().includes(term)) ||
       (tx.facture_number && tx.facture_number.toLowerCase().includes(term)) ||
       (tx.signataire_email && tx.signataire_email.toLowerCase().includes(term));
       
    const matchesId = searchId ? String(tx.id) === searchId.trim() : true;
    
    let matchesDate = true;
    if (searchDate) {
      const txDate = tx.date_creation ? new Date(tx.date_creation).toISOString().split('T')[0] : "";
      matchesDate = txDate === searchDate;
    }

    const matchesStatus = statusFilter === "all" || tx.statut === statusFilter;
    
    return matchesGlobal && matchesId && matchesDate && matchesStatus;
  });

  // Reset to page 1 on filter
  useEffect(() => {
    setCurrentPage(1);
  }, [searchGlobal, searchId, searchDate, statusFilter]);

  // Pagination logic
  const indexOfLastItem  = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems     = filteredTransactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages       = Math.ceil(filteredTransactions.length / itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);


  // Calculate summary stats
  const totalTx = transactions.length;
  const signedTx = transactions.filter(t => String(t.statut).toLowerCase().includes('sign')).length;
  const pendingTx = transactions.filter(t => t.statut === 'créé' || t.statut === 'envoyé').length;

  const handleDownloadZip = async (id) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/admin/transactions/${id}/zip`, {
        withCredentials: true,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `transaction_admin_${id}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      toast.error("Erreur lors du téléchargement du ZIP");
    }
  };
  
  const handleResendTTN = async (id) => {
    try {
      await axios.post(`http://localhost:5000/api/admin/transactions/${id}/resend-ttn`, {}, { withCredentials: true });
      toast.success("Renvoi TTN lancé par l'administrateur");
      fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors du renvoi TTN");
    }
  };

  // Format Transaction ID
  const formatTxId = (id, dateStr) => {
    const year = new Date(dateStr || Date.now()).getFullYear();
    return `TRX-${year}-${String(id).padStart(5, '0')}`;
  };

  return (
    <div className="page glass-bg">
      <div className="full-width-container">
        
        {/* STATS OVERVIEW */}
        <div className="admin-stats-summary">
           <div className="admin-stat-small-card">
              <div className="icon-circ blue"><FaFileAlt /></div>
              <div className="info">
                 <span className="label">Transactions</span>
                 <span className="val">{totalTx}</span>
              </div>
           </div>
           <div className="admin-stat-small-card">
              <div className="icon-circ green"><FaCheckCircle /></div>
              <div className="info">
                 <span className="label">Signées (Validées)</span>
                 <span className="val">{signedTx}</span>
              </div>
           </div>
           <div className="admin-stat-small-card">
              <div className="icon-circ orange"><FaClock /></div>
              <div className="info">
                 <span className="label">En attente</span>
                 <span className="val">{pendingTx}</span>
              </div>
           </div>
        </div>

        <div className="page-header" style={{ marginBottom: 20 }}>
          <div className="page-header-title">
            <FaCogs color="#0247AA" size={24} />
            <h2>Supervision des Transactions</h2>
          </div>
          <button className="btn btn-outline" onClick={exportCSV}>
             <FaDownload /> Exporter CSV
          </button>
        </div>

        {/* SECTION FILTRES AVANCÉS */}
        <div className="filters-card premium">
          <div className="filters-grid-pro" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div className="search-wrap-admin">
              <FaSearch className="icon" />
              <input 
                className="input"
                placeholder="Client, Facture, Signataire..."
                value={searchGlobal}
                onChange={(e) => setSearchGlobal(e.target.value)}
              />
            </div>
            
            <div className="search-wrap-admin">
              <span style={{ position: 'absolute', left: '14px', top: '12px', fontSize: '13px', fontWeight: 900, color: '#94a3b8' }}>#</span>
              <input 
                className="input"
                style={{ paddingLeft: '34px' }}
                placeholder="ID de Transaction"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
              />
            </div>
            
            <div className="search-wrap-admin">
              <FaCalendarCheck className="icon" style={{ opacity: 0.6 }} />
              <input 
                type="date"
                className="input"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
              />
            </div>
            
            <div className="filter-select-wrap">
              <FaFilter className="icon" />
              <select 
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Tous les Statuts</option>
                <option value="créé">🕒 Créé</option>
                <option value="envoyé">📤 Envoyé</option>
                <option value="signée">✍️ Signé</option>
                <option value="signée_ttn">✅ Signé TTN</option>
                <option value="refusée par TTN">❌ Refusée par TTN</option>
                <option value="rejeté">❌ Rejeté</option>
                <option value="supprimée">🗑️ Supprimé</option>
              </select>
            </div>
          </div>
        </div>

        <div className="transactions-container" style={{ marginTop: 25 }}>
          {loading ? (
            <div className="loading-state">Initialisation des données...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="empty-state-admin">
               <FaExclamationTriangle size={40} color="#cbd5e1" />
               <p>Aucun résultat pour cette recherche</p>
            </div>
          ) : (
            <>
              {/* Pagination Info */}
              <div style={{ marginBottom: '16px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                Affiche {Math.min(filteredTransactions.length, currentItems.length)} sur {filteredTransactions.length} transaction{filteredTransactions.length > 1 ? 's' : ''}
              </div>
            <div className="transactions-list">
              {currentItems.map(tx => (
                <div key={tx.id} className="transaction-row admin-row-premium">
                  <div className="tx-main-card">
                    <div className="tx-id-badge" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 700, border: '1px solid #e2e8f0' }}>{formatTxId(tx.id, tx.date_creation)}</div>
                    <div className="tx-details-flex">
                       <div className="tx-col">
                          <div className="tx-num">Facture: {tx.facture_number}</div>
                          <div className="tx-user"><FaUser size={12}/> {tx.user_name}</div>
                          <div className="tx-email"><FaEnvelope size={10}/> {tx.user_email}</div>
                       </div>
                       <div className="tx-col">
                          <div className="tx-label">Destinataire:</div>
                          <div className="tx-sign">{tx.signataire_email}</div>
                          <div className="tx-date"><FaCalendarCheck size={11}/> {new Date(tx.date_creation).toLocaleDateString()}</div>
                       </div>
                    </div>
                  </div>

                  <div className="status-and-actions">
                    <div className="status-container">
                       <span className={`status-pill pill-large ${tx.statut}`}>
                         {tx.statut.toUpperCase()}
                       </span>
                    </div>

                    <div className="admin-actions-group">
                       <select 
                         className="admin-select-status"
                         value={tx.statut}
                         onChange={(e) => handleUpdateStatus(tx.id, e.target.value)}
                       >
                         <option value="créé">Créé</option>
                         <option value="envoyé">Envoyé</option>
                         <option value="signée">Signé</option>
                         <option value="signée_ttn">Signé TTN</option>
                         <option value="refusée par TTN">Refusée par TTN</option>
                         <option value="rejeté">Rejeté</option>
                       </select>
                       
                       <button 
                         className="btn-details-circ" 
                         title="Télécharger ZIP"
                         style={{ background: '#f1f5f9', color: '#0247AA' }}
                         onClick={() => handleDownloadZip(tx.id)}
                       >
                         <FaDownload />
                       </button>

                       {(tx.statut === "signée" || tx.statut === "refusée par TTN") && (
                         <button 
                           className="btn-details-circ" 
                           title="Renvoyer vers TTN"
                           style={{ background: '#f1f5f9', color: '#0247AA' }}
                           onClick={() => handleResendTTN(tx.id)}
                         >
                           <FaSync />
                         </button>
                       )}


                       <button 
                         className="btn-details-circ" 
                         title="Détails"
                         onClick={() => viewDetails(tx)}
                       >
                         <FaEye />
                       </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-container" style={{ marginTop: '24px' }}>
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <FaChevronLeft />
                </button>

                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    className={`pagination-number ${
                      currentPage === i + 1 ? "active" : ""
                    }`}
                    onClick={() => handlePageChange(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}

                <button
                  className="pagination-btn"
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

      {/* MODAL DETAILS PRO */}
      {showModal && (
        <div className="admin-modal-overlay">
           <div className="admin-modal-content" style={{ maxWidth: '750px' }}>
              <div className="modal-header" style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px 12px 0 0' }}>
                 <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <FaFileAlt color="#0247AA" /> Détails de la Transaction <span style={{ color: '#0247AA' }}>{formatTxId(selectedTx?.id, selectedTx?.date_creation)}</span>
                 </h3>
                 <button className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', color: '#64748b', cursor: 'pointer' }} onClick={() => setShowModal(false)}><FaTimes /></button>
              </div>
              
              <div className="modal-body" style={{ padding: '24px' }}>
                 <div className="modal-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#f1f5f9', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                    <div><strong style={{ color: '#64748b' }}>N° Facture:</strong> <br/><span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedTx?.facture_number}</span></div>
                    <div><strong style={{ color: '#64748b' }}>Client:</strong> <br/><span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedTx?.user_name}</span></div>
                    <div><strong style={{ color: '#64748b' }}>Statut:</strong> <br/><span className={`status-pill pill-large ${selectedTx?.statut}`} style={{ marginTop: '4px', display: 'inline-block' }}>{selectedTx?.statut}</span></div>
                    <div><strong style={{ color: '#64748b' }}>Date création:</strong> <br/><span style={{ fontWeight: 600, color: '#0f172a' }}>{new Date(selectedTx?.date_creation).toLocaleString()}</span></div>
                 </div>

                 <h4 className="docs-title" style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   Documents inclus
                   
                   <button 
                     className="btn-primary-alt" 
                     onClick={() => handleDownloadZip(selectedTx?.id)}
                     style={{ padding: '6px 14px', fontSize: '0.9rem', borderRadius: '6px' }}
                   >
                     <FaDownload style={{ marginRight: '6px' }}/> Télécharger ZIP complet
                   </button>
                 </h4>
                 
                 {loadingDocs ? (
                    <div className="modal-loading" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Chargement des fichiers...</div>
                 ) : txDocs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', background: '#fafafa', borderRadius: '8px', color: '#94a3b8' }}>Aucun document.</div>
                 ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <table className="admin-docs-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                         <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                            <tr>
                               <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>ID</th>
                               <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Nom Fichier</th>
                               <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Statut</th>
                               <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Date Signature</th>
                            </tr>
                         </thead>
                         <tbody>
                            {txDocs.map(doc => (
                               <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '12px', color: '#64748b' }}>{doc.id}</td>
                                  <td style={{ padding: '12px', fontWeight: 500, color: '#0f172a' }}>{doc.filename}</td>
                                  <td style={{ padding: '12px' }}><span className={`doc-status ${doc.statut}`}>{doc.statut}</span></td>
                                  <td style={{ padding: '12px', color: '#64748b' }}>{doc.signed_at ? new Date(doc.signed_at).toLocaleDateString() : "—"}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                    </div>
                 )}
              </div>
              
              <div className="modal-footer" style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 12px 12px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                 <button 
                    style={{ background: '#e2e8f0', color: '#475569', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }} 
                    onClick={() => setShowModal(false)}
                 >
                    Fermer
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default GestionTransactionsAdmin;
