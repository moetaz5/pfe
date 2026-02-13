import { useEffect, useState } from "react";

const TokenAPI = () => {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("http://localhost:5000/api/my-api-token", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setToken(data.apiToken));
  }, []);

  const generateToken = async () => {
    setLoading(true);
    const res = await fetch(
      "http://localhost:5000/api/generate-api-token",
      {
        method: "POST",
        credentials: "include",
      }
    );

    const data = await res.json();
    setToken(data.apiToken);
    setLoading(false);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    alert("Token copié !");
  };

  return (
    <div style={{ padding: 30 }}>
      <h2>Token API</h2>

      {token ? (
        <>
          <textarea
            value={token}
            readOnly
            style={{ width: "100%", height: 80 }}
          />
          <br />
          <button onClick={copyToken}>Copier</button>
        </>
      ) : (
        <p>Aucun token généré</p>
      )}

      <br />
      <br />

      <button onClick={generateToken} disabled={loading}>
        {loading ? "Génération..." : "Générer / Régénérer Token"}
      </button>
    </div>
  );
};

export default TokenAPI;
