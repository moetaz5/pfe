import React, { useContext, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
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
  FaSearch
} from "react-icons/fa";
import { AuthContext } from "../context/AuthContext";
import "./style/dashboard.css";

// ✅ Logo de l'application
import logo from "./assets/logo.png";

const Dashboard = () => {
  const { user, logout, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isDashboardHome =
    location.pathname === "/dashboard" || location.pathname === "/dashboard/";

  if (loading) return <p className="loading">Chargement...</p>;
  if (!user) return <Navigate to="/login" replace />;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const navItemClass = ({ isActive }) => `nav-item ${isActive ? "active" : ""}`;
  const navSubClass = ({ isActive }) => `nav-sub ${isActive ? "active" : ""}`;

  return (
    <div className="dash">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="brand">
            {/* ✅ Logo à la place du carré */}
            <img src={logo} alt="Medica-Sign Logo" className="brand-logo" />

            {!collapsed && (
              <div className="brand-text">
                {/* ✅ Nom de l'application */}
                <h3>Medica-Sign</h3>
                <p>{user.name}</p>
              </div>
            )}
          </div>

          <button
            className="icon-btn"
            onClick={() => setCollapsed(v => !v)}
            aria-label="Toggle sidebar"
          >
            <FaBars />
          </button>
        </div>

        <nav className="nav">
          <NavLink className={navItemClass} to="CreateTransaction">
            <span className="nav-ico"><FaSignature /></span>
            {!collapsed && <span className="nav-label">Création de transaction</span>}
          </NavLink>

          <NavLink className={navItemClass} to="MyTransactions">
            <span className="nav-ico"><FaFileInvoice /></span>
            {!collapsed && <span className="nav-label">Mes transactions</span>}
          </NavLink>

          <NavLink className={navItemClass} to="facture">
            <span className="nav-ico"><FaFileInvoice /></span>
            {!collapsed && <span className="nav-label">Mes factures</span>}
          </NavLink>

          {/* Profil : le titre ne navigue PAS */}
          <div className="section-title">
            <span className="section-ico"><FaUser /></span>
            {!collapsed && <span>Mon profil</span>}
          </div>

          <div className="nav-group">
            <NavLink end className={navSubClass} to="profil">
              {!collapsed ? "Mes informations" : <span className="dot" />}
            </NavLink>

            <NavLink className={navSubClass} to="profil/ProfilEdit">
              {!collapsed ? "Modifier profil" : <span className="dot" />}
            </NavLink>

            <NavLink className={navSubClass} to="profil/ChangePassword">
              {!collapsed ? "Changer mot de passe" : <span className="dot" />}
            </NavLink>

            <NavLink className={navSubClass} to="profil/signature">
              {!collapsed ? "Ma signature" : <span className="dot" />}
            </NavLink>

            <NavLink className={navSubClass} to="profil/certification">
              {!collapsed ? "Certifier mon compte" : <span className="dot" />}
            </NavLink>
          </div>

          <div className="section-title">
            <span className="section-ico"><FaBuilding /></span>
            {!collapsed && <span>Organisation</span>}
          </div>

          <div className="nav-group">
            <NavLink className={navSubClass} to="organisation/users">
              {!collapsed ? "Utilisateur transaction" : <span className="dot" />}
            </NavLink>
            <NavLink className={navSubClass} to="organisation/ttn">
              {!collapsed ? "Facture TTN" : <span className="dot" />}
            </NavLink>
            <NavLink className={navSubClass} to="organisation/teif">
              {!collapsed ? "Facture TEIF" : <span className="dot" />}
            </NavLink>
            <NavLink className={navSubClass} to="organisation/settings">
              {!collapsed ? "Paramètre" : <span className="dot" />}
            </NavLink>
            <NavLink className={navSubClass} to="Statistique">
              {!collapsed ? "Statistique" : <span className="dot" />}
            </NavLink>
          </div>

          <div className="section-title">
            <span className="section-ico"><FaHeadset /></span>
            {!collapsed && <span>Support</span>}
          </div>
          <div className="nav-group">
            <NavLink end className={navSubClass} to="contacter">
              {!collapsed ? "contacter" : <span className="dot" />}
            </NavLink>
            <NavLink className={navSubClass} to="AcheterJetons">
              {!collapsed ? "Acheter des jetons" : <span className="dot" />}
            </NavLink>
          </div>

          <div className="section-title">
            <span className="section-ico"><FaCode /></span>
            {!collapsed && <span>Développeur</span>}
          </div>

          <div className="nav-group">
            <NavLink className={navSubClass} to="dev/token">
              {!collapsed ? "Token d’API" : <span className="dot" />}
            </NavLink>
            <NavLink className={navSubClass} to="dev/api">
              {!collapsed ? "Échange d’API" : <span className="dot" />}
            </NavLink>
            <NavLink className={navSubClass} to="dev/hidden">
              {!collapsed ? "Positionnement caché" : <span className="dot" />}
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="logout" onClick={handleLogout}>
            <FaSignOutAlt />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="search">
            <FaSearch />
            <input placeholder="Rechercher…" />
          </div>

          <div className="top-actions">
            <button className="chip">Aide</button>
            <button className="chip">FAQ</button>
            <button className="icon-btn notif" aria-label="Notifications">
              <FaBell />
              <span className="badge">3</span>
            </button>
            <div className="avatar" title={user.name}>
              {String(user.name || "U").trim().slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="content">
          {isDashboardHome && (
            <div className="welcome">
              <div>
                <h2>Bienvenue, {user.name} 👋</h2>
                <p>Veuillez sélectionner une option dans le menu pour commencer.</p>
              </div>
              <div className="welcome-actions">
                <NavLink className="btn primary" to="signature">Nouvelle signature</NavLink>
                <NavLink className="btn ghost" to="transactions">Voir transactions</NavLink>
              </div>
            </div>
          )}

          <div className="card">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
