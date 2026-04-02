import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <p className="loading">Chargement...</p>;

  // ❌ si pas connecté => redirect login
  if (!user) return <Navigate to="/login" replace />;

  // 🔐 Vérification du rôle si défini
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // ✅ connecté => autorisé
  return children;
};

export default ProtectedRoute;
