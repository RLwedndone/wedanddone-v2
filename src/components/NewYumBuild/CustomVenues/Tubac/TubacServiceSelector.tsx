// src/components/NewYumBuild/CustomVenues/Tubac/TubacServiceSelector.tsx
import React, { useEffect, useState } from "react";

interface TubacServiceSelectorProps {
  serviceOption: "plated" | "buffet";
  onSelect: (option: "plated" | "buffet") => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

const blue = "#2c62ba";

const TubacServiceSelector: React.FC<TubacServiceSelectorProps> = ({
  serviceOption,
  onSelect,
  onContinue,
  onBack,
  onClose,
}) => {
  const [selected, setSelected] = useState<"plated" | "buffet" | null>(serviceOption || null);
  const [open, setOpen] = useState<"plated" | "buffet" | null>(serviceOption || null);

  const handleSelect = (option: "plated" | "buffet") => {
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
    padding: 10, // gives subtle framing
  });

  // ⬇️ reduce overall image width by ~20%
  const imgStyle: React.CSSProperties = {
    display: "block",
    width: "80%",        // was 100%
    height: "auto",
    borderRadius: 18,
    margin: "0 auto",    // centers smaller image
  };

  // keep local state synced with parent prop
  useEffect(() => {
    setSelected(serviceOption);
    setOpen(serviceOption);
  }, [serviceOption]);

  return (
    <div
      className="pixie-card"
      style={{
        maxWidth: 700,
        textAlign: "center",
        paddingBottom: 32,
        paddingTop: 28,
        margin: "0 auto",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .tubac-stack {
              display: flex;
              flex-direction: column;
              gap: 24px;
              align-items: center;
            }
            .tubac-card {
              width: 100%;
              max-width: 380px; /* was 420px – scale down for balance */
            }
          `,
        }}
      />

      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* 💙 Title */}
      <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
        Choose Your Service Style
      </h2>

      <p className="px-prose-narrow" style={{ maxWidth: 560, margin: "0 auto 24px" }}>
        Tubac Golf Resort offers two elegant dining experiences. Select what best fits
        the flow of your celebration.
      </p>

      {/* 🔽 Stacked tiles */}
      <div className="tubac-stack">
        {/* ───── Plated ───── */}
        <div className="tubac-card">
          <div style={titleStyle}>Two-Course Plated Dinner</div>
          <div
            role="button"
            aria-label="Select Two-Course Plated Dinner"
            onClick={() => handleSelect("plated")}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSelect("plated")}
            tabIndex={0}
            style={imgWrap(selected === "plated")}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/images/YumYum/Tubac/plated.jpg`}
              alt="Two-Course Plated Dinner"
              style={imgStyle}
            />
          </div>

          {open === "plated" && (
            <div className="px-prose-narrow" style={{ marginTop: 10 }}>
              A refined dining experience with tableside service, featuring chef-plated
              decadent meals delivered fresh to each guest.
            </div>
          )}
        </div>

        {/* ───── Buffet ───── */}
        <div className="tubac-card">
          <div style={titleStyle}>Buffet Dinner</div>
          <div
            role="button"
            aria-label="Select Buffet Dinner"
            onClick={() => handleSelect("buffet")}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSelect("buffet")}
            tabIndex={0}
            style={imgWrap(selected === "buffet")}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/images/YumYum/Tubac/buffet.jpg`}
              alt="Buffet Dinner"
              style={imgStyle}
            />
          </div>

          {open === "buffet" && (
            <div className="px-prose-narrow" style={{ marginTop: 10 }}>
              A relaxed yet elegant presentation of chef-selected mains and sides,
              allowing guests to sample and enjoy a variety of flavors at their leisure.
            </div>
          )}
        </div>
      </div>

      {/* 💙 CTAs */}
      <div className="px-cta-col" style={{ marginTop: 26 }}>
        <button
          className="boutique-primary-btn"
          disabled={!selected}
          onClick={onContinue}
          style={{
            width: 240,
            opacity: selected ? 1 : 0.6,
            cursor: selected ? "pointer" : "not-allowed",
          }}
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

export default TubacServiceSelector;