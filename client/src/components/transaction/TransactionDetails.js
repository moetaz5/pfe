import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import "../style/mytransaction.css";

// ✅ Professional icons
import {
  ArrowLeft,
  Download,
  FileText,
  Trash2,
  FileDown,
} from "lucide-react";

const TransactionDetails = () => {
  const { transactionId } = useParams();
  const [transaction, setTransaction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactionDetails = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/transactions/${transactionId}/details`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!response.ok) throw new Error("Erreur chargement détails");

        const data = await response.json();

        // ⚠️ Simulation document list (si tu n'as pas encore table factures)
        data.factures = [
          {
            id: data.facture_number,
            statut: data.statut,
            date_creation: data.date_creation,
          },
        ];

        setTransaction(data);
      } catch (error) {
        alert("Erreur serveur.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactionDetails();
  }, [transactionId]);

  // ✅ Download ZIP of ALL documents
  const handleDownloadAllZip = async () => {
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
    } catch (error) {
      alert("Erreur lors du téléchargement.");
    }
  };

  const handleDownloadFile = async (fileType) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/transactions/${transactionId}/download?type=${fileType}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) throw new Error("Erreur téléchargement fichier");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `facture_${transactionId}.${fileType}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert("Erreur lors du téléchargement.");
    }
  };

  const handleDeleteFacture = () => {
    alert("Suppression facture (à connecter à ton API DELETE)");
  };

  return (
    <div className="page">
      <div className="full-width-container">
        {isLoading ? (
          <p>Chargement des détails...</p>
        ) : transaction ? (
          <div className="transaction-details">
            {/* Header */}
            <div className="transaction-top">
              <div className="page-header-left">
                <Link to="/dashboard/MyTransactions" className="btn btn-icon">
                  <ArrowLeft size={18} />
                </Link>

                <div className="transaction-info">
                  <h2 style={{ margin: 0 }}>Mes factures TEIF</h2>

                  {/* ✅ show user name */}
                  <p style={{ color: "#6b7280", margin: 0 }}>
                    <strong>{transaction.user_name || "Utilisateur"}</strong>
                    <br />
                    Transaction ID : {transaction.id}
                    <br />
                    {new Date(transaction.date_creation).toLocaleString()}
                    <br />
                    Statut : {transaction.statut}
                  </p>
                </div>
              </div>

              {/* ✅ ZIP BUTTON */}
              <button className="btn btn-outline" onClick={handleDownloadAllZip}>
                <Download size={18} />
                Télécharger tous les documents
              </button>
            </div>

            {/* Documents */}
            <div className="section-title">
              <FileText size={18} color="#0247AA" />
              Liste des documents ({transaction.factures?.length || 0})
            </div>

            <div className="factures-grid">
              {transaction.factures?.map((facture) => (
                <div key={facture.id} className="facture-card">
                  <div className="facture-left">
                    <strong>{facture.id}</strong>

                    <p style={{ margin: 0, color: "#6b7280" }}>
                      Statut : {facture.statut} <br />
                      Numéro de la facture : {facture.id} <br />
                      Date de facture :{" "}
                      {new Date(facture.date_creation).toLocaleString()}
                    </p>
                  </div>

                  <div className="facture-actions">
                    <button
                      onClick={handleDeleteFacture}
                      className="btn btn-icon"
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>

                    <button
                      onClick={() => handleDownloadFile("pdf")}
                      className="btn btn-icon"
                      title="Télécharger PDF"
                    >
                      <FileDown size={18} />
                    </button>

                    <button
                      onClick={() => handleDownloadFile("xml")}
                      className="btn btn-icon"
                      title="Télécharger XML"
                    >
                      <FileDown size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p>Transaction introuvable</p>
        )}
      </div>
    </div>
  );
};

export default TransactionDetails;
