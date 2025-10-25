// src/components/common/WeddingDateConfirmScreen.tsx
// (or wherever this lives)

interface WeddingDateConfirmScreenProps {
  formattedDate: string;   // can be ISO like "2025-10-02" or already pretty
  dayOfWeek: string;
  userHasDate: boolean;
  weddingDateLocked: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onEditDate: () => void;
}

// turn "2025-10-02" into "October 2nd, 2025"
function toPrettyDate(input: string): string {
  // Try to detect ISO-ish strings and normalize to noon to avoid TZ shifts
  const maybeISO = /^\d{4}-\d{2}-\d{2}$/;
  const d = new Date(maybeISO.test(input) ? `${input}T12:00:00` : input);

  if (isNaN(d.getTime())) {
    // not a date—just return what we got
    return input;
  }

  const month = d.toLocaleString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();

  const suffix = (() => {
    if (day >= 11 && day <= 13) return "th";
    switch (day % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  })();

  return `${month} ${day}${suffix}, ${year}`;
}

const WeddingDateConfirmScreen: React.FC<WeddingDateConfirmScreenProps> = ({
  formattedDate,
  dayOfWeek,
  userHasDate,
  weddingDateLocked,
  onConfirm,
  onClose,
  onEditDate,
}) => {

  console.log("[WeddingDateConfirmScreen] props:", {
    formattedDate,
    dayOfWeek,
    userHasDate,
    weddingDateLocked,
  });
  const prettyDate = toPrettyDate(formattedDate);

  return (
    <div className="pixie-card pixie-card--modal">
      {/* close (pink X) */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>
  
      <div className="pixie-card__body">
        {/* 📽️ Calendar Video */}
        <div className="px-media px-media--sm">
          <video
            autoPlay
            loop
            muted
            playsInline
            src={`${import.meta.env.BASE_URL}assets/videos/calendar_loop.mp4`}
          />
        </div>
  
        {/* Title */}
        <h2 className="px-title">Here’s your wedding date!</h2>
  
        {/* Date lines */}
        <p className="px-prose-narrow" style={{ marginBottom: "0.75rem" }}>
          <strong>{prettyDate}</strong> — a <strong>{dayOfWeek}</strong>
        </p>
  
        <p className="px-prose-narrow">Let’s confirm it and keep going.</p>
  
        {/* 🛑 Only show the “contact Madge” line if the user CAN’T edit */}
        {!(userHasDate && !weddingDateLocked) && (
          <p className="px-prose-narrow" style={{ marginTop: "0.25rem" }}>
            If you need to change your date, please reach out to{" "}
            <a href="mailto:Madge@wedanddone.com">
              <strong>Madge@wedanddone.com</strong>
            </a>.
          </p>
        )}
  
        {/* CTAs */}
        <div className="px-cta-col">
          <button className="boutique-primary-btn" onClick={onConfirm}>
            Confirm &amp; Continue
          </button>
  
          {userHasDate && !weddingDateLocked && (
            <button className="boutique-back-btn" onClick={onEditDate}>
              ✏️ Change My Date
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeddingDateConfirmScreen;