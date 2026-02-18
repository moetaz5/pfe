import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import "../style/posSignature.css";

const PosSignature = ({
  // ✅ NEW props (optional)
  pdfFile = null,          // File object (PDF) from CreateTransaction
  embeddedMode = false,    // when true: save to parent, not API
  onSave = null,           // function({ qr_config, ref_config })
  onClose = null,          // function()
}) => {
  const API_URL = "http://localhost:5000";
  const MIN_SIZE = 24;
  const DEFAULT_QR_WIDTH = 120;
  const DEFAULT_QR_HEIGHT = 120;
  const DEFAULT_REF_WIDTH = 360;
  const DEFAULT_REF_HEIGHT = 56;
  const REFERENCE_TEXT =
    "Copie de la facture electronique enregistree aupres de TTN sous la reference unique n";
  const REFERENCE_SAMPLE = "000000000000000000000000000";
  const sheetRef = useRef(null);

  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [step, setStep] = useState("qr");
  const [qrZone, setQrZone] = useState(null);
  const [refZone, setRefZone] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function pointFromEvent(event) {
    if (!sheetRef.current) return null;
    const bounds = sheetRef.current.getBoundingClientRect();
    return {
      x: clamp(Math.round(event.clientX - bounds.left), 0, Math.round(bounds.width)),
      y: clamp(Math.round(event.clientY - bounds.top), 0, Math.round(bounds.height)),
    };
  }

  function rectFromPoints(start, end) {
    return {
      x: Math.round(Math.min(start.x, end.x)),
      y: Math.round(Math.min(start.y, end.y)),
      width: Math.round(Math.abs(end.x - start.x)),
      height: Math.round(Math.abs(end.y - start.y)),
      page: 1,
      unit: "px",
    };
  }

  function parseStoredRect(raw, type) {
    if (!raw) return null;

    let value = raw;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch (e) {
        return null;
      }
    }

    if (!value || typeof value !== "object") return null;

    if (value.configuration && typeof value.configuration === "object") {
      const c = value.configuration;
      if (type === "qr") {
        const x = Number(c.qrPositionX);
        const y = Number(c.qrPositionY);
        const page = Number(c.qrPositionP || 1);
        const width = Number(c.qrWidth || DEFAULT_QR_WIDTH);
        const height = Number(c.qrHeight || DEFAULT_QR_HEIGHT);

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(page)) return null;
        return {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.max(MIN_SIZE, Math.round(width)),
          height: Math.max(MIN_SIZE, Math.round(height)),
          page: Math.max(1, Math.floor(page)),
          unit: "px",
        };
      }

      const x = Number(c.labelPositionX);
      const y = Number(c.labelPositionY);
      const page = Number(c.labelPositionP || 1);
      const width = Number(c.labelWidth || DEFAULT_REF_WIDTH);
      const height = Number(c.labelHeight || DEFAULT_REF_HEIGHT);

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(page)) return null;
      return {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.max(MIN_SIZE, Math.round(width)),
        height: Math.max(MIN_SIZE, Math.round(height)),
        page: Math.max(1, Math.floor(page)),
        unit: "px",
      };
    }

    const page = Number(value.page || 1);
    const x = Number(value.x);
    const y = Number(value.y);
    const width = Number(value.width || (type === "qr" ? DEFAULT_QR_WIDTH : DEFAULT_REF_WIDTH));
    const height = Number(value.height || (type === "qr" ? DEFAULT_QR_HEIGHT : DEFAULT_REF_HEIGHT));

    if (
      !Number.isFinite(page) ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    ) {
      return null;
    }

    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.max(MIN_SIZE, Math.round(width)),
      height: Math.max(MIN_SIZE, Math.round(height)),
      page: Math.max(1, Math.floor(page)),
      unit: "px",
    };
  }

  function toQrPayload(rect) {
    if (!rect) return null;
    return {
      configuration: {
        qrPositionX: rect.x,
        qrPositionY: rect.y,
        qrPositionP: rect.page || 1,
        qrWidth: rect.width,
        qrHeight: rect.height,
      },
    };
  }

  function toRefPayload(rect) {
    if (!rect) return null;
    return {
      configuration: {
        labelPositionX: rect.x,
        labelPositionY: rect.y,
        labelPositionP: rect.page || 1,
        labelWidth: rect.width,
        labelHeight: rect.height,
        referenceText: REFERENCE_TEXT,
      },
    };
  }

  // ✅ NEW: If embedded + pdfFile provided -> auto load PDF
  useEffect(() => {
    if (!pdfFile) return;

    try {
      const url = URL.createObjectURL(pdfFile);
      setPdfUrl(url);
      setPdfName(pdfFile.name || "document.pdf");
      setMessage({
        type: "success",
        text:
          step === "qr"
            ? "PDF charge depuis CreateTransaction. Etape 1: selectionnez la zone QR."
            : "PDF charge depuis CreateTransaction. Etape 2: selectionnez la zone de reference.",
      });
    } catch (e) {
      setMessage({ type: "error", text: "Impossible de charger le PDF fourni." });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfFile]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [qrRes, refRes] = await Promise.allSettled([
        axios.get(`${API_URL}/api/auth/position`, { withCredentials: true }),
        axios.get(`${API_URL}/api/auth/posref`, { withCredentials: true }),
      ]);
      const qrFailed = qrRes.status !== "fulfilled";

      if (!qrFailed) {
        setQrZone(parseStoredRect(qrRes.value?.data?.position, "qr"));
      } else {
        setMessage({
          type: "error",
          text:
            qrRes.reason?.response?.data?.message ||
            "Erreur chargement position QR.",
        });
      }

      if (refRes.status === "fulfilled") {
        setRefZone(parseStoredRect(refRes.value?.data?.posref, "ref"));
      } else if (!qrFailed) {
        setMessage({
          type: "info",
          text:
            refRes.reason?.response?.data?.message ||
            "API posref non disponible pour le moment.",
        });
      }

      setLoading(false);
    };

    load();
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const onChoosePdf = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isPdf =
      String(file.type || "").toLowerCase() === "application/pdf" ||
      /\.pdf$/i.test(file.name || "");
    if (!isPdf) {
      setMessage({ type: "error", text: "Veuillez importer un fichier PDF." });
      return;
    }

    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(URL.createObjectURL(file));
    setPdfName(file.name || "document.pdf");
    setMessage({
      type: "success",
      text:
        step === "qr"
          ? "PDF charge. Etape 1: selectionnez la zone QR."
          : "PDF charge. Etape 2: selectionnez la zone de reference.",
    });
  };

  const onMouseDown = (event) => {
    if (!pdfUrl) {
      setMessage({ type: "error", text: "Importez un PDF avant de selectionner." });
      return;
    }
    const start = pointFromEvent(event);
    if (!start) return;
    setDraft({ start, end: start, type: step });
  };

  const onMouseMove = (event) => {
    if (!draft?.start) return;
    const end = pointFromEvent(event);
    if (!end) return;
    setDraft((prev) => (prev ? { ...prev, end } : prev));
  };

  const onMouseUp = (event) => {
    if (!draft?.start) return;
    const end = pointFromEvent(event) || draft.end || draft.start;
    const rect = rectFromPoints(draft.start, end);
    const captureType = draft.type || step;
    setDraft(null);

    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
      setMessage({
        type: "error",
        text: "Zone trop petite. Selectionnez une zone plus grande.",
      });
      return;
    }

    if (captureType === "qr") {
      setQrZone(rect);
      setMessage({
        type: "success",
        text: "Zone QR selectionnee. Cliquez sur Envoyer QR.",
      });
      return;
    }

    setRefZone(rect);
    setMessage({
      type: "success",
      text: "Zone reference selectionnee. Cliquez sur Envoyer reference.",
    });
  };

  const onResetStep = () => {
    setDraft(null);
    if (step === "qr") {
      setQrZone(null);
    } else {
      setRefZone(null);
    }
    setMessage({ type: "", text: "" });
  };

  // ✅ OLD behavior: save QR to API
  const onSaveQr = async () => {
    const payload = toQrPayload(qrZone);
    if (!payload) {
      setMessage({ type: "error", text: "Selectionnez la zone QR avant envoi." });
      return;
    }

    try {
      setSavingType("qr");
      await axios.put(`${API_URL}/api/auth/position`, payload, {
        withCredentials: true,
      });
      setStep("ref");
      setMessage({
        type: "success",
        text: "Etape 1 validee. Passez a l'etape 2 pour la zone reference.",
      });
    } catch (e) {
      setMessage({
        type: "error",
        text: e?.response?.data?.message || "Erreur enregistrement zone QR.",
      });
    } finally {
      setSavingType("");
    }
  };

  // ✅ OLD behavior: save REF to API
  const onSaveRef = async () => {
    const payload = toRefPayload(refZone);
    if (!payload) {
      setMessage({
        type: "error",
        text: "Selectionnez la zone reference avant envoi.",
      });
      return;
    }

    try {
      setSavingType("ref");
      await axios.put(`${API_URL}/api/auth/posref`, payload, {
        withCredentials: true,
      });
      setMessage({
        type: "success",
        text: "Etape 2 validee. Les deux positions sont enregistrees.",
      });
    } catch (e) {
      setMessage({
        type: "error",
        text:
          e?.response?.data?.message ||
          "Erreur enregistrement zone reference.",
      });
    } finally {
      setSavingType("");
    }
  };

  // ✅ NEW behavior: save both configs to parent (modal mode)
  const onSaveEmbeddedAll = () => {
    const qrPayload = toQrPayload(qrZone);
    const refPayload = toRefPayload(refZone);

    if (!qrPayload || !refPayload) {
      setMessage({ type: "error", text: "Veuillez définir les 2 zones (QR + Référence)." });
      return;
    }

    try {
      if (typeof onSave === "function") {
        onSave({
          qr_config: qrPayload,
          ref_config: refPayload,
        });
      }

      setMessage({ type: "success", text: "Positions enregistrées (transaction)." });

      if (typeof onClose === "function") {
        onClose();
      }
    } catch (e) {
      setMessage({ type: "error", text: "Erreur lors de l'enregistrement local." });
    }
  };

  const draftRect =
    draft?.start && draft?.end ? rectFromPoints(draft.start, draft.end) : null;
  const viewerUrl = pdfUrl
    ? `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&view=FitH`
    : "";

  return (
    <div className="possig-scope">
      <div className="possig-page">
        <header className="possig-head">
          <h2>Position signature TTN</h2>
          <p>
            Etape 1: choisir et envoyer la zone QR. Etape 2: choisir et envoyer
            la zone reference.
          </p>
        </header>

        <section className="possig-card">
          <div className="possig-tools">
            {/* ✅ Keep original choose PDF (only show when not embedded pdfFile) */}
            {!pdfFile ? (
              <label className="possig-file-btn">
                Choisir un PDF
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={onChoosePdf}
                />
              </label>
            ) : (
              <div
                className="possig-file-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "#eef2ff",
                  border: "1px solid #c7d2fe",
                  fontWeight: 800,
                }}
              >
                PDF depuis transaction
              </div>
            )}

            <span className="possig-file-name">
              {pdfName || "Aucun fichier selectionne"}
            </span>
            <span className={`possig-pill ${qrZone ? "ok" : ""}`}>
              QR: {qrZone ? "Pret" : "Non defini"}
            </span>
            <span className={`possig-pill ${refZone ? "ok" : ""}`}>
              Reference: {refZone ? "Pret" : "Non definie"}
            </span>
          </div>

          <div className="possig-stepper">
            <button
              type="button"
              className={`possig-step-btn ${step === "qr" ? "active" : ""}`}
              onClick={() => setStep("qr")}
            >
              <span>1</span>
              Zone QR
            </button>
            <button
              type="button"
              className={`possig-step-btn ${step === "ref" ? "active" : ""}`}
              onClick={() => setStep("ref")}
            >
              <span>2</span>
              Zone reference
            </button>
          </div>

          <div className="possig-instruction">
            {step === "qr"
              ? "Tracez la zone du QR sur la feuille, puis cliquez sur Envoyer QR."
              : "Tracez la zone du paragraphe de reference, puis cliquez sur Envoyer reference."}
          </div>

          <div className="possig-sheet-wrap">
            <div className="possig-sheet" ref={sheetRef}>
              {viewerUrl ? (
                <iframe
                  title="Apercu PDF"
                  src={viewerUrl}
                  className="possig-pdf-frame"
                />
              ) : (
                <div className="possig-empty">
                  <strong>Apercu PDF</strong>
                  <span>Importez un fichier PDF pour commencer.</span>
                </div>
              )}

              <div
                className="possig-capture"
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={() => setDraft(null)}
              >
                {draftRect && (
                  <div
                    className={`possig-zone possig-zone-draft ${draft?.type === "ref" ? "ref" : "qr"}`}
                    style={{
                      left: `${draftRect.x}px`,
                      top: `${draftRect.y}px`,
                      width: `${draftRect.width}px`,
                      height: `${draftRect.height}px`,
                    }}
                  />
                )}

                {qrZone && (
                  <div
                    className="possig-zone qr"
                    style={{
                      left: `${qrZone.x}px`,
                      top: `${qrZone.y}px`,
                      width: `${qrZone.width}px`,
                      height: `${qrZone.height}px`,
                    }}
                  >
                    <span className="possig-zone-label">Zone QR</span>
                  </div>
                )}

                {refZone && (
                  <div
                    className="possig-zone ref"
                    style={{
                      left: `${refZone.x}px`,
                      top: `${refZone.y}px`,
                      width: `${refZone.width}px`,
                      height: `${refZone.height}px`,
                    }}
                  >
                    <span className="possig-zone-label">Zone reference</span>
                    <div className="possig-reference">
                      <p>{REFERENCE_TEXT}</p>
                      <strong>{REFERENCE_SAMPLE}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="possig-bottom">
            <div className="possig-meta">
              {loading ? (
                <span>Chargement...</span>
              ) : (
                <>
                  <span>qrPositionX: {qrZone?.x ?? "-"}</span>
                  <span>qrPositionY: {qrZone?.y ?? "-"}</span>
                  <span>qrPositionP: {qrZone?.page ?? "-"}</span>
                  <span>labelPositionX: {refZone?.x ?? "-"}</span>
                  <span>labelPositionY: {refZone?.y ?? "-"}</span>
                  <span>labelPositionP: {refZone?.page ?? "-"}</span>
                </>
              )}
            </div>

            <div className="possig-actions">
              <button
                type="button"
                className="possig-btn ghost"
                onClick={onResetStep}
                disabled={savingType !== ""}
              >
                Reinitialiser etape
              </button>

              {/* ✅ Embedded mode: single "Enregistrer" button */}
              {embeddedMode ? (
                <button
                  type="button"
                  className="possig-btn primary"
                  onClick={onSaveEmbeddedAll}
                  disabled={!qrZone || !refZone}
                >
                  Enregistrer
                </button>
              ) : (
                <>
                  {step === "qr" ? (
                    <button
                      type="button"
                      className="possig-btn primary"
                      onClick={onSaveQr}
                      disabled={savingType !== "" || !qrZone}
                    >
                      {savingType === "qr" ? "Envoi QR..." : "Envoyer QR"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="possig-btn primary"
                      onClick={onSaveRef}
                      disabled={savingType !== "" || !refZone}
                    >
                      {savingType === "ref" ? "Envoi reference..." : "Envoyer reference"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {message.text && (
            <p className={`possig-alert ${message.type || "info"}`}>
              {message.text}
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

export default PosSignature;
