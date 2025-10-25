// src/components/VenueRanker/VenueThankYou.tsx
import React, { useEffect } from "react";
import playMagicSound from "../../utils/playMagicSound";

type VenueThankYouProps = {
  onClose: () => void;

  // NEW (all optional, backwards-compatible)
  variant?: "postPurchase" | "alreadyBooked";
  titleOverride?: string;
  bodyOverride?: React.ReactNode;
  ctaLabel?: string;
};

const VenueThankYou: React.FC<VenueThankYouProps> = ({
  onClose,
  variant = "postPurchase",
  titleOverride,
  bodyOverride,
  ctaLabel,
}) => {
  // Only play sound & dispatch "purchase" events when this is a fresh purchase
  useEffect(() => {
    if (variant === "postPurchase") {
      playMagicSound();
      window.dispatchEvent(new Event("userPurchaseMade"));
      window.dispatchEvent(new Event("venueCompletedNow"));
      window.dispatchEvent(new Event("purchaseMade")); // 🪄 Needed for Budget Wand
      console.log("🏰 Venue booking complete — events dispatched!");
    }
  }, [variant]);

  const heading =
    titleOverride ||
    (variant === "alreadyBooked"
      ? "You’ve already booked your venue 🎉"
      : "Thank you for booking!");

  const defaultBody =
    variant === "alreadyBooked" ? (
      <>
        <p style={{ fontSize: "1rem", lineHeight: 1.6, marginBottom: "0.85rem" }}>
          Your venue is set and your Pixie Planning Team is included. <br></br><br></br>You're all set here!
        </p>
        <p style={{ fontSize: "1rem", lineHeight: 1.6 }}>
          Guest counts usually shift as RSVPs come in, so you’ll confirm your final guest count{" "} about
          <strong>45 days before your wedding</strong>. In the meantime, feel free to explore the rest of our magical button boutiques to book more vendors and get that wedding checklist DONE!
        </p>
      </>
    ) : (
      <>
        <p style={{ fontSize: "1rem", lineHeight: 1.6 }}>
          You've booked your venue! Woohoo! That's a big ol' check off the to-do list!
        </p>
        <p style={{ fontSize: "1rem", lineHeight: 1.6 }}>
          You’ll find a copy of your contract in the <strong>Docs</strong> folder of your magical dashboard.
        </p>
        <p style={{ fontSize: "1rem", lineHeight: 1.6 }}>
          Check out the rest of our magical button boutiques to book more vendors and get that wedding checklist DONE!
        </p>
      </>
    );

    return (
      <div className="pixie-card pixie-card--modal" role="dialog" aria-modal="true">
        {/* Pink X */}
        <button
          className="pixie-card__close"
          onClick={onClose}
          aria-label="Close"
        >
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>
    
        {/* Body */}
        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/venue_thanks.mp4`}
            autoPlay
            loop
            muted
            playsInline
            className="px-media"
            style={{ maxWidth: 220, margin: "0 auto 12px" }}
          />
    
          <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
            {heading}
          </h2>
    
          <div className="px-prose-narrow" style={{ margin: "0 auto 20px" }}>
            {bodyOverride || defaultBody}
          </div>
    
          <div className="px-cta-col">
            <button className="boutique-primary-btn" onClick={onClose}>
              {ctaLabel || "Close"}
            </button>
          </div>
        </div>
      </div>
    );
};

export default VenueThankYou;