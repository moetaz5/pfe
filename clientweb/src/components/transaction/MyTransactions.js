import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../style/mytransaction.css";
import { Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";

// Icons
import {
  Download,
  Eye,
  ShoppingCart,
  Filter,
  ChevronLeft,
  ChevronRight,
  PenTool,
  RefreshCw,
} from "lucide-react";

const Transactions = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [status, setStatus] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [transactionIdSearch, setTransactionIdSearch] = useState(""); // Nouveau champ pour rechercher par ID
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  /* ✅ FORMAT TRANSACTION ID */
  const formatTransactionId = (id) => {
    const year = new Date().getFullYear();
    return `TRX-${year}-${String(id).padStart(5, "0")}`;
  };

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch("http://51.178.39.67/api/transactions", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) throw new Error("Erreur chargement transactions");

        const data = await response.json();
        setTransactions(data);
      } catch (error) {
        toast.error("Erreur chargement transactions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, []);
const handleDeleteTransaction = async (transactionId) => {
  const result = await Swal.fire({
    title: "Êtes-vous sûr ?",
    text: "Cette transaction sera marquée comme supprimée.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Oui, supprimer",
    cancelButtonText: "Annuler",
    background: "#fff",
    borderRadius: "16px",
    width: "400px",
    showCloseButton: true,
  });

  if (!result.isConfirmed) return;

  try {
    const response = await fetch(
      `http://51.178.39.67/api/transactions/${transactionId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Erreur serveur");
    }

    const data = await response.json();

    await Swal.fire({
      title: "Supprimée !",
      text: "La transaction a été supprimée avec succès.",
      icon: "success",
      confirmButtonColor: "#0247AA",
      confirmButtonText: "OK",
      borderRadius: "16px",
      showCloseButton: true,
    });

    // Actualiser la page comme demandé
    window.location.reload();

  } catch (err) {
    Swal.fire({
      title: "Erreur",
      text: err.message,
      icon: "error",
      confirmButtonColor: "#0247AA",
      borderRadius: "16px",
      showCloseButton: true,
    });
  }
};
  const handleDownloadZip = async (transactionId) => {
    try {
      const response = await fetch(
        `http://51.178.39.67/api/transactions/${transactionId}/zip`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) throw new Error("Erreur téléchargement ZIP");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `transaction_${transactionId}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Erreur lors du téléchargement.");
    }
  };

  const handleResendTTN = async (transactionId) => {
    try {
      const response = await fetch(
        `http://51.178.39.67/api/transactions/${transactionId}/resend-ttn`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erreur serveur");
      }

      await Swal.fire({
        title: "Envoi à la TTN",
        text: "La transaction a été renvoyée aux services de la TTN avec succès.",
        icon: "success",
        timer: 3000,
        showConfirmButton: false,
        borderRadius: "16px",
      });

      // Optionnel : actualiser la liste pour voir le changement de statut 'Renvoi TTN en cours...'
      window.location.reload();
    } catch (err) {
      Swal.fire({
        title: "Erreur",
        text: err.message,
        icon: "error",
        borderRadius: "16px",
      });
    }
  };

  const openSignatureLink = (id) => {
    window.open(`http://51.178.39.67/signature/${id}`, "_blank");
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchStatus = status ? t.statut === status : true;
    const matchNumber = invoiceNumber
      ? String(t.facture_number).includes(invoiceNumber)
      : true;
    const matchTransactionId = transactionIdSearch
      ? formatTransactionId(t.id).includes(transactionIdSearch) // Rechercher par ID de transaction formaté
      : true;

    return matchStatus && matchNumber && matchTransactionId; // Ajout du filtre par ID de transaction
  });

  // PAGINATION LOGIC
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [status, invoiceNumber, transactionIdSearch]);

  const getRowClass = (statut) => {
    if (!statut) return "blue";
    if (statut.toLowerCase().includes("sign")) return "green";
    if (statut.toLowerCase().includes("refus")) return "red";
    if (statut.toLowerCase().includes("trans")) return "orange";
    return "blue";
  };

  return (
    <div className="page">
      <div className="full-width-container">

        <div className="page-header">
          <div className="page-header-title">
            <ShoppingCart size={22} color="#0247AA" />
            <h2 style={{ margin: 0 }}>Mes factures TEIF</h2>
          </div>

          <Link to="/dashboard/CreateTransaction" className="btn btn-primary">
            Créer une transaction
          </Link>
        </div>

        <div className="filters-card">
          <div className="filters-title">
            <Filter size={18} color="#0247AA" />
            Filtrer les transactions
          </div>

          <div className="filters-grid">
          

            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Statut</option>
              <option value="créé">Créé</option>
              <option value="signée">Signée</option>
              <option value="signée_ttn">signée par TTN</option>
              <option value="refusée par TTN">Refusée par TTN</option>
            </select>

            <input
              className="input"
              type="text"
              placeholder="Numéro de la facture"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />

            {/* Nouveau champ de recherche par ID de transaction */}
            <input
              className="input"
              type="text"
              placeholder="Recherche par ID transaction"
              value={transactionIdSearch}
              onChange={(e) => setTransactionIdSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="transactions-container">
          {isLoading ? (
            <p>Chargement des transactions...</p>
          ) : filteredTransactions.length === 0 ? (
            <p style={{ color: "#6b7280" }}>Aucune transaction trouvée.</p>
          ) : (
            <div className="transactions-list">
              {currentTransactions.map((t) => (
                <div
                  key={t.id}
                  className={`transaction-row ${getRowClass(t.statut)} ${
                    t.statut === "supprimée" ? "is-supprimee" : ""
                  }`}
                  onClick={() => navigate(`/dashboard/TransactionDetails/${t.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="transaction-left">

                    {/* ✅ ID FORMATÉ */}
                    <div className="transaction-number">
                      {formatTransactionId(t.id)}
                    </div>

                    <div className="transaction-meta">
                      {new Date(t.date_creation).toLocaleString()}
                    </div>

                    <div className="transaction-status">{t.statut}</div>

                    <div className="transaction-meta">
                      {t.user_name || "Utilisateur"}
                    </div>

                    {t.statut === "supprimée" && t.date_suppression && (
                      <span className="supprimee-date-badge">
                        🗑️ Supprimée le {new Date(t.date_suppression).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="transaction-actions" onClick={(e) => e.stopPropagation()}>
                    {t.statut === "créé" && (
                      <button
                        className="btn btn-icon danger"
                        title="Supprimer transaction"
                        onClick={() => handleDeleteTransaction(t.id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    <button
                      className="btn btn-icon"
                      onClick={() => handleDownloadZip(t.id)}
                      title="Télécharger ZIP"
                    >
                      <Download size={18} />
                    </button>
                    {(t.statut === "signée" || t.statut === "refusée par TTN") && (
                      <button
                        className="btn btn-icon"
                        title="Renvoyer à la TTN"
                        onClick={() => handleResendTTN(t.id)}
                        style={{ color: "#0247AA" }}
                      >
                        <RefreshCw size={18} />
                      </button>
                    )}

                    {t.statut === "créé" && (
                      <button
                        className="btn btn-icon"
                        title="Ouvrir la page de signature"
                        onClick={() => openSignatureLink(t.id)}
                      >
                        <PenTool size={18} />
                      </button>
                    )}

                    <Link
                      to={`/dashboard/TransactionDetails/${t.id}`}
                      className="btn btn-outline"
                    >
                      <Eye size={16} />
                      Voir détails
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination-wrap">
              <button 
                className={`page-btn ${currentPage === 1 ? "disabled" : ""}`}
                onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={18} />
              </button>
              
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  className={`page-btn ${currentPage === i + 1 ? "active" : ""}`}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}

              <button 
                className={`page-btn ${currentPage === totalPages ? "disabled" : ""}`}
                onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Transactions;
