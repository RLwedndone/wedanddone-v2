// src/components/NewYumBuild/YumIntro.tsx
import React from "react";

interface YumIntroProps {
  onCateringNext: () => void;
  onDessertNext: () => void;
  onClose: () => void;
}

const YumIntro: React.FC<YumIntroProps> = ({
  onCateringNext,
  onDessertNext,
  onClose,
}) => {
  return (
    <div className="pixie-card">
      {/* Pink X */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/yumyumtitle.png`}
          alt="Yum Yum Title"
          style={{ width: "100%", maxWidth: 225, margin: "0 auto 1rem", display: "block" }}
        />

        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_intro_loop2.mp4`}
          autoPlay
          muted
          playsInline
          loop
          style={{
            width: "100%",
            maxWidth: 312,
            height: "auto",
            borderRadius: 12,
            margin: "0 auto 2rem",
            display: "block",
          }}
        />

        {/* Narrow readable body */}
        <div className="px-prose-narrow" style={{ margin: "0 auto 1.5rem" }}>
          <p>
            You’re about to explore some delicious catering options! If you haven’t picked your venue yet,
            you’ll start by building your menu with <strong>Wed&Done’s Culinary Team</strong> — our flexible,
            fully customizable menu that works with most venues.
          </p>
          <p>
            🎉 <strong>Already have a venue?</strong> You can still book your catering <em>right now</em> —
            as long as your venue allows outside catering.
          </p>
          <p>
            🏰 If you're planning to book your venue here with Wed&Done, <em>do that first</em>. Once your
            venue is confirmed, your options in the YumYum Menu will automatically update.
          </p>
          <p>
            🍰 <strong>Just looking to book desserts?</strong> Tap the pink button below!
          </p>
        </div>

        {/* CTA column */}
        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button
            className="boutique-primary-btn"
            style={{ width: 250 }}
            onClick={onCateringNext}
          >
            Book Catering
          </button>
          <button
            className="boutique-back-btn"
            style={{ width: 250 }}
            onClick={onDessertNext}
          >
            Book Desserts
          </button>
        </div>
      </div>
    </div>
  );
};

export default YumIntro;