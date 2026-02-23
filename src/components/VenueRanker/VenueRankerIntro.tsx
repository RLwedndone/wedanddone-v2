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
    <div
  className="pixie-card wd-page-turn"
  style={{ maxWidth: 640, marginInline: "auto" }}
>
      {/* 🩷 Pink X inside the card */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      {/* Scrollable body */}
      <div
  className="pixie-card__body"
  style={{
    textAlign: "center",
    paddingInline: 20, // ⬅️ was effectively much wider due to prose constraints
  }}
>
        {/* 🖼️ Title Image */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/venue_title.png`}
          alt="Venue Ranker"
          className="px-media px-media--sm"
          style={{ maxWidth: 200, marginBottom: 8 }}
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
            maxWidth: 275,
            borderRadius: 18,
            marginBottom: 10,
            display: "block",
            marginInline: "auto",
          }}
        />

        {/* ✨ Whimsical Copy */}
        <h2
  className="px-intro-title"
  style={{
    marginBottom: 6,
    fontSize: "1.55rem",
    lineHeight: 1.25,
  }}
>
Your Venue Hub
        </h2>
        <p
  className="px-prose-narrow"
  style={{
    marginBottom: 6,
    fontSize: "0.95rem",
    lineHeight: 1.45,
  }}
>
Explore real Arizona venues, compare your top picks, and book when it clicks — all in one place.<br></br>

<br></br>No pressure. Save favorites, reshuffle your lineup, and come back anytime.
This is your space to search, compare, and book — without the tours, giant PDFs, or endless email threads.
</p>
<p
  className="px-prose-narrow"
  style={{
    marginBottom: 12,
    fontSize: "0.95rem",
    lineHeight: 1.45,
  }}
>
We do the heavy lifting behind the scenes — so you start with venues that actually make sense for you.
Want to explore more? The full lineup is always at your fingertips.
</p>


{/* 💬 Founder Note */}
<div
  style={{
    margin: "1.25rem auto 1.75rem",
    maxWidth: 520,
    textAlign: "left",
    background: "rgba(240,246,255,0.85)",
    borderRadius: 16,
    padding: "14px 16px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
  }}
>
  {/* Small h2-style title */}
  <h2
    style={{
      fontSize: "1.6rem",
      fontWeight: 900,
      color: "#2c62ba",
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}
  >
    <img
      src={`${import.meta.env.BASE_URL}assets/images/KRFounderTogether.webp`}
      alt="Rachel and Karen, founders of Wed&Done"
      style={{
        width: 64,
        height: 64,
        borderRadius: 12,
        objectFit: "cover",
        flexShrink: 0,
      }}
    />
    Rachel & Karen explain why this works
  </h2>

  <p
    style={{
      fontSize: "0.95rem",
      lineHeight: 1.45,
      color: "#333",
      margin: 0,
      fontStyle: "italic",
    }}
  >
    “If you’ve ever left a venue tour thinking, ‘Wait… what did they actually say was included?’ — hi. Welcome. You’re completely normal.
    <br /><br />
    We built Wed&Done because venue booking is weirdly hard. Pricing is inconsistent. Contracts aren’t comparable. And couples can lose entire weekends just driving around collecting brochures and trying to remember who included what.
    <br /><br />
    Between us, we’ve been inside hundreds of venue contracts and wedding days. We know what’s standard, what’s flexible, what’s marketing sparkle — and what actually matters.
    <br /><br />
    So we made it simple: answer a few quick questions, see your best-fit venues first, compare them clearly, and book when it clicks. No pressure. No spreadsheet gymnastics. No venue roulette.
    <br /><br />
    Your time is expensive. We treat it that way.”
  </p>
</div>

<p
  style={{
    margin: "6px 0 8px",
    fontSize: "0.95rem",
    color: "#666",
  }}
>
  How do you want to start?
</p>

        {/* 👉 Two-path CTA */}
        <div className="px-cta-col" style={{ gap: 8 }}>
          {/* Path 1: explore (unchanged flow) */}
          <button className="boutique-primary-btn" onClick={onExplore}>
          Match me with venues
          </button>
          {/* Path 2: direct book reveal */}
          <button
  className="boutique-brightblue-btn"
  style={{
    width: "100%",
    opacity: 0.92,
    transform: "scale(0.98)",
  }}
  onClick={() => {
    setShowDirectBook(true);
    scrollToDirectBook();
  }}
>
  Book a W&D venue
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