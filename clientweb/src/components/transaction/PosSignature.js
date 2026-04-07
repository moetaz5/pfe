import React, { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Rnd } from "react-rnd";
import { 
  Maximize, 
  Check, 
  X, 
  QrCode, 
  Type, 
  ChevronLeft, 
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Settings2,
  MousePointer2
} from "lucide-react";

import "../style/posSignature.css";

// Fix for pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const REFERENCE_TEXT_DEFAULT = "Copie de la facture electronique enregistree aupres de TTN sous la reference unique n :";

const PosSignature = ({
  pdfFile = null,
  onSave = null,
  onClose = null,
}) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfPoints, setPdfPoints] = useState({ width: 0, height: 0 });
  const [isReady, setIsReady] = useState(false);

  // zones positions in PDF POINTS (72 dpi)
  const [qrZone, setQrZone] = useState({ x: 400, y: 50, width: 100, height: 100 });
  const [refZone, setRefZone] = useState({ x: 50, y: 750, width: 450, height: 40 });

  const [activeZone, setActiveZone] = useState("qr");

  // Initial responsiveness
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setScale(0.6);
    } else if (window.innerWidth < 600) {
      setScale(0.4);
    }
  }, []);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  function onPageLoadSuccess(page) {
    const { width, height } = page.getViewport({ scale: 1 });
    setPdfPoints({ width, height });
    setIsReady(true);
  }

  const handleSave = () => {
    if (!onSave) return;
    const pdfH = pdfPoints.height || 842;

    const finalQr = {
      configuration: {
        qrPositionX: Math.round(qrZone.x),
        qrPositionY: Math.round(pdfH - qrZone.y - qrZone.height),
        qrPositionP: pageNumber,
        qrWidth: Math.round(qrZone.width),
        qrHeight: Math.round(qrZone.height),
      }
    };

    const finalRef = {
      configuration: {
        labelPositionX: Math.round(refZone.x),
        labelPositionY: Math.round(pdfH - refZone.y - refZone.height),
        labelPositionP: pageNumber,
        labelWidth: Math.round(refZone.width),
        labelHeight: Math.round(refZone.height),
        referenceText: REFERENCE_TEXT_DEFAULT,
      }
    };

    onSave({
      qr_config: finalQr,
      ref_config: finalRef,
    });

    if (onClose) onClose();
  };

  return (
    <div className="pos-signature-main">
      <div className="pos-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <div className="pos-config-badge">
            <Settings2 size={16} />
            <span className="hide-mobile">Éditeur de placement</span>
          </div>
          
          <div className="pos-mode-switcher">
            <button 
              className={`pos-mode-btn qr ${activeZone === "qr" ? "active" : ""}`}
              onClick={() => setActiveZone("qr")}
            >
              <QrCode size={16} /> QR
            </button>
            <button 
              className={`pos-mode-btn ref ${activeZone === "ref" ? "active" : ""}`}
              onClick={() => setActiveZone("ref")}
            >
              <Type size={16} /> Réf
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pos-controls-group">
            <button className="pos-control-btn" onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}><ChevronLeft size={18} /></button>
            <span style={{ fontSize: '12px', fontWeight: '800', minWidth: '60px', textAlign: 'center' }}> {pageNumber} / {numPages || '?'}</span>
            <button className="pos-control-btn" onClick={() => setPageNumber(p => Math.min(numPages || 1, p + 1))} disabled={pageNumber >= numPages}><ChevronRight size={18} /></button>
          </div>
          
          <div className="pos-controls-group">
            <button className="pos-control-btn" onClick={() => setScale(s => Math.max(0.3, s - 0.1))}><ZoomOut size={18} /></button>
            <span style={{ fontSize: '11px', fontWeight: '800', minWidth: '40px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
            <button className="pos-control-btn" onClick={() => setScale(s => Math.min(2.0, s + 0.1))}><ZoomIn size={18} /></button>
          </div>
        </div>
      </div>

      <div className="pos-viewer-canvas-wrapper">
        <div className="pos-pdf-surface">
          <Document file={pdfFile} onLoadSuccess={onDocumentLoadSuccess}>
            <Page 
              pageNumber={pageNumber} 
              scale={scale} 
              onLoadSuccess={onPageLoadSuccess}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
          </Document>

          {isReady && (
            <>
              <Rnd
                size={{ width: qrZone.width * scale, height: qrZone.height * scale }}
                position={{ x: qrZone.x * scale, y: qrZone.y * scale }}
                onDragStop={(e, d) => setQrZone({ ...qrZone, x: d.x / scale, y: d.y / scale })}
                onResizeStop={(e, direction, ref, delta, position) => {
                  setQrZone({
                    width: ref.offsetWidth / scale,
                    height: ref.offsetHeight / scale,
                    x: position.x / scale,
                    y: position.y / scale
                  });
                }}
                bounds="parent"
                className="rnd-zone qr"
                activeClassName="active"
                onClick={() => setActiveZone("qr")}
              >
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={Math.min(qrZone.width * scale, qrZone.height * scale) * 0.4} color="var(--ps-primary)" opacity={0.6} />
                  {activeZone === 'qr' && (
                    <div className="pos-zone-label">Placement QR</div>
                  )}
                </div>
              </Rnd>

              <Rnd
                size={{ width: refZone.width * scale, height: refZone.height * scale }}
                position={{ x: refZone.x * scale, y: refZone.y * scale }}
                onDragStop={(e, d) => setRefZone({ ...refZone, x: d.x / scale, y: d.y / scale })}
                onResizeStop={(e, direction, ref, delta, position) => {
                  setRefZone({
                    width: ref.offsetWidth / scale,
                    height: ref.offsetHeight / scale,
                    x: position.x / scale,
                    y: position.y / scale
                  });
                }}
                bounds="parent"
                className="rnd-zone ref"
                activeClassName="active"
                onClick={() => setActiveZone("ref")}
              >
                <div style={{ padding: '6px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ fontSize: Math.max(5, 7 * scale) + 'px', color: 'var(--ps-secondary)', lineHeight: '1.2', fontWeight: 600 }}>
                    {REFERENCE_TEXT_DEFAULT} [REFERENCE]
                  </div>
                  {activeZone === 'ref' && (
                    <div className="pos-zone-label ref">Zone Texte TTN</div>
                  )}
                </div>
              </Rnd>
            </>
          )}
        </div>
      </div>

      <div className="pos-footer">
        <div className="hide-tablet" style={{ color: 'var(--ps-text-muted)', fontSize: '12px', flex: 1 }}>
           <p style={{ margin: 0 }}>Faites glisser et redimensionnez les zones. <br/>Précision PostScript préservée.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', width: window.innerWidth < 1024 ? '100%' : 'auto' }}>
          <button className="psig-btn ghost" onClick={onClose} style={{ flex: 1 }}>
            Annuler
          </button>
          <button className="psig-btn primary" onClick={handleSave} style={{ flex: 2 }}>
            <Check size={18} /> Enregistrer positions
          </button>
        </div>
      </div>
    </div>
  );
};

export default PosSignature;
