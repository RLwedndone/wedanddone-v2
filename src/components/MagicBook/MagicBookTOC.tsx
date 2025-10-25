// src/components/MagicBook/MagicBookTOC.tsx
import React, { useEffect, useState } from "react";

type MagicStep =
  | "intro"
  | "dwIntro"
  | "dwBasics"
  | "dwStyle"
  | "dwCosts"
  | "budget"
  | "makeItOfficial"
  | "saveTheDate"
  | "timeline"
  | "setTables"
  | "photoVIPIntro"
  | "coupleInfo"
  | "vip"
  | "photoShotIntro"
  | "vip1"
  | "vip2"
  | "photoShotList1"
  | "photoShotList2"
  | "photoShotListCombined"
  | "photoPDF"
  | "toc";

interface Props {
  setStep: (s: MagicStep) => void;
  // resumeMagicBook: () => void; // not currently used
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

const MagicBookTOC: React.FC<Props> = ({ setStep }) => {
  const isMobile = useIsMobile();
  const [showAllPages, setShowAllPages] = useState(false);

  const go = (step: MagicStep) => {
    localStorage.setItem("magicStep", step);
    setStep(step);
  };

  // shared sizing
  const BUTTON_WIDTH_PCT = "72%";
  const BUTTON_MAX_W = 340;

  // title image overlay
  const TITLE_IMG_PATH = `${import.meta.env.BASE_URL}assets/images/TOC_tile.png`;
  const TITLE_HEIGHT = isMobile ? 120 : 160;
  // const TITLE_WIDTH = isMobile ? 220 : 300; // not used

  return (
    <>
      <div
        className="pixie-overlay"
        style={{
          padding: 0,
          overflowY: "auto",
          scrollPaddingTop: isMobile ? 120 : 160,
        }}
      >
        {/* Book background container */}
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 900,
            borderRadius: 24,
            backgroundImage: `url(${import.meta.env.BASE_URL}assets/images/toc.png)`,
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center top",
            padding: isMobile ? "3rem 1rem 2rem" : "4rem 2rem 2rem",
            boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
            margin: "0 auto",
            overflowAnchor: "none" as any,
          }}
        >
          {/* Title art (not interactive) */}
          <img
            src={TITLE_IMG_PATH}
            alt="MBD's Table of Contents"
            style={{
              position: "absolute",
              top: isMobile ? 100 : 70,
              left: "50%",
              transform: "translateX(-50%)",
              width: "45%",
              height: "auto",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />

          {/* Spacer to push content below the title */}
          <div style={{ height: TITLE_HEIGHT }} />

          {/* Content band */}
          <div
            style={{
              marginTop: 80,
              display: "grid",
              gap: isMobile ? 8 : 12,
              justifyItems: "center",
            }}
          >
            {/* Explainer text (match button width) */}
            <div
              style={{
                width: BUTTON_WIDTH_PCT,
                maxWidth: BUTTON_MAX_W,
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, color: "#333", lineHeight: 1.45 }}>
                Pick where you’d like to jump in. You can always come back here.
              </p>
            </div>

            {/* Big path buttons */}
            <img
              src={`${import.meta.env.BASE_URL}assets/images/toc_buttons/detailwrangler_button.png`}
              alt="Detail Wrangler"
              onClick={() => go("dwIntro")}
              style={{
                width: BUTTON_WIDTH_PCT,
                maxWidth: BUTTON_MAX_W,
                cursor: "pointer",
                transition: "transform 0.18s ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "scale(1.03)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "scale(1.0)";
              }}
            />

            <img
              src={`${import.meta.env.BASE_URL}assets/images/toc_buttons/VIPandPhotos.png`}
              alt="VIP’s & Photos"
              onClick={() => go("photoVIPIntro")}
              style={{
                width: BUTTON_WIDTH_PCT,
                maxWidth: BUTTON_MAX_W,
                cursor: "pointer",
                transition: "transform 0.18s ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "scale(1.03)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "scale(1.0)";
              }}
            />
          </div>

          {/* “All Pages” big button */}
          <div
            style={{
              textAlign: "center",
              marginTop: isMobile ? 12 : 10,
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/images/toc_buttons/all_pages.png`}
              alt="All pages (jump anywhere)"
              onClick={() => setShowAllPages(true)}
              style={{
                width: "70%",
                maxWidth: 200,
                cursor: "pointer",
                transition: "transform .2s ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "scale(1.0)";
              }}
            />
          </div>

          <div style={{ height: 8 }} />
        </div>
      </div>

      {/* ===== All Pages Modal (white card) ===== */}
      {showAllPages && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAllPages(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="pixie-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 18,
              width: "92%",
              maxWidth: 560,
              maxHeight: "80vh",
              overflowY: "auto",
              position: "relative",
              padding: "1.25rem 1.25rem 1.5rem",
              boxShadow: "0 12px 24px rgba(0,0,0,0.25)",
              textAlign: "center",
            }}
          >
            {/* Close X */}
            <button
              onClick={() => setShowAllPages(false)}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                background: "none",
                border: "none",
                fontSize: "1.4rem",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ✖
            </button>

            {/* Title */}
            <h2
              style={{
                margin: "6px 0 14px",
                color: "#2c62ba",
                fontSize: "1.6rem",
                fontWeight: 800,
                letterSpacing: "0.2px",
              }}
            >
              Jump Anywhere!
            </h2>

            {/* Detail Wrangler */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                Detail Wrangler
              </div>
              <ul
                style={{
                  listStyle: "disc",
                  paddingLeft: 0,
                  margin: 0,
                  display: "inline-block",
                  textAlign: "left",
                  lineHeight: 1.75,
                }}
              >
                {[
                  ["Intro", "dwIntro"],
                  ["Basics", "dwBasics"],
                  ["Style", "dwStyle"],
                  ["Wedding Costs", "dwCosts"],
                  ["Save The Date", "saveTheDate"],
                  ["Timeline", "timeline"],
                  ["Set Tables", "setTables"],
                ].map(([label, step]) => (
                  <li key={label} style={{ marginBottom: 2 }}>
                    <button
                      onClick={() => {
                        setShowAllPages(false);
                        localStorage.setItem("magicStep", step as MagicStep);
                        setStep(step as MagicStep);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#2c62ba",
                        padding: 0,
                        cursor: "pointer",
                        font: "inherit",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.textDecoration = "underline";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.textDecoration = "none";
                      }}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* VIPs & Photos */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                VIPs & Photos
              </div>
              <ul
                style={{
                  listStyle: "disc",
                  paddingLeft: 0,
                  margin: 0,
                  display: "inline-block",
                  textAlign: "left",
                  lineHeight: 1.75,
                }}
              >
                {[
                  ["Intro", "photoVIPIntro"],
                  ["Couple Info", "coupleInfo"],
                  ["VIP List", "vip"],
                  ["LB1 Shots", "photoShotList1"],
                  ["LB2 Shots", "photoShotList2"],
                  ["Combined Shots", "photoShotListCombined"],
                  ["Export PDF", "photoPDF"],
                ].map(([label, step]) => (
                  <li key={label} style={{ marginBottom: 2 }}>
                    <button
                      onClick={() => {
                        setShowAllPages(false);
                        localStorage.setItem("magicStep", step as MagicStep);
                        setStep(step as MagicStep);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#2c62ba",
                        padding: 0,
                        cursor: "pointer",
                        font: "inherit",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.textDecoration = "underline";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.textDecoration = "none";
                      }}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Back to TOC (purple) */}
            <div>
              <button
                onClick={() => setShowAllPages(false)}
                style={{
                  width: 200,
                  backgroundColor: "#7b4bd8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "0.75rem 1rem",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🪄 Back to TOC
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MagicBookTOC;