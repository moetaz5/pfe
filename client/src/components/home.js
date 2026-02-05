import { Link, Navigate } from "react-router-dom";
import { useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import "./style/home.css";

// ✅ Import logo
import logo from "./assets/logo.png";

const Home = () => {
  const { user, loading } = useContext(AuthContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('cloud');
  const [stats, setStats] = useState({
    signatures: 0,
    clientsSaaS: 0,
    clientsGov: 0,
    countries: 0
  });
  const canvasRef = useRef(null);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Animate stats on scroll
  useEffect(() => {
    const animateStats = () => {
      const statsSection = document.getElementById('stats');
      if (!statsSection) return;

      const rect = statsSection.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;

      if (isVisible) {
        const animateValue = (start, end, duration) => {
          let startTimestamp = null;
          const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            return Math.floor(progress * (end - start) + start);
          };
          return step;
        };

        setStats({
          signatures: animateValue(0, 50000, 2000),
          clientsSaaS: animateValue(0, 1500, 2000),
          clientsGov: animateValue(0, 50, 2000),
          countries: animateValue(0, 12, 2000)
        });
      }
    };

    window.addEventListener('scroll', animateStats);
    animateStats();
    return () => window.removeEventListener('scroll', animateStats);
  }, []);

  // Navbar scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Particles animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationFrameId;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticles = () => {
      const particleCount = Math.min(100, Math.floor(window.innerWidth / 15));
      particles = [];

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 2 + 0.5,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
          opacity: Math.random() * 0.5 + 0.2,
        });
      }
    };

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle, i) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(37, 99, 235, ${particle.opacity})`;
        ctx.fill();

        particles.slice(i + 1).forEach((otherParticle) => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            const opacity = (1 - distance / 150) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = `rgba(37, 99, 235, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationFrameId = requestAnimationFrame(drawParticles);
    };

    resizeCanvas();
    createParticles();
    drawParticles();

    const handleResize = () => {
      resizeCanvas();
      createParticles();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const pricingPlans = [
    { tokens: 10, price: 10, name: 'Pack 10', popular: false },
    { tokens: 20, price: 17, name: 'Pack 20', popular: false },
    { tokens: 100, price: 75, name: 'Pack 100', popular: true },
    { tokens: 1000, price: 555, name: 'Pack 1000', popular: false }
  ];

  const timeline = [
    { year: '2016', title: 'Plateforme de facturation en ligne', icon: '🚀' },
    { year: '2017', title: 'Certification eIDAS', icon: '✅' },
    { year: '2021', title: 'Plateforme de Cachet Électronique', icon: '📄' },
    { year: '2023', title: 'Expansion internationale', icon: '🌍' }
  ];

  if (loading) return <p className="loading">Chargement</p>;
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="home-container">
      <div className="dynamic-bg"></div>
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>
      <div className="grid-overlay"></div>

      <div className="particles-container">
        <canvas ref={canvasRef} className="particles-canvas"></canvas>
      </div>

      <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="navbar-container">
          <div className="navbar-content">
            <div className="flex-shrink-0">
              <Link to="/" className="logo">
                {/* ✅ Logo + Text */}
                <img src={logo} alt="Medica-Sign" className="home-logo-img" />
                <span>MEDICA-SIGN</span>
              </Link>
            </div>

            <div className="nav-menu">
              <ul className="nav-menu-list">
                <li><Link to="/produits" className="nav-link">Produits</Link></li>
                <li><a href="#services" className="nav-link">Services</a></li>
                <li><a href="#tarifs" className="nav-link">Tarifs</a></li>
                <li><a href="#apropos" className="nav-link">À propos</a></li>
              </ul>
            </div>

            <div>
              <Link to="/login" className="btn btn-primary">
                Se connecter
              </Link>
            </div>

            <button
              className="mobile-menu-button"
              onClick={toggleMobileMenu}
              aria-label="Menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>

          <div className={`mobile-menu ${isMobileMenuOpen ? 'active' : ''}`}>
            <Link to="/produits" className="mobile-menu-link" onClick={() => setIsMobileMenuOpen(false)}>Produits</Link>
            <a href="#services" className="mobile-menu-link" onClick={() => setIsMobileMenuOpen(false)}>Services</a>
            <a href="#tarifs" className="mobile-menu-link" onClick={() => setIsMobileMenuOpen(false)}>Tarifs</a>
            <a href="#apropos" className="mobile-menu-link" onClick={() => setIsMobileMenuOpen(false)}>À propos</a>
          </div>
        </div>
      </nav>

      <main className="hero">
        <div className="hero-content">
          <div className="hero-badge">✨ Nouvelle version 2.0 disponible</div>
          <h1>Facturez vos documents où que vous soyez</h1>
          <p>FacturationTTN offre un moyen simple et rapide de créer et gérer vos factures électroniques conformes aux normes TTN à travers une application moderne et une API universelle.</p>
          <div className="hero-buttons">
            <Link to="/login" className="btn btn-primary btn-lg">
              Commencer maintenant
            </Link>
            <a href="#services" className="btn btn-outline btn-lg">
              En savoir plus
            </a>
          </div>
        </div>
      </main>

      {/* Cadre légal */}
      <section className="legal-section">
        <div className="legal-container">
          <div className="legal-content">
            <h2>Cadre légal</h2>
            <h3>Conforme aux normes internationales</h3>
            <p>Nos solutions respectent les normes internationales de facturation électronique. FacturationTTN est certifiée eIDAS et conforme aux normes ETSI</p>
            <ul className="legal-list">
              <li>✓ Facturation électronique à valeur probante</li>
              <li>✓ Même valeur que la facturation papier</li>
              <li>✓ Sécurité renforcée (intégrité, authenticité et non-répudiation)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="services-section">
        <div className="services-container">
          <div className="section-header">
            <h2>Services</h2>
            <p>Des solutions de confiance électronique qui s'adaptent à vos besoins et vos contraintes</p>
          </div>

          <div className="services-tabs">
            <button 
              className={`tab-button ${activeTab === 'cloud' ? 'active' : ''}`}
              onClick={() => setActiveTab('cloud')}
            >
              ☁️ Cloud
            </button>
            <button 
              className={`tab-button ${activeTab === 'server' ? 'active' : ''}`}
              onClick={() => setActiveTab('server')}
            >
              🖥️ Serveur
            </button>
            <button 
              className={`tab-button ${activeTab === 'hybrid' ? 'active' : ''}`}
              onClick={() => setActiveTab('hybrid')}
            >
              🔄 Cloud Hybride
            </button>
          </div>

          <div className="services-content">
            {activeTab === 'cloud' && (
              <div className="service-detail active">
                <h3>Cloud</h3>
                <p>Utilisez nos services de facturation électronique sur notre Cloud privé et sécurisé sans aucune installation requise.</p>
                <ul className="feature-list">
                  <li>✓ Accès instantané</li>
                  <li>✓ Maintenance incluse</li>
                  <li>✓ Mises à jour automatiques</li>
                  <li>✓ Sécurité maximale</li>
                </ul>
              </div>
            )}
            {activeTab === 'server' && (
              <div className="service-detail active">
                <h3>Serveur</h3>
                <p>Installez nos solutions de facturation électronique dans vos locaux et ayez le contrôle total de votre Data.</p>
                <ul className="feature-list">
                  <li>✓ Contrôle total</li>
                  <li>✓ Installation sur site</li>
                  <li>✓ Personnalisation complète</li>
                  <li>✓ Conformité totale</li>
                </ul>
              </div>
            )}
            {activeTab === 'hybrid' && (
              <div className="service-detail active">
                <h3>Cloud Hybride</h3>
                <p>Profitez de nos services de facturation électronique Cloud tout en gardant le contrôle total de votre Data.</p>
                <ul className="feature-list">
                  <li>✓ Flexibilité optimale</li>
                  <li>✓ Meilleur des deux mondes</li>
                  <li>✓ Scalabilité</li>
                  <li>✓ Sécurité hybride</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="pricing-section">
        <div className="pricing-container">
          <div className="section-header">
            <h2>Tarifs</h2>
            <p>Payez uniquement ce que vous consommez</p>
          </div>

          <div className="pricing-grid">
            {pricingPlans.map((plan) => (
              <div 
                key={plan.tokens}
                className={`pricing-card ${plan.popular ? 'popular' : ''}`}
              >
                {plan.popular && <div className="popular-badge">⭐ Plus populaire</div>}
                <div className="pricing-header">
                  <div className="price">{plan.price} TND</div>
                  <div className="tokens">Pack de {plan.tokens} Jetons</div>
                  <div className="pack-name">{plan.name}</div>
                </div>
                <ul className="pricing-features">
                  <li>✓ {plan.tokens} factures électroniques</li>
                  <li>✓ Support prioritaire</li>
                  <li>✓ Stockage sécurisé</li>
                  <li>✓ Conformité TTN</li>
                </ul>
                <button className={`btn ${plan.popular ? 'btn-primary' : 'btn-outline'} pricing-btn`}>
                  Choisir ce pack
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* À propos */}
      <section id="apropos" className="about-section">
        <div className="about-container">
          <div className="section-header">
            <h2>Qui sommes-nous ?</h2>
            <h3>L'expert de la confiance électronique</h3>
            <p>Spécialiste de la facturation électronique et les infrastructures à clé publique (PKI) et l'éditeur de la première plateforme web de facturation électronique conforme TTN.</p>
          </div>

          <div className="timeline">
            {timeline.map((item, index) => (
              <div key={index} className="timeline-item">
                <div className="timeline-year">{item.year}</div>
                <div className="timeline-content">
                  <div className="timeline-icon">{item.icon}</div>
                  <div className="timeline-title">{item.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Statistiques */}
      <section id="stats" className="stats-section">
        <div className="stats-container">
          <div className="section-header">
            <h2>Ils nous font confiance</h2>
          </div>

          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{stats.signatures.toLocaleString()}+</div>
              <div className="stat-label">Factures électroniques</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.clientsSaaS}+</div>
              <div className="stat-label">Clients SaaS</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.clientsGov}+</div>
              <div className="stat-label">Clients eGov et grands comptes</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.countries}</div>
              <div className="stat-label">Pays</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-content">
            <div className="footer-brand">
              <Link to="/" className="logo">
                {/* ✅ Logo + Text في الفوتر */}
                <img src={logo} alt="Medica-Sign" className="home-logo-img" />
                <span>FacturationTTN</span>
              </Link>
              <p>Plateforme de facturation électronique conforme TTN, sécurisée et moderne.</p>
            </div>

            <div className="footer-links">
              <Link to="/produits">Produits</Link>
              <a href="#services">Services</a>
              <a href="#tarifs">Tarifs</a>
              <a href="#apropos">À propos</a>
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

export default Home;
