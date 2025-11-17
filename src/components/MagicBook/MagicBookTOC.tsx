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
  onClose: () => void;
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

const MagicBookTOC: React.FC<Props> = ({ setStep, onClose }) => {
  const isMobile = useIsMobile();
  const [showAllPages, setShowAllPages] = useState(false);

  const go = (step: MagicStep) => {
    localStorage.setItem("magicStep", step);
    setStep(step);
  };

  return (
    <div className="pixie-card">
      {/* Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      {/* Card Body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        
        {/* Placeholder looping video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: "100%",
            maxWidth: 320,
            borderRadius: "12px",
            margin: "0 auto 1.5rem",
            display: "block",
          }}
        >
          <source
            src={`${import.meta.env.BASE_URL}assets/videos/bookmark.mp4`}
            type="video/mp4"
          />
        </video>

        {/* Title */}
        <h2
          style={{
            fontFamily: "Jenna Sue, cursive",
            color: "#2c62ba",
            fontSize: isMobile ? "2rem" : "2.4rem",
            marginBottom: "0.75rem",
          }}
        >
          Table of Contents
        </h2>

        {/* Subtitle text */}
        <p
          style={{
            color: "#444",
            lineHeight: 1.5,
            maxWidth: 350,
            margin: "0 auto 1.5rem",
            padding: "0 1rem",
          }}
        >
          Pick where you’d like to go next inside your Magical Book of Deets.  
          You can always return here.
        </p>

        {/* Chapter Buttons */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/toc_buttons/detailwrangler_button.png`}
          alt="Detail Wrangler"
          onClick={() => go("dwIntro")}
          style={{
            width: "80%",
            maxWidth: 340,
            cursor: "pointer",
            marginBottom: "1rem",
            transition: "transform 0.18s ease",
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
        />

        <img
          src={`${import.meta.env.BASE_URL}assets/images/toc_buttons/VIPandPhotos.png`}
          alt="VIP’s & Photos"
          onClick={() => go("photoVIPIntro")}
          style={{
            width: "80%",
            maxWidth: 340,
            cursor: "pointer",
            marginBottom: "1.5rem",
            transition: "transform 0.18s ease",
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
        />

        {/* All Pages */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/toc_buttons/all_pages.png`}
          alt="All pages (jump anywhere)"
          onClick={() => setShowAllPages(true)}
          style={{
            width: "60%",
            maxWidth: 200,
            cursor: "pointer",
            transition: "transform 0.18s ease",
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
        />
      </div>

      {/* ===== ALL PAGES MODAL ===== */}
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
              padding: "1.25rem 1.25rem 2rem",
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
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => setShowAllPages(false)}
              className="boutique-primary-btn"
              style={{
                width: 200,
                borderRadius: 8,
                padding: "0.75rem 1rem",
                fontSize: "1.05rem",
                fontWeight: 700,
                cursor: "pointer",
                color: "#fff",
                border: "none",
              }}
            >
              🪄 Back to TOC
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MagicBookTOC;