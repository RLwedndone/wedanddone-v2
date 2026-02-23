// src/components/dashboard/DashboardGate.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import AccountModal from "../common/AccountModal";
import { auth } from "../../firebase/firebaseConfig";

type DashboardGateProps = {
  onComplete: () => void; // parent can route to your new account screen if you want
  onLogin: () => void;
  onOpenVenueRanker: () => void;
};

const LS_DONE_KEY = "wd_guestbook_done";

const phCapture = (event: string, props: Record<string, any> = {}) => {
  const ph = (window as any).posthog;
  if (!ph || typeof ph.capture !== "function") return;
  ph.capture(event, props);
};

export default function DashboardGate({ onComplete, onLogin }: DashboardGateProps) {

  const videoStartedRef = useRef(false);
  const videoCompletedRef = useRef(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showBonusCTA, setShowBonusCTA] = useState(false);

  useEffect(() => {
    setShowBonusCTA(true);
  }, []);
  const isMobile = window.innerWidth < 480;
  const device = isMobile ? "mobile" : "desktop";

  const scrollToForm = () => {
    const el = document.getElementById("dashboardGateForm");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    phCapture("dashboard_gate_viewed", {
      device,
      logged_in: !!auth.currentUser,
      source: "dashboardGate",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Vimeo analytics (single listener — removed duplicate)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const origin = (e.origin || "").toLowerCase();
      const isVimeo = origin.includes("vimeo.com") || origin.includes("player.vimeo.com");
      if (!isVimeo) return;
      if (!e.data) return;

      let data: any = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }

      const evt = data?.event;
      if (!evt) return;

      if (evt === "play" && !videoStartedRef.current) {
        videoStartedRef.current = true;
        phCapture("dashboard_gate_video_played", {
          device,
          logged_in: !!auth.currentUser,
          source: "dashboardGate",
          video: "founderInterview",
        });
      }

      if (evt === "ended" && !videoCompletedRef.current) {
        videoCompletedRef.current = true;
        phCapture("dashboard_gate_video_completed", {
          device,
          logged_in: !!auth.currentUser,
          source: "dashboardGate",
          video: "founderInterview",
        });
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [device]);

  // ✅ Scrapbook photo order (KarenReal2 in the middle)
  const photos = [
    "assets/images/KarenReal1.jpg",
    "assets/images/RachelReal1.png",
    "assets/images/KarenReal2.jpg", // hero
    "assets/images/RachelReal2.jpg",
    "assets/images/RachelKarenReal1.jpg",
  ];

  const rotationsDesktop = [-6, -3, 0, 3, 6];
  const rotationsMobile = [-3, 2, -1, 3, -2];


  const handleCloseToDashboard = () => {
    phCapture("dashboard_gate_closed", {
      device,
      logged_in: !!auth.currentUser,
      source: "dashboardGate",
    });
  
    try {
      localStorage.setItem("wd_gate_snooze_until", String(Date.now() + 24 * 60 * 60 * 1000));
    } catch {}
  
    onComplete();
  };

  const handleOpenBonusIntro = () => {
    phCapture("dashboard_gate_bonus_cta_clicked", {
      device,
      logged_in: !!auth.currentUser,
      source: "dashboardGate",
    });
  
    // ✅ activate bonus for pricing logic
    localStorage.setItem("wd_bonus500", "true");
    localStorage.setItem("wd_bonus500_active", "true");
  
    // 1️⃣ close gate
    onComplete();
  
    // 2️⃣ open Venue Ranker (normal intro)
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent("openOverlay", {
          detail: {
            type: "venueranker",
            startAt: "intro",
          },
        })
      );
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1.25rem",
        overflowX: "hidden", // ✅ 1) overlay clips horizontal overflow
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: isMobile ? 520 : 720,
          background: "rgba(255,255,255,0.96)",
          borderRadius: 18,
          boxShadow: `
            0 0 0 1px rgba(220,235,255,0.8),
            0 0 55px rgba(200,225,255,0.9),
            0 0 90px rgba(200,225,255,0.6),
            0 25px 60px rgba(0,0,0,0.45)
          `,
          padding: "1.25rem",
          maxHeight: "90vh",
          overflowY: "auto",
          overflowX: "hidden", // ✅ 2) card clips horizontal overflow
          position: "relative", // ✅ for the X button
        }}
      >
        {/* 🩷 Pink X inside the card */}
        <button
          className="pixie-card__close"
          onClick={handleCloseToDashboard} // ✅ use close handler
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 4,
            zIndex: 10,
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
            style={{ width: 22, height: 22 }}
          />
        </button>

        {/* HERO STACK */}
        <div style={{ textAlign: "center" }}>
          {/* Logo Cloud */}
          <img
            src={`${import.meta.env.BASE_URL}assets/images/logo_cloud.png`}
            alt="Wed&Done trusted venues and partners"
            style={{
              width: isMobile ? 170 : 250,
              maxWidth: "80%",
              height: "auto",
              display: "block",
              margin: "0 auto 0.25rem",
              opacity: 0.95,
            }}
          />

          {/* Title */}
          <h2
            style={{
              fontFamily:
                "'Nunito', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
              fontSize: isMobile ? "1.05rem" : "1.5rem",
              fontWeight: 900,
              letterSpacing: "-0.2px",
              margin: "0 0 0.65rem",
              color: "#2c62ba",
              lineHeight: 1.05,
            }}
          >
            Planning your Arizona wedding <br />
            shouldn’t feel like a full-time job.
          </h2>

          <br />
          <div style={{ maxWidth: 560, margin: "0.25rem auto 0", padding: "0 10px" }}>
            <p style={{ margin: "0.6rem 0 0", color: "#444", lineHeight: 1.45 }}>
  Hi — we’re Rachel &amp; Karen 👋  
  We built Wed&amp;Done because wedding planning somehow turned into a stressful, chaotic,
  overpriced scavenger hunt — and honestly, we were DONE with that.
</p>
</div>
<br />

          {/* ✅ Founder Interview Video (NEW) */}
          <div style={{ width: "100%", display: "flex", justifyContent: "center", marginBottom: "0.35rem" }}>
            <div
              style={{
                width: "100%",
                maxWidth: isMobile ? 420 : 560,
                borderRadius: 14,
                overflow: "hidden",
                background: "#000",
                boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#000" }}>
                <iframe
                  id="wdGateVimeo"
                  src="https://player.vimeo.com/video/829588294?title=0&byline=0&portrait=0&dnt=1&api=1&player_id=wdGateVimeo"
                  title="Why Wed&Done — Founder Interview"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, display: "block" }}
                />
              </div>
            </div>
          </div>
          <br></br>

          {showBonusCTA && (
  <div
    style={{
      marginTop: 16,
      marginBottom: 8,
      textAlign: "center",
    }}
  >
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto 10px",
        padding: "14px 18px",
        background: "rgba(43, 108, 176, 0.08)",
        borderRadius: 16,
        boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: "1.05rem",
          color: "#2c62ba",
          marginBottom: 6,
        }}
      >
        ✨ You made it in early
      </div>

      <div
        style={{
          fontSize: "0.95rem",
          color: "#333",
          lineHeight: 1.45,
          marginBottom: 12,
        }}
      >
        You’re one of the first couples to try out Wed&amp;Done —  
        and you’ve unlocked a <strong>$500 Venue Ranker credit</strong> for being here early.
      </div>

      <button
        className="boutique-primary-btn"
        onClick={handleOpenBonusIntro}
        style={{
          paddingInline: 28,
          fontSize: "0.95rem",
        }}
      >
        Claim your $500 Venue Ranker credit →
      </button>
    </div>
  </div>
)}
          

          {/* Founders line (directly under Jump link) */}
          <div style={{ maxWidth: 560, margin: "0.25rem auto 0", padding: "0 10px" }}>
            <p style={{ margin: "0.6rem 0 0", color: "#444", lineHeight: 1.45 }}>
              Wed&amp;Done was built by two real wedding pros — the tech whiz behind the magic: Rachel Leintz
              (photographer), and the planning heart of the system: Karen Podrasky (planner).
            </p>
          </div>

          {/* ✅ Scrapbook Photos (wrapped + clipped) */}
