import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, HelpCircle, FileText, UserCheck, ShieldCheck,
  ArrowLeft, ChevronRight, CheckCircle, Star, Phone, Mail,
  MapPin, Building2, Users, Lightbulb, Heart, ArrowRight,
  Upload, PenLine, Bell, ClipboardCheck, Eye, Lock, Clock
} from "lucide-react";
import logo from "./assets/logo.png";
import "./style/documentation.css";

/* ─── Navigation sections ─── */
const sections = [
  { id: "medicacom",  label: "À propos de MEDICACOM", icon: Building2 },
  { id: "presentation", label: "Medica-Sign",          icon: ShieldCheck },
  { id: "comment",    label: "Comment ça marche ?",    icon: Lightbulb },
  { id: "signature",  label: "Signer un document",     icon: PenLine },
  { id: "factures",   label: "Gérer vos factures",     icon: FileText },
  { id: "compte",     label: "Votre compte",           icon: UserCheck },
  { id: "securite",   label: "Sécurité & Confidentialité", icon: Lock },
  { id: "faq",        label: "Questions fréquentes",   icon: HelpCircle },
  { id: "contact",    label: "Contact & Support",      icon: Phone },
];

/* ─── FAQ data ─── */
const faqs = [
  {
    q: "Medica-Sign est-il légalement reconnu en Tunisie ?",
    a: "Oui. Medica-Sign est intégré à la plateforme TTN (Tunisian Trust Network), ce qui garantit la validité légale de chaque signature électronique conformément à la législation tunisienne en vigueur (Décret 2000-2102).",
  },
  {
    q: "Quels formats de documents sont acceptés ?",
    a: "Medica-Sign accepte les fichiers PDF et XML. La taille maximale par document est de 20 Mo.",
  },
  {
    q: "Comment les signataires sont-ils notifiés ?",
    a: "Dès qu'une transaction est créée, chaque signataire reçoit automatiquement un e-mail avec un lien sécurisé lui permettant de consulter et signer le document.",
  },
  {
    q: "Puis-je signer depuis mon téléphone ?",
    a: "Oui, Medica-Sign est entièrement responsive et s'adapte à tous les appareils : ordinateur, tablette et smartphone.",
  },
  {
    q: "Que se passe-t-il si un signataire refuse de signer ?",
    a: "Le signataire peut refuser la signature en laissant un commentaire explicatif. Vous recevrez une notification et pourrez relancer ou annuler la transaction.",
  },
  {
    q: "Mes documents sont-ils stockés en toute sécurité ?",
    a: "Oui. Tous les documents sont chiffrés avec un algorithme AES-256 et hébergés sur des serveurs sécurisés. Seuls vous et vos signataires autorisés peuvent y accéder.",
  },
  {
    q: "Comment obtenir de l'aide si j'ai un problème ?",
    a: "Notre équipe support est disponible par e-mail et par téléphone. Vous pouvez également utiliser le formulaire de contact intégré dans votre espace Medica-Sign.",
  },
];

