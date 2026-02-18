import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  Navigate
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
  FaChartBar
} from "react-icons/fa";

import {
  Sidebar,
  Menu,
  MenuItem,
  SubMenu
} from "react-pro-sidebar";

import { AuthContext } from "../context/AuthContext";
import "./style/dashboard.css";
import logo from "./assets/logo.png";

const Dashboard = () => {
  const { user, logout, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = user?.role === "ADMIN";
  const isUser = user?.role === "USER";
  const userId = user?.id || null;
  const [totalJetons, setTotalJetons] = useState(0);

  // ✅ NOUVEAU STATE POUR ORGANISATION
  const [organizationId, setOrganizationId] = useState(null);

  // ===================== CHARGER ORGANISATION =====================
  useEffect(() => {
    if (!userId || !isUser) {
      setOrganizationId(null);
      return;
    }

    const fetchOrganization = async () => {
      try {
        const res = await axios.get(
          "http://localhost:5000/api/organizations/mine",
          { withCredentials: true }
        );

        if (res.data.length > 0) {
          setOrganizationId(res.data[0].id); // première organisation
        } else {
          setOrganizationId(null);
        }
      } catch (err) {
        console.error("ORG LOAD ERROR:", err);
        setOrganizationId(null);
      }
    };

    fetchOrganization();
  }, [userId, isUser]);

  // ===================== JETONS =====================
  useEffect(() => {
    if (!userId || !isUser) {
      setTotalJetons(0);
      return;
    }

    let isActive = true;

    const fetchJetonTotal = async () => {
      try {
        const res = await axios.get(
          "http://localhost:5000/api/jeton/total",
          { withCredentials: true }
        );

        if (isActive) {
          setTotalJetons(Number(res.data?.total_jetons || 0));
        }
      } catch (e) {
        if (isActive) {
          setTotalJetons(0);
        }
      }
    };

    fetchJetonTotal();

    return () => {
      isActive = false;
    };
  }, [isUser, location.pathname, userId]);

  if (loading) return <p className="loading">Chargement...</p>;
  if (!user) return <Navigate to="/login" replace />;

  const isDashboardHome =
    location.pathname === "/dashboard" ||
    location.pathname === "/dashboard/";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="dash">

      {/* ================= SIDEBAR ================= */}
      <Sidebar
        collapsed={collapsed}
        rootStyles={{
          backgroundColor: "var(--panel)",
          borderRight: "1px solid var(--border)",
          height: "100vh"
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

          <button
            className="icon-btn"
            onClick={() => setCollapsed(!collapsed)}
          >
            <FaBars />
          </button>
        </div>

        <Menu>

          {/* ================= USER ================= */}
          {isUser && (
            <>
              <MenuItem
                icon={<FaSignature />}
                component={<NavLink to="CreateTransaction" />}
              >
                Création de transaction
              </MenuItem>

              <MenuItem
                icon={<FaFileInvoice />}
                component={<NavLink to="MyTransactions" />}
              >
                Mes transactions
              </MenuItem>

              <MenuItem
                icon={<FaFileInvoice />}
                component={<NavLink to="facture" />}
              >
                Mes factures
              </MenuItem>

              {/* ================= PROFIL ================= */}
              <SubMenu icon={<FaUser />} label="Mon profil">
                <MenuItem component={<NavLink to="profil" />}>
                  Mes informations
                </MenuItem>

                <MenuItem component={<NavLink to="profil/ProfilEdit" />}>
                  Modifier profil
                </MenuItem>

                <MenuItem component={<NavLink to="profil/ChangePassword" />}>
                  Changer mot de passe
                </MenuItem>

                <MenuItem component={<NavLink to="profil/Signature" />}>
                  Ma signature
                </MenuItem>

                <MenuItem component={<NavLink to="profil/Certification" />}>
                  Certifier mon compte
                </MenuItem>
              </SubMenu>

              {/* ================= ORGANISATION ================= */}
              <SubMenu icon={<FaBuilding />} label="Organisation">
                <MenuItem component={<NavLink to="CreationOrganization" />}>
                  Creation Organisation
                </MenuItem>

                {/* ✅ AFFICHER SEULEMENT SI organizationId EXISTE */}
                {organizationId && (
                  <MenuItem
                    component={
                      <NavLink to={`/dashboard/OrganizationDetail/${organizationId}`} />
                    }
                  >
                    Organisation Detail
                  </MenuItem>
                )}
                <MenuItem component={<NavLink to={`Organization/${organizationId}/transactions`} />}>
  Transactions Organisation
</MenuItem>

              </SubMenu>

              {/* ================= SUPPORT ================= */}
              <SubMenu icon={<FaHeadset />} label="Support">
                <MenuItem component={<NavLink to="contacter" />}>
                  Contacter
                </MenuItem>

                <MenuItem component={<NavLink to="AcheterJetons" />}>
                  Acheter des jetons
                </MenuItem>

                <MenuItem component={<NavLink to="MesDemandesJetons" />}>
                  Mes demandes de jetons
                </MenuItem>
              </SubMenu>

              {/* ================= DEVELOPPEUR ================= */}
              <SubMenu icon={<FaCode />} label="Développeur">
                <MenuItem component={<NavLink to="TokenAPI" />}>
                  Token API
                </MenuItem>

                <MenuItem component={<NavLink to="dev/api" />}>
                  Échange API
                </MenuItem>
              </SubMenu>

              <MenuItem
                icon={<FaFileInvoice />}
                component={<NavLink to="PosSignature" />}
              >
                Signing Room
              </MenuItem>

              <MenuItem
                icon={<FaChartBar />}
                component={<NavLink to="statistique" />}
              >
                Statistiques
              </MenuItem>
            </>
          )}

          {/* ================= ADMIN ================= */}
          {isAdmin && (
            <>
              <MenuItem
                icon={<FaUsers />}
                component={<NavLink to="GestionUtilisateur" />}
              >
                Gestion utilisateurs
              </MenuItem>

              <MenuItem
                icon={<FaFileInvoice />}
                component={<NavLink to="GestionConfirmationFinaleJetons" />}
              >
               Confirmation finale de payement jetons
              </MenuItem>
<MenuItem
                icon={<FaFileInvoice />}
                component={<NavLink to="GestionDemandesJetons" />}
              >
                Toutes demandes de jetons
              </MenuItem>
              <MenuItem
                icon={<FaChartBar />}
                component={<NavLink to="StatistiqueAdmin" />}
              >
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

      {/* ================= MAIN ================= */}
      <div className="main">

        <header className="topbar">
          <div className="search">
            <FaSearch />
            <input placeholder="Rechercher…" />
          </div>

          <div className="top-actions">
            {isUser && (
              <span className="jeton-balance-chip">
                Jetons: {totalJetons}
              </span>
            )}

            <button className="icon-btn notif">
              <FaBell />
              <span className="badge">3</span>
            </button>

            <div className="avatar">
              {String(user.name || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="content">
          {isDashboardHome && (
            <div className="welcome">
              <div>
                <h2>
                  Bienvenue, {user.name}{" "}
                  {isAdmin && (
                    <span style={{ color: "#e11d48" }}> (ADMIN)</span>
                  )}
                </h2>
                <p>
                  Veuillez sélectionner une option dans le menu pour commencer.
                </p>
              </div>

              {isUser && (
                <div className="welcome-actions">
                  <NavLink className="btn primary" to="CreateTransaction">
                    Nouvelle signature
                  </NavLink>
                  <NavLink className="btn ghost" to="MyTransactions">
                    Voir transactions
                  </NavLink>
                </div>
              )}
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
