import React, { useEffect } from "react";

type Props = {
  onClose: () => void;
  onFAQ: () => void;

  // ✅ actions
  onChatWithMadge: () => void; // open your existing AI chat
  onWalkthrough: () => void;   // open walkthrough modal/scroll
  onAskFounder: () => void;    // open founder contact modal

  // optional analytics hook
  onEvent?: (event: string, props?: Record<string, any>) => void;
};

export default function MadgeHelpCard({
    onClose,
    onFAQ, // ✅ ADD THIS
    onChatWithMadge,
    onWalkthrough,
    onAskFounder,
    onEvent,
  }: Props) {
  useEffect(() => {
    onEvent?.("madge_help_opened", { source: "madgeHelpCard" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="pixie-overlay"
      style={{ zIndex: 3000 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="pixie-card account-card--compact"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 560,
          width: "min(560px, 92vw)",
          position: "relative",
        }}
      >
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>

        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          {/* Optional header art (swap if you have a Madge image) */}
          <img
            src={`${import.meta.env.BASE_URL}assets/images/madgeGuideCloud.png`}
            alt="Help"
            className="px-media"
            style={{ maxWidth: 200, margin: "0 auto 0.9rem", display: "block" }}
          />

          <h2 className="px-title" style={{ marginBottom: "0.4rem" }}>
          Meet Madge ... <br></br>your<br></br> Wed&Done guide ✨
          </h2>

          <p className="px-prose-narrow" style={{ marginBottom: "1rem" }}>
            Tell me what you need and I’ll point you to the right magic door.
          </p>

          <div style={{ display: "grid", gap: 12, justifyContent: "center", marginTop: 6 }}>
            
          <button
              className="boutique-primary-btn"
              style={{ width: "min(360px, 88vw)" }}
              onClick={() => {
                onEvent?.("madge_help_walkthrough_clicked", { source: "madgeHelpCard" });
                onWalkthrough();
              }}
            >
              Walk me through this 🧭
            </button>

            <button
              className="boutique-back-btn"
              style={{ width: "min(360px, 88vw)" }}
              onClick={() => {
                onEvent?.("madge_help_ask_founder_clicked", { source: "madgeHelpCard" });
                onAskFounder();
              }}
            >
              Talk to a human 💬
            </button>
            
            
            <button
              className="boutique-primary-btn"
              style={{ width: "min(360px, 88vw)" }}
              onClick={() => {
                onEvent?.("madge_help_chat_clicked", { source: "madgeHelpCard" });
                onChatWithMadge();
              }}
            >
              Chat with Madge 🤖✨
            </button>

           

            
          </div>
        </div>
      </div>
    </div>
  );
}