import { Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* Pages publiques */
import Home from "./components/home";
import Login from "./components/login";
import Register from "./components/register";
import GoogleCallback from "./components/GoogleCallback";
import VerifyEmail from "./components/VerifyEmail";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import GestionUtilisateur from "./components/admin/GestionUtilisateur";

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
import MesDemandesJetons from "./components/support/MesDemandesJetons";
import Statistique from "./components/Statistique/Statistiqueuser";
import StatistiqueAdmin from "./components/Statistique/StatistiqueAdmin";
/* developeur  */
import TokenAPI from "./components/DEVELOPEUR/TokenAPI";

/*admin jeton*/ 
import GestionConfirmationFinaleJetons from "./components/demandesjetonsadmin/GestionConfirmationFinaleJetons";
import GestionDemandesJetons  from "./components/demandesjetonsadmin/GestionDemandesJetons";
/* Auth context */
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./context/ProtectedRoute";
import PublicRoute from "./context/PublicRoute";

import PosSignature from "./components/transaction/PosSignature";
import CreationOrganization from "./components/organization/CreationOrganization";
import OrganizationDetail from "./components/organization/OrganizationDetail";
import TransactionOrganization from "./components/organization/TransactionOrganization";


function App() {
  return (
    <AuthProvider>
      
      <Routes>

        {/* ==================== PAGES PUBLIQUES ==================== */}

        <Route
          path="/"
          element={
            <PublicRoute>
              <Home />
            </PublicRoute>
          }
        />

        <Route
          path="/produits"
          element={
            <PublicRoute>
              <Home />
            </PublicRoute>
          }
        />

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
        <Route
          path="/signature/:id"
          element={<SignatureSignataire />}
        />

        {/* ==================== DASHBOARD PROTÉGÉ ==================== */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={["USER", "ADMIN"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        >

          {/* Accueil dashboard */}
          <Route index element={<InformationProfil />} />

          {/* ================= PROFIL ================= */}
          <Route
            path="profil"
            element={
              <ProtectedRoute roles={["USER", "ADMIN"]}>
                <InformationProfil />
              </ProtectedRoute>
            }
          />

          <Route
            path="profil/ChangePassword"
            element={
              <ProtectedRoute roles={["USER", "ADMIN"]}>
                <ChangePassword />
              </ProtectedRoute>
            }
          />

          <Route
            path="profil/ProfilEdit"
            element={
              <ProtectedRoute roles={["USER", "ADMIN"]}>
                <ProfilEdit />
              </ProtectedRoute>
            }
          />

          <Route
            path="profil/Signature"
            element={
              <ProtectedRoute roles={["USER", "ADMIN"]}>
                <Signature />
              </ProtectedRoute>
            }
          />

          <Route
            path="profil/Certification"
            element={
              <ProtectedRoute roles={["USER", "ADMIN"]}>
                <Certification />
              </ProtectedRoute>
            }
          />

          {/* ================= USER SEULEMENT ================= */}
          <Route
            path="facture"
            element={
              <ProtectedRoute roles={["USER"]}>
                <Facture />
              </ProtectedRoute>
            }
          />

          <Route
            path="CreateTransaction"
            element={
              <ProtectedRoute roles={["USER"]}>
                <CreateTransaction />
              </ProtectedRoute>
            }
          />

          <Route
            path="MyTransactions"
            element={
              <ProtectedRoute roles={["USER"]}>
                <Transactions />
              </ProtectedRoute>
            }
          />

          <Route
            path="TransactionDetails/:transactionId"
            element={
              <ProtectedRoute roles={["USER"]}>
                <TransactionDetails />
              </ProtectedRoute>
            }
          />
<Route
            path="statistique"
            element={
              <ProtectedRoute roles={["USER"]}>
                <Statistique />
              </ProtectedRoute>
            }
          />
          <Route
            path="TokenAPI"
            element={
              <ProtectedRoute roles={["USER"]}>
                <TokenAPI />
              </ProtectedRoute>
            }
          />
          <Route
            path="AcheterJetons"
            element={
              <ProtectedRoute roles={["USER"]}>
                <AcheterJetons />
              </ProtectedRoute>
            }
          />
          <Route
            path="MesDemandesJetons"
            element={
              <ProtectedRoute roles={["USER"]}>
                <MesDemandesJetons />
              </ProtectedRoute>
            }
          />
          <Route
            path="CreationOrganization"
            element={
              <ProtectedRoute roles={["USER"]}>
                <CreationOrganization />
              </ProtectedRoute>
            }
          />
          <Route
  path="OrganizationDetail/:id"
  element={
    <ProtectedRoute roles={["USER"]}>
      <OrganizationDetail />
    </ProtectedRoute>
  }
/>
<Route
  path="Organization/:id/transactions"
  element={
    <ProtectedRoute roles={["USER"]}>
      <TransactionOrganization />
    </ProtectedRoute>
  }
/>
          {/* ================= ADMIN SEULEMENT ================= */}
          
          <Route
            path="GestionUtilisateur"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <GestionUtilisateur />
              </ProtectedRoute>
            }
          />
          <Route
            path="StatistiqueAdmin"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <StatistiqueAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="GestionDemandesJetons"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <GestionDemandesJetons />
              </ProtectedRoute>
            }
          />
          <Route
            path="GestionConfirmationFinaleJetons"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <GestionConfirmationFinaleJetons />
              </ProtectedRoute>
            }
          />

          {/* ================= SUPPORT ================= */}
          <Route
            path="contacter"
            element={
              <ProtectedRoute roles={["USER", "ADMIN"]}>
                <Contacter />
              </ProtectedRoute>
            }
          />

          <Route
            path="AcheterJetons"
            element={
              <ProtectedRoute roles={["USER", "ADMIN"]}>
                <AcheterJetons />
              </ProtectedRoute>
            }
          />

          {/* ================= position detail ttn ================= */}
          <Route
            path="PosSignature"
            element={
              <ProtectedRoute roles={["USER", "ADMIN"]}>
                <PosSignature />
              </ProtectedRoute>
            }
          />

        </Route>

      </Routes>
    </AuthProvider>
    
  );
}

export default App;
