import React, { useContext, useEffect, useState, useRef } from "react";
import axios from "axios";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";

import {
  FaSignature,
  FaFileInvoice,
  FaUser,
  FaBuilding,
  FaHeadset,
  FaCode,
  FaSignOutAlt,
  FaBell,
  FaBars,
  FaSearch,
  FaUsers,
  FaCoins,
  FaChartBar,
  FaRocket,
  FaLayerGroup,
  FaShieldAlt,
  FaFileAlt,
  FaPlus,
  FaArrowRight,
  FaClock,
  FaCheckCircle,
  FaHome,
} from "react-icons/fa";

import { Sidebar, Menu, MenuItem, SubMenu } from "react-pro-sidebar";

import { AuthContext } from "../context/AuthContext";
import "./style/dashboard.css";
import logo from "./assets/logo.png";
import MiniAIChat from "../components/chatboot/MiniAIChat";

const Dashboard = () => {
  const { user, logout, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // ── Notifications ──
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  // ── AI Chat ──
  const [aiOpen, setAiOpen] = useState(false);
  const searchRef = useRef(null);

  // ── Sidebar ──
  const [collapsed, setCollapsed] = useState(false);

  // ── User info ──
  const isAdmin = user?.role === "ADMIN";
  const isUser  = user?.role === "USER";
  const userId  = user?.id || null;

  // ── Jetons ──
  const [totalJetons, setTotalJetons] = useState(0);

  // ── Organisation ──
  const [organizationId, setOrganizationId] = useState(null);

  // ── Search ──
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredMenuItems, setFilteredMenuItems] = useState([]);

  // ── Stats ──
  const [stats, setStats] = useState({
    transactions: 0,
    signatures: 0,
    factures: 0,
  });

  // ── Close search on outside click ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setFilteredMenuItems([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Close notif on outside click ──
  const notifRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Search helpers ──
  const filterMenuItems = (query) => {
    const allMenuItems = [
      { name: "Création de transaction", path: "CreateTransaction" },
      { name: "Mes transactions",        path: "MyTransactions" },
      { name: "Mes factures",            path: "facture" },
      { name: "Mon profil",              path: "profil" },
      { name: "Modifier profil",         path: "profil/ProfilEdit" },
      { name: "Changer mot de passe",    path: "profil/ChangePassword" },
      { name: "Organisation",            path: "Organization" },
      { name: "Jeton",                   path: "Jeton" },
      { name: "Token API",               path: "TokenAPI" },
      { name: "Signing Room",            path: "PosSignature" },
      { name: "Statistiques",            path: "statistique" },
      { name: "Gestion utilisateurs",    path: "GestionUtilisateur" },
      { name: "Confirmation finale de paiement jetons", path: "GestionConfirmationFinaleJetons" },
      { name: "Toutes demandes de jetons", path: "GestionDemandesJetons" },
      { name: "Statistiques Admin",      path: "StatistiqueAdmin" },
    ];
    return allMenuItems.filter((item) =>
      item.name.toLowerCase().includes(query.toLowerCase())
    );
  };

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    setFilteredMenuItems(q.length > 0 ? filterMenuItems(q) : []);
  };

  // ── Load organisation ──
  useEffect(() => {
    if (!userId || !isUser) { setOrganizationId(null); return; }
    const fetchOrg = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/organizations/mine", { withCredentials: true });
        setOrganizationId(res.data.length > 0 ? res.data[0].id : null);
      } catch { setOrganizationId(null); }
    };
    fetchOrg();
  }, [userId, isUser]);

  // ── Load Stats & Jetons ──
  useEffect(() => {
    if (!userId || !isUser) {
      setStats({ transactions: 0, signatures: 0, factures: 0 });
      setTotalJetons(0);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/dashboard/stats", { withCredentials: true });
        const data = res.data;
        setStats({
          transactions: data.transactions,
          signatures: data.signatures,
          factures: data.factures,
        });
        setTotalJetons(data.totalJetons);
      } catch (err) {
        console.error("DASHBOARD STATS LOAD ERROR:", err);
        setStats({ transactions: 0, signatures: 0, factures: 0 });
        setTotalJetons(0);
      }
    };

    fetchDashboardData();
  }, [userId, isUser, location.pathname]);

  // ── Load notifications ──
  useEffect(() => {
    if (!userId) return;
    const fetchNotifs = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/notifications", { withCredentials: true });
        setNotifications(res.data || []);
      } catch (err) { console.error("NOTIFICATION LOAD ERROR:", err); }
    };
    fetchNotifs();
  }, [userId, location.pathname]);


  const markAsRead = async (id) => {
    try {
      await axios.put(`http://localhost:5000/api/notifications/${id}/read`, {}, { withCredentials: true });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    } catch (err) { console.error("MARK READ ERROR:", err); }
  };

  const getAISuggestions = () => {
    const path = location.pathname;
    if (path.includes("CreateTransaction"))
      return ["Comment créer une transaction ?", "Quels documents sont nécessaires ?", "Comment envoyer une signature ?"];
    if (path.includes("MyTransactions"))
      return ["Pourquoi ma transaction est en attente ?", "Comment annuler une transaction ?", "Voir le statut détaillé"];
    if (path.includes("Organization"))
      return ["Comment ajouter un membre ?", "Comment voir les transactions organisation ?", "Comment gérer les rôles ?"];
    if (path.includes("Token"))
      return ["Comment acheter des jetons ?", "Pourquoi mes jetons ne sont pas crédités ?", "Voir historique des paiements"];
    return ["Comment fonctionne Medica-Sign ?", "Comment créer une signature ?", "Comment contacter le support ?"];
  };

  // ── Current time greeting ──
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  if (loading) return <p className="loading">Chargement...</p>;
  if (!user) return <Navigate to="/login" replace />;

  const isDashboardHome =
    location.pathname === "/dashboard" || location.pathname === "/dashboard/";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="dash">
      {/* ═══════════════════ SIDEBAR ═══════════════════ */}
      <Sidebar
        collapsed={collapsed}
        rootStyles={{
          backgroundColor: "var(--panel)",
          borderRight: "1px solid var(--border)",
          height: "100vh",
        }}
      >
        <div className="sidebar-header-pro">
          <div className="brand">
            <img src={logo} alt="Medica-Sign" className="brand-logo" />
            {!collapsed && (
              <div className="brand-text">
                <h3>Medica-Sign</h3>
                <p>{user.name}</p>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={() => setCollapsed(!collapsed)} title="Toggle menu">
            <FaBars />
          </button>
        </div>

        <Menu>
          <MenuItem icon={<FaHome />} component={<NavLink to="/dashboard" end />}>
            Tableau de bord
          </MenuItem>
          {isUser && (
            <>
              <MenuItem icon={<FaSignature />} component={<NavLink to="CreateTransaction" />}>
                Création de transaction
              </MenuItem>
              <MenuItem icon={<FaFileInvoice />} component={<NavLink to="MyTransactions" />}>
                Mes transactions
              </MenuItem>
              <MenuItem icon={<FaFileInvoice />} component={<NavLink to="facture" />}>
                Mes factures
              </MenuItem>
              <SubMenu icon={<FaUser />} label="Mon profil">
                <MenuItem component={<NavLink to="profil" />}>Mes informations</MenuItem>
                <MenuItem component={<NavLink to="profil/ProfilEdit" />}>Modifier profil</MenuItem>
                <MenuItem component={<NavLink to="profil/ChangePassword" />}>Changer mot de passe</MenuItem>
                <MenuItem component={<NavLink to="profil/Signature" />}>Ma signature</MenuItem>
                <MenuItem component={<NavLink to="profil/Certification" />}>Certifier mon compte</MenuItem>
              </SubMenu>
              <SubMenu icon={<FaBuilding />} label="Organisation">
                {!organizationId && (
                  <MenuItem component={<NavLink to="CreationOrganization" />}>Créer une organisation</MenuItem>
                )}
                {organizationId && (
                  <>
                    <MenuItem component={<NavLink to={`/dashboard/OrganizationDetail/${organizationId}`} />}>
                      Détail organisation
                    </MenuItem>
                    <MenuItem component={<NavLink to={`Organization/${organizationId}/transactions`} />}>
                      Transactions organisation
                    </MenuItem>
                  </>
                )}
              </SubMenu>
              <SubMenu icon={<FaHeadset />} label="Support">
                <MenuItem component={<NavLink to="contacter" />}>Contacter</MenuItem>
              </SubMenu>
              <SubMenu icon={<FaCoins />} label="Jeton">
                <MenuItem component={<NavLink to="AcheterJetons" />}>Acheter des jetons</MenuItem>
                <MenuItem component={<NavLink to="MesDemandesJetons" />}>Mes demandes</MenuItem>
              </SubMenu>
              <SubMenu icon={<FaCode />} label="Développeur">
                <MenuItem component={<NavLink to="TokenAPI" />}>Token API</MenuItem>
                <MenuItem component={<NavLink to="dev/api" />}>Échange API</MenuItem>
              </SubMenu>
              <MenuItem icon={<FaLayerGroup />} component={<NavLink to="PosSignature" />}>
                Signing Room
              </MenuItem>
              <MenuItem icon={<FaChartBar />} component={<NavLink to="statistique" />}>
                Statistiques
              </MenuItem>
            </>
          )}
          {isAdmin && (
            <>
              <MenuItem icon={<FaUsers />} component={<NavLink to="GestionUtilisateur" />}>
                Gestion utilisateurs
              </MenuItem>
              <MenuItem icon={<FaFileInvoice />} component={<NavLink to="GestionConfirmationFinaleJetons" />}>
                Confirmation paiement jetons
              </MenuItem>
              <MenuItem icon={<FaCoins />} component={<NavLink to="GestionDemandesJetons" />}>
                Toutes demandes de jetons
              </MenuItem>
              <MenuItem icon={<FaChartBar />} component={<NavLink to="StatistiqueAdmin" />}>
                Statistiques
              </MenuItem>
            </>
          )}
        </Menu>

        <div className="sidebar-footer-pro">
          <button className="logout" onClick={handleLogout}>
            <FaSignOutAlt />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </Sidebar>

      {/* ═══════════════════ MAIN ═══════════════════ */}
      <div className="main">
        {/* ── Topbar ── */}
        <header className="topbar">
          <div className="search" ref={searchRef}>
            <FaSearch />
            <input
              type="text"
              placeholder="Rechercher une fonction..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {filteredMenuItems.length > 0 && (
              <div className="search-suggestions">
                {filteredMenuItems.map((item) => (
                  <NavLink
                    to={item.path}
                    key={item.name}
                    className="search-suggestion"
                    onClick={() => { setFilteredMenuItems([]); setSearchQuery(""); }}
                  >
                    {item.name}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <div className="top-actions">
            {isUser && (
              <NavLink to="AcheterJetons" className="jeton-balance-chip">
                <FaCoins />
                Jetons: {totalJetons.toLocaleString()}
              </NavLink>
            )}

            <div className="notif-wrapper" ref={notifRef}>
              <button className="icon-btn notif" onClick={() => setNotifOpen(!notifOpen)} title="Notifications">
                <FaBell />
                {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <strong>Notifications</strong>
                    {unreadCount > 0 && (
                      <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
                        {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {notifications.length === 0 && (
                    <div className="notif-empty">Aucune notification</div>
                  )}
                  <div className="notif-list">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`notif-item ${!notif.is_read ? "unread" : ""}`}
                        onClick={() => markAsRead(notif.id)}
                      >
                        <div className="notif-title">{notif.title}</div>
                        <div className="notif-message">{notif.message}</div>
                        <div className="notif-date">
                          {new Date(notif.created_at).toLocaleString("fr-FR")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="avatar" title={user.name}>
              {String(user.name || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <main className="content">
          {isDashboardHome && (
            <>
              {/* ── Welcome Banner ── */}
              <div className="welcome">
                <div className="welcome-content">
                  <h2>
                    {getGreeting()}, {user.name} 👋
                    {isAdmin && <span className="admin-badge">ADMIN</span>}
                  </h2>
                  <p>
                    Créez, signez et gérez vos documents en toute sécurité.
                  </p>
                </div>
                {isUser && (
                  <div className="welcome-actions">
                    <NavLink className="welcome-btn welcome-btn--primary" to="CreateTransaction">
                      <FaPlus style={{ fontSize: 11 }} />
                      Nouvelle signature
                    </NavLink>
                    <NavLink className="welcome-btn welcome-btn--ghost" to="MyTransactions">
                      Voir transactions
                    </NavLink>
                  </div>
                )}
              </div>

              {/* ── Stats Cards ── */}
              {isUser && (
                <div className="stats-grid">
                  <NavLink to="AcheterJetons" className="stat-card stat-card--jetons">
                    <div className="stat-card__header">
                      <span className="stat-card__label">JETONS DISPONIBLES</span>
                      <div className="stat-card__icon stat-card__icon--jetons">
                        <FaCoins />
                      </div>
                    </div>
                    <div className="stat-card__value">{totalJetons.toLocaleString()}</div>
                    <div className="stat-card__sub">
                      <span className="stat-card__status stat-card__status--active">● actif</span>
                    </div>
                  </NavLink>

                  <NavLink to="MyTransactions" className="stat-card stat-card--transactions">
                    <div className="stat-card__header">
                      <span className="stat-card__label">TRANSACTIONS</span>
                      <div className="stat-card__icon stat-card__icon--transactions">
                        <FaFileAlt />
                      </div>
                    </div>
                    <div className="stat-card__value">{stats.transactions}</div>
                    <div className="stat-card__sub">
                      <span className="stat-card__link">Ce mois <FaArrowRight style={{ fontSize: 9 }} /></span>
                    </div>
                  </NavLink>

                  <NavLink to="PosSignature" className="stat-card stat-card--signatures">
                    <div className="stat-card__header">
                      <span className="stat-card__label">SIGNATURES</span>
                      <div className="stat-card__icon stat-card__icon--signatures">
                        <FaShieldAlt />
                      </div>
                    </div>
                    <div className="stat-card__value">{stats.signatures}</div>
                    <div className="stat-card__sub">
                      <span className="stat-card__link">Validées <FaCheckCircle style={{ fontSize: 10 }} /></span>
                    </div>
                  </NavLink>

                  <NavLink to="facture" className="stat-card stat-card--factures">
                    <div className="stat-card__header">
                      <span className="stat-card__label">FACTURES</span>
                      <div className="stat-card__icon stat-card__icon--factures">
                        <FaFileInvoice />
                      </div>
                    </div>
                    <div className="stat-card__value">{stats.factures}</div>
                    <div className="stat-card__sub">
                      <span className="stat-card__link">Générées <FaArrowRight style={{ fontSize: 9 }} /></span>
                    </div>
                  </NavLink>
                </div>
              )}

              {/* ── Quick Actions ── */}
              {isUser && (
                <div className="quick-section">
                  <h3 className="quick-section__title">
                    <FaRocket style={{ color: "var(--primary)", fontSize: 14 }} />
                    Accès rapides
                  </h3>
                  <div className="quick-grid">
                    <NavLink to="CreateTransaction" className="quick-card">
                      <div className="quick-card__icon"><FaSignature /></div>
                      <div>
                        <div className="quick-card__title">Nouvelle transaction</div>
                        <div className="quick-card__desc">Créer et envoyer un document à signer</div>
                      </div>
                      <FaArrowRight className="quick-card__arrow" />
                    </NavLink>

                    <NavLink to="profil" className="quick-card">
                      <div className="quick-card__icon"><FaUser /></div>
                      <div>
                        <div className="quick-card__title">Mon profil</div>
                        <div className="quick-card__desc">Consultez et modifiez vos informations</div>
                      </div>
                      <FaArrowRight className="quick-card__arrow" />
                    </NavLink>

                    <NavLink to="statistique" className="quick-card">
                      <div className="quick-card__icon"><FaChartBar /></div>
                      <div>
                        <div className="quick-card__title">Statistiques</div>
                        <div className="quick-card__desc">Visualisez vos performances</div>
                      </div>
                      <FaArrowRight className="quick-card__arrow" />
                    </NavLink>

                    <NavLink to="AcheterJetons" className="quick-card">
                      <div className="quick-card__icon"><FaCoins /></div>
                      <div>
                        <div className="quick-card__title">Acheter des jetons</div>
                        <div className="quick-card__desc">Rechargez votre solde de jetons</div>
                      </div>
                      <FaArrowRight className="quick-card__arrow" />
                    </NavLink>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Main card wrapping all child routes */}
          {!isDashboardHome && (
            <div className="card">
              <Outlet />
            </div>
          )}
          {isDashboardHome && <Outlet />}
        </main>
      </div>

      {/* ── AI Chatbot ── */}
      <MiniAIChat
        isOpen={aiOpen}
        setIsOpen={setAiOpen}
        suggestions={getAISuggestions()}
      />
    </div>
  );
};

export default Dashboard;
