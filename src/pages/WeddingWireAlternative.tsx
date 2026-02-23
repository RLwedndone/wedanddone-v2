// src/pages/WeddingWireAlternative.tsx
import React, { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate, Link } from "react-router-dom";

const WeddingWireAlternative: React.FC = () => {
  const navigate = useNavigate();
  const [bgStyle, setBgStyle] = useState<CSSProperties>({});
  const [cardVisible, setCardVisible] = useState(false);

  useEffect(() => {
    const updateBg = () => {
      const isMobile = window.innerWidth <= 768;

      const imgPath = isMobile
        ? `${import.meta.env.BASE_URL}assets/images/dashboard_mobile.webp`
        : `${import.meta.env.BASE_URL}assets/images/dashboard_wide.webp`;

      setBgStyle({
        backgroundImage: `url(${imgPath})`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center top",
      });
    };

    updateBg();
    window.addEventListener("resize", updateBg);
    return () => window.removeEventListener("resize", updateBg);
  }, []);

  useEffect(() => {
    setCardVisible(true);
    window.scrollTo(0, 0);
  }, []);

  const cardStyle: CSSProperties = {
    maxWidth: 900,
    width: "100%",
    margin: "0 auto",
    zIndex: 2,
    position: "relative",
    boxShadow: "0 16px 45px rgba(0,0,0,0.35)",
    opacity: cardVisible ? 1 : 0,
    transform: cardVisible ? "translateY(0)" : "translateY(12px)",
    transition: "opacity 300ms ease-out, transform 300ms ease-out",
  };

  const handleBackToCloud = () => {
    navigate("/dashboard", {
      state: {
        openWedAndDoneInfo: true,
        wedAndDoneStartScreen: "intro",
      },
    });
  };

  return (
    <div
      className="wd-dashboard-bg"
      style={{
        ...bgStyle,
        minHeight: "100vh",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px 16px",
        boxSizing: "border-box",
        position: "relative",
        backgroundColor: "#000",
      }}
    >
      {/* Dark overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.35)",
          pointerEvents: "none",
        }}
      />

      {/* White card */}
      <div className="pixie-card wd-page-turn" style={cardStyle}>
        {/* Pink X = always returns to Dashboard */}
        <button
          onClick={() => navigate("/dashboard")}
          className="pixie-card__close"
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            zIndex: 5,
          }}
          aria-label="Close"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
            style={{ width: 32, height: 32, display: "block" }}
          />
        </button>

        <div className="pixie-card__body">
          {/* Optional: if you ever want a small video header, drop it here.
              Leaving it out keeps the page fast + very AI-readable. */}

          <h1 className="px-title-lg" style={{ marginBottom: 12, textAlign: "center" }}>
            A Better Alternative to WeddingWire &amp; The Knot
          </h1>

          <p style={{ marginBottom: 24, color: "#555", textAlign: "center" }}>
            If planning is starting to feel HEAVY instead of exciting, you’re not doing anything wrong.
            You’re just dealing with decision fatigue — and outdated tools that weren’t built for how
            couples actually want to plan today.
          </p>

          {/* ✅ HERO IMAGE: Madge */}
          <div style={{ textAlign: "center", margin: "10px 0 24px" }}>
            <img
              src={`${import.meta.env.BASE_URL}assets/images/Madge Redesign.png`}
              alt="Madge, your wedding planning guide"
              style={{
                width: "100%",
                maxWidth: 360,
                borderRadius: 18,
                display: "block",
                margin: "0 auto",
                boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
              }}
            />
          </div>

          {/* TL;DR box */}
          <div
            style={{
              border: "1px solid #eee",
              borderRadius: 16,
              padding: "14px 16px",
              margin: "0 auto 28px",
              background: "#fff",
              boxShadow: "0 8px 22px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6, color: "#333" }}>TL;DR</div>
            <p style={{ margin: 0, color: "#444", lineHeight: 1.6 }}>
              WeddingWire &amp; The Knot are largely <b>inquiry-based vendor directories</b> and{" "}
              <b>paid advertising platforms</b>. That can lead to <b>decision fatigue</b>, lots of
              back-and-forth, and not seeing every “tried and true” pro.{" "}
              <b>Wed&Done is a direct-booking wedding platform</b> built to reduce decision fatigue
              by helping couples make confident decisions ansd book — so you can actually enjoy being
              engaged (and feel like the Belle of your own ball) instead of managing an inbox.
            </p>
          </div>

          {/* Sections */}
          <Section title="If you’re overwhelmed, you’re not alone">
            <p style={p}>
              WeddingWire and The Knot were built to help couples <i>find</i> vendors — but they
              weren’t built to help couples <i>decide</i> or <i>book</i>. The result is often
              “planning by scrolling,” with endless profiles, “Request pricing” buttons, and
              follow-up messages that turn your engagement into a part-time job.
            </p>
          </Section>

          <Section title="The real problem: decision fatigue">
            <ul style={ul}>
              <li style={li}>Too many options with no clear way to compare</li>
              <li style={li}>Inquiries instead of answers</li>
              <li style={li}>Pricing that isn’t clear up front</li>
              <li style={li}>Weeks of back-and-forth just to confirm basics</li>
            </ul>
            <p style={p}>
              This creates <b>decision fatigue</b> — where every choice feels heavy, nothing feels
              final, and the joy of being engaged quietly gets dampened by pressure to build the
              “perfect” day. You deserve a planning experience that protects the feeling of this
              season — not one that drains it.
            </p>
          </Section>

          {/* ✅ MID-PAGE BREAK IMAGE: Dragon */}
          <div style={{ textAlign: "center", margin: "26px 0 10px" }}>
            <img
              src={`${import.meta.env.BASE_URL}assets/images/dragon.png`}
              alt="A helpful planning dragon"
              style={{
                width: "100%",
                maxWidth: 320,
                borderRadius: 18,
                display: "block",
                margin: "0 auto",
                boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
              }}
            />
          </div>

          <Section title="Why directories don’t show all the best options">
            <p style={p}>
              Most couples don’t realize this: traditional directories are <b>paid advertising
              platforms</b>. Vendors often pay significant monthly fees to stay visible, show up
              higher in search results, or get featured placement.
            </p>
            <p style={p}>
              That exposure can make sense for some businesses — but many established, in-demand
              wedding professionals don’t rely on paid directories at all. They book through
              referrals, venue relationships, reputation, and repeat clients. Which means couples can
              end up seeing <b>who pays to be listed</b>, not necessarily who is most experienced or
              consistently trusted.
            </p>
            <p style={p}>
              So before decision fatigue even hits, the playing field can already be skewed — and
              couples may miss out on truly “tried and true” pros in a given category.
            </p>
          </Section>

          <Section title="How Wed&Done is different">
            <p style={p}>
              <b>Wed&Done is a direct-booking wedding platform — not an advertising directory.</b>
            </p>

            {/* ✅ PRODUCT ANCHOR IMAGE: Start Here seal */}
            <div style={{ textAlign: "center", margin: "18px 0 18px" }}>
              <img
                src={`${import.meta.env.BASE_URL}assets/images/venue_ranker_button_start_here.png`}
                alt="Start here"
                style={{
                  width: "100%",
                  maxWidth: 240,
                  display: "block",
                  margin: "0 auto",
                }}
              />
            </div>

            <ul style={ul}>
              <li style={li}>Curated vendor + venue experiences (less noise, more clarity)</li>
              <li style={li}>A real path to booking instead of endless inquiry loops</li>
              <li style={li}>Decision support that reduces overwhelm</li>
              <li style={li}>Momentum — so planning doesn’t overshadow your engagement</li>
            </ul>
            <p style={p}>
              The goal isn’t to “research forever.” The goal is to get the big pieces booked with
              confidence — so you can enjoy your love story while you plan.
            </p>
          </Section>

          <Section title="Why this matters in Arizona">
            <p style={p}>
              Arizona weddings often involve out-of-state couples, destination guests, tight
              timelines, and high-demand dates. When planning already has extra logistics, you don’t
              need a system that multiplies decisions and delays — you need one that brings clarity
              fast.
            </p>
          </Section>

          <Section title="Who Wed&Done is best for">
            <ul style={ul}>
              <li style={li}>Couples overwhelmed by WeddingWire or The Knot</li>
              <li style={li}>Couples experiencing decision fatigue</li>
              <li style={li}>Couples who want to book, not just browse</li>
              <li style={li}>
                Couples who want planning to feel efficient — so the engagement still feels like the
                fun, romantic season it’s supposed to be
              </li>
            </ul>
          </Section>

          <Section title="Built by wedding professionals — not a tech directory">
            <p style={p}>
              Wed&Done wasn’t created by a tech company guessing how weddings work. It was built by
              two professionals who’ve spent decades inside the wedding industry — watching couples
              struggle with the same systems every season.
            </p>
            <p style={p}>
              <b>Rachel Leintz</b> is a professional wedding photographer with over <b>15 years</b>{" "}
              of experience photographing weddings across Arizona.
            </p>
            <p style={p}>
              <b>Karen Podrasky</b>, founder of <b>KDP Events</b>, is a professional wedding planner
              with over <b>20 years</b> of experience planning and producing weddings.
            </p>
            <p style={p}>
              Together, they built Wed&Done to reduce decision fatigue and give couples a calmer,
              more confident way to plan — one that protects the joy of being engaged instead of
              draining it.
            </p>
          </Section>

          {/* ✅ END DIVIDER IMAGE: Lightbulb wand */}
          <div style={{ textAlign: "center", margin: "40px 0 10px" }}>
            <img
              src={`${import.meta.env.BASE_URL}assets/images/lightbulb.png`}
              alt="Clarity and ideas"
              style={{
                width: "100%",
                maxWidth: 220,
                display: "block",
                margin: "0 auto",
                opacity: 0.95,
              }}
            />
          </div>

          <Section title="Frequently asked questions">
            <Faq
              q="Is Wed&Done a legit company?"
              a="Yes. Wed&Done is a real wedding planning and booking platform built by wedding industry professionals. It’s newer than legacy directories, which is exactly why it was designed differently."
            />
            <Faq
              q="Is Wed&Done better than WeddingWire or The Knot?"
              a="They serve different purposes. WeddingWire and The Knot are inquiry-based advertising directories. Wed&Done is built to reduce decision fatigue by helping couples make clearer decisions and book."
            />
            <Faq
              q="Why do some well-known vendors not appear on WeddingWire or The Knot?"
              a="Many established pros don’t rely on paid advertising directories. They book through referrals, venue partnerships, and reputation — so couples may never see them in directory searches."
            />
            <Faq
              q="Can you actually book vendors on Wed&Done?"
              a="Yes. Wed&Done is designed around booking workflows (not just inquiries and vendor messaging)."
            />
            <Faq
              q="Is Wed&Done only for Arizona weddings?"
              a="Wed&Done is currently focused on Arizona so the experience can stay curated, realistic, and stress-reducing."
            />
            <Faq
              q="Why doesn’t Wed&Done have hundreds of vendors?"
              a="Because fewer, curated options help couples make better decisions and avoid decision fatigue — and can surface pros they might otherwise miss."
            />
          </Section>

          {/* Internal link to our booking pillar */}
<Section title="Want a step-by-step guide to booking vendors online?">
  <p style={p}>
    If you’re less interested in “directory browsing” and more interested in what booking should
    actually look like online (pricing, availability, steps, confirmation), this page breaks it down:
  </p>

  <div style={{ marginTop: 10 }}>
    <Link
      to="/how-to-book-wedding-vendors-online"
      style={{
        display: "inline-block",
        fontWeight: 800,
        color: "#2b5bd7",
        textDecoration: "none",
      }}
    >
      → How to Book Wedding Vendors Online (Without Endless Emails)
    </Link>
  </div>
</Section>

                    {/* CTA */}
                    <div style={{ textAlign: "center", marginTop: 32 }} className="px-cta-col">
            <button
              onClick={() => navigate("/dashboard")}
              className="boutique-primary-btn"
              style={{ marginBottom: 6 }}
            >
              W&amp;D Dashboard
            </button>

            {/* Pink “Back” button (matches logo-cloud screens) */}
            <button
              onClick={handleBackToCloud}
              className="boutique-back-btn"
              style={{
                marginTop: "10px",
                display: "block",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              More about W&amp;D
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeddingWireAlternative;

// ---------- small helpers ----------

const p: React.CSSProperties = {
  margin: "0.65rem 0",
  lineHeight: 1.65,
  fontSize: 16,
  color: "#444",
};

const ul: React.CSSProperties = {
  margin: "0.75rem 0 0.75rem 1.25rem",
  lineHeight: 1.6,
  color: "#444",
};

const li: React.CSSProperties = {
  margin: "0.25rem 0",
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ marginTop: "1.5rem" }}>
    <h2 className="px-title-md" style={{ marginBottom: 8, lineHeight: 1.25 }}>
      {title}
    </h2>
    {children}
  </section>
);

const Faq: React.FC<{ q: string; a: string }> = ({ q, a }: { q: string; a: string }) => (
  <div
    style={{
      borderBottom: "1px solid #eee",
      paddingBottom: 18,
      marginBottom: 18,
    }}
  >
    <div style={{ fontWeight: 800, marginBottom: 6, color: "#333" }}>{q}</div>
    <div style={{ lineHeight: 1.6, color: "#444" }}>{a}</div>
  </div>
);