import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  ShieldCheck, FileText, CheckCircle, ArrowRight, Github, 
  Twitter, Linkedin, Mail, Phone, MapPin, Play, Zap, Check, Lock
} from "lucide-react";
import heroImage from "./style/hero-signature.png";
import logo from "./assets/logo.png";
import "./style/home.css";

import { Menu, X } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="home-page">
      {/* ── TOPBAR INTÉGRÉ ── */}
      <header className={`home-topbar ${isMenuOpen ? "menu-open" : ""}`}>
        <div className="home-topbar-inner">
          <div className="home-brand" onClick={() => navigate("/")}>
            <img src={logo} alt="logo Medica-Sign" className="home-logo" />
          </div>

          <button className="mobile-menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <nav className={`home-topbar-right ${isMenuOpen ? "active" : ""}`}>
            <button className="home-btn-ghost" onClick={() => { setIsMenuOpen(false); navigate("/login"); }}>Se connecter</button>
            <button className="home-btn-primary" onClick={() => { setIsMenuOpen(false); navigate("/register"); }}>
              Commencer <ArrowRight size={15} />
            </button>
          </nav>
        </div>
      </header>

      <div className="home-wrapper">
        {/* ── HERO SECTION ── */}
        <section className="home-hero">
          <div className="hero-left">
            <div className="hero-badge-top">
              <span className="live-dot"></span> Pionnier de la confiance numérique
            </div>
            <h1>
              Sécurisez vos <br />
              <span>Affaires</span> avec <br />
              <span>Sérénité.</span>
            </h1>

            <p className="hero-desc">
              Medica-Sign est la solution de signature électronique la plus avancée en Tunisie, alliant expertise IA et conformité réglementaire TTN totale.
            </p>

            <div className="hero-buttons">
              <button
                className="btn-hero-primary"
                onClick={() => navigate("/register")}
              >
                Commencer gratuitement <ArrowRight size={16} />
              </button>

              <button
                className="btn-hero-secondary"
                onClick={() => navigate("/documentation")}
              >
                Découvrir l'offre <Play size={16} style={{ fill: "currentColor" }} />
              </button>
            </div>

            <div className="hero-badges">
              <span className="badge-row">
                <CheckCircle size={15} className="ok" /> Infrastructure Hôtesse TTN
              </span>
              <span className="badge-row">
                <CheckCircle size={15} className="ok" /> Cryptographie Militaire
              </span>
            </div>
          </div>

          <div className="hero-right">
            <div className="hero-image-wrap">
              <img src={heroImage} alt="hero signature" className="hero-image" />
              
              <div className="status-float">
                <div className="status-icon">
                  <CheckCircle size={18} className="ok" />
                </div>
                <div className="status-texts">
                  <div className="status-label">VALEUR JURIDIQUE</div>
                  <div className="status-value">100% Conforme</div>
                </div>
              </div>

              {/* Security Floating Badge */}
              <div className="security-badge-float">
                <ShieldCheck size={20} color="#3b82f6" />
                <span>Protection AES-256</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── TRUST BAR ── */}
        <section className="home-trust-bar">
          <p>ILS NOUS FONT CONFIANCE</p>
          <div className="trust-logos">
             <div className="trust-logo-item">TTN TRADENET</div>
             <div className="trust-logo-item">ISET SOLUTIONS</div>
             <div className="trust-logo-item">MEDHEALTH</div>
             <div className="trust-logo-item">PHARMA SYNC</div>
             <div className="trust-logo-item">BIO-TECH TN</div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="home-features">
          <div className="feature-card">
            <div className="feature-ico"><FileText size={22} /></div>
            <h3>Importation simplifiée</h3>
            <p>Prise en charge des formats PDF et XML (UBL) avec validation immédiate des normes TTN.</p>
          </div>

          <div className="feature-card">
            <div className="feature-ico"><ShieldCheck size={22} /></div>
            <h3>Signature hautement sécurisée</h3>
            <p>Chiffrement de bout en bout, authentification forte et communication directe avec la plateforme TTN.</p>
          </div>

          <div className="feature-card">
            <div className="feature-ico"><CheckCircle size={22} /></div>
            <h3>Suivi en temps réel</h3>
            <p>Suivez le statut de vos documents en direct et téléchargez les journaux d'audit de chaque transaction.</p>
          </div>
        </section>

        {/* ── STATS SECTION ── */}
        <section className="home-stats">
          <div className="stat-item">
            <span className="stat-number">10K+</span>
            <span className="stat-label">Documents Signés</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">99.9%</span>
            <span className="stat-label">Disponibilité</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">256-bit</span>
            <span className="stat-label">Chiffrement AES</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">100%</span>
            <span className="stat-label">Conforme TTN</span>
          </div>
        </section>

        {/* ── ABOUT MEDICACOM ── */}
        <section className="home-about">
          <div className="about-content">
            <div className="about-tag">Médicacom Corporate</div>
            <h2>Propulsant l'avenir de la santé</h2>
            <p>
              <strong>MEDICACOM</strong> est une startup tunisienne visionnaire dédiée à l’injection de l’intelligence artificielle au cœur de l’industrie pharmaceutique et médicale.
            </p>
            <p className="corporate-tagline">
              "L’IA au service de l’humain, pour une santé plus intelligente et plus accessible."
            </p>
            <div className="about-grid">
              <div className="about-mini-card">
                <Zap size={20} className="pri-icon" />
                <h4>Innovation IA</h4>
                <p>Développement d'algorithmes prédictifs pour le suivi patient.</p>
              </div>
              <div className="about-mini-card">
                <CheckCircle size={20} className="pri-icon" />
                <h4>E-Santé</h4>
                <p>Digitalisation complète des processus réglementaires.</p>
              </div>
            </div>
            
            <a 
               href="https://www.medicacom.tn/" 
               target="_blank" 
               rel="noopener noreferrer" 
               className="btn-visit-corp"
            >
               Découvrir Médicacom <ArrowRight size={18} />
            </a>
          </div>
        </section>

        {/* ── PRICING SECTION ── */}
        <section className="home-pricing">
           <div className="pricing-head">
              <div className="about-tag">Nos Offres</div>
              <h2>Choisissez votre <span>vitesse</span></h2>
           </div>
           <div className="pricing-grid">
              <div className="pricing-card">
                 <div className="price-title">Starter</div>
                 <div className="price-val">0<span>DT/mois</span></div>
                 <ul className="price-features">
                    <li><Check size={14} /> 5 Documents/mois</li>
                    <li><Check size={14} /> Import PDF & XML</li>
                    <li><Check size={14} /> Validation TTN</li>
                    <li className="off"><Check size={14} /> Support Prioritaire</li>
                 </ul>
                 <button className="btn-price" onClick={() => navigate("/register")}>Essayer</button>
              </div>
              <div className="pricing-card featured">
                 <div className="best-value">POPULAIRE</div>
                 <div className="price-title">Pro</div>
                 <div className="price-val">79<span>DT/mois</span></div>
                 <ul className="price-features">
                    <li><Check size={14} /> Documents Illimités</li>
                    <li><Check size={14} /> Gestion d'Organisation</li>
                    <li><Check size={14} /> Validation TTN Prioritaire</li>
                    <li><Check size={14} /> Support 24/7</li>
                 </ul>
                 <button className="btn-price featured" onClick={() => navigate("/register")}>Commencer</button>
              </div>
              <div className="pricing-card">
                 <div className="price-title">Entreprise</div>
                 <div className="price-val">Sur devis</div>
                 <ul className="price-features">
                    <li><Check size={14} /> API Dédiée</li>
                    <li><Check size={14} /> SSO & Sécurité Avancée</li>
                    <li><Check size={14} /> Accompagnement Dédié</li>
                    <li><Check size={14} /> On-premise disponible</li>
                 </ul>
                 <button className="btn-price" onClick={() => navigate("/support")}>Contacter</button>
              </div>
           </div>
        </section>

        {/* ── FAQ SECTION ── */}
        <section className="home-faq">
            <div className="faq-head">
               <h2>Questions <span>Fréquentes</span></h2>
            </div>
            <div className="faq-grid">
               <div className="faq-item">
                  <h4>Est-ce légalement reconnu ?</h4>
                  <p>Oui, Medica-Sign génère des signatures conformes à la loi 2000-83 et certifiées par la TTN.</p>
               </div>
               <div className="faq-item">
                  <h4>Quels formats sont supportés ?</h4>
                  <p>Nous supportons les PDF standards ainsi que les fichiers XML structurés pour la facturation électronique.</p>
               </div>
               <div className="faq-item">
                  <h4>Mes données sont-elles en Tunisie ?</h4>
                  <p>Absolument, Medica-Sign respecte la souveraineté numérique nationale avec un hébergement sécurisé.</p>
               </div>
            </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="home-final-cta">
          <div className="cta-box">
            <h2>Prêt à digitaliser vos signatures ?</h2>
            <p>Rejoignez des centaines d'entreprises tunisiennes qui font confiance à Medica-Sign.</p>
            <button className="btn-cta" onClick={() => navigate("/register")}>
              Créer mon compte maintenant <ArrowRight size={20} />
            </button>
          </div>
        </section>
      </div>

      {/* ── FOOTER ── */}
      {/* ── FOOTER LIGHT ── */}
      <footer className="home-footer-light">
        <div className="footer-top">
          <div className="footer-brand">
            <img src={logo} alt="logo Medica-Sign" className="footer-logo" />
            <p className="footer-desc">
              La plateforme de signature électronique sécurisée par <a href="https://www.medicacom.tn/" target="_blank" rel="noopener noreferrer" className="company-link">MEDICACOM</a>, intégrée à la TTN pour garantir la conformité et l'authenticité absolue de vos documents.
            </p>
            <div className="footer-socials">
              <a href="#" aria-label="Github" className="social-icon"><Github size={18} /></a>
              <a href="#" aria-label="Twitter" className="social-icon"><Twitter size={18} /></a>
              <a href="#" aria-label="LinkedIn" className="social-icon"><Linkedin size={18} /></a>
            </div>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Navigation</h4>
            <ul>
              <li><button className="footer-link" onClick={() => navigate("/")}>Accueil</button></li>
              <li><button className="footer-link" onClick={() => navigate("/documentation")}>Guide utilisateur</button></li>
              <li><button className="footer-link" onClick={() => navigate("/login")}>Espace client</button></li>
              <li><button className="footer-link" onClick={() => navigate("/register")}>Créer un compte</button></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Médicacom</h4>
            <ul>
              <li><a href="https://www.medicacom.tn/" target="_blank" rel="noopener noreferrer" className="footer-link">À propos de nous</a></li>
              <li><a href="https://www.medicacom.tn/#contact" target="_blank" rel="noopener noreferrer" className="footer-link">Carrières</a></li>
              <li><a href="https://www.medicacom.tn/#services" target="_blank" rel="noopener noreferrer" className="footer-link">Nos services</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Contact</h4>
            <ul>
              <li className="footer-contact-item"><Mail size={14} /> <span>support@medicacom.tn</span></li>
              <li className="footer-contact-item"><Phone size={14} /> <span>+216 XX XXX XXX</span></li>
              <li className="footer-contact-item"><MapPin size={14} /> <span>Tunis, Tunisie</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} MEDICACOM. Tous droits réservés.</span>
          <div className="footer-bottom-links">
            <button className="footer-link-sm" onClick={() => navigate("/documentation")}>Politique de confidentialité</button>
            <button className="footer-link-sm" onClick={() => navigate("/documentation")}>Conditions d'utilisation</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
