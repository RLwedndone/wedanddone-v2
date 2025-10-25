import React from "react";

interface WDPartnersProps {
  onClose: () => void; // kept for API parity, not used here
}

// 🔧 Partners (no external links)
const VENUES: string[] = [
  "The Historic Bates Mansion",
  "Desert Foothills",
  "Encanterra",
  "The Farm House at Schnepf's Farms",
  "Fabric Warehouse",
  "The Lake House at the Windmill Winery",
  "The Big Red Barn at Schnepf's Farms",
  "Sunkist Warehouse",
  "The Meadow at Schnepf's Farms",
  "Tubac Resort & Spa",
  "The Verrado Golf Club",
  "The Vic at Verrado",
  "The Big Red Barn at the Windmill Winery",
  "Hacienda del Sol",
  "Hotel Valley Ho",
  "The Rubi House",
  "Soho63",
  "Ocotillo Restaurant",
];

const FLORISTS: string[] = ["Buckaroo Flowers"];

const PHOTOGRAPHERS: string[] = [
  "Harley Bonham Photography",
  "Twin Lens Studios",
  "Step On Me Photography",
];

const CATERERS: string[] = ["Santis Catering"];

const DJS_MCS: string[] = ["Arizona DJs"];

const WDPartners: React.FC<WDPartnersProps> = () => {
  return (
    // CONTENT-ONLY: parent overlay/card supplies the scroll container
    <div style={{ padding: "0 0 1rem" }}>
      {/* Title */}
      <h2
        style={{
          textAlign: "center",
          fontSize: "2.5rem",
          margin: "0 0 1rem",
          color: "#2c62ba",
        }}
      >
        The Magic Hall of Partners
      </h2>

      {/* 🎥 9:16 looping video (rounded corners, responsive) */}
      <div style={{ margin: "0 auto 1.25rem", maxWidth: 420, width: "100%" }}>
        <div
          style={{
            position: "relative",
            width: "75%",
            aspectRatio: "9 / 16",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
            background: "#000",
            margin: "0 auto",
          }}
        >
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/magic_hall.mp4`}
            autoPlay
            loop
            muted
            playsInline
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>
      </div>

      {/* Intro (below video) */}
      <p
        style={{
          fontSize: "1rem",
          lineHeight: 1.6,
          textAlign: "center",
          maxWidth: 640,
          margin: "0.5rem auto 1.25rem",
          opacity: 0.95,
        }}
      >
        Step inside and meet the extraordinary pros who help bring your wedding to life.
        This is our ever‑growing list of trusted partners — handpicked for style, quality,
        and stellar service.
      </p>

      {/* Vertical sections (headers in dark blue, plain text items) */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 0.5rem 0.5rem" }}>
        {/* Venues */}
        <div style={{ marginBottom: "2rem" }}>
          <h3
            style={{
              fontSize: "1.6rem",
              marginBottom: "0.6rem",
              textAlign: "center",
              color: "#2c62ba",
            }}
          >
            Venues
          </h3>
          <ul style={{ listStyle: "none", padding: 0, textAlign: "center" }}>
            {VENUES.map((name, idx) => (
              <li key={idx} style={{ margin: "0.35rem 0", fontWeight: 600 }}>
                {name}
              </li>
            ))}
          </ul>
        </div>

        {/* Florists */}
        <div style={{ marginBottom: "2rem" }}>
          <h3
            style={{
              fontSize: "1.6rem",
              marginBottom: "0.6rem",
              textAlign: "center",
              color: "#2c62ba",
            }}
          >
            Florists
          </h3>
          <ul style={{ listStyle: "none", padding: 0, textAlign: "center" }}>
            {FLORISTS.map((name, idx) => (
              <li key={idx} style={{ margin: "0.35rem 0", fontWeight: 600 }}>
                {name}
              </li>
            ))}
          </ul>
        </div>

        {/* Photographers */}
        <div style={{ marginBottom: "2rem" }}>
          <h3
            style={{
              fontSize: "1.6rem",
              marginBottom: "0.6rem",
              textAlign: "center",
              color: "#2c62ba",
            }}
          >
            Photographers
          </h3>
          <ul style={{ listStyle: "none", padding: 0, textAlign: "center" }}>
            {PHOTOGRAPHERS.map((name, idx) => (
              <li key={idx} style={{ margin: "0.35rem 0", fontWeight: 600 }}>
                {name}
              </li>
            ))}
          </ul>
        </div>

        {/* Caterers */}
        <div style={{ marginBottom: "2rem" }}>
          <h3
            style={{
              fontSize: "1.6rem",
              marginBottom: "0.6rem",
              textAlign: "center",
              color: "#2c62ba",
            }}
          >
            Caterers
          </h3>
          <ul style={{ listStyle: "none", padding: 0, textAlign: "center" }}>
            {CATERERS.map((name, idx) => (
              <li key={idx} style={{ margin: "0.35rem 0", fontWeight: 600 }}>
                {name}
              </li>
            ))}
          </ul>
        </div>

        {/* DJs & MCs */}
        <div style={{ marginBottom: "2rem" }}>
          <h3
            style={{
              fontSize: "1.6rem",
              marginBottom: "0.6rem",
              textAlign: "center",
              color: "#2c62ba",
            }}
          >
            DJs & MCs
          </h3>
          <ul style={{ listStyle: "none", padding: 0, textAlign: "center" }}>
            {DJS_MCS.map((name, idx) => (
              <li key={idx} style={{ margin: "0.35rem 0", fontWeight: 600 }}>
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <p style={{ fontSize: "0.9rem", color: "#666" }}>
          Interested in becoming a partner?{" "}
          <a href="mailto:hello@wedanddone.com">partners@wedanddone.com</a>
        </p>
      </div>
    </div>
  );
};

export default WDPartners;