<div
  style={{
    marginTop: "0.9rem",
    display: "flex",
    justifyContent: "center",
    width: "100%",
    overflow: "hidden",     // ✅ clip both axes
    overflowY: "hidden",    // ✅ kill tiny vertical scrollbar
  }}
>
  <div
    style={{
      transform: isMobile ? "none" : "translateX(36px)",
      overflow: "hidden",   // ✅ also prevent inner div from becoming scrollable
      overflowY: "hidden",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        flexWrap: isMobile ? "wrap" : "nowrap",
        gap: isMobile ? 12 : 0,
        maxWidth: isMobile ? 520 : "none",
        width: "100%",
        padding: isMobile ? "0 10px" : 0,
        position: "relative",
        minHeight: isMobile ? 0 : 170,
        overflow: "hidden",   // ✅ belt + suspenders
        overflowY: "hidden",
      }}
    >
      {photos.map((src, index) => {
        const isCenter = index === 2;
        const desktopOverlap = index * -18;

        return (
          <img
            key={src}
            src={`${import.meta.env.BASE_URL}${src}`}
            alt="Wed&Done founders at real weddings"
            style={{
              display: "block", // ✅ removes inline-image baseline weirdness
              width: isMobile ? (isCenter ? 172 : 160) : isCenter ? 150 : 135,
              height: "auto",
              maxHeight: isMobile ? 180 : isCenter ? 165 : 150,
              objectFit: "contain",
              borderRadius: 22,
              border: "3px solid #fff",
              background: "#fff",
              boxShadow: "0 12px 28px rgba(0,0,0,0.22)",
              position: "relative",
              left: isMobile ? 0 : desktopOverlap,
              transform: `rotate(${(isMobile ? rotationsMobile : rotationsDesktop)[index]}deg)`,
              zIndex: isCenter ? 50 : 40 + index,
            }}
          />
        );
      })}
    </div>
  </div>
