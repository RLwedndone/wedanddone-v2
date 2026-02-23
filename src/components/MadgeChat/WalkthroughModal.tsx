import React, { useEffect } from "react";

export type WalkthroughTarget =
  | "venue"
  | "yum"
  | "photo"
  | "jam"
  | "planner"
  | "floral";

type Props = {
  onClose: () => void;

  // ✅ parent decides how to route/open overlays
  onGo: (target: WalkthroughTarget) => void;

  onEvent?: (event: string, props?: Record<string, any>) => void;
};

const BASE = import.meta.env.BASE_URL || "/";

const items: Array<{
  key: WalkthroughTarget;
  bookingLabel: string;
  title: string;
  desc: string;
  img: string;
  imgAlt: string;
}> = [
  {
    key: "venue",
    bookingLabel: "Book your venue",
    title: "Venue Ranker 🏰",
    desc: "Find real Arizona venues with real pricing (plus video walkthroughs!) — and book without touring 48 castles in one weekend.",
    img: `${BASE}assets/images/venue_ranker_button_start_here.png`,
    imgAlt: "Venue Ranker button",
  },
  {
    key: "floral",
    bookingLabel: "Book your florals",
    title: "Floral Picker 🌸",
    desc: "Choose your floral style and arrangements with clear pricing — then lock it in.",
    img: `${BASE}assets/images/floral_picker_button.png`,
    imgAlt: "Floral Picker button",
  },
  {
    key: "photo",
    bookingLabel: "Book your photographer",
    title: "Photo Styler 📸",
    desc: "Pick your photography vibe and we match you with someone we trust — then make your own customized photography package.",
    img: `${BASE}assets/images/photo_style_button.png`,
    imgAlt: "Photo Styler button",
  },
  {
    key: "yum",
    bookingLabel: "Book your catering",
    title: "Yum Yum Guide 🍰",
    desc: "Build catering + dessert choices in minutes then buy as many plates and treats as you need!",
    img: `${BASE}assets/images/yum_yum_button.png`,
    imgAlt: "Yum Yum Guide button",
  },
  {
    key: "planner",
    bookingLabel: "Book your wedding planner",
    title: "Pixie Planner ✨",
    desc: "Yes, you need one. In fact, most venues now REQUIRE one. And we've got you covered.",
    img: `${BASE}assets/images/planner_button.png`,
    imgAlt: "Pixie Planner button",
  },
  {
    key: "jam",
    bookingLabel: "Book your DJ",
    title: "Jam & Groove 🎵",
    desc: "Choose your music vibe and lock in your DJ without awkward back-and-forth emails or hour long meet-ups.",
    img: `${BASE}assets/images/jam_groove_button.png`,
    imgAlt: "Jam & Groove button",
  },
];

export default function WalkthroughModal({ onClose, onGo, onEvent }: Props) {
  useEffect(() => {
    onEvent?.("madge_help_walkthrough_opened", { source: "walkthroughModal" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenBookingPath = () => {
    onEvent?.("madge_help_booking_path_clicked", { source: "walkthroughModal" });
    window.dispatchEvent(new CustomEvent("openUserMenuScreen", { detail: "bookings" }));
    onClose(); // closes walkthrough (and usually Madge overlay can remain)
  };

  const handleGo = (key: WalkthroughTarget) => {
    onEvent?.("madge_help_walkthrough_clicked", { target: key });
    onGo(key);
  };

  return (
    <div
      className="pixie-overlay"
      style={{ zIndex: 3100 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
  className="pixie-card account-card--expanded"
  onClick={(e) => e.stopPropagation()}
  style={{
    maxWidth: 720,
    width: "min(720px, 92vw)",
    maxHeight: "86vh",
    overflow: "hidden",
    position: "relative",
  }}
>
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${BASE}assets/icons/pink_ex.png`} alt="Close" />
        </button>

        <div
  className="pixie-card__body"
  style={{
    paddingBottom: "1rem",
    overflowX: "hidden",   // ✅ stops the tiny sideways scroll on mobile
    width: "100%",
    boxSizing: "border-box",
  }}
>
          <h2 className="px-title" style={{ textAlign: "center", marginBottom: 8 }}>
            Quick walkthrough 🧭
          </h2>

          <p className="px-prose-narrow" style={{ marginTop: 0 }}>
            Think of Wed&Done as you online button boutique for all things wedding. You can literally plan and book you wedding here, in the magic of the online world, sitting on your couch, wearing your sweats! <br></br>Here’s what each button does. Feel free to click and explore!
          </p>

          {/* ✅ Plain white scroll area */}
          <div
  style={{
    marginTop: 12,
    paddingRight: 6,
    background: "#fff",
    borderRadius: 14,
  }}
>
<div style={{ display: "grid", gap: 26, padding: "12px 6px 16px" }}>
  {items.map((it) => (
    <div
      key={it.key}
      style={{
        textAlign: "center",
        background: "#fff",
        borderRadius: 18,
        padding: "18px 14px 22px",
        boxShadow:
          "0 8px 22px rgba(44, 98, 186, 0.12), 0 2px 6px rgba(0,0,0,0.06)",
      }}
    >
      {/* ✅ Label above each button */}
      <div
        style={{
          fontSize: "1.7rem",
          fontWeight: 800,
          color: "#2c62ba",
          marginBottom: 10,
          textShadow: "0 1px 0 rgba(255,255,255,0.7)", // subtle, keeps it crisp
        }}
      >
        {it.bookingLabel}
      </div>

      {/* Clickable image (button art) */}
      <button
        onClick={() => handleGo(it.key)}
        style={{
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
        aria-label={`Go to ${it.title}`}
      >
        <img
          src={it.img}
          alt={it.imgAlt}
          style={{
            width: "min(250px, 78vw)",
            height: "auto",
            display: "block",
            filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.22))",
            transition: "transform 140ms ease, filter 140ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLImageElement).style.transform = "scale(1.02)";
            (e.currentTarget as HTMLImageElement).style.filter =
              "drop-shadow(0 12px 24px rgba(0,0,0,0.26))";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLImageElement).style.transform = "scale(1)";
            (e.currentTarget as HTMLImageElement).style.filter =
              "drop-shadow(0 8px 18px rgba(0,0,0,0.22))";
          }}
        />
      </button>

      {/* Helper text */}
      <div style={{ marginTop: 8, fontSize: 14, opacity: 0.7 }}>
        Click to go there
      </div>

      {/* Explainer line */}
      <div
        style={{
          marginTop: 10,
          fontSize: 18,
          lineHeight: 1.45,
          color: "#333",
          maxWidth: 450,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {it.desc}
      </div>
    </div>
  ))}
</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16 }}>
  <button
    className="boutique-primary-btn"
    style={{ width: "min(360px, 86vw)" }}
    onClick={handleOpenBookingPath}
  >
    View the Booking Path ✨
  </button>

  <div
    style={{
      marginTop: 8,
      fontSize: 13,
      color: "#444",
      opacity: 0.9,
      textAlign: "center",
      maxWidth: 520,
      lineHeight: 1.35,
    }}
  >
    Want to see our recommended order? Check out the booking path!
  </div>
</div>

          <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
            <button
              className="boutique-primary-btn"
              style={{ width: "min(320px, 86vw)" }}
              onClick={onClose}
            >
              back to guide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}