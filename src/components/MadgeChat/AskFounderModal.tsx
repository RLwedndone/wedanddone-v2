import React, { useEffect } from "react";

type Props = {
  onClose: () => void;
  onEvent?: (event: string, props?: Record<string, any>) => void;

  // ✅ make these configurable
  founderEmail?: string;
  founderPhoneText?: string; // display text: "(480) 555-1234"
  founderPhoneTel?: string;  // tel link: "+14805551234"
};

export default function AskFounderModal({
  onClose,
  onEvent,
  founderEmail = "rachel@wedanddone.com",
  founderPhoneText = "623-330-6382",
  founderPhoneTel = "623-330-6382",
}: Props) {
  useEffect(() => {
    onEvent?.("madge_help_founder_modal_opened", { source: "askFounderModal" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pixie-overlay" style={{ zIndex: 3100 }} onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="pixie-card account-card--expanded"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, width: "min(640px, 92vw)", position: "relative" }}
      >
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>

        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          <h2 className="px-title" style={{ marginBottom: "0.35rem" }}>
            Yup, we're human and you can actually reach us 👋
          </h2>

          <img
  src={`${import.meta.env.BASE_URL}assets/images/RFounderGlasses.webp`}
  alt="Rachel, co-founder of Wed&Done"
  style={{
    width: 140,
    maxWidth: "90%",
    height: "auto",
    borderRadius: 16, // 👈 rounded rectangle
    objectFit: "contain",
    display: "block",
    margin: "0.75rem auto 1rem",
    boxShadow: "0 10px 26px rgba(0,0,0,0.18)",
  }}
/>

          <p className="px-prose-narrow" style={{ marginBottom: "0.75rem" }}>
            I’m Rachel — one of the humans who built Wed&amp;Done. If something’s confusing, weird, or you just want a
            gut-check, you can text or email me directly.
          </p>

          <p className="px-prose-narrow" style={{ marginTop: 0, marginBottom: "1.15rem", color: "#666" }}>
            I reply pretty quickly… just not <b>magic lightning fast 24/7</b> ⚡😅
          </p>

          <div
            style={{
              display: "grid",
              gap: 12,
              maxWidth: 420,
              margin: "0 auto",
              textAlign: "left",
            }}
          >
            <div
              style={{
                border: "1px solid rgba(44,98,186,0.18)",
                borderRadius: 14,
                padding: "0.85rem 0.9rem",
                background: "rgba(240,246,255,0.7)",
              }}
            >
              <div style={{ fontWeight: 900, color: "#2c62ba", marginBottom: 6 }}>📧 Email</div>
              <a
                href={`mailto:${founderEmail}`}
                style={{ color: "#111", fontWeight: 800, textDecoration: "underline" }}
                onClick={() => onEvent?.("madge_help_email_clicked", { email: founderEmail })}
              >
                {founderEmail}
              </a>
            </div>

            <div
              style={{
                border: "1px solid rgba(44,98,186,0.18)",
                borderRadius: 14,
                padding: "0.85rem 0.9rem",
                background: "rgba(240,246,255,0.7)",
              }}
            >
              <div style={{ fontWeight: 900, color: "#2c62ba", marginBottom: 6 }}>📱 Text</div>
              <a
                href={`tel:${founderPhoneTel}`}
                style={{ color: "#111", fontWeight: 800, textDecoration: "underline" }}
                onClick={() => onEvent?.("madge_help_text_clicked", { phone: founderPhoneTel })}
              >
                {founderPhoneText}
              </a>

              <div style={{ marginTop: 8, fontSize: "0.85rem", color: "#666" }}>
                Text is fastest. If it’s after hours, I’ll reply as soon as I’m back at my keyboard (or my coffee).
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button className="boutique-back-btn" style={{ width: "min(300px, 86vw)" }} onClick={onClose}>
              Back to guide ✨
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}