</div>

          {/* Text */}
          <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 10px" }}>
            <p style={{ margin: "1.2rem 0 0", color: "#444", lineHeight: 1.45 }}>
              Wed&amp;Done is your “book it with a button” magic for Arizona weddings. Find and book your venue, catering,
              and all that jazz, in under an hour (seriously).
              <br />
              <br />
              Whether you need to book the whole shabang or just need that perfect cake, florals, or photographer, we’ve got you
              covered.
              <br />
              <br />
              See real venues, real vendors, real prices, then book it all with a click.
              <br />

              <img
                src={`${import.meta.env.BASE_URL}assets/images/AZLogo.png`}
                alt="Arizona"
                style={{
                  display: "block",
                  margin: "0.7rem auto 0.15rem",
                  width: isMobile ? 54 : 62,
                  height: "auto",
                  opacity: 0.95,
                }}
              />
              <span
                style={{
                  display: "block",
                  textAlign: "center",
                  fontSize: "0.85rem",
                  color: "#6b7280",
                  fontWeight: 700,
                }}
              >
                Arizona-only for now ✨
              </span>

              {/* Secondary explainer video */}
              <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "center" }}>
                <div
                  style={{
                    width: "100%",
                    maxWidth: isMobile ? 420 : 520,
                    borderRadius: 14,
                    overflow: "hidden",
                    background: "#000",
                    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
                  }}
                >
                  <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#000" }}>
                    <iframe
                      src="https://player.vimeo.com/video/1106994127?title=0&byline=0&portrait=0&dnt=1"
                      title="What is Wed&Done"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                    />
                  </div>
                </div>
              </div>

              <p
                style={{
                  textAlign: "center",
                  marginTop: "0.5rem",
                  fontSize: "0.85rem",
                  color: "#666",
                  lineHeight: 1.4,
                }}
              >
                Prefer a quick overview? This video walks through how the system works.
              </p>
            </p>
          </div>
        </div>

        {/* ACCOUNT CTA */}
        <div id="dashboardGateForm" style={{ marginTop: "1.25rem" }}>
          <p style={{ textAlign: "center", margin: "0 0 0.35rem", fontWeight: 800, color: "#222" }}>
            Make an account to unlock the dashboard ✨
          </p>

          <div style={{ textAlign: "center", color: "#666", fontSize: "0.9rem", marginBottom: "0.6rem" }}>
            Takes less than a minute • saves your progress
          </div>

          <img
            src={`${import.meta.env.BASE_URL}assets/images/gold_key.png`}
            alt="Unlock Wed&Done dashboard"
            style={{ display: "block", margin: "0 auto 0.9rem", width: 55, height: "auto" }}
          />

          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => {
                phCapture("dashboard_gate_make_account_modal_opened", {
                  device,
                  logged_in: !!auth.currentUser,
                  source: "dashboardGate",
                });
                setShowAccountModal(true);
              }}
              className="boutique-primary-btn"
              style={{
                width: "auto",
                minWidth: 240,
                padding: "0.9rem 2.5rem",
                margin: "0 auto",
                display: "block",
              }}
            >
              Make an account ✨
            </button>

            <div style={{ marginTop: 12 }}>
  <button
    type="button"
    className="boutique-back-btn"
    style={{ width: "auto", minWidth: 240, margin: "0 auto", display: "block" }}
    onClick={() => {
      phCapture("dashboard_gate_snoozed", {
        device,
        logged_in: !!auth.currentUser,
        source: "dashboardGate",
        hours: 24,
      });

      // ✅ snooze for 24 hours
      try {
        localStorage.setItem("wd_gate_snooze_until", String(Date.now() + 24 * 60 * 60 * 1000));
      } catch {}

      // ✅ close gate and show dashboard
      onComplete();
    }}
  >
    Not now — I want to peek first 👀
  </button>
</div>

            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={onLogin}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#2b6cb0",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                }}
              >
                Already have an account? Log in
              </button>
            </div>
            {showAccountModal && (
  <AccountModal
    title="Make an account to unlock the dashboard ✨"
    subtitle="Takes less than a minute — saves your progress."
    onClose={() => setShowAccountModal(false)}
    onSuccess={() => {
      phCapture("dashboard_gate_account_created_or_logged_in", {
        device,
        source: "dashboardGate",
      });
    
      // ✅ mark gate complete (so it never shows again)
      try {
        localStorage.setItem("wd_guestbook_done", "true");
      } catch {}
    
      setShowAccountModal(false);
      onComplete();
    }}
  />
)}
          </div>
        </div>
      </div>
    </div>
  );
}