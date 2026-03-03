import { useMemo, useState } from "react";
import axios from "axios";
import { useSnackbar } from "notistack";
import { Mail, Phone, MessageSquare, Send, Globe } from "lucide-react";
import MiniAIChat from "../chatboot/MiniAIChat";
import "../style/contacter.css";

const API_URL = "http://localhost:5000";

const Contacter = () => {
  const { enqueueSnackbar } = useSnackbar();

  const [form, setForm] = useState({
    subject: "",
    type: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);

  // 🔥 NOUVEAU : état du chat IA
  const [isChatOpen, setIsChatOpen] = useState(false);

  const typeOptions = useMemo(
    () => [
      { value: "signature", label: "Verification de signature" },
      { value: "facture", label: "Depot de facture" },
      { value: "compte", label: "Acces au compte" },
      { value: "facturation", label: "Facturation" },
      { value: "autre", label: "Autre" },
    ],
    []
  );

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    const subject = form.subject.trim();
    const type = form.type;
    const msg = form.message.trim();

    if (!subject) {
      enqueueSnackbar("Veuillez indiquer un objet.", { variant: "warning" });
      return;
    }
    if (!type) {
      enqueueSnackbar("Veuillez choisir le type de demande.", { variant: "warning" });
      return;
    }
    if (!msg || msg.length < 10) {
      enqueueSnackbar("Message trop court.", { variant: "warning" });
      return;
    }

    try {
      setLoading(true);

      await axios.post(
        `${API_URL}/api/support/contact`,
        {
          type,
          message: `Objet: ${subject}\n\n${msg}`,
        },
        { withCredentials: true }
      );

      enqueueSnackbar("Demande envoyée avec succès.", { variant: "success" });
      setForm({ subject: "", type: "", message: "" });
    } catch (err) {
      enqueueSnackbar("Erreur lors de l'envoi.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="contact-scope">
        <div className="page">
          <div className="page-head">
            <h2>Centre de support</h2>
            <p>Envoyez un message ou discutez en direct avec l'assistant IA.</p>
          </div>

          <div className="contact-grid">
            <div className="contact-main">
              <div className="contact-card">
                <div className="card-head">
                  <h3>Envoyer un message</h3>
                </div>

                <form onSubmit={onSubmit} className="form-grid">
                  <div className="form-row">
                    <div className="field">
                      <label>Objet</label>
                      <input
                        name="subject"
                        value={form.subject}
                        onChange={onChange}
                        required
                      />
                    </div>

                    <div className="field">
                      <label>Catégorie</label>
                      <select
                        name="type"
                        value={form.type}
                        onChange={onChange}
                        required
                      >
                        <option value="">Selectionner</option>
                        {typeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label>Message</label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={onChange}
                      required
                    />
                  </div>

                  <div className="form-actions">
                    <button className="btn primary" type="submit" disabled={loading}>
                      <Send size={16} />
                      {loading ? "Envoi..." : "Envoyer"}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="contact-side">
              <div className="contact-card">
                <div className="card-head">
                  <h3>Support en direct</h3>
                  <p>Discutez instantanément avec notre assistant IA.</p>
                </div>

                {/* 🔥 BOUTON OUVERTURE IA */}
                <button
                  className="btn outline"
                  type="button"
                  onClick={() => setIsChatOpen(true)}
                >
                  <MessageSquare size={16} />
                  Démarrer le chat
                </button>

                <p className="muted-note">
                  Temps de réponse moyen : immédiat
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 INTÉGRATION DU MOTEUR IA */}
      <MiniAIChat
        isOpen={isChatOpen}
        setIsOpen={setIsChatOpen}
        suggestions={[
          "Comment signer une facture XML ?",
          "Pourquoi ma signature TTN est refusée ?",
          "Comment acheter des jetons ?",
          "Comment créer une organisation ?"
        ]}
      />
    </>
  );
};

export default Contacter;