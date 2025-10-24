import React from "react";

type OurStoryProps = {
  onClose: () => void;
};

const OurStory: React.FC<OurStoryProps> = ({ onClose }) => {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

  return (
    <div
      style={{
        padding: "4rem 1.5rem",
        backgroundColor: "#fff",
        fontFamily: "serif",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <img
          src="/assets/images/magic_quill.png"
          alt="Our Story header"
          style={{
            width: "260px",
            height: "auto",
          }}
        />
      </div>

      {/* Rachel Section */}
      <div style={{ marginBottom: "4rem", overflow: "hidden", textAlign: isMobile ? "center" : "left" }}>
        <img
          src="/assets/images/Rachel_Headshot.png"
          alt="Rachel headshot"
          style={{
            float: isMobile ? "none" : "left",
            display: isMobile ? "block" : "inline",
            margin: isMobile ? "0 auto 1.5rem auto" : "0 1.5rem 1rem 0",
            width: "180px",
            height: "auto",
            borderRadius: "16px",
            objectFit: "cover",
            aspectRatio: "4 / 5",
          }}
        />
        <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem", textAlign: isMobile ? "center" : "left" }}>
          Rachel – The Nerdy Tech Whiz
        </h2>
        <p style={{ fontSize: "1rem", lineHeight: "1.7", textAlign: isMobile ? "center" : "left" }}>
          Rachel’s love of light and storytelling started in the world of photography, where she built a thriving brand known for bold, emotional wedding imagery. With a background in forensic science (yeah, she used to work for Phoenix PD’s homicide unit!) and a brain wired for tech, she’s the wizard behind Wed&Done’s booking flow — turning complicated planning tasks into intuitive, beautiful tools. Equal parts creative and code-nerd, Rachel spends her free time watching sci-fi movies with her son Wyatt, swooning over her husband’s cooking, and fully geeking out on all things Zelda.
        </p>
      </div>

      {/* Karen Section */}
      <div style={{ marginBottom: "4rem", overflow: "hidden", textAlign: isMobile ? "center" : "left" }}>
        <img
          src="/assets/images/Karen_Headshot.png"
          alt="Karen headshot"
          style={{
            float: isMobile ? "none" : "right",
            display: isMobile ? "block" : "inline",
            margin: isMobile ? "0 auto 1.5rem auto" : "0 0 1rem 1.5rem",
            width: "180px",
            height: "auto",
            borderRadius: "16px",
            objectFit: "cover",
            aspectRatio: "4 / 5",
          }}
        />
        <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem", textAlign: isMobile ? "center" : "left" }}>
          Karen – The Planning Pro
        </h2>
        <p style={{ fontSize: "1rem", lineHeight: "1.7", textAlign: isMobile ? "center" : "left" }}>
          Karen is the heart and hands-on wisdom behind Wed&Done. After two decades of moving around the country with her Air Force husband, she returned to her Arizona roots and built KDP Events into one of the Valley’s most trusted planning teams. She’s handled every kind of wedding scenario imaginable, bringing calm, clarity, and serious know-how to each couple’s big day. A nature-loving, dog-adoring hostess at heart, Karen believes no celebration is complete without good food, great people, and a little bit of magic.
        </p>
      </div>

      {/* Divider Icon */}
      <div style={{ textAlign: "center", margin: "3rem 0" }}>
        <img
          src="/assets/images/magic_divider.png"
          alt="Divider icon"
          style={{ width: "120px", height: "auto" }}
        />
      </div>

      {/* Final Paragraph */}
      <div style={{ maxWidth: "700px", margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: "2.0rem", marginBottom: "1rem" }}>
          Once Upon a Time . . . How it all began!
        </h2>
        <p style={{ fontSize: "1rem", lineHeight: "1.7" }}>
          Rachel and Karen have been working together for over 10 years, creating wedding magic all across the Valley. Along the way, they started dreaming up something bigger. They saw too many couples overwhelmed by planning, unsure who to trust, and convinced they didn’t need a planner (spoiler: they did). So they built Wed&Done — a smarter, simpler way to book your wedding. It’s part expert guidance, part tech wizardry, and all designed to bring the joy (not the chaos) back to planning.
        </p>
        {/* Back Button */}
{/* Back Button */}
<div style={{ textAlign: "center", marginTop: "2.5rem" }}>
  <button onClick={onClose} className="boutique-back-btn">
    ← Back
  </button>
</div>
      </div>
    </div>
  );
};

export default OurStory;