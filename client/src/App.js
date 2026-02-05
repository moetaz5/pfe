import { Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

/* Pages publiques */
import Home from "./components/home";
import Login from "./components/login";
import Register from "./components/register";
import GoogleCallback from "./components/GoogleCallback";
import VerifyEmail from "./components/VerifyEmail";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";

/* Dashboard */
import Dashboard from "./components/Dashboard";

/* Profil */
import InformationProfil from "./components/profil/informationprofill";
import ChangePassword from "./components/profil/ChangePassword";
import ProfilEdit from "./components/profil/ProfilEdit";
import Signature from "./components/profil/Signature";
import Certification from "./components/profil/Certification";

/* Factures & Transactions */
import Facture from "./components/facture/Facture";
import CreateTransaction from "./components/transaction/createTransaction";
import Transactions from "./components/transaction/MyTransactions";
import TransactionDetails from "./components/transaction/TransactionDetails";
import SignatureSignataire from "./components/transaction/SignatureSignataire";

/* Support & Stats */
import Contacter from "./components/support/Contacter";
import AcheterJetons from "./components/support/AcheterJetons";
import Statistique from "./components/Statistique/Statistique";

/* Auth context */
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./context/ProtectedRoute";
import PublicRoute from "./context/PublicRoute";

function App() {
  return (
    <AuthProvider>
      <Routes>

        {/* ==================== PAGES PUBLIQUES ==================== */}
        <Route path="/" element={<Home />} />
        <Route path="/produits" element={<Home />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

        <Route
          path="/verify-email"
          element={
            <PublicRoute>
              <VerifyEmail />
            </PublicRoute>
          }
        />

        <Route
          path="/google/callback"
          element={
            <PublicRoute>
              <GoogleCallback />
            </PublicRoute>
          }
        />

        <Route
          path="/ForgotPassword"
          element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          }
        />

        <Route
          path="/ResetPassword"
          element={
            <PublicRoute>
              <ResetPassword />
            </PublicRoute>
          }
        />

        {/* ==================== SIGNATURE PUBLIQUE ==================== */}
        <Route path="/signature/:id" element={<SignatureSignataire />} />


        {/* ==================== DASHBOARD PROTÉGÉ ==================== */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          {/* Accueil dashboard */}
          <Route index element={<InformationProfil />} />

          {/* Profil */}
          <Route path="profil" element={<InformationProfil />} />
          <Route path="profil/ChangePassword" element={<ChangePassword />} />
          <Route path="profil/ProfilEdit" element={<ProfilEdit />} />
          <Route path="profil/Signature" element={<Signature />} />
          <Route path="profil/Certification" element={<Certification />} />

          {/* Factures & transactions */}
          <Route path="facture" element={<Facture />} />
          <Route path="CreateTransaction" element={<CreateTransaction />} />
          <Route path="MyTransactions" element={<Transactions />} />
          <Route
            path="TransactionDetails/:transactionId"
            element={<TransactionDetails />}
          />

          {/* Statistiques */}
          <Route path="statistique" element={<Statistique />} />

          {/* Support */}
          <Route path="contacter" element={<Contacter />} />
          <Route path="AcheterJetons" element={<AcheterJetons />} />
        </Route>

      </Routes>
    </AuthProvider>
  );
}

export default App;
