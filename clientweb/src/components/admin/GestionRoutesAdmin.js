import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaChevronLeft, FaChevronRight, FaRoute, FaSearch } from "react-icons/fa";
import "../style/gestionUtilisateur.css";

const METHOD_STYLE = {
  GET:    { bg: "#e0f2fe", color: "#0284c7" },
  POST:   { bg: "#dcfce7", color: "#16a34a" },
  PUT:    { bg: "#fef3c7", color: "#d97706" },
  DELETE: { bg: "#fee2e2", color: "#dc2626" },
};

const ROLE_CATEGORY = {
  "Connexion utilisateur":           { bg: "#ede9fe", color: "#7c3aed" },
  "Inscription nouvel utilisateur":  { bg: "#ede9fe", color: "#7c3aed" },
  "Deconnexion":                     { bg: "#ede9fe", color: "#7c3aed" },
  "Verification OTP email":          { bg: "#ede9fe", color: "#7c3aed" },
  "Infos profil connecte":           { bg: "#ede9fe", color: "#7c3aed" },
  "Auth via Google":                 { bg: "#ede9fe", color: "#7c3aed" },
  "Demande reset mot de passe":      { bg: "#ede9fe", color: "#7c3aed" },
  "Reinitialisation mot de passe":   { bg: "#ede9fe", color: "#7c3aed" },
  "Gestion des utilisateurs (Admin)":{ bg: "#fee2e2", color: "#dc2626" },
  "Gestion des routes API (Admin)":  { bg: "#fee2e2", color: "#dc2626" },
  "Gestion des transactions":        { bg: "#ecfdf5", color: "#059669" },
  "Acces aux factures":              { bg: "#ecfdf5", color: "#059669" },
  "Gestion des notifications":       { bg: "#fef3c7", color: "#d97706" },
  "Generer Cle API":                 { bg: "#f0f9ff", color: "#0284c7" },
  "Recuperer Cle API":               { bg: "#f0f9ff", color: "#0284c7" },
  "API Publique Export Documents":   { bg: "#f0fdf4", color: "#16a34a" },
  "Page de signature client":        { bg: "#fdf4ff", color: "#a21caf" },
};

const getRoleBadgeStyle = (role) => {
  return ROLE_CATEGORY[role] || { bg: "#f1f5f9", color: "#475569" };
};

const GestionRoutesAdmin = () => {
  const [routes, setRoutes] = useState([]);
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;


  const fetchRoutes = async () => {
    try {
      const res = await axios.get("http://51.178.39.67.nip.io/api/admin/routes", {
        withCredentials: true,
      });
      setRoutes(res.data.routes || []);
    } catch (err) {
      console.error("Erreur routes:", err);
    }
  };

  useEffect(() => { fetchRoutes(); }, []);

  const filteredRoutes = routes.filter((r) => {
    const matchSearch =
      r.path.toLowerCase().includes(search.toLowerCase()) ||
      (r.role || "").toLowerCase().includes(search.toLowerCase()) ||
      r.methods.join(", ").toLowerCase().includes(search.toLowerCase());

    const matchMethod =
      filterMethod === "ALL" || r.methods.includes(filterMethod);

    return matchSearch && matchMethod;
  });

  // Reset to page 1 on filter
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterMethod]);

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredRoutes.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRoutes.length / itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);


  const totalByMethod = (m) => routes.filter(r => r.methods.includes(m)).length;

  return (
    <div className="page">
      <div className="full-width-container">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-title">
            <FaRoute />
            <h2>Gestion des Routes API</h2>
          </div>
          <div style={{ fontSize: "13px", color: "#64748b", marginTop: 4 }}>
            {routes.length} routes enregistrées
          </div>
        </div>

        {/* Stats rapides */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "16px"
        }}>
          {["ALL", "GET", "POST", "PUT", "DELETE"].map((m) => {
            const s = m === "ALL" ? null : METHOD_STYLE[m];
            const count = m === "ALL" ? routes.length : totalByMethod(m);
            const isActive = filterMethod === m;
            return (
              <button
                key={m}
                onClick={() => setFilterMethod(m)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  border: isActive
                    ? `2px solid ${s ? s.color : "#334155"}`
                    : "2px solid transparent",
                  background: isActive
                    ? (s ? s.bg : "#e2e8f0")
                    : "#f8fafc",
                  color: s ? s.color : "#334155",
                  fontWeight: "bold",
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {m} <span style={{ opacity: 0.7 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Barre de recherche */}
        <div className="filters-card">
          <div style={{ position: "relative", width: "100%" }}>
            <FaSearch style={{ position: "absolute", left: 15, top: 14, color: "#aaa" }} />
            <input
              className="input"
              style={{ paddingLeft: 40, width: "100%", boxSizing: "border-box" }}
              placeholder="Rechercher par chemin, rôle ou méthode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Liste des routes */}
        <div className="transactions-container">
          {filteredRoutes.length > 0 && (
            <div style={{ marginBottom: '16px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              Affiche {Math.min(filteredRoutes.length, currentItems.length)} sur {filteredRoutes.length} route{filteredRoutes.length > 1 ? 's' : ''}
            </div>
          )}
          <div className="transactions-list">
            {currentItems.map((route, i) => {
              const badgeStyle = getRoleBadgeStyle(route.role);
              return (
                <div key={i} className="transaction-row blue" style={{ padding: "12px 16px" }}>
                  {/* Méthodes */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                    {route.methods.map((m) => {
                      const ms = METHOD_STYLE[m] || { bg: "#f1f5f9", color: "#475569" };
                      return (
                        <span
                          key={m}
                          style={{
                            background: ms.bg,
                            color: ms.color,
                            padding: "3px 10px",
                            borderRadius: "12px",
                            fontWeight: "bold",
                            fontSize: "11px",
                            letterSpacing: "0.5px"
                          }}
                        >
                          {m}
                        </span>
                      );
                    })}
                    {/* Badge rôle */}
                    <span style={{
                      background: badgeStyle.bg,
                      color: badgeStyle.color,
                      padding: "3px 10px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: "600",
                      border: `1px solid ${badgeStyle.color}30`
                    }}>
                      {route.role || "Non défini"}
                    </span>
                  </div>
                  {/* Chemin */}
                  <div style={{
                    fontFamily: "monospace",
                    fontSize: "13px",
                    color: "#334155",
                    fontWeight: "bold",
                    wordBreak: "break-all",
                    overflowWrap: "anywhere"
                  }}>
                    {route.path}
                  </div>
                </div>
              );
            })}
            {filteredRoutes.length === 0 && (
              <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>
                Aucune route trouvée.
              </div>
            )}
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
        </div>
      </div>
    </div>
  );
};

export default GestionRoutesAdmin;
