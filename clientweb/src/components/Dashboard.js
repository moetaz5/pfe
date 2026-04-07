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
  FaUserShield,
  FaChartLine,
  FaChevronLeft,
  FaChevronRight,
  FaRoute,
  FaTrash,
  FaCheckDouble,
} from "react-icons/fa";

import { Sidebar, Menu, MenuItem, SubMenu } from "react-pro-sidebar";
import { Bell } from "lucide-react";

import { AuthContext } from "../context/AuthContext";
import "./style/dashboard.css";
import logo from "./assets/logo_M.png";
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
  const [toggled, setToggled] = useState(false);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth <= 768 && toggled) {
      setToggled(false);
    }
  }, [location.pathname, toggled]);

  // ── Toggle Sidebar Helper ──
  const toggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setToggled(!toggled);
    } else {
      setCollapsed(!collapsed);
    }
  };

  // ── User info ──
  const isAdmin = user?.role === "ADMIN";
  const isUser = user?.role === "USER";
  const userId = user?.id || null;

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
    organizations: 0,
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
      { name: "Mes transactions", path: "MyTransactions" },
      { name: "Mes factures", path: "facture" },
      { name: "Mon profil", path: "profil" },
      { name: "Modifier profil", path: "profil/ProfilEdit" },
      { name: "Changer mot de passe", path: "profil/ChangePassword" },
      { name: "Organisation", path: "Organization" },
      { name: "Jeton", path: "Jeton" },
      { name: "Token API", path: "TokenAPI" },
      { name: "Statistiques", path: "statistique" },
      { name: "Gestion utilisateurs", path: "GestionUtilisateur" },
      {
        name: "Confirmation finale de paiement jetons",
        path: "GestionConfirmationFinaleJetons",
      },
      { name: "Toutes demandes de jetons", path: "GestionDemandesJetons" },
      { name: "Statistiques Admin", path: "StatistiqueAdmin" },
      { name: "Toutes les API", path: "GestionRoutesAdmin" },
    ];
    return allMenuItems.filter((item) =>
      item.name.toLowerCase().includes(query.toLowerCase()),
    );
  };

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    setFilteredMenuItems(q.length > 0 ? filterMenuItems(q) : []);
  };

  // ── Load organisation ──
  useEffect(() => {
    if (!userId || !isUser) {
      setOrganizationId(null);
      return;
    }
    const fetchOrg = async () => {
      try {
        const res = await axios.get(
          "/api/organizations/mine",
          { withCredentials: true },
        );
        setOrganizationId(res.data.length > 0 ? res.data[0].id : null);
      } catch {
        setOrganizationId(null);
      }
    };
    fetchOrg();
  }, [userId, isUser]);

  // ── Load Stats & Jetons ──
  useEffect(() => {
    if (!userId) return;

    const fetchDashboardData = async () => {
      try {
        if (isAdmin) {
          // Fetch admin global stats
          const res = await axios.get("/api/statistiqueadmin", {
            withCredentials: true,
          });
          const data = res.data;
          setStats({
            transactions: data.totalTransactions || 0,
            signatures: data.utilisateurs || 0,
            factures: data.totalFactures || 0,
            organizations: data.totalOrganizations || 0,
          });
        } else {
          const res = await axios.get(
            "/api/dashboard/stats",
            { withCredentials: true },
          );
          const data = res.data;
          setStats({
            transactions: data.transactions,
            signatures: data.signatures,
            factures: data.factures,
            organizations: 0,
          });
          setTotalJetons(data.totalJetons);
        }
      } catch (err) {
        console.error("DASHBOARD STATS LOAD ERROR:", err);
        setStats({ transactions: 0, signatures: 0, factures: 0, organizations: 0 });
        if (!isAdmin) setTotalJetons(0);
      }
    };

    fetchDashboardData();
  }, [userId, isAdmin, location.pathname]);

  // ── Load notifications ──
  useEffect(() => {
    if (!userId) return;
    const fetchNotifs = async () => {
      try {
        const res = await axios.get("/api/notifications", {
          withCredentials: true,
        });
        setNotifications(res.data || []);
      } catch (err) {
        console.error("NOTIFICATION LOAD ERROR:", err);
      }
    };
    fetchNotifs();
  }, [userId, location.pathname]);

  const markAsRead = async (id) => {
    try {
      await axios.put(
        `/api/notifications/${id}/read`,
        {},
        { withCredentials: true },
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)),
      );
    } catch (err) {
      console.error("MARK READ ERROR:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(
        "/api/notifications/read-all",
        {},
        { withCredentials: true },
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error("MARK ALL READ ERROR:", err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await axios.delete(`/api/notifications/${id}`, {
        withCredentials: true,
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("DELETE NOTIF ERROR:", err);
    }
  };

  const getAISuggestions = () => {
    const path = location.pathname;
    if (path.includes("CreateTransaction"))
      return [
        "Comment créer une transaction ?",
        "Quels documents sont nécessaires ?",
        "Comment envoyer une signature ?",
      ];
    if (path.includes("MyTransactions"))
      return [
        "Pourquoi ma transaction est en attente ?",
        "Comment annuler une transaction ?",
        "Voir le statut détaillé",
      ];
    if (path.includes("Organization"))
      return [
        "Comment ajouter un membre ?",
        "Comment voir les transactions organisation ?",
        "Comment gérer les rôles ?",
      ];
    if (path.includes("Token"))
      return [
        "Comment acheter des jetons ?",
        "Pourquoi mes jetons ne sont pas crédités ?",
        "Voir historique des paiements",
      ];
    return [
      "Comment fonctionne Medica-Sign ?",
      "Comment créer une signature ?",
      "Comment contacter le support ?",
    ];
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
        toggled={toggled}
        onBackdropClick={() => setToggled(false)}
        breakPoint="md"
        rootStyles={{
          backgroundColor: "var(--panel)",
          borderRight: "1px solid var(--border)",
          height: "100vh",
        }}
      >
        <div className={`sidebar-header-pro ${collapsed ? "is-sidebar-collapsed" : ""}`}>
          {!collapsed && (
            <div className="brand">
              <div className="brand-text">
                <h3>Medica-Sign</h3>
                <p>{user.name}</p>
              </div>
            </div>
          )}
          <button
            className={`sidebar-toggle-pro ${collapsed ? "is-collapsed" : ""}`}
            onClick={toggleSidebar}
            title={collapsed ? "Ouvrir" : "Réduire"}
            style={collapsed ? { margin: '0 auto' } : {}}
          >
            {collapsed ? (
              <FaChevronRight fontSize={14} />
            ) : (
              <FaChevronLeft fontSize={14} />
            )}
          </button>
        </div>

        <Menu>
          <MenuItem
            icon={<FaHome />}
            active={location.pathname === "/dashboard" || location.pathname === "/dashboard/"}
            component={<NavLink to="/dashboard" end />}
          >
            Tableau de bord
          </MenuItem>
          {isUser && (
            <>
              <MenuItem
                icon={<FaSignature />}
                active={location.pathname.includes("CreateTransaction")}
                component={<NavLink to="CreateTransaction" />}
              >
                Création de transaction
              </MenuItem>
              <MenuItem
                icon={<FaFileInvoice />}
                active={location.pathname.includes("MyTransactions")}
                component={<NavLink to="MyTransactions" />}
              >
                Mes transactions
              </MenuItem>
              <MenuItem
                icon={<FaFileInvoice />}
                active={location.pathname.includes("facture")}
                component={<NavLink to="facture" />}
              >
                Mes factures
              </MenuItem>
              <SubMenu icon={<FaUser />} label="Mon profil">
                <MenuItem component={<NavLink to="profil" />}>
                  Mes informations
                </MenuItem>
                <MenuItem component={<NavLink to="profil/ProfilEdit" />}>
                  Modifier profil
                </MenuItem>


                <MenuItem component={<NavLink to="profil/Certification" />}>
                  Certifier mon compte
                </MenuItem>
              </SubMenu>
              <SubMenu icon={<FaBuilding />} label="Organisation">
                {!organizationId && (
                  <MenuItem component={<NavLink to="CreationOrganization" />}>
                    Créer une organisation
                  </MenuItem>
                )}
                {organizationId && (
                  <>
                    <MenuItem
                      component={
                        <NavLink
                          to={`/dashboard/OrganizationDetail/${organizationId}`}
                        />
                      }
                    >
                      Détail organisation
                    </MenuItem>
                    <MenuItem
                      component={
                        <NavLink
                          to={`Organization/${organizationId}/transactions`}
                        />
                      }
                    >
                      Transactions organisation
                    </MenuItem>
                  </>
                )}
              </SubMenu>
              <SubMenu icon={<FaHeadset />} label="Support">
                <MenuItem component={<NavLink to="contacter" />}>
                  Contacter
                </MenuItem>
              </SubMenu>
              <SubMenu icon={<FaCoins />} label="Jeton">
                <MenuItem component={<NavLink to="AcheterJetons" />}>
                  Acheter des jetons
                </MenuItem>
                <MenuItem component={<NavLink to="MesDemandesJetons" />}>
                  Mes demandes
                </MenuItem>
              </SubMenu>
              <SubMenu icon={<FaCode />} label="Développeur">
                <MenuItem component={<NavLink to="TokenAPI" />}>
                  Token API
                </MenuItem>
                
              </SubMenu>

              <MenuItem
                icon={<FaChartBar />}
                component={<NavLink to="statistique" />}
              >
                Statistiques
              </MenuItem>
            </>
          )}
          {isAdmin && (
            <>
              <MenuItem
                icon={<FaUsers />}
                active={location.pathname.includes("GestionUtilisateur")}
                component={<NavLink to="GestionUtilisateur" />}
              >
                Gestion Utilisateurs
              </MenuItem>
              <MenuItem
                icon={<FaFileAlt />}
                active={location.pathname.includes("GestionTransactionsAdmin")}
                component={<NavLink to="GestionTransactionsAdmin" />}
              >
                Toutes les transactions
              </MenuItem>
              <MenuItem
                icon={<FaBuilding />}
                component={<NavLink to="GestionOrganisationsAdmin" />}
              >
                Toutes les organisations
              </MenuItem>
              <MenuItem
                icon={<FaRoute />}
                component={<NavLink to="GestionRoutesAdmin" />}
              >
                Gestion API Server
              </MenuItem>
              <MenuItem
                icon={<FaCoins />}
                component={<NavLink to="GestionDemandesJetons" />}
              >
                Demandes de jetons
              </MenuItem>
              <MenuItem
                icon={<FaCheckCircle />}
                component={<NavLink to="GestionConfirmationFinaleJetons" />}
              >
                Confirmations Paiements
              </MenuItem>
              <MenuItem
                icon={<FaChartLine />}
                component={<NavLink to="StatistiqueAdmin" />}
              >
                Statistiques Globales
              </MenuItem>
              <MenuItem
                icon={<FaHeadset />}
                component={<NavLink to="contacter" />}
              >
                Support Admin
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
      <div className={`main ${toggled ? "toggled" : ""}`}>
        {/* ── Topbar ── */}
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-toggle" onClick={toggleSidebar}>
              <FaBars />
            </button>
            <div className="search" ref={searchRef}>
              <FaSearch />
              <input
                type="text"
                placeholder="Rechercher..."
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
                      onClick={() => {
                        setFilteredMenuItems([]);
                        setSearchQuery("");
                      }}
                    >
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="top-actions">
            {isUser && (
              <NavLink to="AcheterJetons" className="jeton-balance-chip">
                <FaCoins />
                Jetons: {totalJetons.toLocaleString()}
              </NavLink>
            )}

            <div className="notif-wrapper" ref={notifRef}>
              <button
                className={`icon-btn notif ${unreadCount > 0 ? "has-unread" : ""}`}
                onClick={() => setNotifOpen(!notifOpen)}
                title="Notifications"
              >
                <Bell size={22} strokeWidth={1.8} />
                {unreadCount > 0 && (
                  <span className="badge">{unreadCount}</span>
                )}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <strong>Notifications</strong>
                    <div className="notif-header-actions">
                      {unreadCount > 0 && (
                        <button
                          className="text-btn"
                          onClick={markAllAsRead}
                          title="Tout marquer comme lu"
                        >
                          <FaCheckDouble size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {notifications.length === 0 && (
                    <div className="notif-empty">Aucune notification</div>
                  )}
                  <div className="notif-list">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`notif-item ${!notif.is_read ? "unread" : ""}`}
                        onClick={() => !notif.is_read && markAsRead(notif.id)}
                      >
                        <div className="notif-content">
                          <div className="notif-title">{notif.title}</div>
                          <div className="notif-message">{notif.message}</div>
                          <div className="notif-date">
                            {new Date(notif.created_at).toLocaleString("fr-FR")}
                          </div>
                        </div>
                        <button
                          className="notif-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notif.id);
                          }}
                          title="Supprimer"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div 
              className="avatar" 
              title={user.name}
              onClick={() => navigate("/dashboard/profil")}
              style={{ cursor: "pointer" }}
            >
              {String(user.name || "U")
                .charAt(0)
                .toUpperCase()}
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
                  <p>Créez, signez et gérez vos documents en toute sécurité.</p>
                </div>
                {isUser && (
                  <div className="welcome-actions">
                    <NavLink
                      className="welcome-btn welcome-btn--primary"
                      to="CreateTransaction"
                    >
                      <FaPlus style={{ fontSize: 11 }} />
                      Nouvelle signature
                    </NavLink>
                    <NavLink
                      className="welcome-btn welcome-btn--ghost"
                      to="MyTransactions"
                    >
                      Voir transactions
                    </NavLink>
                  </div>
                )}
              </div>

              {/* ── Stats Cards ── */}
              {isUser && (
                <div className="stats-grid">
                  <NavLink
                    to="AcheterJetons"
                    className="stat-card stat-card--jetons"
                  >
                    <div className="stat-card__header">
                      <span className="stat-card__label">
                        JETONS DISPONIBLES
                      </span>
                      <div className="stat-card__icon stat-card__icon--jetons">
                        <FaCoins />
                      </div>
                    </div>
                    <div className="stat-card__value">
                      {totalJetons.toLocaleString()}
                    </div>
                    <div className="stat-card__sub">
                      <span className="stat-card__status stat-card__status--active">
                        ● actif
                      </span>
                    </div>
                  </NavLink>

                  <NavLink
                    to="MyTransactions"
                    className="stat-card stat-card--transactions"
                  >
                    <div className="stat-card__header">
                      <span className="stat-card__label">TRANSACTIONS</span>
                      <div className="stat-card__icon stat-card__icon--transactions">
                        <FaFileAlt />
                      </div>
                    </div>
                    <div className="stat-card__value">{stats.transactions}</div>
                    <div className="stat-card__sub">
                      <span className="stat-card__link">
                        Ce mois <FaArrowRight style={{ fontSize: 9 }} />
                      </span>
                    </div>
                  </NavLink>

                  <NavLink
                    to="PosSignature"
                    className="stat-card stat-card--signatures"
                  >
                    <div className="stat-card__header">
                      <span className="stat-card__label">SIGNATURES</span>
                      <div className="stat-card__icon stat-card__icon--signatures">
                        <FaShieldAlt />
                      </div>
                    </div>
                    <div className="stat-card__value">{stats.signatures}</div>
                    <div className="stat-card__sub">
                      <span className="stat-card__link">
                        Validées <FaCheckCircle style={{ fontSize: 10 }} />
                      </span>
                    </div>
                  </NavLink>

                  <NavLink
                    to="facture"
                    className="stat-card stat-card--factures"
                  >
                    <div className="stat-card__header">
                      <span className="stat-card__label">FACTURES</span>
                      <div className="stat-card__icon stat-card__icon--factures">
                        <FaFileInvoice />
                      </div>
                    </div>
                    <div className="stat-card__value">{stats.factures}</div>
                    <div className="stat-card__sub">
                      <span className="stat-card__link">
                        Générées <FaArrowRight style={{ fontSize: 9 }} />
                      </span>
                    </div>
                  </NavLink>
                </div>
              )}

              {/* ── Quick Actions USER ── */}
              {isUser && (
                <div className="quick-section">
                  <h3 className="quick-section__title">
                    <FaRocket
                      style={{ color: "var(--primary)", fontSize: 14 }}
                    />
                    Actions Rapides
                  </h3>
                  <div className="quick-grid">
                    <NavLink to="profil/Certification" className="quick-card">
                      <div className="quick-card__icon" style={{ backgroundColor: '#eff6ff', color: '#3b82f6' }}>
                        <FaUserShield />
                      </div>
                      <div>
                        <div className="quick-card__title">Certifier mon compte</div>
                        <div className="quick-card__desc">Validez votre identité officiellement</div>
                      </div>
                    </NavLink>

                    <NavLink to={organizationId ? `/dashboard/OrganizationDetail/${organizationId}` : "CreationOrganization"} className="quick-card">
                      <div className="quick-card__icon" style={{ backgroundColor: '#fff7ed', color: '#f97316' }}>
                        <FaBuilding />
                      </div>
                      <div>
                        <div className="quick-card__title">Organisation</div>
                        <div className="quick-card__desc">Gérez votre entreprise</div>
                      </div>
                    </NavLink>
                    <NavLink to="TokenAPI" className="quick-card">
                      <div className="quick-card__icon" style={{ backgroundColor: '#f5f3ff', color: '#8b5cf6' }}>
                        <FaCode />
                      </div>
                      <div>
                        <div className="quick-card__title">Token API</div>
                        <div className="quick-card__desc">Intégration & développeur</div>
                      </div>
                    </NavLink>
                  </div>
                </div>
              )}


              {/* ── Stats Cards Admin ── */}
              {isAdmin && (
                <div className="stats-grid">
                  <NavLink
                    to="GestionUtilisateur"
                    className="stat-card stat-card--users"
                  >
                    <div className="stat-card__header">
                      <span className="stat-card__label">UTILISATEURS</span>
                      <div className="stat-card__icon stat-card__icon--users">
                        <FaUsers />
                      </div>
                    </div>
                    <div className="stat-card__value">{stats.signatures}</div>
                    <div className="stat-card__sub">
                      <span className="stat-card__status stat-card__status--active">
                        ● inscriptions
                      </span>
                    </div>
                  </NavLink>

                  <NavLink
                    to="GestionTransactionsAdmin"
                    className="stat-card stat-card--transactions"
                  >
                    <div className="stat-card__header">
                      <span className="stat-card__label">
                        TRANSACTIONS GLOBALES
                      </span>
                      <div className="stat-card__icon stat-card__icon--transactions">
                        <FaFileAlt />
                      </div>
                    </div>
                    <div className="stat-card__value">{stats.transactions}</div>
                    <div className="stat-card__sub">
                      <span className="stat-card__link">
                        Total système <FaArrowRight style={{ fontSize: 9 }} />
                      </span>
                    </div>
                  </NavLink>

                  <NavLink
                    to="GestionOrganisationsAdmin"
                    className="stat-card stat-card--signatures"
                  >
                    <div className="stat-card__header">
                      <span className="stat-card__label">ORGANISATIONS</span>
                      <div className="stat-card__icon stat-card__icon--signatures">
                        <FaBuilding />
                      </div>
                    </div>
                    <div className="stat-card__value">{stats.organizations}</div>
                    <div className="stat-card__sub">
                      <span className="stat-card__link">
                        Actives <FaCheckCircle style={{ fontSize: 10 }} />
                      </span>
                    </div>
                  </NavLink>

                  <NavLink
                    to="StatistiqueAdmin"
                    className="stat-card stat-card--factures"
                  >
                    <div className="stat-card__header">
                      <span className="stat-card__label">ANALYTIQUES</span>
                      <div className="stat-card__icon stat-card__icon--factures">
                        <FaChartLine />
                      </div>
                    </div>
                    <div className="stat-card__value">LIVE</div>
                    <div className="stat-card__sub">
                      <span className="stat-card__link">
                        Détails <FaArrowRight style={{ fontSize: 9 }} />
                      </span>
                    </div>
                  </NavLink>
                </div>
              )}

              {/* ── Quick Actions Admin ── */}
              {isAdmin && (
                <div className="quick-section">
                  <h3 className="quick-section__title">
                    <FaRocket
                      style={{ color: "var(--primary)", fontSize: 14 }}
                    />
                    Gestion Rapide Admin
                  </h3>
                  <div className="quick-grid">
                    <NavLink to="GestionDemandesJetons" className="quick-card">
                      <div className="quick-card__icon">
                        <FaCoins />
                      </div>
                      <div>
                        <div className="quick-card__title">
                          Demandes de jetons
                        </div>
                        <div className="quick-card__desc">
                          Valider les nouvelles requêtes
                        </div>
                      </div>
                      <FaArrowRight className="quick-card__arrow" />
                    </NavLink>

                    <NavLink to="GestionUtilisateur" className="quick-card">
                      <div className="quick-card__icon">
                        <FaUsers />
                      </div>
                      <div>
                        <div className="quick-card__title">Utilisateurs</div>
                        <div className="quick-card__desc">
                          Gérer les comptes et accès
                        </div>
                      </div>
                      <FaArrowRight className="quick-card__arrow" />
                    </NavLink>

                    <NavLink to="GestionRoutesAdmin" className="quick-card">
                      <div className="quick-card__icon">
                        <FaRoute />
                      </div>
                      <div>
                        <div className="quick-card__title">Routes API</div>
                        <div className="quick-card__desc">
                          Surveillance des terminaux
                        </div>
                      </div>
                      <FaArrowRight className="quick-card__arrow" />
                    </NavLink>

                    <NavLink to="contacter" className="quick-card">
                      <div className="quick-card__icon">
                        <FaHeadset />
                      </div>
                      <div>
                        <div className="quick-card__title">Tickets Support</div>
                        <div className="quick-card__desc">
                          Répondre aux sollicitations
                        </div>
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
              <Outlet context={{ setAiOpen }} />
            </div>
          )}
          {isDashboardHome && <Outlet context={{ setAiOpen }} />}
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
