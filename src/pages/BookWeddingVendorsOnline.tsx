// src/pages/BookWeddingVendorsOnline.tsx
import React, { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate, Link } from "react-router-dom";

const BookWeddingVendorsOnline: React.FC = () => {
  const navigate = useNavigate();
  const [bgStyle, setBgStyle] = useState<CSSProperties>({});
  const [cardVisible, setCardVisible] = useState(false);

  // Images (you confirmed these)
  const HERO_IMG = `${import.meta.env.BASE_URL}assets/images/Madge Redesign.png`;
  const MID_BREAK_IMG = `${import.meta.env.BASE_URL}assets/images/magic_book.png`;
  const PRODUCT_ANCHOR_IMG = `${import.meta.env.BASE_URL}assets/images/logo_cloud.png`;

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

  const handleOpenDashboard = () => navigate("/dashboard");

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
          onClick={handleOpenDashboard}
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
          <h1 className="px-title-lg" style={{ marginBottom: 12, textAlign: "center" }}>
            How to Book Wedding Vendors Online (Without Endless Emails)
          </h1>

          <p style={{ marginBottom: 24, color: "#555", textAlign: "center" }}>
            Most wedding sites help couples browse vendors. They don’t actually help you{" "}
            <b>book</b> them. Here’s what booking should look like online — and why it’s taken this
            long for a truly booking-first platform to exist.
          </p>

          {/* ✅ HERO IMAGE: Madge */}
          <div style={{ textAlign: "center", margin: "10px 0 24px" }}>
            <img
              src={HERO_IMG}
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
              Booking wedding vendors online should feel like:{" "}
              <b>clear pricing, real availability, guided steps, and actual confirmation</b> — not
              inbox chaos. Most directories are built for <b>listings</b> and <b>inquiries</b>, not
              booking. <b>Wed&Done is booking-first</b>, so couples can move through steps, sign,
              pay, and know what’s secured.
            </p>
          </div>

          <Section title="What “booking wedding vendors online” actually means">
            <p style={p}>
              When couples say they want to “book wedding vendors online,” they usually mean:
            </p>
            <ul style={ul}>
              <li style={li}>They want to see <b>real pricing</b> (not vague “starting at” numbers)</li>
              <li style={li}>They want to know if the vendor is <b>actually available</b> for their date</li>
              <li style={li}>They want a <b>clear process</b> (not a “message us and wait” loop)</li>
              <li style={li}>They want to lock it in with a <b>contract + payment</b></li>
              <li style={li}>They want confirmation that feels <b>real</b> — not “we’ll get back to you”</li>
            </ul>
            <p style={p}>
              That’s booking. Browsing vendor profiles is not booking. Saving favorites is not
              booking. Sending inquiries is not booking. Booking means: <b>secured</b>.
            </p>
          </Section>

          <Section title="Why booking wedding vendors online is still weirdly hard">
            <p style={p}>
              Most wedding platforms were designed in an era when booking was expected to happen
              offline. So the platform’s job was simply to:
            </p>
            <ul style={ul}>
              <li style={li}>show listings</li>
              <li style={li}>collect leads</li>
              <li style={li}>send inquiries</li>
            </ul>
            <p style={p}>
              The result is a planning experience that feels busy, but nothing feels secured. You’re
              doing a lot… but you’re not booked.
            </p>
          </Section>

          <Section title="Why most directories don’t actually let you book">
            <p style={p}>
              A lot of couples assume directories don’t allow booking because they “just haven’t
              updated.” The real reason is more fundamental:
            </p>

            <ul style={ul}>
              <li style={li}><b>They’re built for advertising and inquiries</b>, not step-based booking flows.</li>
              <li style={li}><b>Availability is complicated</b> (especially with venues, dates, and capacity).</li>
              <li style={li}><b>Pricing is complicated</b> (real totals, deposits, add-ons, service fees, tax).</li>
              <li style={li}><b>Contracts are complicated</b> (terms, signatures, receipts, storage, and audit trails).</li>
              <li style={li}><b>Payments are complicated</b> (Stripe, deposits vs full pay, payment plans, confirmations).</li>
            </ul>

            <p style={p}>
              In other words: the reason this hasn’t existed isn’t because the idea is new —
              it’s because <b>the system is complex</b>.
            </p>

            <p style={p}>
              Wed&Done only became realistic to build because modern tools (including AI) made it
              possible for <b>actual wedding professionals</b> to build the platform themselves —
              not a tech company guessing how weddings work from the outside.
            </p>
          </Section>

          {/* ✅ MID-PAGE BREAK IMAGE: Magic Book */}
          <div style={{ textAlign: "center", margin: "26px 0 10px" }}>
            <img
              src={MID_BREAK_IMG}
              alt="The Wed&Done Magic Book"
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

          <Section title="What booking should look like online (the checklist)">
            <p style={p}>
              A true online booking experience should answer the big questions up front and move you
              through a real sequence. That means:
            </p>

            <ul style={ul}>
              <li style={li}><b>Clear pricing</b> (what it costs, what’s included, and what changes it)</li>
              <li style={li}><b>Real availability</b> tied to your date</li>
              <li style={li}><b>Guided steps</b> that reduce decision fatigue</li>
              <li style={li}><b>Contract + signature</b> built into the process</li>
              <li style={li}><b>Secure payment</b> (deposit or pay-in-full when applicable)</li>
              <li style={li}><b>No wondering if the cost is going to increase</b> after you “inquire”</li>
              <li style={li}><b>Confirmation</b> that feels final</li>
            </ul>

            <p style={p}>
              When those pieces are visible together, booking stops feeling risky. It starts feeling
              calm.
            </p>
          </Section>

          <Section title="How Wed&Done is different">
            <p style={p}>
              <b>Wed&Done is a direct-booking wedding platform — not a vendor directory.</b> We’re
              built for booking workflows, not inquiry loops.
            </p>

            {/* ✅ PRODUCT ANCHOR IMAGE: Logo Cloud */}
            <div style={{ textAlign: "center", margin: "18px 0 18px" }}>
              <img
                src={PRODUCT_ANCHOR_IMG}
                alt="Wed&Done dashboard logo cloud"
                style={{
                  width: "100%",
                  maxWidth: 260,
                  display: "block",
                  margin: "0 auto",
                }}
              />
            </div>

            <ul style={ul}>
              <li style={li}><b>Curated</b> experiences (less noise, more clarity)</li>
              <li style={li}><b>Booking steps</b> that actually move you forward</li>
              <li style={li}><b>Real totals</b> so you aren’t guessing</li>
              <li style={li}><b>Availability logic</b> connected to your date</li>
              <li style={li}><b>Contracts + payment</b> built into the flow</li>
            </ul>

            <p style={p}>
              The goal isn’t to keep couples “researching.” The goal is to help couples get booked —
              and feel lighter while doing it.
            </p>
          </Section>

          <Section title="Who this is best for">
            <ul style={ul}>
              <li style={li}>Couples who are tired of sending inquiries into the void</li>
              <li style={li}>Couples who want a clearer, faster path to booking</li>
              <li style={li}>Couples who want planning to feel efficient (and still fun)</li>
              <li style={li}>Couples planning from out of state or juggling busy schedules</li>
            </ul>
          </Section>

          <Section title="Built by wedding professionals (not a tech directory)">
            <p style={p}>
              Wed&Done wasn’t created by a tech company guessing how weddings work. It was built by
              two professionals who’ve spent decades inside the wedding industry — watching couples
              struggle with the same outdated systems every season.
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
              Together, they built Wed&Done to give couples a calmer, booking-first experience —
              where progress means <b>secured</b>, not “we messaged them.”
            </p>
          </Section>

          <Section title="Frequently asked questions">
            <Faq
              q="Can you really book wedding vendors online with Wed&Done?"
              a="Yes. Wed&Done is designed around step-based booking flows — not inquiry-based messaging. The goal is to help couples sign, pay, and know what’s secured."
            />
            <Faq
              q="Why don’t most wedding sites let you book vendors online?"
              a="Because true booking requires complicated systems: availability checks, accurate pricing, contracts, signatures, payments, and confirmation. Most directories were built for listings and leads — not booking."
            />
            <Faq
              q="Is Wed&Done only for Arizona weddings?"
              a="Right now, yes. We’re focused on Arizona so the experience can stay curated, accurate, and stress-reducing."
            />
            <Faq
              q="How is this different from a directory like WeddingWire or The Knot?"
              a="Directories are primarily inquiry-based advertising platforms. Wed&Done is booking-first — built to reduce decision fatigue by helping couples move through real steps and get booked."
            />
          </Section>

          {/* Internal link to your other pillar */}
          <Section title="Want to compare Wed&Done to traditional directories?">
            <p style={p}>
              If you’re specifically looking for an alternative to directory-based planning, you’ll
              probably like this:
            </p>
            <div style={{ marginTop: 10 }}>
            <Link
  to="/weddingwire-the-knot-alternative"
  style={{
    display: "inline-block",
    fontWeight: 800,
    color: "#2b5bd7",
    textDecoration: "none",
  }}
>
  → A Better Alternative to WeddingWire &amp; The Knot
</Link>
            </div>
          </Section>

          {/* CTA */}
          <div style={{ textAlign: "center", marginTop: 32 }} className="px-cta-col">
            <button
              onClick={handleOpenDashboard}
              className="boutique-primary-btn"
              style={{ marginBottom: 6 }}
            >
              W&amp;D Dashboard
            </button>

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

export default BookWeddingVendorsOnline;

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

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section style={{ marginTop: "1.5rem" }}>
    <h2 className="px-title-md" style={{ marginBottom: 8, lineHeight: 1.25 }}>
      {title}
    </h2>
    {children}
  </section>
);

const Faq: React.FC<{ q: string; a: string }> = ({
  q,
  a,
}: {
  q: string;
  a: string;
}) => (
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