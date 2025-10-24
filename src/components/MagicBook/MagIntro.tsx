interface MagIntroProps {
  onNext: () => void;
}

const MagIntro: React.FC<MagIntroProps> = ({ onNext }) => {

  return (
    <div className="pixie-overlay">
      <div className="pixie-card">
        {/* ✖ Close Button */}
        <button
          onClick={() => window.location.href = "/dashboard"}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "none",
            border: "none",
            fontSize: "1.5rem",
            cursor: "pointer",
          }}
        >
          ✖
        </button>

        {/* Title Image */}
        <img
          src="/assets/images/MagicBookTextIntro.png"
          alt="Magic Book Intro Title"
          style={{
            width: "100%",
            maxWidth: "400px",
            margin: "0 auto 1.5rem",
            display: "block",
          }}
        />

        {/* Looping Intro Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: "100%",
            maxWidth: "400px",
            borderRadius: "12px",
            margin: "0 auto 1.5rem",
            display: "block",
          }}
        >
          <source
            src="/assets/videos/Magic_Book/Mag_Book_Intro.mp4"
            type="video/mp4"
          />
        </video>

        {/* Explainer Text */}
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontSize: "1rem",
              lineHeight: "1.6",
              marginBottom: "1.5rem",
            }}
          >
            Welcome to your <strong>Magical Book of Deets!</strong>
            <br />
            <br />
            This is your enchanted planning space for all things weddingy and
            wonderful. Inside you'll find:
            <br />
            <br />🪄 The Detail Wrangler — your secret stash of expert tips, timelines, and planning spells.
            <br />
            <br />📸 The VIP & Photos chapter — create your VIP list and build a custom shot list for your photographer (with adorable Polaroids!).
          </p>

          <button
  onClick={() => {
    console.log("✨ Button clicked");
    onNext();
  }}
  style={{
    padding: "0.75rem 1.5rem",
    fontSize: "1.1rem",
    borderRadius: "8px",
    backgroundColor: "#2c62ba",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  }}
>
  start your story
</button>
        </div>
      </div>
    </div>
  );
};

export default MagIntro;