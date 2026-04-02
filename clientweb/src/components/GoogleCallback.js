import { useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";

const GoogleCallback = () => {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/auth/me", {
          withCredentials: true,
        });
        setUser(res.data);
        navigate("/dashboard", { replace: true });
      } catch (err) {
        navigate("/login", { replace: true });
      }
    };

    fetchUser();
  }, [navigate, setUser]);

  return <p style={{ textAlign: "center" }}>Connexion Google...</p>;
};

export default GoogleCallback;
