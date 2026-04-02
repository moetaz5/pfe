import React, { useEffect, useState } from "react";
import axios from "axios";
import { 
  FaBuilding, 
  FaSearch, 
  FaUsers, 
  FaCalendarAlt, 
  FaTrashAlt, 
  FaEnvelope, 
  FaUserTie,
  FaShieldAlt,
  FaIdBadge,
  FaTimes,
  FaFileAlt,
  FaEye,
  FaChevronLeft,
  FaChevronRight
} from "react-icons/fa";
import { toast } from "react-toastify";
import "../style/gestionUtilisateur.css";

const GestionOrganisationsAdmin = () => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Nouveaux Filtres
  const [searchTerm, setSearchTerm] = useState("");
  const [searchId, setSearchId] = useState("");
  const [searchDate, setSearchDate] = useState("");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  
  // Modale Details
  const [showModal, setShowModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);
  const [orgTransactions, setOrgTransactions] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Stats
  const totalOrgs = organizations.length;
  const totalMembers = organizations.reduce((acc, org) => acc + (org.members_count || 0), 0);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const res = await axios.get("http://localhost:5000/api/admin/organizations/all", { withCredentials: true });
      setOrganizations(res.data || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des organisations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette organisation ? Cette action est irréversible.")) return;

    try {
      await axios.delete(`http://localhost:5000/api/admin/organizations/${id}`, { withCredentials: true });
      toast.success("Organisation supprimée");
      fetchOrganizations();
    } catch (err) {
      toast.error("Erreur lors de la suppression");
    }
  };
  
  const handleViewDetails = async (org) => {
    setSelectedOrg(org);
    setShowModal(true);
    setLoadingDetails(true);
    try {
      const [membersRes, txsRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/admin/organizations/${org.id}/members`, { withCredentials: true }),
        axios.get(`http://localhost:5000/api/admin/organizations/${org.id}/transactions`, { withCredentials: true })
      ]);
      setOrgMembers(membersRes.data || []);
      setOrgTransactions(txsRes.data || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des détails");
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredOrgs = organizations.filter(org => {
    const matchesGlobal = 
      String(org.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(org.owner_email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(org.owner_name || "").toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesId = searchId ? String(org.id) === searchId.trim() : true;
    
    let matchesDate = true;
    if (searchDate) {
      const orgDate = org.created_at ? new Date(org.created_at).toISOString().split('T')[0] : "";
      matchesDate = orgDate === searchDate;
    }

    return matchesGlobal && matchesId && matchesDate;
  });

  // Reset to page 1 on filter
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchId, searchDate]);

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredOrgs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrgs.length / itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);



  return (
    <div className="page glass-bg">
      <div className="full-width-container">
        
        {/* SUMMARY CARDS */}
        <div className="admin-stats-summary">
           <div className="admin-stat-small-card">
              <div className="icon-circ blue"><FaBuilding /></div>
              <div className="info">
                 <span className="label">Total Organisations</span>
                 <span className="val">{totalOrgs}</span>
              </div>
           </div>
           <div className="admin-stat-small-card">
              <div className="icon-circ green"><FaUsers /></div>
              <div className="info">
                 <span className="label">Total Membres</span>
                 <span className="val">{totalMembers}</span>
              </div>
           </div>
        </div>

        <div className="page-header" style={{ marginBottom: 20 }}>
          <div className="page-header-title">
            <FaShieldAlt color="#0247AA" size={24} />
            <h2>Supervision des Organisations</h2>
          </div>
        </div>

        {/* SECTION FILTRES AVANCÉS */}
        <div className="filters-card premium">
          <div className="filters-grid-pro" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div className="search-wrap-admin">
              <FaSearch className="icon" />
              <input 
                className="input"
                placeholder="Nom, Email Propriétaire..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="search-wrap-admin">
              <FaIdBadge className="icon" style={{ opacity: 0.6 }} />
              <input 
                className="input"
                placeholder="Rechercher par ID..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
              />
            </div>
            
            <div className="search-wrap-admin">
              <FaCalendarAlt className="icon" style={{ opacity: 0.6 }} />
              <input 
                type="date"
                className="input"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="organizations-container" style={{ marginTop: 25 }}>
          {loading ? (
            <div className="loading-state">Synchronisation des données...</div>
          ) : filteredOrgs.length === 0 ? (
            <div className="empty-state-admin">Aucune organisation trouvée correspondant à vos critères.</div>
          ) : (
            <>
              {/* Pagination Info */}
              <div style={{ marginBottom: '16px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                Affiche {Math.min(filteredOrgs.length, currentItems.length)} sur {filteredOrgs.length} organisation{filteredOrgs.length > 1 ? 's' : ''}
              </div>
            <div className="organizations-grid-admin">
              {currentItems.map(org => (
                <div key={org.id} className="org-card-admin-premium">
                  <div className="org-header-premium">
                     <h3>{org.name}</h3>
                     <div className="org-id-badge">ID #{org.id}</div>
                  </div>

                  <div className="org-body-premium">
                     <div className="owner-section-premium">
                        <div className="owner-avatar">
                           <FaUserTie />
                        </div>
                        <div className="owner-meta-data">
                           <div className="owner-name-meta">{org.owner_name}</div>
                           <div className="owner-email-meta"><FaEnvelope size={10}/> {org.owner_email}</div>
                        </div>
                     </div>

                     <div className="org-stats-premium-row">
                        <div className="org-stat-bubble" style={{ background: '#eff6ff', color: '#0247AA' }}>
                           <FaUsers className="icon" /> 
                           <strong>{org.members_count}</strong> Membres
                        </div>
                        <div className="org-stat-bubble" style={{ background: '#f8fafc', color: '#64748b' }}>
                           <FaCalendarAlt className="icon" />
                           {new Date(org.created_at).toLocaleDateString()}
                        </div>
                     </div>
                  </div>

                  <div className="org-footer-premium" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                      <button 
                         className="btn-primary-alt"
                         title="Détails de l'organisation"
                         onClick={() => handleViewDetails(org)}
                         style={{ background: '#eff6ff', color: '#0247AA', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #bfdbfe', cursor: 'pointer', outline: 'none' }}
                      >
                         <FaEye /> Détails
                      </button>

                      <button 
                        className="btn-danger-alt" 
                        onClick={() => handleDelete(org.id)}
                        title="Supprimer définitivement"
                        style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #fecaca', cursor: 'pointer', outline: 'none' }}
                      >
                        <FaTrashAlt /> Supprimer
                      </button>
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
      
      {/* MODAL DETAILS PRO ORGANISATION */}
      {showModal && selectedOrg && (
        <div className="admin-modal-overlay">
           <div className="admin-modal-content" style={{ maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header" style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px 12px 0 0' }}>
                 <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <FaBuilding color="#0247AA" /> Détails Organisation <span style={{ color: '#0247AA' }}>#{selectedOrg.id}</span>
                 </h3>
                 <button className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', color: '#64748b', cursor: 'pointer' }} onClick={() => setShowModal(false)}><FaTimes /></button>
              </div>
              
              <div className="modal-body" style={{ padding: '24px', overflowY: 'auto' }}>
                 <div className="modal-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', background: '#f1f5f9', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                    <div><strong style={{ color: '#64748b' }}>Nom:</strong> <br/><span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedOrg.name}</span></div>
                    <div><strong style={{ color: '#64748b' }}>Propriétaire:</strong> <br/><span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedOrg.owner_name}</span></div>
                    <div><strong style={{ color: '#64748b' }}>Date création:</strong> <br/><span style={{ fontWeight: 600, color: '#0f172a' }}>{new Date(selectedOrg.created_at).toLocaleDateString()}</span></div>
                 </div>

                 {loadingDetails ? (
                    <div className="modal-loading" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Chargement des données liées...</div>
                 ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {/* MEMBERS TABLE */}
                      <div>
                        <h4 className="docs-title" style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}><FaUsers color="#64748b" /> Membres ({orgMembers.length})</h4>
                        {orgMembers.length === 0 ? (
                            <div style={{ padding: '20px', background: '#fafafa', borderRadius: '8px', color: '#94a3b8', textAlign: 'center' }}>Aucun membre.</div>
                        ) : (
                            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                              <table className="admin-docs-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                    <tr>
                                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>ID</th>
                                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Nom</th>
                                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Email</th>
                                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Rôle</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orgMembers.map(m => (
                                      <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '12px', color: '#64748b' }}>{m.id}</td>
                                          <td style={{ padding: '12px', fontWeight: 500, color: '#0f172a' }}>{m.name}</td>
                                          <td style={{ padding: '12px', color: '#64748b' }}>{m.email}</td>
                                          <td style={{ padding: '12px' }}><span className={`status-pill pill-large ${m.role === 'owner' ? 'signée_ttn' : 'signée'}`}>{m.role.toUpperCase()}</span></td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                        )}
                      </div>

                      {/* TRANSACTIONS TABLE */}
                      <div>
                        <h4 className="docs-title" style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}><FaFileAlt color="#64748b" /> Transactions ({orgTransactions.length})</h4>
                        {orgTransactions.length === 0 ? (
                            <div style={{ padding: '20px', background: '#fafafa', borderRadius: '8px', color: '#94a3b8', textAlign: 'center' }}>Aucune transaction liée.</div>
                        ) : (
                            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                              <table className="admin-docs-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                    <tr>
                                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>ID</th>
                                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Facture</th>
                                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Statut</th>
                                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Membre source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orgTransactions.map(t => (
                                      <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '12px', color: '#64748b' }}>{t.id}</td>
                                          <td style={{ padding: '12px', fontWeight: 500, color: '#0f172a' }}>{t.facture_number}</td>
                                          <td style={{ padding: '12px' }}><span className={`status-pill pill-large ${t.statut}`}>{t.statut}</span></td>
                                          <td style={{ padding: '12px', color: '#64748b' }}>{t.user_name}</td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                        )}
                      </div>
                    </div>
                 )}
              </div>
              
              <div className="modal-footer" style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 12px 12px', display: 'flex', justifyContent: 'flex-end', gap: '12px', flexShrink: 0 }}>
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

export default GestionOrganisationsAdmin;
