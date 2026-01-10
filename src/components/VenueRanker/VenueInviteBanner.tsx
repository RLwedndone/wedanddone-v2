// src/components/VenueRanker/VenueInviteBanner.tsx
import React from "react";

const LS_INVITE_VENUE_KEY = "wd_inviteVenueSlug";

interface VenueInviteBannerProps {
  onClick: () => void;              // should setCurrentScreen("inviteIntro")
  forceShow?: boolean;              // optional (default false)
  invitedVenueSlug?: string;        // optional override
}

const VenueInviteBanner: React.FC<VenueInviteBannerProps> = ({
  onClick,
  forceShow,
  invitedVenueSlug,
}) => {
  let invitedSlugLS = "";

  try {
    invitedSlugLS = localStorage.getItem(LS_INVITE_VENUE_KEY) || "";
  } catch {}

  const invitedSlug = invitedVenueSlug || invitedSlugLS;

  if (!forceShow && !invitedSlug) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open venue invite"
      title="Open venue invite"
      style={{
        appearance: "none",
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        cursor: "pointer",
        lineHeight: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}assets/images/inviteEnvelope.png`}
        alt="Venue invite available"
        style={{
            width: "clamp(150px, 14vw, 180px)",
          height: "auto",
          display: "block",
          transform: "translateZ(0)",
          transition: "transform 160ms ease, filter 160ms ease",
          filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.18))",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.06)";
          e.currentTarget.style.filter =
            "drop-shadow(0 14px 24px rgba(0,0,0,0.22))";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.filter =
            "drop-shadow(0 10px 18px rgba(0,0,0,0.18))";
        }}
      />
    </button>
  );
};

export default VenueInviteBanner;