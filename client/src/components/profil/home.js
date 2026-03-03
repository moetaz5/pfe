import { Link, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { Navbar, Nav, NavDropdown, Container, Button } from "react-bootstrap";
import "./style/home.css";

const Home = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <p className="loading">Chargement...</p>;
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="home-container">
      {/* Navbar */}
      <Navbar expand="lg" className="custom-navbar" fixed="top" variant="light">
        <Container>
          <Navbar.Brand className="logo">FacturationTTN</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link href="#produits">Produits</Nav.Link>

              <NavDropdown title="Services" id="services-dropdown">
                <NavDropdown.Item href="#signature">Signature électronique</NavDropdown.Item>
                <NavDropdown.Item href="#cachet">Cachet électronique visible</NavDropdown.Item>
              </NavDropdown>

              <Nav.Link href="#tarifs">Tarifs</Nav.Link>
              <Nav.Link href="#blogs">Blogs</Nav.Link>
            </Nav>

            <Link to="/login">
              <Button variant="primary">Se connecter</Button>
            </Link>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* Section principale */}
      <header className="hero">
        <h1>Plateforme de Facturation Électronique</h1>
        <p>Gestion sécurisée des factures conformes TTN</p>
      </header>
    </div>
  );
};

export default Home;
