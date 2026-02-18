import { useState } from "react";
import axios from "axios";
import { useSnackbar } from "notistack";
import { Mail, Phone, MessageSquare, Send, Globe } from "lucide-react";
import "../style/contacter.css";

const API_URL = "http://localhost:5000";

const Contacter = () => {
  const [form, setForm] = useState({ subject: "", type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const onChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!form.subject.trim()) {
      enqueueSnackbar("Veuillez indiquer un objet.", {
        variant: "warning",
      });
      return;
    }
    if (!form.type) {
      enqueueSnackbar("Veuillez choisir le type de demande.", {
        variant: "warning",
      });
      return;
    }
    if (!form.message.trim()) {
      enqueueSnackbar("Veuillez ecrire votre message.", { variant: "warning" });
      return;
    }

    try {
      setLoading(true);

      const composedMessage = form.subject.trim()
        ? `Objet: ${form.subject.trim()}\n\n${form.message.trim()}`
        : form.message.trim();

      const res = await axios.post(
        `${API_URL}/api/support/contact`,
        {
          type: form.type,
          message: composedMessage,
        },
        { withCredentials: true }
      );

      enqueueSnackbar(res.data?.message || "Demande envoyee avec succes.", {
        variant: "success",
      });
      setForm({ subject: "", type: "", message: "" });
    } catch (e2) {
      enqueueSnackbar(
        e2?.response?.data?.message || "Erreur lors de l'envoi.",
        { variant: "error" }
      );
    } finally {
      setLoading(false);
    }
  };

  const onReset = () => {
    setForm({ subject: "", type: "", message: "" });
  };

  return (
    <div className="contact-scope">
      <div className="page">
        <div className="page-head">
          <h2>Centre de support</h2>
          <p>Comment pouvons-nous vous aider aujourd'hui ?</p>
        </div>

        <div className="contact-grid">
          <div className="contact-main">
            <div className="contact-card">
              <div className="card-head">
                <h3>Envoyer un message</h3>
                <p>Remplissez le formulaire ci-dessous et nous reviendrons vers vous rapidement.</p>
              </div>

              <form onSubmit={onSubmit} className="form-grid">
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="subject">Objet</label>
                    <input
                      id="subject"
                      name="subject"
                      value={form.subject}
                      onChange={onChange}
                      placeholder="Probleme technique"
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="type">Categorie</label>
                    <select
                      id="type"
                      name="type"
                      value={form.type}
                      onChange={onChange}
                      required
                    >
                      <option value="">Selectionner</option>
                      <option value="signature">Verification de signature</option>
                      <option value="facture">Depot de facture</option>
                      <option value="compte">Acces au compte</option>
                      <option value="facturation">Facturation</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="message">Message</label>
                  <textarea
                    id="message"
                    name="message"
                    value={form.message}
                    onChange={onChange}
                    placeholder="Decrivez votre probleme en detail..."
                    required
                  />
                </div>

                <div className="form-actions">
                  <button className="btn primary" type="submit" disabled={loading}>
                    <Send size={16} />
                    {loading ? "Envoi..." : "Envoyer"}
                  </button>
                  <button className="btn ghost" type="button" onClick={onReset} disabled={loading}>
                    Reinitialiser
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="contact-side">
            <div className="contact-card primary">
              <div className="card-head">
                <h3>Informations de contact</h3>
              </div>
              <div className="contact-info">
                <div className="info-item">
                  <Phone size={18} />
                  <div>
                    <span className="info-label">Telephone</span>
                    <span className="info-value">+216 70 000 000</span>
                  </div>
                </div>
                <div className="info-item">
                  <Mail size={18} />
                  <div>
                    <span className="info-label">Email</span>
                    <span className="info-value">support@medica-sign.com</span>
                  </div>
                </div>
                <div className="info-item">
                  <Globe size={18} />
                  <div>
                    <span className="info-label">Site web</span>
                    <span className="info-value">www.medica-sign.com</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="contact-card">
              <div className="card-head">
                <h3>Support en direct</h3>
                <p>Discutez avec un conseiller pour une aide immediate.</p>
              </div>
              <button className="btn outline" type="button">
                <MessageSquare size={16} />
                Demarrer le chat
              </button>
              <p className="muted-note">Temps de reponse moyen : 2 min</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contacter;