/* ─── FAQ Item ─── */
const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? "open" : ""}`}>
      <button className="faq-question" onClick={() => setOpen(!open)}>
        <span>{q}</span>
        <ChevronRight size={18} className={`faq-icon ${open ? "rotated" : ""}`} />
      </button>
      {open && <div className="faq-answer">{a}</div>}
    </div>
  );
};

/* ─── Step Card ─── */
const Step = ({ num, icon: Icon, title, desc, color }) => (
  <div className={`how-step how-step--${color}`}>
    <div className="how-step-num">{num}</div>
    <div className="how-step-icon">
      <Icon size={26} />
    </div>
    <h3>{title}</h3>
    <p>{desc}</p>
  </div>
);

/* ─── Main Component ─── */
export default function Documentation() {
  const navigate = useNavigate();
  const [active, setActive] = useState("medicacom");

  const scrollTo = (id) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="doc-page">

      {/* ── TOPBAR ── */}
      <header className="doc-topbar">
        <div className="doc-topbar-inner">
          <div className="doc-topbar-left">
            <button className="doc-back-btn" onClick={() => navigate("/")}>
              <ArrowLeft size={16} /> Accueil
            </button>
            <div className="doc-brand" onClick={() => navigate("/")}>
              <img src={logo} alt="logo" className="doc-logo" />
              <span className="doc-brand-name"></span>
            </div>
          </div>
          <nav className="doc-topbar-right">
            <button className="doc-cta-btn" onClick={() => navigate("/register")}>
              Commencer gratuitement <ArrowRight size={15} />
            </button>
          </nav>
        </div>
      </header>

      <div className="doc-layout">

        {/* ── SIDEBAR ── */}
        <aside className="doc-sidebar">
          <div className="doc-sidebar-section">
            <p className="doc-sidebar-label">Guide utilisateur</p>
            <ul className="doc-nav">
              {sections.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    className={`doc-nav-item ${active === id ? "active" : ""}`}
                    onClick={() => scrollTo(id)}
                  >
                    <Icon size={15} />
                    {label}
                    {active === id && <ChevronRight size={13} className="doc-nav-arrow" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="doc-sidebar-footer">
            <Heart size={14} />
            <span>Fait avec soin par MEDICACOM</span>
          </div>
        </aside>

        {/* ── CONTENT ── */}
        <main className="doc-content">

          {/* ══ MEDICACOM ══ */}
          <section id="medicacom" className="doc-section">
            <div className="doc-section-badge"><Building2 size={14} /> Notre entreprise</div>
            <h1>À propos de MEDICACOM</h1>

            <div className="company-hero">
              <div className="company-hero-text">
                <p className="doc-lead">
                  Fondée en <strong>2020</strong> par un groupe de <strong>pharmaciens</strong> et
                  d'<strong>ingénieurs en génie logiciel</strong>, <strong>MEDICACOM</strong> est une startup
                  tunisienne dédiée à rendre les nouvelles technologies, notamment l'intelligence artificielle,
                  accessibles dans le secteur de la santé — et plus particulièrement au sein de l'industrie
                  pharmaceutique.
                </p>
                <p className="doc-lead">
                  En tant que <strong>partenaire de confiance</strong> des acteurs pharmaceutiques, MEDICACOM
                  soutient ses clients pour exploiter pleinement les capacités de l'<strong>Intelligence
                  Artificielle</strong> et de la <strong>Big Data</strong> afin d'améliorer les performances
                  globales de l'industrie pharmaceutique.
                </p>
              </div>
            </div>

            <div className="company-pillars">
              <div className="pillar-card">
                <div className="pillar-icon blue"><Lightbulb size={24} /></div>
                <h3>Innovation</h3>
                <p>Nous développons des solutions numériques à la pointe pour moderniser le secteur pharmaceutique.</p>
              </div>
              <div className="pillar-card">
                <div className="pillar-icon green"><Users size={24} /></div>
                <h3>Expertise mixte</h3>
                <p>Une équipe unique qui allie compétences médicales et savoir-faire technologique.</p>
              </div>
              <div className="pillar-card">
                <div className="pillar-icon purple"><ShieldCheck size={24} /></div>
                <h3>Confiance</h3>
                <p>Nos solutions respectent les normes réglementaires et garantissent la sécurité de vos données.</p>
              </div>
              <div className="pillar-card">
                <div className="pillar-icon orange"><Heart size={24} /></div>
                <h3>Impact santé</h3>
                <p>Chaque outil que nous créons vise à améliorer la santé des patients et la performance des acteurs de santé.</p>
              </div>
            </div>

            <div className="company-stats-row">
              <div className="cstat"><span className="cstat-num">2020</span><span className="cstat-label">Année de fondation</span></div>
              <div className="cstat"><span className="cstat-num">Tunis</span><span className="cstat-label">Siège social</span></div>
              <div className="cstat"><span className="cstat-num">IA & Big Data</span><span className="cstat-label">Cœur de métier</span></div>
              <div className="cstat"><span className="cstat-num">100%</span><span className="cstat-label">Engagé pour la santé</span></div>
            </div>
          </section>

          {/* ══ MEDICA-SIGN ══ */}
          <section id="presentation" className="doc-section">
            <div className="doc-section-badge"><ShieldCheck size={14} /> Notre solution</div>
            <h1>Qu'est-ce que Medica-Sign ?</h1>
            <p className="doc-lead">
              <strong>Medica-Sign</strong> est la plateforme de <strong>signature électronique sécurisée</strong>
              développée par MEDICACOM. Elle vous permet de signer, envoyer et gérer vos documents numériques
              (factures, contrats, ordonnances...) de manière légale, rapide et entièrement en ligne.
            </p>

            <div className="feature-grid">
              <div className="feat-item">
                <CheckCircle size={18} className="feat-check" />
                <div>
                  <strong>Signature légalement valide</strong>
                  <p>Reconnue par la loi tunisienne grâce à l'intégration TTN.</p>
                </div>
              </div>
              <div className="feat-item">
                <CheckCircle size={18} className="feat-check" />
                <div>
                  <strong>100% en ligne</strong>
                  <p>Aucune impression, aucun déplacement, tout se fait depuis votre écran.</p>
                </div>
              </div>
              <div className="feat-item">
                <CheckCircle size={18} className="feat-check" />
                <div>
                  <strong>Multi-signataires</strong>
                  <p>Invitez plusieurs personnes à signer un même document.</p>
                </div>
              </div>
              <div className="feat-item">
                <CheckCircle size={18} className="feat-check" />
                <div>
                  <strong>Suivi en temps réel</strong>
                  <p>Suivez l'avancement de chaque signature depuis votre tableau de bord.</p>
                </div>
              </div>
              <div className="feat-item">
                <CheckCircle size={18} className="feat-check" />
                <div>
                  <strong>Archivage sécurisé</strong>
                  <p>Vos documents signés sont conservés et accessibles à tout moment.</p>
                </div>
              </div>
              <div className="feat-item">
                <CheckCircle size={18} className="feat-check" />
                <div>
                  <strong>Compatible tous appareils</strong>
                  <p>Utilisez Medica-Sign sur ordinateur, tablette ou smartphone.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ══ COMMENT ÇA MARCHE ══ */}
          <section id="comment" className="doc-section">
            <div className="doc-section-badge"><Lightbulb size={14} /> Guide pratique</div>
            <h1>Comment ça marche ?</h1>
            <p className="doc-lead">
              Medica-Sign est conçu pour être aussi simple que possible. En quelques étapes, votre document est signé.
            </p>

            <div className="how-steps">
              <Step num="1" icon={UserCheck} color="blue"
                title="Créez votre compte"
                desc="Inscrivez-vous gratuitement sur Medica-Sign avec votre e-mail. Un code de vérification vous sera envoyé pour activer votre compte." />
              <Step num="2" icon={Upload} color="green"
                title="Importez votre document"
                desc="Chargez votre fichier PDF ou XML depuis votre ordinateur directement dans votre espace personnel." />
              <Step num="3" icon={PenLine} color="purple"
                title="Ajoutez les signataires"
                desc="Indiquez les adresses e-mail des personnes qui doivent signer. Elles recevront automatiquement une invitation." />
              <Step num="4" icon={Bell} color="orange"
                title="Les signataires sont notifiés"
                desc="Chaque signataire reçoit un lien sécurisé par e-mail pour accéder au document et le signer." />
              <Step num="5" icon={ClipboardCheck} color="teal"
                title="Signature & validation TTN"
                desc="Chaque signataire appose sa signature. Le document est ensuite validé automatiquement par la plateforme TTN." />
              <Step num="6" icon={Eye} color="indigo"
                title="Suivez & téléchargez"
                desc="Consultez l'état de chaque signature depuis votre tableau de bord et téléchargez le document final signé." />
            </div>
          </section>

          {/* ══ SIGNATURE ══ */}
          <section id="signature" className="doc-section">
            <div className="doc-section-badge"><PenLine size={14} /> Signature</div>
            <h1>Comment signer un document ?</h1>
            <p className="doc-lead">
              Que vous soyez l'<strong>émetteur</strong> (celui qui envoie) ou le <strong>signataire</strong>
              (celui qui signe), voici comment procéder.
            </p>

            <h2>Si vous envoyez un document à signer</h2>
            <ol className="doc-ordered-list">
              <li>Connectez-vous à votre espace Medica-Sign.</li>
              <li>Cliquez sur <strong>« Nouvelle transaction »</strong> dans le menu.</li>
              <li>Importez votre document (PDF ou XML).</li>
              <li>Ajoutez les e-mails des signataires.</li>
              <li>Confirmez l'envoi — les signataires sont notifiés automatiquement.</li>
              <li>Suivez la progression depuis votre tableau de bord.</li>
            </ol>

            <h2>Si vous êtes invité à signer</h2>
            <ol className="doc-ordered-list">
              <li>Ouvrez l'e-mail reçu de Medica-Sign.</li>
              <li>Cliquez sur le lien sécurisé pour accéder au document.</li>
              <li>Lisez attentivement le document.</li>
              <li>Entrez votre code PIN de signature pour valider.</li>
              <li>C'est terminé ! Vous recevrez une confirmation par e-mail.</li>
            </ol>

            <div className="info-box">
              <Bell size={16} className="info-icon" />
              <p>Vous pouvez relancer un signataire qui n'a pas encore signé directement depuis la page de détail de votre transaction.</p>
            </div>
          </section>

          {/* ══ FACTURES ══ */}
          <section id="factures" className="doc-section">
            <div className="doc-section-badge"><FileText size={14} /> Factures</div>
            <h1>Gérer vos factures</h1>
            <p className="doc-lead">
              Medica-Sign vous permet d'importer, d'organiser et de signer vos factures électroniques en toute simplicité.
            </p>

            <h2>Importer une facture</h2>
            <ol className="doc-ordered-list">
              <li>Accédez à la section <strong>« Factures »</strong> de votre tableau de bord.</li>
              <li>Cliquez sur <strong>« Importer une facture »</strong>.</li>
              <li>Sélectionnez votre fichier (PDF ou XML UBL).</li>
              <li>La facture est automatiquement validée et ajoutée à votre espace.</li>
            </ol>

            <h2>Envoyer une facture à signer</h2>
            <ol className="doc-ordered-list">
              <li>Sélectionnez la facture dans votre liste.</li>
              <li>Cliquez sur <strong>« Créer une transaction »</strong>.</li>
              <li>Ajoutez les signataires et envoyez.</li>
            </ol>

            <div className="format-cards">
              <div className="format-card">
                <span className="format-badge red">PDF</span>
                <div>
                  <strong>Facture PDF</strong>
                  <p>Format universel, idéal pour l'envoi et l'impression. Toute version PDF est acceptée.</p>
                </div>
              </div>
              <div className="format-card">
                <span className="format-badge orange">XML</span>
                <div>
                  <strong>Facture XML (UBL 2.1)</strong>
                  <p>Format structuré recommandé pour l'interopérabilité avec les systèmes ERP et comptables.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ══ COMPTE ══ */}
          <section id="compte" className="doc-section">
            <div className="doc-section-badge"><UserCheck size={14} /> Votre compte</div>
            <h1>Gérer votre compte</h1>

            <h2>Créer un compte</h2>
            <ol className="doc-ordered-list">
              <li>Cliquez sur <strong>« Créer un compte »</strong> sur la page d'accueil.</li>
              <li>Saisissez votre nom complet, e-mail et mot de passe.</li>
              <li>Validez votre adresse e-mail avec le code reçu.</li>
              <li>Vous êtes connecté et prêt à utiliser Medica-Sign !</li>
            </ol>

            <h2>Configurer votre signature</h2>
            <p className="doc-section-p">
              Dans votre espace <strong>Profil → Ma signature</strong>, vous pouvez dessiner ou importer votre
              signature manuscrite qui sera apposée sur vos documents.
            </p>

            <h2>Ajouter un certificat</h2>
            <p className="doc-section-p">
              Pour les signatures avancées, accédez à <strong>Profil → Certification</strong> pour lier votre
              certificat numérique délivré par une autorité TTN agréée.
            </p>

            <h2>Changer votre mot de passe</h2>
            <ol className="doc-ordered-list">
              <li>Allez dans <strong>Profil → Changer le mot de passe</strong>.</li>
              <li>Entrez votre ancien mot de passe puis le nouveau.</li>
              <li>Validez. La modification est immédiate.</li>
            </ol>

            <div className="info-box info-box--green">
              <Star size={16} className="info-icon green" />
              <p>Vous pouvez également vous connecter avec votre compte <strong>Google</strong> pour une expérience encore plus rapide.</p>
            </div>
          </section>

          {/* ══ SÉCURITÉ ══ */}
          <section id="securite" className="doc-section">
            <div className="doc-section-badge"><Lock size={14} /> Sécurité</div>
            <h1>Sécurité & Confidentialité</h1>
            <p className="doc-lead">
              La protection de vos données et la sécurité de vos documents sont au cœur de Medica-Sign.
              Voici ce que nous mettons en place pour vous garantir une expérience sécurisée.
            </p>

            <div className="security-list">
              <div className="sec-row">
                <div className="sec-row-icon"><ShieldCheck size={22} /></div>
                <div>
                  <h3>Chiffrement de bout en bout</h3>
                  <p>Tous vos documents sont chiffrés pendant leur transfert et lors de leur stockage. Personne d'autre que vous et vos signataires autorisés ne peut y accéder.</p>
                </div>
              </div>
              <div className="sec-row">
                <div className="sec-row-icon"><Clock size={22} /></div>
                <div>
                  <h3>Horodatage certifié</h3>
                  <p>Chaque signature est accompagnée d'un horodatage légal certifié, prouvant la date et l'heure exacte de la signature.</p>
                </div>
              </div>
              <div className="sec-row">
                <div className="sec-row-icon"><Lock size={22} /></div>
                <div>
                  <h3>Code PIN de signature</h3>
                  <p>Pour signer un document, chaque signataire doit utiliser un code PIN personnel, garantissant que c'est bien lui qui signe.</p>
                </div>
              </div>
              <div className="sec-row">
                <div className="sec-row-icon"><Eye size={22} /></div>
                <div>
                  <h3>Journal d'audit</h3>
                  <p>Toute action sur un document (ouverture, signature, refus...) est enregistrée dans un journal consultable à tout moment.</p>
                </div>
              </div>
              <div className="sec-row">
                <div className="sec-row-icon"><CheckCircle size={22} /></div>
                <div>
                  <h3>Conformité TTN</h3>
                  <p>Medica-Sign respecte les exigences légales de la TTN et du cadre règlementaire tunisien relatif à la signature électronique.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ══ FAQ ══ */}
          <section id="faq" className="doc-section">
            <div className="doc-section-badge"><HelpCircle size={14} /> FAQ</div>
            <h1>Questions fréquentes</h1>
            <p className="doc-lead">
              Vous trouverez ici les réponses aux questions les plus souvent posées par nos utilisateurs.
            </p>

            <div className="faq-list">
              {faqs.map((item, i) => (
                <FaqItem key={i} q={item.q} a={item.a} />
              ))}
            </div>
          </section>

          {/* ══ CONTACT ══ */}
          <section id="contact" className="doc-section">
            <div className="doc-section-badge"><Phone size={14} /> Contact</div>
            <h1>Contact & Support</h1>
            <p className="doc-lead">
              Notre équipe MEDICACOM est à votre disposition pour répondre à toutes vos questions et vous accompagner
              dans l'utilisation de Medica-Sign.
            </p>

            <div className="contact-grid">
              <div className="contact-card">
                <div className="contact-icon"><Mail size={22} /></div>
                <h3>E-mail</h3>
                <p>support@medicacom.tn</p>
                <p className="contact-sub">Réponse sous 24h ouvrées</p>
              </div>
              <div className="contact-card">
                <div className="contact-icon"><Phone size={22} /></div>
                <h3>Téléphone</h3>
                <p>+216 XX XXX XXX</p>
                <p className="contact-sub">Lun – Ven : 8h00 – 17h00</p>
              </div>
              <div className="contact-card">
                <div className="contact-icon"><MapPin size={22} /></div>
                <h3>Adresse</h3>
                <p>MEDICACOM, Tunis</p>
                <p className="contact-sub">Tunisie</p>
              </div>
            </div>

            <div className="contact-cta">
              <div className="contact-cta-text">
                <h2>Prêt à commencer ?</h2>
                <p>Créez votre compte gratuitement et commencez à signer vos documents en toute sécurité.</p>
              </div>
              <div className="contact-cta-actions">
                <button className="cta-primary" onClick={() => navigate("/register")}>
                  Créer un compte gratuit <ArrowRight size={16} />
                </button>
                <button className="cta-ghost" onClick={() => navigate("/login")}>
                  Se connecter
                </button>
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
