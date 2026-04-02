import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import "../style/mytransaction.css";

import {
  ArrowLeft,
  Download,
  FileText,
  FileDown,
} from "lucide-react";

const TransactionDetails = () => {
  const { transactionId } = useParams();

  const [transaction, setTransaction] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  /* ✅ FORMAT ID */
  const formatTransactionId = (id) => {
    const year = new Date().getFullYear();
    return `TRX-${year}-${String(id).padStart(5, "0")}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const txRes = await fetch(
          `http://localhost:5000/api/transactions/${transactionId}/details`,
          { credentials: "include" }
        );

        if (!txRes.ok) throw new Error("Erreur transaction");

        const txData = await txRes.json();
        setTransaction(txData);

        const docsRes = await fetch(
          `http://localhost:5000/api/transactions/${transactionId}/docs`,
          { credentials: "include" }
        );

        if (!docsRes.ok) throw new Error("Erreur documents");

        const docsData = await docsRes.json();
        setDocuments(Array.isArray(docsData) ? docsData : []);
      } catch (e) {
        alert("Erreur chargement données.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [transactionId]);

  const handleDownloadAllZip = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/transactions/${transactionId}/zip`,
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

  const handleDownloadDoc = async (docId, type) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/docs/${docId}/download?type=${type}`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error();

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `document_${docId}.${type}`;
      link.click();
    } catch {
      alert("Erreur téléchargement fichier");
    }
  };

  return (
    <div className="page">
      <div className="full-width-container">
        {isLoading ? (
          <p>Chargement...</p>
        ) : transaction ? (
          <div className="transaction-details">

            <div className="transaction-top">
              <div className="page-header-left">
                <Link to="/dashboard/MyTransactions" className="btn btn-icon">
                  <ArrowLeft size={18} />
                </Link>

                <div className="transaction-info">
                  <h2 style={{ margin: 0 }}>Détails de la transaction</h2>
                  <p style={{ color: "#6b7280", margin: 0 }}>
                    <strong>{transaction.user_name}</strong>
                    <br />

                    {/* ✅ ID FORMATÉ */}
                    Transaction ID : {formatTransactionId(transaction.id)}
                    <br />

                    

                    {new Date(transaction.date_creation).toLocaleString()}
                    <br />
                    Statut : {transaction.statut}
                  </p>
                </div>
              </div>

              <button className="btn btn-outline" onClick={handleDownloadAllZip}>
                <Download size={18} />
                Télécharger tout (ZIP)
              </button>
            </div>

            <div className="section-title">
              <FileText size={18} color="#0247AA" />
              Documents ({documents.length})
            </div>

            <div className="factures-grid">
              {documents.map((doc) => (
                <div key={doc.id} className="facture-card">

                  <div className="facture-left">

                    {/* ✅ NUMÉRO FACTURE INDIVIDUEL */}
                    <strong>Facture : {doc.invoice_number}</strong>

                    <p style={{ margin: 0, color: "#6b7280" }}>
                      Statut : {doc.statut}
                      <br />
                      Créé le : {new Date(doc.created_at).toLocaleString()}
                      {doc.signed_at && (
                        <>
                          <br />
                          Signé le : {new Date(doc.signed_at).toLocaleString()}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="facture-actions">

                    <button
                      onClick={() => handleDownloadDoc(doc.id, "pdf")}
                      className="btn btn-icon"
                      title="Télécharger PDF"
                    >
                      <FileDown size={18} />
                    </button>

                    <button
                      onClick={() => handleDownloadDoc(doc.id, "xml")}
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
