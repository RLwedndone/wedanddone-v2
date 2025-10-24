// src/components/NewYumBuild/CustomVenues/Rubi/RubiCateringMenuChoice.tsx
import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

export type MenuChoice = "bbq" | "mexican";

interface RubiCateringMenuChoiceProps {
  /** Current selection (if any). Optional for flexibility. */
  menuOption?: MenuChoice | null;
  /** Fire immediately on click */
  onSelect: (option: MenuChoice) => void;
  /** Proceed to tier/menu builder */
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

const blue = "#2c62ba";

/* Firestore-safe helper (drops undefined) */
const toFirestoreSafe = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

/* Blank snapshot for Rubi (we’ll flesh out fields in the builder step) */
const BLANK_SELECTIONS = toFirestoreSafe({
  picks: [] as string[],
  notes: "",
  pricingHint: 0,
});

const RubiCateringMenuChoice: React.FC<RubiCateringMenuChoiceProps> = ({
  menuOption = null,
  onSelect,
  onContinue,
  onBack,
  onClose,
}) => {
  const [selected, setSelected] = useState<MenuChoice | null>(menuOption ?? null);
  const [open, setOpen] = useState<MenuChoice | null>(menuOption ?? null);

  const clearSavedPicks = async (nextChoice: MenuChoice) => {
    try {
      localStorage.setItem("yumStep", "rubiMenuChoice");
      localStorage.setItem("rubiMenuChoice", nextChoice);
      localStorage.setItem("rubiMenuSelections", JSON.stringify(BLANK_SELECTIONS));
      localStorage.removeItem("rubiPerGuest");
    } catch {}

    const u = getAuth().currentUser;
    if (u) {
      try {
        await setDoc(doc(db, "users", u.uid, "yumYumData", "rubiMenuSelections"), BLANK_SELECTIONS, { merge: true });
        await setDoc(
          doc(db, "users", u.uid),
          { progress: { yumYum: { step: "rubiMenuChoice" } } },
          { merge: true }
        );
      } catch {}
    }

    window.dispatchEvent(new CustomEvent("rubiMenuChanged", { detail: { menu: nextChoice } }));
  };

  const handleSelect = async (option: MenuChoice) => {
    if (option !== menuOption) {
      await clearSavedPicks(option);
    }
    setSelected(option);
    setOpen(option);
    onSelect(option);
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: "'Jenna Sue', cursive",
    color: blue,
    fontSize: "2rem",
    lineHeight: 1.1,
    marginBottom: 8,
  };

  const imgWrap = (active: boolean): React.CSSProperties => ({
    borderRadius: 18,
    background: "#fff",
    boxShadow: active ? "0 0 28px 10px rgba(70,140,255,0.60)" : "0 1px 0 rgba(0,0,0,0.03)",
    cursor: "pointer",
    transition: "box-shadow .2s ease, transform .2s ease",
    border: "none",
    padding: 10,
  });

  const imgStyle: React.CSSProperties = {
    display: "block",
    width: "80%",
    height: "auto",
    borderRadius: 18,
    margin: "0 auto",
    objectFit: "cover",
  };

  useEffect(() => {
    setSelected(menuOption ?? null);
    setOpen(menuOption ?? null);
  }, [menuOption]);

  return (
    <div
      className="pixie-card"
      style={{ maxWidth: 700, textAlign: "center", paddingBottom: 32, paddingTop: 28, margin: "0 auto" }}
    >
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .rubi-stack {
              display: flex;
              flex-direction: column;
              gap: 24px;
              align-items: center;
            }
            .rubi-card {
              width: 100%;
              max-width: 380px;
            }
          `,
        }}
      />

      <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
        Choose Your Menu — Brother John’s Catering
      </h2>

      <p className="px-prose-narrow" style={{ maxWidth: 560, margin: "0 auto 24px" }}>
        Pick one of Brother John’s two menu styles.
      </p>

      <div className="rubi-stack">
        {/* BBQ */}
        <div className="rubi-card">
          <div style={titleStyle}>BBQ Menu</div>
          <div
            role="button"
            aria-label="Select BBQ Menu"
            onClick={() => handleSelect("bbq")}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSelect("bbq")}
            tabIndex={0}
            style={imgWrap(selected === "bbq")}
          >
            <img src="/assets/images/YumYum/Rubi/BJsBBQ.jpg" alt="Brother John’s BBQ Menu" style={imgStyle} />
          </div>

          {open === "bbq" && (
            <div className="px-prose-narrow" style={{ marginTop: 10 }}>
              Slow-smoked classics and hearty sides—think brisket, pulled pork, house sausages, cornbread, and more.
            </div>
          )}
        </div>

        {/* Mexican */}
        <div className="rubi-card">
          <div style={titleStyle}>Mexican Menu</div>
          <div
            role="button"
            aria-label="Select Mexican Menu"
            onClick={() => handleSelect("mexican")}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSelect("mexican")}
            tabIndex={0}
            style={imgWrap(selected === "mexican")}
          >
            <img src="/assets/images/YumYum/Rubi/BJsMexican.jpg" alt="Brother John’s Mexican Menu" style={imgStyle} />
          </div>

          {open === "mexican" && (
            <div className="px-prose-narrow" style={{ marginTop: 10 }}>
              Crowd-pleasing favorites—street-style tacos, enchiladas, flavorful sides, salsas, and fresh toppings.
            </div>
          )}
        </div>
      </div>

      <div className="px-cta-col" style={{ marginTop: 26 }}>
        <button
          className="boutique-primary-btn"
          disabled={!selected}
          onClick={onContinue}
          style={{ width: 240, opacity: selected ? 1 : 0.6, cursor: selected ? "pointer" : "not-allowed" }}
        >
          Build My Menu
        </button>
        <button className="boutique-back-btn" onClick={onBack} style={{ width: 240 }}>
          ⬅ Back
        </button>
      </div>
    </div>
  );
};

export default RubiCateringMenuChoice;