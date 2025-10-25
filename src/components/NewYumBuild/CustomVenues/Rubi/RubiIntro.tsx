import React from "react";

interface RubiIntroProps {
  onContinue: () => void;
  onClose?: () => void;
}

const RubiIntro: React.FC<RubiIntroProps> = ({ onContinue, onClose }) => {
  return (
    <div className="pixie-card">
      {/* 🩷 Pink X Close */}
      {onClose && (
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>
      )}

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/yumyumtitle.png`}
          alt="Yum Yum Title"
          className="px-media"
          style={{ width: 225, maxWidth: "80%", margin: "0 auto 12px" }}
        />

        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_intro_loop2.mp4`}
          autoPlay
          muted
          playsInline
          loop
          className="px-media"
          style={{ width: 312, maxWidth: "95%", borderRadius: 12, margin: "0 auto 24px", display: "block" }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Welcome to Rubi House Catering
        </h2>

        <div className="px-prose-narrow" style={{ margin: "0 auto 18px", maxWidth: 520 }}>
          <p>
            ✨ Welcome to your <strong>Rubi House catering journey!</strong>
          </p>
          <p>
            First, you’ll choose a <strong>restaurant menu</strong> — pick from our two delectable options!
          </p>
          <p>
            Next, you’ll build your menu by selecting courses and items within that restaurant (prices vary by choice),
            then review your cart and check out.
          </p>
        </div>

        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button className="boutique-primary-btn" onClick={onContinue}>
            Start My Rubi House Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default RubiIntro;