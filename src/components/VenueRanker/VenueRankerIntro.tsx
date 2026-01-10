// src/components/VenueRanker/VenueRankerIntro.tsx
import React, { useMemo, useRef, useState } from "react";
import "../../styles/globals/boutique.master.css";

type VenueOption = { slug: string; label: string };

interface VenueRankerIntroProps {
  onExplore: () => void;
  onDirectBook: (venueSlug: string) => void;
  venueOptions: VenueOption[]; // provided by overlay (active venues)
  onClose: () => void;
}

const VenueRankerIntro: React.FC<VenueRankerIntroProps> = ({
  onExplore,
  onDirectBook,
  venueOptions,
  onClose,
}) => {
  const [showDirectBook, setShowDirectBook] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string>("");

  const sortedOptions = useMemo(() => {
    const arr = Array.isArray(venueOptions) ? venueOptions.slice() : [];
    // keep it predictable + cute: alphabetical by label
    arr.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return arr;
  }, [venueOptions]);

  const canContinueDirect = !!selectedSlug;

  const directBookRef = useRef<HTMLDivElement | null>(null);

const scrollToDirectBook = () => {
  requestAnimationFrame(() => {
    directBookRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
};

  return (
    <div className="pixie-card wd-page-turn">
      {/* 🩷 Pink X inside the card */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      {/* Scrollable body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* 🖼️ Title Image */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/venue_title.png`}
          alt="Venue Ranker"
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
            maxWidth: 350,
            borderRadius: 20,
            marginBottom: "1rem",
            display: "block",
            marginInline: "auto",
          }}
        />

        {/* ✨ Whimsical Copy */}
        <h2 className="px-intro-title" style={{ marginBottom: 8 }}>
          Find the perfect place for your "I do's"!
        </h2>
        <p className="px-prose-narrow" style={{ marginBottom: 6 }}>
          Peek at all the magical venues we partner with across Arizona, or let us help you discover your
          perfect vibe!
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: 20 }}>
          However you explore, your dream venue is just a few clicks away.
        </p>

        {/* 👉 Two-path CTA */}
        <div className="px-cta-col" style={{ gap: 10 }}>
          {/* Path 1: explore (unchanged flow) */}
          <button className="boutique-primary-btn" onClick={onExplore}>
            I’m looking for a venue
          </button>

          {/* Path 2: direct book reveal */}
          <button
  className="boutique-brightblue-btn"
  onClick={() => {
    setShowDirectBook(true);
    scrollToDirectBook(); // if you already have this helper, keep it
  }}
>
  I already know the W&amp;D venue I want to book
</button>

          {showDirectBook && (
  <div
    ref={directBookRef}
    style={{
      marginTop: 10,
      width: "100%",
      maxWidth: 360,
      marginInline: "auto",
      textAlign: "left",
      background: "rgba(255,255,255,0.75)",
      borderRadius: 14,
      padding: "12px 12px 14px",
      boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
    }}
  >
              <p
                className="px-prose-narrow"
                style={{ marginBottom: 8, textAlign: "center" }}
              >
                Pick your venue, then we’ll jump straight into booking ✨
              </p>

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
                Which venue are you booking?
              </label>

              <select
                id="directVenueSelect"
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                style={{
                  width: "100%",
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

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "center",
                  marginTop: 12,
                }}
              >
                <button
                  className="boutique-back-btn"
                  onClick={() => setShowDirectBook(false)}
                  style={{ paddingInline: 14 }}
                >
                  Nevermind
                </button>

                <button
                  className="boutique-primary-btn"
                  onClick={() => {
                    if (!selectedSlug) return;
                    onDirectBook(selectedSlug);
                  }}
                  disabled={!canContinueDirect}
                  style={{
                    opacity: canContinueDirect ? 1 : 0.55,
                    cursor: canContinueDirect ? "pointer" : "not-allowed",
                  }}
                >
                  Continue to Booking
                </button>
              </div>

              <p
                style={{
                  marginTop: 10,
                  fontSize: "0.9rem",
                  color: "#555",
                  textAlign: "center",
                  lineHeight: 1.35,
                }}
              >
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VenueRankerIntro;