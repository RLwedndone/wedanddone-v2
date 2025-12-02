// src/components/jam/JamThankYouInitial.tsx
import React, { useEffect } from "react";
import playMagicSound from "../../utils/playMagicSound";

interface JamThankYouInitialProps {
  onClose: () => void;
  /** true when they only bought the Groove Guide PDF */
  isPdfOnly?: boolean;
}

const JamThankYouInitial: React.FC<JamThankYouInitialProps> = ({
  onClose,
  isPdfOnly = false,
}) => {
  useEffect(() => {
    playMagicSound();

    // Only fire the "Jam booked" events when the DJ is actually booked
    if (!isPdfOnly) {
      window.dispatchEvent(new Event("userPurchaseMade"));
      window.dispatchEvent(new Event("jamGrooveCompletedNow"));
      console.log("🎧 Jam & Groove booking complete — events dispatched!");
    } else {
      console.log("📄 Groove Guide PDF purchased — no DJ booking events fired.");
    }
  }, [isPdfOnly]);

  const heading = isPdfOnly
    ? "Your Groove Guide PDF is ready! 🎧"
    : "Your DJ is officially booked! 🎶";

  const body = isPdfOnly ? (
    <>
      You’ll find your <strong>Groove Guide PDF</strong> in your{" "}
      <strong>Docs</strong>. Use it to keep your DJ (whoever you choose!) on
      the same musical page. If you decide later you’d like Wed&amp;Done to
      handle the DJ too, just hop back into the Jam &amp; Groove guide and add
      the DJ package to your cart.
    </>
  ) : (
    <>
      You’ll find the receipt in your <strong>Docs</strong>. Way to go! Another
      wedding vendor booked and another big checkmark on the ol&apos; to-do
      list.
    </>
  );

  return (
    <div
      className="pixie-overlay"
      style={{ zIndex: 2000 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="pixie-card pixie-card--modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pink X */}
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>

        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/frog_thanks.mp4`}
            autoPlay
            loop
            muted
            playsInline
            className="px-media"
            style={{
              maxWidth: 160,
              borderRadius: 16,
              margin: "0 auto 12px",
              display: "block",
            }}
          />

          <h2 className="px-title" style={{ marginBottom: 8 }}>
            {heading}
          </h2>

          <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
            {body}
          </p>

          <button
            className="boutique-primary-btn"
            onClick={onClose}
            style={{ display: "block", margin: "0 auto" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default JamThankYouInitial;