import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, FileText, CheckCircle, ArrowRight } from "lucide-react";
import heroImage from "./style/hero-signature.png";
import logo from "./assets/logo1.png";
import "./style/home.css";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <div className="home-wrapper">

        {/* HEADER */}
        <header className="home-header">
          <div className="home-brand" onClick={() => navigate("/")}>
            <img src={logo} alt="logo" className="home-logo" />
            <span className="home-brand-name">Medica-Sign</span>
          </div>

          <div className="home-actions">
            <button className="btn ghost" onClick={() => navigate("/login")}>
              Log In
            </button>
            <button className="btn primary" onClick={() => navigate("/register")}>
              Get Started
            </button>
          </div>
        </header>

        {/* HERO */}
        <section className="home-hero">
          <div className="hero-left">
            <h1>
              Secure E- <br />
              Signatures <br />
              <span>Verify with</span> <br />
              <span>Confidence.</span>
            </h1>

            <p>
              Streamline your invoicing process with our TTN-integrated
              electronic signature platform. Secure, compliant and effortless.
            </p>

            <div className="hero-buttons">
              <button
                className="btn primary hero-cta"
                onClick={() => navigate("/register")}
              >
                Start Signing Now <ArrowRight size={16} />
              </button>

              <button
                className="btn hero-secondary"
                onClick={() => navigate("/login")}
              >
                View Documentation
              </button>
            </div>

            <div className="hero-badges">
              <span className="badge-row">
                <CheckCircle size={16} className="ok" />
                TTN Integrated
              </span>
              
            </div>
          </div>

          <div className="hero-right">
            <div className="hero-image-wrap">
              <img src={heroImage} alt="hero" className="hero-image" />
            </div>

            <div className="status-float">
              <div className="status-icon">
                <CheckCircle size={18} className="ok" />
              </div>
              <div className="status-texts">
                <div className="status-label">STATUS</div>
                <div className="status-value">Successfully Verified</div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="home-features">
          <div className="card feature-card">
            <div className="feature-ico"><FileText size={22} /></div>
            <h3>Upload Documents</h3>
            <p>Support for PDF and XML invoice formats with automatic validation.</p>
          </div>

          <div className="card feature-card">
            <div className="feature-ico"><ShieldCheck size={22} /></div>
            <h3>Secure Signing</h3>
            <p>Advanced encryption and TTN platform communication for validity.</p>
          </div>

          <div className="card feature-card">
            <div className="feature-ico"><CheckCircle size={22} /></div>
            <h3>Real-time Tracking</h3>
            <p>Monitor signature status and download completed transaction logs.</p>
          </div>
        </section>

      </div>
    </div>
  );
}
