import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "../style/mytransaction.css";
import "../style/facture.css";

import {
  Download,
  Eye,
  ShoppingCart,
  Filter,
  PenTool,
} from "lucide-react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

const TransactionOrganization = () => {
  const { id } = useParams();

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [status, setStatus] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [transactionIdSearch, setTransactionIdSearch] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  /* ================= FORMAT ID ================= */
  const formatTransactionId = (txId) => {
    const year = new Date().getFullYear();
    return `TRX-${year}-${String(txId).padStart(5, "0")}`;
  };

  /* ================= FETCH DATA ================= */
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch(
          `http://51.178.39.67.nip.io/api/organizations/${id}/transactions`,
          { credentials: "include" }
        );

        const data = await response.json();

        if (Array.isArray(data)) {
          setTransactions(data);
        } else {
          console.error("Réponse backend inattendue :", data);
          setTransactions([]);
        }
      } catch (error) {
        console.error("Erreur fetch transactions organisation :", error);
        setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [id]);

  /* ================= DOWNLOAD ZIP ================= */
  const handleDownloadZip = async (transactionId) => {
    try {
      const response = await fetch(
        `http://51.178.39.67.nip.io/api/transactions/${transactionId}/zip`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error();

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `transaction_${transactionId}.zip`;
      link.click();
    } catch {
      alert("Erreur téléchargement ZIP");
    }
  };

  /* ================= OPEN SIGNATURE ================= */
  const openSignatureLink = (transactionId) => {
    window.open(`http://localhost:3000/signature/${transactionId}`, "_blank");
  };

  /* ================= FILTER ================= */
  const filteredTransactions = Array.isArray(transactions)
    ? transactions.filter((t) => {
        const matchStatus = status ? t.statut === status : true;
        const matchNumber = invoiceNumber
          ? String(t.facture_number).includes(invoiceNumber)
          : true;
        const matchTransactionId = transactionIdSearch
          ? formatTransactionId(t.id).includes(transactionIdSearch)
          : true;
        return matchStatus && matchNumber && matchTransactionId;
      })
    : [];

  /* ================= PAGINATION LOGIC ================= */
  const indexOfLastItem  = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems     = filteredTransactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages       = Math.ceil(filteredTransactions.length / itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);

  // Reset to page 1 on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [status, invoiceNumber, transactionIdSearch]);

  /* ================= ROW COLOR ================= */
  const getRowClass = (statut) => {
    if (!statut) return "blue";
    if (statut.toLowerCase().includes("sign")) return "green";
    if (
      statut.toLowerCase().includes("refus") ||
      statut.toLowerCase().includes("reje")
    )
      return "red";
    if (statut.toLowerCase().includes("trans")) return "orange";
    return "blue";
  };

  return (
    <div className="page">
      <div className="full-width-container">

        {/* HEADER */}
        <div className="page-header">
          <div className="page-header-title">
            <ShoppingCart size={22} color="#0247AA" />
            <h2 style={{ margin: 0 }}>Transactions de l'Organisation</h2>
          </div>
        </div>

        {/* FILTERS */}
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
              <option value="signée_ttn">Signée par TTN</option>
              <option value="refusée par TTN">Refusée par TTN</option>
            </select>

            <input
              className="input"
              type="text"
              placeholder="Numéro facture"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />

            <input
              className="input"
              type="text"
              placeholder="Recherche ID transaction"
              value={transactionIdSearch}
              onChange={(e) => setTransactionIdSearch(e.target.value)}
            />
          </div>
        </div>

        {/* LIST */}
        <div className="transactions-container">
          {isLoading ? (
            <p>Chargement...</p>
          ) : filteredTransactions.length === 0 ? (
            <p style={{ color: "#6b7280" }}>Aucune transaction trouvée.</p>
          ) : (
            <>
              {/* Count + page info */}
              <div
                style={{
                  marginBottom: 12,
                  fontSize: 13,
                  color: "#64748b",
                  fontWeight: 600,
                }}
              >
                {filteredTransactions.length} transaction
                {filteredTransactions.length > 1 ? "s" : ""}
                {totalPages > 1 && ` — Page ${currentPage} / ${totalPages}`}
              </div>

              <div className="transactions-list">
                {currentItems.map((t) => (
                  <div
                    key={t.id}
                    className={`transaction-row ${getRowClass(t.statut)}`}
                  >
                    <div className="transaction-left">
                      <div className="transaction-number">
                        {formatTransactionId(t.id)}
                      </div>
                      <div className="transaction-meta">
                        {new Date(t.date_creation).toLocaleString()}
                      </div>
                      <div className="transaction-status">{t.statut}</div>
                      <div className="transaction-meta">
                        Créé par : {t.user_name}
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
                          onClick={() => openSignatureLink(t.id)}
                          title="Ouvrir signature"
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

              {/* PAGINATION */}
              {totalPages > 1 && (
                <div className="pagination-container">
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
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default TransactionOrganization;
