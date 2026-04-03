import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";

export default function SigningRoom() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pin, setPin] = useState("");
  const [pinValid, setPinValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState("");

  const pdfUrl = `/api/public/transactions/${id}/pdf`;

  /* 🔐 vérifier PIN */
  const checkPin = async () => {
    setError("");
    setPinValid(false);

    try {
      const res = await fetch(
        `/api/public/transactions/${id}/check-pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }
      );

      if (!res.ok) throw new Error();
      setPinValid(true);
    } catch {
      setError("❌ PIN incorrect");
    }
  };

  /* ✍️ signer */
  const handleSign = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/public/transactions/${id}/sign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur signature");
      }

      setSigned(true);
    } catch (e) {
      setError("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ================= SUCCESS ================= */
  if (signed) {
    return (
      <div style={{ minHeight: "100vh" }} className="flex flex-col items-center justify-center text-center">
        <h1 style={{ fontSize: 28, marginBottom: 10 }}>✅ Signature réussie</h1>
        <p style={{ color: "#555", marginBottom: 20 }}>
          La signature TunuTrust est réussie ! L'envoi automatique vers la TTN est en cours de traitement.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            padding: "12px 20px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          ← Retour au dashboard
        </button>
      </div>
    );
  }

  /* ================= PAGE SIGNATURE ================= */
  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      {/* PDF */}
      <div style={{ flex: 1, padding: 20, background: "#f4f7fb" }}>
        <iframe
          src={pdfUrl}
          title="PDF"
          style={{ width: "100%", height: "100%", border: "1px solid #ccc" }}
        />
      </div>

      {/* ACTION */}
      <div style={{ width: 360, padding: 20, borderLeft: "1px solid #e5e7eb" }}>
        <h3>Signer le document</h3>

        <input
          type="password"
          placeholder="Entrer votre PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            marginTop: 10,
            borderRadius: 6,
            border: "1px solid #ccc",
          }}
        />

        <button
          onClick={checkPin}
          disabled={!pin}
          style={{
            width: "100%",
            marginTop: 10,
            padding: 10,
            background: "#e5e7eb",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Vérifier PIN
        </button>

        <button
          onClick={handleSign}
          disabled={!pinValid || loading}
          style={{
            width: "100%",
            marginTop: 10,
            padding: 12,
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            opacity: !pinValid ? 0.5 : 1,
          }}
        >
          {loading ? "Signature..." : "Signer"}
        </button>

        {error && (
          <p style={{ color: "red", marginTop: 12 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
