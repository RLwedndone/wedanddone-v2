import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

type ServiceStyle = "plated" | "stations";

interface ValleyHoServiceSelectorProps {
  serviceOption: ServiceStyle;                      // current selection (if any)
  onSelect: (option: ServiceStyle) => void;         // fire immediately on click
  onContinue: () => void;                           // proceed to menu builder
  onBack: () => void;
  onClose: () => void;
}

const blue = "#2c62ba";

/* Firestore-safe helpers (prevents `undefined` in subfields) */
const toFirestoreSafe = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

const BLANK_SELECTIONS = toFirestoreSafe({
  hors: [],
  salad: [],
  platedEntrees: [],
  // intentionally omit stationA/stationB keys when empty
  pastaPicks: [],
  riceBases: [],
  riceProteins: [],
  sliderPicks: [],
  tacoPicks: [],
});

const ValleyHoServiceSelector: React.FC<ValleyHoServiceSelectorProps> = ({
  serviceOption,
  onSelect,
  onContinue,
  onBack,
  onClose,
}) => {
  const [selected, setSelected] = useState<ServiceStyle | null>(serviceOption || null);
  const [open, setOpen] = useState<ServiceStyle | null>(serviceOption || null);

  const clearSavedPicks = async (nextService: ServiceStyle) => {
    // Local storage reset (guest count intentionally NOT touched)
    try {
      localStorage.setItem("yumStep", "valleyHoService");
      localStorage.setItem("valleyHoService", nextService);
      localStorage.setItem("valleyHoPerGuest", "0");
      localStorage.setItem("valleyHoMenuSelections", JSON.stringify(BLANK_SELECTIONS));
    } catch {/* ignore */}

    // Firestore snapshot (safe merge)
    const u = getAuth().currentUser;
    if (u) {
      try {
        await setDoc(
          doc(db, "users", u.uid, "yumYumData", "valleyHoMenuSelections"),
          BLANK_SELECTIONS,
          { merge: true }
        );
        await setDoc(
          doc(db, "users", u.uid),
          { progress: { yumYum: { step: "valleyHoService" } } },
          { merge: true }
        );
      } catch {/* ignore */}
    }

    // Optional: let any listeners update
    window.dispatchEvent(new CustomEvent("valleyHoServiceChanged", { detail: { service: nextService } }));
  };

  const handleSelect = async (option: ServiceStyle) => {
    // If flipping services, wipe saved picks first
    if (option !== serviceOption) {
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

  // keep the Tubac image scale for consistency
  const imgStyle: React.CSSProperties = {
    display: "block",
    width: "80%",
    height: "auto",
    borderRadius: 18,
    margin: "0 auto",
  };

  // keep local state synced with parent
  useEffect(() => {
    setSelected(serviceOption);
    setOpen(serviceOption);
  }, [serviceOption]);

  return (
    <div
      className="pixie-card wd-page-turn"
      style={{ maxWidth: 700, textAlign: "center", paddingBottom: 32, paddingTop: 28, margin: "0 auto" }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .vh-stack {
              display: flex;
              flex-direction: column;
              gap: 24px;
              align-items: center;
            }
            .vh-card {
              width: 100%;
              max-width: 380px;
            }
          `,
        }}
      />

      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* Title */}
      <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
        Choose Your Service Style
      </h2>

      <p className="px-prose-narrow" style={{ maxWidth: 560, margin: "0 auto 24px" }}>
        Hotel Valley Ho offers two distinctive experiences. Pick the style that fits your celebration’s vibe—
        we’ll tailor the menu options that follow.
      </p>

      {/* Stacked tiles */}
      <div className="vh-stack">
        {/* ───── Plated ───── */}
        <div className="vh-card">
          <div style={titleStyle}>Plated Dinner</div>
          <div
            role="button"
            aria-label="Select Plated Dinner"
            onClick={() => handleSelect("plated")}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSelect("plated")}
            tabIndex={0}
            style={imgWrap(selected === "plated")}
          >
            {/* Reuse Tubac image per your note */}
            <img src={`${import.meta.env.BASE_URL}assets/images/YumYum/Tubac/plated.jpg`} alt="Plated Dinner" style={imgStyle} />
          </div>

          {open === "plated" && (
            <div className="px-prose-narrow" style={{ marginTop: 10 }}>
              A refined, coursed dinner served tableside. Guests choose from your selected entrées.
            </div>
          )}
        </div>

        {/* ───── Reception Stations ───── */}
        <div className="vh-card">
          <div style={titleStyle}>Reception Stations</div>
          <div
            role="button"
            aria-label="Select Reception Stations"
            onClick={() => handleSelect("stations")}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSelect("stations")}
            tabIndex={0}
            style={imgWrap(selected === "stations")}
          >
            {/* Reuse Tubac buffet image as the stations visual */}
            <img src={`${import.meta.env.BASE_URL}assets/images/YumYum/Tubac/buffet.jpg`} alt="Reception Stations" style={imgStyle} />
          </div>

          {open === "stations" && (
            <div className="px-prose-narrow" style={{ marginTop: 10 }}>
              Chef-led stations with interactive service and variety—perfect for mingling and flow.
            </div>
          )}
        </div>
      </div>

      {/* CTAs */}
      <div className="px-cta-col" style={{ marginTop: 26 }}>
        <button
          className="boutique-primary-btn"
          disabled={!selected}
          onClick={onContinue}
          style={{ width: 240, opacity: selected ? 1 : 0.6, cursor: selected ? "pointer" : "not-allowed" }}
        >
          Make My Menu
        </button>
        <button className="boutique-back-btn" onClick={onBack} style={{ width: 240 }}>
          ⬅ Back
        </button>
      </div>
    </div>
  );
};

export default ValleyHoServiceSelector;