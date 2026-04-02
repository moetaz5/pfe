import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, X } from "lucide-react";
import { notification } from "antd";
import "../style/acheterJetons.css";

const API_URL = "http://localhost:5000";

const PACKS = [
  { id: "pack-10", name: "Pack 10", tokens: 10, price: 9 },
  { id: "pack-20", name: "Pack 20", tokens: 20, price: 17 },
  { id: "pack-100", name: "Pack 100", tokens: 100, price: 75 },
];

const getUnitPrice = (tokens) => {
  if (tokens >= 100) return 0.75;
  if (tokens >= 20) return 0.85;
  return 0.9;
};

const calculateCustomPrice = (tokens) => tokens * getUnitPrice(tokens);

const formatPrice = (value) =>
  new Intl.NumberFormat("fr-TN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AcheterJetons = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [contactEmail, setContactEmail] = useState("");
  const [customTokens, setCustomTokens] = useState(15);
  const [inlineMessage, setInlineMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const safeTokens = useMemo(() => {
    const parsed = Number(customTokens);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.floor(parsed));
  }, [customTokens]);

  const customUnitPrice = useMemo(() => getUnitPrice(safeTokens), [safeTokens]);
  const customPrice = useMemo(
    () => calculateCustomPrice(safeTokens),
    [safeTokens],
  );

  useEffect(() => {
    if (!isModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen]);

  const openPackModal = (pack) => {
    setSelectedOffer({
      id: pack.id,
      name: pack.name,
      tokens: pack.tokens,
      price: pack.price,
      source: "pack",
    });
    setContactEmail("");
    setInlineMessage("");
    setIsModalOpen(true);
  };

  const openCustomModal = () => {
    if (safeTokens < 1) {
      setInlineMessage("Le nombre de jetons doit etre au minimum 1.");
      return;
    }

    setSelectedOffer({
      id: "custom",
      name: "Achat par nombre de jetons",
      tokens: safeTokens,
      price: Number(customPrice.toFixed(2)),
      source: "custom",
    });
    setContactEmail("");
    setInlineMessage("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (loading) return;
    setIsModalOpen(false);
    setContactEmail("");
  };

  const sendRequest = async (event) => {
    event.preventDefault();
    if (!selectedOffer) return;

    const emailValue = String(contactEmail || "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(emailValue)) {
      notification.warning({
        message: "Email invalide",
        description: "Veuillez saisir un email valide.",
        placement: "topRight",
      });
      return;
    }

    try {
      setLoading(true);

      await axios.post(
        `${API_URL}/api/jeton`,
        {
          pack_name: selectedOffer.name,
          tokens: String(selectedOffer.tokens),
          price_tnd: String(selectedOffer.price),
          contact_email: emailValue,
          request_source: selectedOffer.source,
        },
        {
          withCredentials: true,
        },
      );

      notification.success({
        message: "Demande envoyee",
        description: "Etape 1/4: demande jetons envoyee avec succes.",
        placement: "topRight",
      });
      setIsModalOpen(false);
      setContactEmail("");
    } catch (e) {
      notification.error({
        message: "Erreur",
        description:
          e?.response?.data?.message || "Erreur lors de l'envoi de la demande.",
        placement: "topRight",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="jetons-scope">
      <div className="jetons-page">
        <header className="jetons-head">
          <h2>Abonnement prepaye</h2>
          <p>Payez uniquement ce que vous consommez</p>
        </header>

        <section className="jetons-grid">
          {PACKS.map((pack) => (
            <article className="jetons-pack-card" key={pack.id}>
              <h3>{pack.name}</h3>
              <p className="pack-tokens">{pack.tokens} jetons</p>
              <p className="pack-price">{formatPrice(pack.price)} TND</p>
              <button
                type="button"
                className="jetons-btn"
                onClick={() => openPackModal(pack)}
              >
                DEMANDER
              </button>
            </article>
          ))}

          <article className="jetons-pack-card jetons-custom-card">
            <h3>Pack personnalise</h3>
            <p className="custom-text">Discuter avec notre equipe commerciale.</p>
            <button
              type="button"
              className="jetons-btn"
              onClick={() => navigate("/dashboard/contacter")}
            >
              Nous contacter
            </button>
          </article>
        </section>

        <section className="jetons-calc-card">
          <div className="calc-head">
            <h3>Achat par nombre de jetons</h3>
            <p>
              Calcul automatique base sur la grille packs:
              <strong> 0.90</strong> TND (&lt;20), <strong>0.85</strong> TND
              (&gt;=20), <strong>0.75</strong> TND (&gt;=100).
            </p>
          </div>

          <div className="calc-form">
            <label htmlFor="customTokens">Nombre de jetons</label>
            <input
              id="customTokens"
              type="number"
              min="1"
              value={customTokens}
              onChange={(event) => setCustomTokens(event.target.value)}
            />
            <div className="calc-summary">
              <span>Prix unitaire: {formatPrice(customUnitPrice)} TND</span>
              <strong>Prix total: {formatPrice(customPrice)} TND</strong>
            </div>

            {inlineMessage && <p className="calc-error">{inlineMessage}</p>}

            <button type="button" className="jetons-btn" onClick={openCustomModal}>
              Demander
            </button>
          </div>
        </section>

        <section className="jetons-rules">
          <p>
            <CheckCircle2 size={18} />
            Chaque signature coutera 1 jeton.
          </p>
          <p>
            <CheckCircle2 size={18} />
            Un document de n signatures coutera n jetons.
          </p>
          <p>
            <CheckCircle2 size={18} />
            Le nombre de documents par transaction n&apos;affecte pas son cout.
          </p>
        </section>
      </div>

      {isModalOpen && selectedOffer && (
        <div className="jetons-modal-backdrop" onClick={closeModal}>
          <div
            className="jetons-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-title"
          >
            <button
              type="button"
              className="modal-close"
              onClick={closeModal}
              aria-label="Fermer"
            >
              <X size={18} />
            </button>

            <h3 id="request-title">Envoyer une demande</h3>

            <div className="modal-summary">
              <div>
                <span>Pack choisi</span>
                <strong>{selectedOffer.name}</strong>
              </div>
              <div>
                <span>Nombre de jetons</span>
                <strong>{selectedOffer.tokens}</strong>
              </div>
              <div>
                <span>Prix</span>
                <strong>{formatPrice(selectedOffer.price)} TND</strong>
              </div>
            </div>

            <form className="modal-form" onSubmit={sendRequest}>
              <label htmlFor="contactInput">Email de reponse</label>
              <input
                id="contactInput"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="ex: client@email.com"
                required
              />

              <button type="submit" className="modal-submit" disabled={loading}>
                {loading ? "Envoi..." : "Envoyer la demande"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcheterJetons;
