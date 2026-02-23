import React from "react";
import { useNavigate } from "react-router-dom";

type OurStoryProps = {
  onBack: () => void;
};

const OurStory: React.FC<OurStoryProps> = ({ onBack }) => {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

  const navigate = useNavigate();

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
          src={`${import.meta.env.BASE_URL}assets/images/magic_quill.png`}
          alt="Our Story header"
          style={{
            width: "260px",
            height: "auto",
          }}
        />
      </div>

      {/* Rachel Section */}
      <div
        style={{
          marginBottom: "4rem",
          overflow: "hidden",
          textAlign: isMobile ? "center" : "left",
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/images/Rachel_Headshot.png`}
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
        <h2
          style={{
            fontSize: "1.5rem",
            marginBottom: "0.5rem",
            textAlign: isMobile ? "center" : "left",
          }}
        >
          Rachel Leintz – The Nerdy Tech Whiz
        </h2>
        <p
  style={{
    fontSize: "1rem",
    lineHeight: "1.7",
    textAlign: isMobile ? "center" : "left",
  }}
>
  Rachel’s love of light and storytelling started in the world of photography,
  where she built a thriving brand known for bold, emotional wedding imagery.
  With a background in forensic science (yes, she used to work for Phoenix PD’s
  homicide unit!) and a brain wired for tech, she’s the wizard behind
  Wed&Done’s wedding booking platform — designing the systems that let couples
  easily book venues and vendors without endless emails or guesswork.
  Equal parts creative and code-nerd, Rachel turns complicated booking processes
  into intuitive, beautiful tools that actually work. When she’s not building
  Wed&Done, she’s watching sci-fi with her son Wyatt, swooning over her
  husband’s cooking, and fully geeking out on all things Zelda.
</p>
      </div>

      {/* Karen Section */}
      <div
        style={{
          marginBottom: "4rem",
          overflow: "hidden",
          textAlign: isMobile ? "center" : "left",
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/images/Karen_Headshot.png`}
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
        <h2
          style={{
            fontSize: "1.5rem",
            marginBottom: "0.5rem",
            textAlign: isMobile ? "center" : "left",
          }}
        >
          Karen Podrasky – The Planning Pro
        </h2>
        <p
  style={{
    fontSize: "1rem",
    lineHeight: "1.7",
    textAlign: isMobile ? "center" : "left",
  }}
>
  Karen is the heart and real-world expertise behind Wed&Done. After two decades
  of moving around the country with her Air Force husband, she returned to her
  Arizona roots and built KDP Events into one of the Valley’s most trusted
  planning teams. With hands-on experience coordinating hundreds of weddings,
  Karen helped shape Wed&Done into a platform that doesn’t just organize
  weddings — it helps couples confidently book the right venues and vendors
  with clarity, transparency, and expert guidance baked in. A nature-loving,
  dog-adoring hostess at heart, Karen believes no celebration is complete without
          good food, great people, and a little bit of magic.
        </p>
      </div>

      {/* Divider Icon */}
      <div style={{ textAlign: "center", margin: "3rem 0" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/magic_divider.png`}
          alt="Divider icon"
          style={{ width: "120px", height: "auto" }}
        />
      </div>

      {/* Final Paragraph + Back */}
      <div
        style={{ maxWidth: "700px", margin: "0 auto", textAlign: "center" }}
      >
        <h2 style={{ fontSize: "2.0rem", marginBottom: "1rem" }}>
          Once Upon a Time . . . How it all began!
        </h2>
        <p style={{ fontSize: "1rem", lineHeight: "1.7" }}>
  Rachel and Karen have been working together for over 10 years, creating
  wedding magic all across the Valley. Along the way, they kept seeing the same
  problem: couples stuck endlessly searching, emailing, and comparing vendors
  with no clear way to actually book their wedding. So they built Wed&Done — a
  smarter, simpler way to book wedding venues and vendors in one place.
  Part expert guidance, part tech wizardry, Wed&Done replaces chaotic vendor
  directories with clear booking paths, fewer emails, and a system designed
  to help couples book confidently and move forward with joy (not stress).
</p>

{/* CTA buttons */}
<div
  style={{
    textAlign: "center",
    marginTop: "1.75rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
  }}
>
  <button
    onClick={() => navigate("/weddingwire-the-knot-alternative")}
    className="boutique-primary-btn"
  >
    Why use Wed&amp;Done
  </button>

  <button
    onClick={() => navigate("/how-to-book-wedding-vendors-online")}
    className="boutique-primary-btn"
  >
    How booking works
  </button>
</div>

{/* Back Button */}
<div style={{ textAlign: "center", marginTop: "2.5rem" }}>
  <button onClick={onBack} className="boutique-back-btn">
    ← Back
  </button>
</div>
      </div>
    </div>
  );
};

export default OurStory;