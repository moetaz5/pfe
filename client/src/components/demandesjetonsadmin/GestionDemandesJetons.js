import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FaExclamationTriangle, FaFileInvoice, FaInfoCircle, FaTimes } from "react-icons/fa";
import { Input, Modal, notification } from "antd";
import "../style/gestionDemandesJetons.css";

const GestionDemandesJetons = () => {
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
  const notifyInfo = useCallback(
    (message) => {
      notification.info({
        message: "Information",
        description: message,
        placement: "topRight",
      });
    },
    [],
  );
  const notifyStepFirstConfirmation = useCallback(
    () => {
      notification.info({
        message: "Premiere confirmation",
        description: "Etape 2/4: premiere confirmation admin enregistree.",
        placement: "topRight",
      });
    },
    [],
  );
  const [requests, setRequests] = useState([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const getStatusLabel = (value) => {
    if (value === "pending") return "En attente de premiere confirmation";
    if (value === "payment_pending") return "En attente d'envoi de preuve client";
    if (value === "payment_submitted") return "Preuve envoyee, attente finale";
    if (value === "approved") return "Confirmee";
    if (value === "rejected") return "Refusee";
    return "En attente";
  };

  const downloadProof = async (requestId, filename, mime) => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/admin/jeton/${requestId}/proof`,
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
      notifyError(
        e?.response?.data?.message ||
          "Impossible de telecharger la preuve de paiement.",
      );
    }
  };

  const fetchTokenRequests = useCallback(async () => {
    try {
      setLoading(true);
      const query =
        requestStatusFilter && requestStatusFilter !== "all"
          ? `?status=${requestStatusFilter}`
          : "";

      const res = await axios.get(
        `http://localhost:5000/api/admin/jeton${query}`,
        { withCredentials: true },
      );

      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      notifyError(
        e?.response?.data?.message ||
          "Erreur lors du chargement des demandes de jetons.",
      );
    } finally {
      setLoading(false);
    }
  }, [notifyError, requestStatusFilter]);

  useEffect(() => {
    fetchTokenRequests();
  }, [fetchTokenRequests]);

  const openDecisionModal = useCallback(
    ({ title, description, defaultNote, okText, danger = false }) =>
      new Promise((resolve) => {
        let note = defaultNote || "";

        const modalTitle = (
          <div className="token-decision-title-wrap">
            <span className={`token-decision-title-icon ${danger ? "danger" : "info"}`}>
              {danger ? <FaExclamationTriangle /> : <FaInfoCircle />}
            </span>
            <span>{title}</span>
          </div>
        );

        Modal.confirm({
          className: "token-decision-modal",
          centered: true,
          width: 560,
          icon: null,
          closable: true,
          closeIcon: (
            <span className="token-decision-close-icon" aria-label="Fermer">
              <FaTimes />
            </span>
          ),
          maskClosable: true,
          title: modalTitle,
          okText,
          cancelText: "Annuler",
          okButtonProps: danger ? { danger: true } : {},
          content: (
            <div className="token-decision-content">
              <p>{description}</p>
              <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 6 }}
                defaultValue={defaultNote}
                placeholder="Note admin (optionnel)"
                onChange={(event) => {
                  note = event.target.value;
                }}
              />
            </div>
          ),
          onOk: () => resolve(note.trim()),
          onCancel: () => resolve(null),
        });
      }),
    [],
  );

  const handleDecision = async (id, decision) => {
    const defaultNote =
      decision === "payment_pending"
        ? "Premiere confirmation admin effectuee"
        : "Demande refusee";

    const note = await openDecisionModal({
      title:
        decision === "payment_pending"
          ? "Premiere confirmation"
          : "Refuser la demande",
      description:
        decision === "payment_pending"
          ? "Validez cette demande pour demander au client d'envoyer la preuve de paiement."
          : "Cette action refusera la demande de jetons.",
      defaultNote,
      okText: decision === "payment_pending" ? "Confirmer" : "Refuser",
      danger: decision === "rejected",
    });

    if (note === null) {
      notifyInfo("Action annulee.");
      return;
    }

    try {
      await axios.put(
        `http://localhost:5000/api/admin/jeton/${id}/decision`,
        {
          decision,
          admin_note: note || null,
        },
        { withCredentials: true },
      );

      if (decision === "payment_pending") {
        notifyStepFirstConfirmation();
      } else {
        notifyWarning("Demande refusee avec succes.");
      }

      fetchTokenRequests();
    } catch (e) {
      notifyError(
        e?.response?.data?.message ||
          "Erreur lors du traitement de la demande.",
      );
    }
  };

  return (
    <div className="page">
      <div className="full-width-container">
        <div className="page-header">
          <div className="page-header-title">
            <FaFileInvoice />
            <h2>Demandes de jetons</h2>
          </div>
        </div>

        <div className="filters-card">
          <div className="token-request-filter-row">
            <label htmlFor="requestStatus">Statut des demandes</label>
            <select
              id="requestStatus"
              className="role-select"
              value={requestStatusFilter}
              onChange={(e) => setRequestStatusFilter(e.target.value)}
            >
              <option value="pending">En attente de premiere confirmation</option>
              <option value="payment_pending">
                En attente d'envoi preuve client
              </option>
              <option value="rejected">Refusees</option>
              <option value="all">Toutes</option>
            </select>
          </div>
        </div>

        <div className="transactions-container">
          <div className="transactions-list">
            {loading ? (
              <div className="empty-token-request">Chargement...</div>
            ) : requests.length === 0 ? (
              <div className="empty-token-request">Aucune demande trouvee.</div>
            ) : (
              requests.map((request) => (
                <div key={request.id} className="transaction-row blue">
                  <div className="transaction-left">
                    <div className="transaction-number">
                      Demande #{request.id} - {request.pack_name}
                    </div>
                    <div className="transaction-meta">
                      Client: {request.user_name} ({request.user_email})
                    </div>
                    <div className="transaction-meta">
                      Jetons: {request.tokens} | Prix: {request.price_tnd} TND
                    </div>
                    <div className="transaction-meta">
                      Contact: {request.contact_info || "non renseigne"}
                    </div>
                    <div className="transaction-meta">
                      Source: {request.request_source || "pack"}
                    </div>
                    {request.created_at && (
                      <div className="transaction-meta">
                        Creee le: {new Date(request.created_at).toLocaleString("fr-FR")}
                      </div>
                    )}
                    {request.payment_uploaded_at && (
                      <div className="transaction-meta">
                        Preuve envoyee le: {new Date(request.payment_uploaded_at).toLocaleString("fr-FR")}
                      </div>
                    )}
                    <div className="transaction-meta">
                      Statut: {getStatusLabel(request.status)}
                    </div>
                    {Number(request.has_payment_proof) === 1 && (
                      <button
                        type="button"
                        className="token-proof-btn"
                        onClick={() =>
                          downloadProof(
                            request.id,
                            request.payment_proof_name || `preuve_${request.id}`,
                            request.payment_proof_mime,
                          )
                        }
                      >
                        Voir preuve paiement
                      </button>
                    )}
                    {request.admin_note && (
                      <div className="transaction-meta">
                        Note admin: {request.admin_note}
                      </div>
                    )}
                  </div>

                  <div className="transaction-actions">
                    {request.status === "pending" ? (
                      <>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleDecision(request.id, "payment_pending")}
                        >
                          Premiere confirmation
                        </button>
                        <button
                          className="btn btn-outline"
                          onClick={() => handleDecision(request.id, "rejected")}
                        >
                          Refuser
                        </button>
                      </>
                    ) : request.status === "payment_pending" ? (
                      <>
                        <span className="token-request-final">
                          En attente de preuve client
                        </span>
                        <button
                          className="btn btn-outline"
                          onClick={() => handleDecision(request.id, "rejected")}
                        >
                          Refuser
                        </button>
                      </>
                    ) : request.status === "payment_submitted" ||
                      request.status === "approved" ? (
                      <span className="token-request-final">
                        Traiter dans "Confirmation finale"
                      </span>
                    ) : (
                      <span className="token-request-final">
                        Deja{" "}
                        {request.status === "approved" ? "confirmee" : "refusee"}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GestionDemandesJetons;
