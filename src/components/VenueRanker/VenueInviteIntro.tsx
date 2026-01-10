// src/components/VenueRanker/VenueInviteIntro.tsx
import React, { useMemo, useState } from "react";
import "../../styles/globals/boutique.master.css";

type VenueOption = { slug: string; label: string };

interface VenueInviteIntroProps {
  onExplore: () => void; // “Explore Wed&Done / Venue Ranker”
  onDirectBook: (venueSlug: string) => void; // Book the invited venue
  venueOptions: VenueOption[]; // provided by overlay (active venues)
  onClose: () => void;

  // Invite context (set by overlay from partner link)
  invitedVenueSlug?: string; // if present, preselect + hide dropdown
  invitedVenueName?: string; // optional display override
  discountLabel?: string; // e.g. "$500 Partner Discount"
}

const VenueInviteIntro: React.FC<VenueInviteIntroProps> = ({
  onExplore,
  onDirectBook,
  venueOptions,
  onClose,
  invitedVenueSlug,
  invitedVenueName,
  discountLabel = "$500 partner discount",
}) => {
  // If we have an invited venue, we should treat it as the selection source of truth.
  const [selectedSlug, setSelectedSlug] = useState<string>(invitedVenueSlug || "");

  const sortedOptions = useMemo(() => {
    const arr = Array.isArray(venueOptions) ? venueOptions.slice() : [];
    arr.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return arr;
  }, [venueOptions]);

  const effectiveSlug = invitedVenueSlug || selectedSlug;

  const selectedLabel = useMemo(() => {
    if (invitedVenueName) return invitedVenueName;
    if (!sortedOptions?.length) return "";
    const hit =
      sortedOptions.find((v) => v.slug === effectiveSlug) ||
      sortedOptions.find((v) => v.slug === invitedVenueSlug) ||
      sortedOptions.find((v) => v.slug === selectedSlug);
    return hit?.label || "";
  }, [invitedVenueName, sortedOptions, effectiveSlug, invitedVenueSlug, selectedSlug]);

  const venueNameForTitle = selectedLabel || invitedVenueSlug || "your venue";
  const canBook = !!effectiveSlug;

  return (
    <div
      className="pixie-card wd-page-turn"
      style={{
        width: "100%",
        maxWidth: 720,
        margin: "0 auto",
        boxSizing: "border-box",
        overflowX: "hidden",
        position: "relative", // ✅ so bottom-left link pins to this card
      }}
    >
      {/* 🩷 Pink X inside the card */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* Scrollable body */}
      <div
        className="pixie-card__body"
        style={{
          textAlign: "center",
          width: "100%",
          boxSizing: "border-box",
          overflowX: "hidden",
          paddingBottom: 60, // ✅ make room so the bottom-left link never overlaps content
        }}
      >
        {/* 🖼️ Title Image */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/venueInviteTitle.png`}
          alt="Venue Invite"
          className="px-media px-media--sm"
          style={{ maxWidth: 200, marginBottom: "1rem" }}
        />

        {/* 🎥 Intro Video */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/venue_intro_loop.mp4`}
          autoPlay
          muted
          playsInline
          loop
          className="px-media"
          style={{
            width: "100%",
            maxWidth: 350,
            borderRadius: 20,
            marginBottom: "1rem",
            display: "block",
            marginInline: "auto",
          }}
        />

        {/* ✨ Invite Copy */}
        <h2 className="px-intro-title" style={{ marginBottom: 8, lineHeight: 1.25 }}>
          <div>Congrats!</div>
          <div>You’ve been invited to book by</div>
          <div style={{ fontWeight: 800 }}>✨ {venueNameForTitle} ✨</div>
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 6 }}>
          This invite includes a <strong>$500 Pixie Booking Bonus</strong>.
        </p>

        <p className="px-prose-narrow" style={{ marginBottom: 20, color: "#222" }}>
          A Pixie Booking Bonus is a Wed&amp;Done credit that’s automatically applied
          when you book through this invite — no codes, no extra steps.
        </p>

        {/* 👉 Single primary CTA (blue) */}
        <div className="px-cta-col" style={{ gap: 10 }}>
          <button
            className="boutique-brightblue-btn" // ✅ primary blue
            onClick={() => {
              if (!canBook) return;
              onDirectBook(effectiveSlug);
            }}
            disabled={!canBook}
            style={{
              opacity: canBook ? 1 : 0.6,
              cursor: canBook ? "pointer" : "not-allowed",
            }}
            type="button"
          >
            Book {selectedLabel || "this venue"}
          </button>

          {/* Optional fallback (only if NOT in invite flow) */}
          {!invitedVenueSlug && (
            <div
              style={{
                marginTop: 10,
                width: "100%",
                maxWidth: 420,
                marginInline: "auto",
              }}
            >
              <label
                htmlFor="directVenueSelect"
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  marginBottom: 6,
                  color: "#333",
                  textAlign: "center",
                }}
              >
                Or pick a venue to book:
              </label>

              <select
                id="directVenueSelect"
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  fontSize: "1rem",
                  background: "#fff",
                  outline: "none",
                }}
              >
                <option value="" disabled>
                  Select a venue…
                </option>

                {sortedOptions.length === 0 ? (
                  <option value="" disabled>
                    Loading venues…
                  </option>
                ) : (
                  sortedOptions.map((v) => (
                    <option key={v.slug} value={v.slug}>
                      {v.label}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Small blue text link in bottom-left */}
      <button
        type="button"
        onClick={onExplore}
        className="linklike"
        style={{
          position: "absolute",
          left: 14,
          bottom: 14,
          fontSize: "0.9rem",
          color: "#2c62ba", // ✅ your primary blue
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Explore Wed&amp;Done
      </button>
    </div>
  );
};

export default VenueInviteIntro;