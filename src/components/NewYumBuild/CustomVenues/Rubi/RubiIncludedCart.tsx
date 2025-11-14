// src/components/NewYumBuild/CustomVenues/Rubi/RubiIncludedCart.tsx
import React, { useEffect, useMemo } from "react";
import { getAuth } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

import type { RubiBBQSelections } from "./RubiBBQMenuBuilder";
import type { RubiMexSelections } from "./RubiMexMenuBuilder";

type RubiMenuChoice = "bbq" | "mexican";

type SelectionSummary = {
  passedApps?: string[];
  starterSoupSalad?: string[];
  entreesOrMeats?: string[];
  sides?: string[];
  notes?: string;
};

interface Props {
  /** "bbq" | "mexican" */
  menuChoice: RubiMenuChoice;
  /** Raw selections from the builder (BBQ or Mexican union) */
  selections: RubiBBQSelections | RubiMexSelections;
  /** Locked GC (optional; used if you want to show it later) */
  guestCount: number;

  /** Optional override for the card title */
  title?: string;

  /** Nav handlers */
  onBackToMenu: () => void;
  onContinueToContract: () => void;
  onClose: () => void;
}

const jsLine: React.CSSProperties = {
  fontFamily: "'Jenna Sue','JennaSue',cursive",
  fontSize: "2.2rem",
  color: "#2c62ba",
  lineHeight: 1.12,
};

const RubiIncludedCart: React.FC<Props> = ({
  menuChoice,
  selections,
  guestCount,
  title = "Rubi Catering — Review Your Menu",
  onBackToMenu,
  onContinueToContract,
  onClose,
}) => {
  // Normalize BBQ/Mex selections into a single display shape
  const summary: SelectionSummary = useMemo(() => {
    if (menuChoice === "bbq") {
      const s = selections as RubiBBQSelections;
      return {
        passedApps: s.passedApps ?? [],
        starterSoupSalad: s.bbqStartersOrSalads ?? [],
        entreesOrMeats: s.bbqMeats ?? [],
        sides: s.bbqSides ?? [],
        notes: s.notes ?? "",
      };
    } else {
      const s = selections as RubiMexSelections;
      return {
        passedApps: s.mexPassedApps ?? [],
        starterSoupSalad: s.mexStartersOrSoup ?? [],
        entreesOrMeats: s.mexEntrees ?? [],
        sides: s.mexSides ?? [],
        notes: s.notes ?? "",
      };
    }
  }, [menuChoice, selections]);

  // Save lightweight progress so users can return here
  useEffect(() => {
    try {
      localStorage.setItem("yumStep", "rubiIncludedCart");
      localStorage.setItem("rubiMenuChoice", menuChoice);
      localStorage.setItem("rubiIncludedCartSelections", JSON.stringify(summary));
      localStorage.setItem("rubiLockedGuestCount", String(guestCount || 0));
    } catch {}

    const user = getAuth().currentUser;
    if (!user) return;

    (async () => {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          { progress: { yumYum: { step: "rubiIncludedCart" } } },
          { merge: true }
        );
        await setDoc(
          doc(db, "users", user.uid, "yumYumData", "rubiIncludedCart"),
          {
            menuChoice,
            summary,
            guestCount: guestCount || 0,
            savedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {
        /* non-blocking */
      }
    })();
  }, [menuChoice, summary, guestCount]);

  // small helper to print list lines in Jenna Sue and keep commas out
  const PrettyList: React.FC<{ items?: string[] }> = ({ items }) =>
    items && items.length ? (
      <>
        {items.map((t) => (
          <div key={t} style={{ ...jsLine, fontSize: "2rem", marginBottom: 8 }}>
            {t.includes(" — ") ? t.split(" — ")[0] : t}
          </div>
        ))}
      </>
    ) : (
      <div className="px-prose-narrow" style={{ opacity: 0.8 }}>None selected</div>
    );

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        boxSizing: "border-box",
      }}
    >
      <div className="pixie-card pixie-card--modal" style={{ maxWidth: 720, position: "relative" }}>
        {/* 🩷 Pink X close */}
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>

        <div className="pixie-card__body" style={{ textAlign: "center", padding: "2rem 2.5rem" }}>
          {/* Looping cart video for continuity (same as Bates) */}
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/yum_cart.mp4`}
            autoPlay
            loop
            muted
            playsInline
            className="px-media"
            style={{ width: 180, margin: "0 auto 14px", borderRadius: 12, display: "block" }}
          />

          <h2 className="px-title-lg" style={{ marginBottom: 10 }}>{title}</h2>
          <p className="px-prose-narrow" style={{ marginTop: -4, marginBottom: 14 }}>
            Look everything over and confirm. Your Rubi catering is included — no payment due.
          </p>

          {/* Selections grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 16,
              margin: "0 auto 8px",
              maxWidth: 640,
              textAlign: "center",
            }}
          >
            {/* Passed Apps */}
            <section
              style={{ background: "#fff", border: "1px solid #e8e8ef", borderRadius: 12, padding: "14px 16px" }}
            >
              <img
                src={`${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/passed_apps.png`}
                alt="Passed Appetizers"
                className="px-media"
                style={{ width: 220, display: "block", margin: "0 auto 6px" }}
              />
              <PrettyList items={summary.passedApps} />
            </section>

            {/* Starter / Soup / Salad (one total) */}
            <section
              style={{ background: "#fff", border: "1px solid #e8e8ef", borderRadius: 12, padding: "14px 16px" }}
            >
              <img
                src={`${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/starters.png`}
                alt="Starter / Soup / Salad"
                className="px-media"
                style={{ width: 220, display: "block", margin: "0 auto 6px" }}
              />
              <PrettyList items={summary.starterSoupSalad} />
            </section>

            {/* Entrées / Meats */}
            <section
              style={{ background: "#fff", border: "1px solid #e8e8ef", borderRadius: 12, padding: "14px 16px" }}
            >
              <img
                src={`${import.meta.env.BASE_URL}assets/images/YumYum/Entrees.png`}
                alt="Entrées"
                className="px-media"
                style={{ width: 220, display: "block", margin: "0 auto 6px" }}
              />
              <PrettyList items={summary.entreesOrMeats} />
            </section>

            {/* Signature Sides */}
<section
  style={{
    background: "#fff",
    border: "1px solid #e8e8ef",
    borderRadius: 12,
    padding: "14px 16px",
  }}
>
  <img
    src={`${import.meta.env.BASE_URL}assets/images/YumYum/sides.png`}
    alt="Signature Sides"
    className="px-media"
    style={{ width: 220, display: "block", margin: "0 auto 6px" }}
  />
  <PrettyList items={summary.sides} />
</section>
          </div>

          {/* Notes (optional) */}
          {summary.notes && (
            <div
              className="px-prose-narrow"
              style={{
                margin: "6px auto 0",
                maxWidth: 640,
                textAlign: "left",
                background: "#f8f9fd",
                border: "1px solid #e3e7f8",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <strong>Notes:</strong> {summary.notes}
            </div>
          )}

          {/* Barrio bread note */}
          <div style={{ ...jsLine, fontSize: "2rem", marginTop: 14 }}>
            Freshly baked “Barrio Bakery” bread rolls are included.
          </div>

          {/* CTAs */}
          <div className="px-cta-col" style={{ marginTop: 16 }}>
            <button className="boutique-primary-btn" style={{ width: 260 }} onClick={onContinueToContract}>
              Confirm My Menu
            </button>
            <button className="boutique-back-btn" style={{ width: 260 }} onClick={onBackToMenu}>
              ⬅ Back to Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RubiIncludedCart;