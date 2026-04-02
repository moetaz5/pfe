import React, { useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Mail, MessageSquare, Send, Phone, MapPin, Building2, ShieldCheck } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import "../style/contacter.css";

const API_URL = "http://localhost:5000";

const Contacter = () => {
  // Remplacé useSnackbar par toast car SnackbarProvider n'est pas présent dans App.js
  const { setAiOpen } = useOutletContext(); // Utilisation du contexte pour ouvrir le chatbot global

  const [form, setForm] = useState({
    subject: "",
    type: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);

  const typeOptions = useMemo(
    () => [
      { value: "signature", label: "Vérification de signature" },
      { value: "facture", label: "Dépôt de facture" },
      { value: "compte", label: "Accès au compte" },
      { value: "facturation", label: "Facturation" },
      { value: "autre", label: "Autre demande" },
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
      toast.warn("Veuillez indiquer un objet.");
      return;
    }
    if (!type) {
      toast.warn("Veuillez choisir le type de demande.");
      return;
    }
    if (!msg || msg.length < 10) {
      toast.warn("Le message est trop court.");
      return;
    }

    try {
      setLoading(true);

      // Envoi du mail au backend (qui est configuré pour l'envoyer au service d'Aymen Amri)
      const response = await axios.post(
        `${API_URL}/api/support/contact`,
        {
          type,
          // Mention explicite du destinataire métier
          message: `Demande de support pour : amri.aymen@medicacom.tn\n\nObjet: ${subject}\n\n${msg}`,
        },
        { withCredentials: true }
      );

      if (response.data) {
        toast.success("Votre message a été envoyé avec succès à amri.aymen@medicacom.tn");
        setForm({ subject: "", type: "", message: "" });
      }
    } catch (err) {
      console.error("Support submission error:", err);
      const errorMsg = err.response?.data?.message || "Erreur lors de l'envoi de votre message.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contact-premium-scope">
      <div className="contact-page">
        
        {/* En-tête de la page */}
        <div className="contact-page-header">
          <div className="c-badge"><ShieldCheck size={16} /> Support Prioritaire</div>
          <h2>Contactez l'Équipe Medica-Sign</h2>
          <p>
            Notre équipe est à votre disposition pour vous assister. Envoyez-nous un message détaillé ci-dessous et votre demande sera transférée directement à <strong>amri.aymen@medicacom.tn</strong>.
          </p>
        </div>

        <div className="contact-grid-pro">
          
          {/* Formulaire Principal Element */}
          <div className="contact-main-form">
            <div className="contact-form-glass">
              <h3><Mail size={20} className="icon-blue" /> Envoyer un message</h3>
              
              <form onSubmit={onSubmit} className="c-form-grid">
                <div className="c-form-row">
                  <div className="c-field">
                    <label>Sujet de votre demande</label>
                    <input
                      name="subject"
                      placeholder="Ex: Problème de signature TTN"
                      value={form.subject}
                      onChange={onChange}
                      required
                    />
                  </div>

                  <div className="c-field">
                    <label>Catégorie</label>
                    <select
                      name="type"
                      value={form.type}
                      onChange={onChange}
                      required
                    >
                      <option value="">Sélectionnez un domaine d'assistance</option>
                      {typeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="c-field">
                  <label>Description (Message adressé à amri.aymen@medicacom.tn)</label>
                  <textarea
                    name="message"
                    placeholder="Décrivez votre problème avec le maximum de détails..."
                    value={form.message}
                    onChange={onChange}
                    required
                  />
                </div>

                <div className="c-form-actions">
                  <span className="c-reply-time">Réponse estimée sous 24h</span>
                  <button className="c-btn-primary" type="submit" disabled={loading}>
                    <Send size={16} />
                    {loading ? "Envoi sécurisé en cours..." : "Envoyer le message"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Side Panel Info & Chat */}
          <div className="contact-side-info">
            
            {/* Assistance IA */}
            <div className="c-side-card c-card-gradient">
              <div className="c-side-icon-wrap"><MessageSquare size={24} /></div>
              <h3>Assistant IA En Direct</h3>
              <p>
                Besoin d'une réponse immédiate ? Notre chatbot IA, formé sur l'ensemble de la documentation Medica-Sign, peut répondre à la plupart de vos interrogations instantanément.
              </p>
              <button 
                className="c-btn-white"
                onClick={() => setAiOpen(true)} // Ouvre le chatbot GLOBAL sans duplication
              >
                Démarrer le chat <span className="pulse-dot"></span>
              </button>
            </div>

            {/* Coordonnées Officielles */}
            <div className="c-side-card c-card-outline">
              <h3>Contact Officiel</h3>
              <ul className="c-official-list">
                <li>
                  <div className="c-list-icon"><Mail size={16} /></div>
                  <div>
                    <strong>E-mail d'assistance</strong>
                    <span>amri.aymen@medicacom.tn</span>
                  </div>
                </li>
                <li>
                  <div className="c-list-icon"><Phone size={16} /></div>
                  <div>
                    <strong>Téléphone (Lun-Ven, 8h-17h)</strong>
                    <span>+216 XX XXX XXX</span>
                  </div>
                </li>
                <li>
                  <div className="c-list-icon"><Building2 size={16} /></div>
                  <div>
                    <strong>Siège MEDICACOM</strong>
                    <span>Sfax, Tunisie</span>
                  </div>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Contacter;