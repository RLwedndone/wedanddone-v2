import React from "react";

interface YumReturnBothBookedProps {
  onClose: () => void;
}

const YumReturnBothBooked: React.FC<YumReturnBothBookedProps> = ({ onClose }) => {
  return (
    // ⛔️ No overlay here — parent handles backdrop
    <div className="pixie-card pixie-card--modal" style={{ ["--pixie-card-w" as any]: "680px" }}>
      {/* 🩷 Pink X close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* Hide scrollbar but keep scrollability */}
      <style>
        {`
          .pixie-card__body {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .pixie-card__body::-webkit-scrollbar { display: none; }
        `}
      </style>

      <div className="pixie-card__body" style={{ textAlign: "center", maxHeight: "72vh", overflowY: "auto" }}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_cart.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ maxWidth: 200, margin: "0 auto 14px", borderRadius: 12 }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          You’re all booked!
        </h2>

        <p className="px-prose-narrow" style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>
          You’ve booked <strong>both catering and desserts</strong> 🎉
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: "0.5rem" }}>
          Your receipts and contracts are saved under <em>Documents</em> in your menu bar.
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
          Guest count changes happen at the <strong>45-day</strong> mark via the <em>Guest Count Scroll</em>.
        </p>
      </div>
    </div>
  );
};

export default YumReturnBothBooked;