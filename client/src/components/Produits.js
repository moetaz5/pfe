import { Link } from "react-router-dom";
import { useEffect } from "react";
import "./style/produits.css";

const Produits = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const products = [
    {
      title: "FacturationTTN Cloud",
      description: "Solution de facturation électronique qui offre une interface web et une API d'intégration.",
      icon: "📊",
      features: ["Interface web moderne", "API REST complète", "Intégration facile", "Support 24/7"]
    },
    {
      title: "QRSecure",
      description: "Solution de cachet électronique (QRCode signé) conforme à la norme 2D-Doc.",
      icon: "📱",
      features: ["Norme 2D-Doc", "QRCode sécurisé", "Validation instantanée", "Multi-support"]
    },
    {
      title: "Remote Trust",
      description: "Solution de PKI complète pour la gestion de vos certificats (Autorité de Certification, enrôlement…).",
      icon: "🔐",
      features: ["PKI complète", "Gestion des certificats", "Autorité de Certification", "Enrôlement"]
    },
    {
      title: "FacturationTTN Hybrid",
      description: "Un compromis entre le service SaaS et la licence on-premise pour profiter de nos services cloud tout en gardant le contrôle total de votre data.",
      icon: "🔄",
      features: ["Mode hybride", "Contrôle total", "Flexibilité", "Sécurité maximale"]
    }
  ];

  const benefits = [
    { icon: "🚀", title: "Solutions intuitives", description: "Interface simple et facile à utiliser" },
    { icon: "🔗", title: "Simple à intégrer", description: "API RESTful complète et documentée" },
    { icon: "⚙️", title: "Solutions flexibles", description: "Adaptées à vos besoins spécifiques" },
    { icon: "🎯", title: "Expert de la confiance", description: "Spécialistes en cryptographie et facturation électronique" }
  ];

  return (
    <div className="produits-container">
      <nav className="produits-navbar">
        <div className="navbar-container">
          <div className="navbar-content">
            <Link to="/" className="logo">
              FacturationTTN
            </Link>
            <Link to="/login" className="btn btn-primary">
              Se connecter
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="produits-hero">
        <div className="hero-content">
          <h1>Une suite complète de produits de confiance électronique</h1>
          <p>Installez nos produits de confiance électronique dans vos locaux et ayez le contrôle total de votre Data et vos flux.</p>
          <div className="hero-features">
            <span className="feature-tag">✓ Scalable</span>
            <span className="feature-tag">✓ Personnalisable</span>
            <span className="feature-tag">✓ Modèles On-premise ou Hybride</span>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="products-section">
        <div className="section-container">
          <div className="section-header">
            <h2>Nos produits</h2>
            <p>Découvrez notre gamme complète de solutions de confiance électronique</p>
          </div>

          <div className="products-grid">
            {products.map((product, index) => (
              <div key={index} className="product-card">
                <div className="product-icon">{product.icon}</div>
                <h3>{product.title}</h3>
                <p>{product.description}</p>
                <ul className="product-features">
                  {product.features.map((feature, idx) => (
                    <li key={idx}>{feature}</li>
                  ))}
                </ul>
                <Link to="/login" className="btn btn-outline">
                  En savoir plus
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* On-Premise Section */}
      <section className="onpremise-section">
        <div className="section-container">
          <div className="onpremise-content">
            <div className="onpremise-text">
              <h2>Nos solutions On-Premises</h2>
              <h3>Installer nos solutions dans vos locaux et ayez le contrôle total de votre Data.</h3>
              <p>Profitez de toutes les fonctionnalités de notre plateforme tout en gardant le contrôle complet sur vos données et votre infrastructure.</p>
              <ul className="onpremise-list">
                <li>🔒 Sécurité maximale</li>
                <li>🏢 Installation sur site</li>
                <li>⚙️ Personnalisation complète</li>
                <li>📊 Contrôle total</li>
              </ul>
              <Link to="/login" className="btn btn-primary">
                Demander une démo
              </Link>
            </div>
            <div className="onpremise-image">
              <div className="image-placeholder">
                <div className="placeholder-icon">🖥️</div>
                <p>Infrastructure On-Premise</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="why-section">
        <div className="section-container">
          <div className="section-header">
            <h2>Pourquoi choisir FacturationTTN ?</h2>
            <p>Spécialiste de la facturation électronique et les infrastructures à clé publique (PKI), l'éditeur d'une suite complète de confiance électronique.</p>
          </div>

          <div className="benefits-grid">
            {benefits.map((benefit, index) => (
              <div key={index} className="benefit-card">
                <div className="benefit-icon">{benefit.icon}</div>
                <h3>{benefit.title}</h3>
                <p>{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Signature Demo Section */}
      <section className="signature-demo-section">
        <div className="section-container">
          <div className="demo-content">
            <h2>Essayez notre démo de signature</h2>
            <p>Découvrez comment fonctionne notre solution de signature électronique en testant notre démo interactive.</p>
            <Link to="/signature" className="btn btn-primary btn-lg">
              📄 Voir la fiche PDF
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Prêt à démarrer ?</h2>
          <p>Découvrez nos solutions et commencez à simplifier votre facturation électronique dès aujourd'hui.</p>
          <div className="cta-buttons">
            <Link to="/login" className="btn btn-primary btn-lg">
              Commencer maintenant
            </Link>
            <Link to="/" className="btn btn-outline btn-lg">
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="produits-footer">
        <div className="footer-container">
          <div className="footer-content">
            <div className="footer-brand">
              <Link to="/" className="logo">FacturationTTN</Link>
              <p>Plateforme de facturation électronique conforme TTN.</p>
            </div>
            <div className="footer-links">
              <Link to="/produits">Produits</Link>
              <Link to="/">Services</Link>
              <Link to="/">Tarifs</Link>
              <Link to="/">À propos</Link>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} FacturationTTN. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Produits;