import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../style/mytransaction.css";

// Icons
import {
  Download,
  Eye,
  ShoppingCart,
  Filter,
  ChevronLeft,
  ChevronRight,
  PenTool,
} from "lucide-react";

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [status, setStatus] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [transactionIdSearch, setTransactionIdSearch] = useState(""); // Nouveau champ pour rechercher par ID

  /* ✅ FORMAT TRANSACTION ID */
  const formatTransactionId = (id) => {
    const year = new Date().getFullYear();
    return `TRX-${year}-${String(id).padStart(5, "0")}`;
  };

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/transactions", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) throw new Error("Erreur chargement transactions");

        const data = await response.json();
        setTransactions(data);
      } catch (error) {
        alert("Erreur serveur.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const handleDownloadZip = async (transactionId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/transactions/${transactionId}/zip`,
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
      alert("Erreur lors du téléchargement.");
    }
  };

  const openSignatureLink = (id) => {
    window.open(`http://localhost:3000/signature/${id}`, "_blank");
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

  const getRowClass = (statut) => {
    if (!statut) return "blue";
    if (statut.toLowerCase().includes("sign")) return "green";
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
            <input className="input" type="date" />
            <input className="input" type="date" />

            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Statut</option>
              <option value="créé">Créé</option>
              <option value="signée">Signée</option>
              <option value="Transféré à TTN">Transféré à TTN</option>
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
              {filteredTransactions.map((t) => (
                <div
                  key={t.id}
                  className={`transaction-row ${getRowClass(t.statut)}`}
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
                  </div>

                  <div className="transaction-actions">
                    <button
                      className="btn btn-icon"
                      onClick={() => handleDownloadZip(t.id)}
                      title="Télécharger ZIP"
                    >
                      <Download size={18} />
                    </button>

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

          <div className="pagination-wrap">
            <button className="page-btn">
              <ChevronLeft size={18} />
            </button>
            <button className="page-btn active">1</button>
            <button className="page-btn">2</button>
            <button className="page-btn">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transactions;
