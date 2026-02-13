import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { notification } from "antd";
import "../style/acheterJetons.css";

const API_URL = "http://localhost:5000";
const ALLOWED_PROOF_TYPES = ["application/pdf"];

const formatPrice = (value) =>
  new Intl.NumberFormat("fr-TN", {
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("fr-FR");
};

const getStatusLabel = (status) => {
  if (status === "pending") return "En attente de validation admin";
  if (status === "payment_pending") return "Admin confirme: envoyez la preuve";
  if (status === "payment_submitted") return "Preuve envoyee - attente finale";
  if (status === "approved") return "Confirmee";
  if (status === "rejected") return "Refusee";
  return "En attente";
};

const MesDemandesJetons = () => {
  const notifyError = useCallback(
    (message) => {
      notification.error({
        message: "Erreur",
        description: message,
        placement: "topRight",
      });
    },
    [],
  );
  const notifyWarning = useCallback(
    (message) => {
      notification.warning({
        message: "Attention",
        description: message,
        placement: "topRight",
      });
    },
    [],
  );
  const notifyStepProofUploaded = useCallback(
    () => {
      notification.info({
        message: "Preuve envoyee",
        description: "Etape 3/4: preuve de paiement envoyee, attente finale.",
        placement: "topRight",
      });
    },
    [],
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [proofSubmitting, setProofSubmitting] = useState({});
  const [proofFiles, setProofFiles] = useState({});
  const [requests, setRequests] = useState([]);

  const fetchMyRequests = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const res = await axios.get(`${API_URL}/api/jeton/mine`, {
        withCredentials: true,
      });
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      notifyError(e?.response?.data?.message || "Erreur chargement des demandes.");
    } finally {
      setHistoryLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

  const downloadProof = async (requestId, filename, mime) => {
    try {
      const res = await axios.get(
        `${API_URL}/api/jeton/${requestId}/proof`,
        {
          withCredentials: true,
          responseType: "arraybuffer",
        },
      );

      const blob = new Blob([res.data], {
        type: mime || "application/octet-stream",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename || `preuve_${requestId}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      notifyError(e?.response?.data?.message || "Impossible de telecharger la preuve.");
    }
  };

  const handleProofFileChange = (requestId, file) => {
    setProofFiles((prev) => ({
      ...prev,
      [requestId]: file || null,
    }));
  };

  const uploadPaymentProof = async (requestId) => {
    const selectedFile = proofFiles[requestId];
    if (!selectedFile) {
      notifyWarning("Veuillez choisir une preuve PDF ou image avant l'envoi.");
      return;
    }

    const mime = String(selectedFile.type || "").toLowerCase();
    const isImage = mime.startsWith("image/");
    const isPdf = ALLOWED_PROOF_TYPES.includes(mime);
    if (!isImage && !isPdf) {
      notifyWarning("Format de preuve invalide. Utilisez PDF ou image.");
      return;
    }

    try {
      setProofSubmitting((prev) => ({ ...prev, [requestId]: true }));

      const formData = new FormData();
      formData.append("payment_proof", selectedFile);

      await axios.put(
        `${API_URL}/api/jeton/${requestId}/payment-proof`,
        formData,
        { withCredentials: true },
      );

      notifyStepProofUploaded();

      setProofFiles((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      fetchMyRequests();
    } catch (e) {
      notifyError(
        e?.response?.data?.message || "Erreur lors de l'envoi de la preuve.",
      );
    } finally {
      setProofSubmitting((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  return (
    <div className="jetons-scope">
      <div className="jetons-page">
        <header className="jetons-head">
          <h2>Mes demandes de jetons</h2>
          <p>Suivez les statuts et envoyez votre preuve apres validation admin</p>
        </header>

        <section className="jetons-history-card">
          <div className="history-head">
            <h3>Historique des demandes</h3>
          </div>

          {historyLoading ? (
            <p className="history-empty">Chargement...</p>
          ) : requests.length === 0 ? (
            <p className="history-empty">Aucune demande pour le moment.</p>
          ) : (
            <div className="history-list">
              {requests.map((item) => (
                <div className="history-row" key={item.id}>
                  <div className="history-main">
                    <strong>{item.pack_name}</strong>
                    <span>{item.tokens} jetons</span>
                    <span>{formatPrice(item.price_tnd)} TND</span>
                    <span>Email: {item.contact_info || "-"}</span>
                    <span>Envoyee le: {formatDate(item.created_at)}</span>
                    {item.payment_uploaded_at && (
                      <span>Preuve envoyee le: {formatDate(item.payment_uploaded_at)}</span>
                    )}
                    {item.admin_note && <span>Note admin: {item.admin_note}</span>}
                    {Number(item.has_payment_proof) === 1 && (
                      <button
                        type="button"
                        className="history-proof-btn"
                        onClick={() =>
                          downloadProof(
                            item.id,
                            item.payment_proof_name || `preuve_${item.id}`,
                            item.payment_proof_mime,
                          )
                        }
                      >
                        Voir preuve
                      </button>
                    )}
                    {item.status === "payment_pending" && (
                      <div className="history-proof-upload">
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={(event) =>
                            handleProofFileChange(item.id, event.target.files?.[0] || null)
                          }
                        />
                        <button
                          type="button"
                          className="history-proof-btn"
                          onClick={() => uploadPaymentProof(item.id)}
                          disabled={Boolean(proofSubmitting[item.id])}
                        >
                          {proofSubmitting[item.id] ? "Envoi..." : "Envoyer preuve"}
                        </button>
                      </div>
                    )}
                  </div>
                  <span className={`history-status status-${item.status}`}>
                    {getStatusLabel(item.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MesDemandesJetons;
