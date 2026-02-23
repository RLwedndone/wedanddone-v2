// src/components/NewYumBuild/YumIntro.tsx
import React from "react";

interface YumIntroProps {
  onCateringNext: () => void;
  onDessertNext: () => void;
  onClose: () => void;

  // NEW: passed down from NoVenueOverlay/MenuController so we can
  // change the wording for couples who already booked a venue
  isSharedFlowBookedVenue?: boolean;
  bookedVenueName?: string;
}

const YumIntro: React.FC<YumIntroProps> = ({
  onCateringNext,
  onDessertNext,
  onClose,
  isSharedFlowBookedVenue,
  bookedVenueName,
}) => {
  return (
    <div className="pixie-card wd-page-turn">
      {/* Pink X */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* Title image */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/yumyumtitle.png`}
          alt="Yum Yum Title"
          style={{
            width: "100%",
            maxWidth: 225,
            margin: "0 auto 1rem",
            display: "block",
          }}
        />

        {/* Looping video */}
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

        {/* Body Copy */}
        <div
          className="px-prose-narrow"
          style={{ margin: "0 auto 1.5rem", textAlign: "left", maxWidth: 420 }}
        >
          {isSharedFlowBookedVenue ? (
            <>
              {/* ✅ VERSION FOR USERS WHO ALREADY BOOKED A VENUE */}
<p
  style={{
    textAlign: "center",
    fontWeight: 500,
    marginBottom: 14,
    fontSize: "1rem",
    lineHeight: 1.6,
    color: "#333",
  }}
>
  Get ready to experience deliciousness! The next few screens will walk you
  through creating your catering menu for your reception at{" "}
  <strong>{bookedVenueName || "your venue"}</strong>. Choose from scrumptious
  appetizers, yummy entrees, and decadent desserts!
</p>
            </>
          ) : (
            <>
              {/* 🌸 ORIGINAL GENERIC VERSION (no venue locked in yet) */}
              <p style={{ marginBottom: 12 }}>
                You’re about to explore some delicious catering options! If you
                haven’t picked your venue yet, you’ll start by building your menu
                with <strong>Wed&Done’s Culinary Team</strong> — our flexible,
                fully customizable menu that works with most venues.
              </p>

              <p style={{ marginBottom: 12 }}>
                🎉 <strong>Already have a venue?</strong> You can still book your
                catering <em>right now</em> — as long as your venue allows outside
                catering.
              </p>

              <p style={{ marginBottom: 12 }}>
                🏰 If you're planning to book your venue here with Wed&Done,
                <em> do that first.</em> Once your venue is confirmed, your options
                in the Yum Yum Menu will automatically update.
              </p>

              <p style={{ marginBottom: 12 }}>
                🍰 <strong>Just looking to book desserts?</strong> Tap the pink
                button below!
              </p>
            </>
          )}
        </div>

        {/* 💬 Founder Note (Karen) */}
<div
  style={{
    margin: "1.25rem auto 1.25rem",
    maxWidth: 520,
    textAlign: "left",
    background: "rgba(240,246,255,0.85)",
    borderRadius: 16,
    padding: "14px 16px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
  }}
>
  <h2
    style={{
      fontSize: "1.55rem",
      fontWeight: 900,
      color: "#2c62ba",
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}
  >
    <img
      src={`${import.meta.env.BASE_URL}assets/images/KFounder1x1.webp`}
      alt="Karen, co-founder of Wed&Done"
      style={{
        width: 60,
        height: 60,
        borderRadius: 10,
        objectFit: "cover",
        flexShrink: 0,
      }}
    />
    Karen explains why this works
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
  “Catering usually means inquiry forms, email threads, and menu revisions
  that somehow multiply overnight.
  <br />
  <br />
  We’ve worked with Santi’s and Whisk & Paddle for years. We know the
  quality and the pricing — so we made it simple: build your menu, see real
  numbers, and book when it clicks.
  <br />
  <br />
  No inquiry forms. No waiting. Just really good food (and cake), made easy.”
</p>
</div>


        {/* CTA column */}
        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button
            className="boutique-primary-btn"
            style={{ width: 250 }}
            onClick={onCateringNext}
          >
            {isSharedFlowBookedVenue
              ? "Book Catering for My Venue"
              : "Book Catering"}
          </button>

          <button
            className="boutique-back-btn"
            style={{ width: 250 }}
            onClick={onDessertNext}
          >
            {isSharedFlowBookedVenue
              ? "Book Desserts for My Venue"
              : "Book Desserts"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default YumIntro;