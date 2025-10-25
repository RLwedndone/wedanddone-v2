// src/components/venue-ranker/VenueGuestCountScreen.tsx
import React, { useEffect, useState } from "react";
import { getGuestState, setGuestCount } from "../../utils/guestCountStore";

interface VenueGuestCountScreenProps {
  onContinue: () => void;
  onClose: () => void;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n || 0));

const VenueGuestCountScreen: React.FC<VenueGuestCountScreenProps> = ({ onContinue, onClose }) => {
  const [guestCount, setGC] = useState<number>(0);
  const [locked, setLocked] = useState<boolean>(false);

  // Pull from the single source of truth + keep in sync with events
  useEffect(() => {
    let mounted = true;

    const pull = async () => {
      const st = await getGuestState();
      if (!mounted) return;
      setGC(Number(st.value || 0));
      setLocked(!!st.locked);
    };

    pull();

    const sync = () => pull();
    window.addEventListener("guestCountUpdated", sync);
    window.addEventListener("guestCountLocked", sync);
    window.addEventListener("guestCountUnlocked", sync);

    return () => {
      mounted = false;
      window.removeEventListener("guestCountUpdated", sync);
      window.removeEventListener("guestCountLocked", sync);
      window.removeEventListener("guestCountUnlocked", sync);
    };
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (locked) return;
    const raw = Number(e.target.value);
    const next = clamp(raw, 1, 250);
    setGC(Number.isFinite(next) ? next : 0);
    await setGuestCount(next);
  };

  const handleContinue = () => {
    if (guestCount >= 1 && guestCount <= 250) onContinue();
  };

  return (
    // Standard white card (overlay is provided by VenueRankerOverlay)
    <div className="pixie-card">
      {/* Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* Lil looping video */}
        <div style={{ marginBottom: "1.25rem" }}>
          <video
            autoPlay
            muted
            playsInline
            loop
            className="px-media"
            style={{ maxWidth: 260, borderRadius: 16 }}
          >
            <source src={`${import.meta.env.BASE_URL}assets/videos/wedding_guests.mp4`} type="video/mp4" />
          </video>
        </div>

        {/* Title (keep the larger Jenna Sue look) */}
        <h2
          className="px-title px-title--lg"
          style={{
            fontSize: "2.4rem",
            marginBottom: "0.6rem",
            color: "#2c62ba",
          }}
        >
          How many guests are you expecting?
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: "1rem" }}>
          Enter any number up to 250. After you book your venue, this will “lock in” your guest
          count. As you get closer to your wedding date, you can always increase your count, but you
          won’t be able to lower it.
        </p>

        {/* Guest count input */}
        <div style={{ maxWidth: 360, margin: "0 auto 1.25rem" }}>
          <input
            className="px-input"
            type="number"
            min={1}
            max={250}
            value={Number.isFinite(guestCount) ? guestCount : 0}
            onChange={handleChange}
            disabled={locked}
            placeholder="e.g., 120"
            inputMode="numeric"
            style={{
              textAlign: "center",
              fontWeight: 600,
            }}
          />
        </div>

        {locked && (
          <p className="px-prose-narrow" style={{ color: "#666", marginTop: "-0.5rem", marginBottom: "1rem" }}>
            Guest count is locked after booking. You'll be able to increase your count closer to your wedding date, using the Guest Count Scroll!
          </p>
        )}

        {/* CTA */}
        <button
          className="boutique-primary-btn"
          onClick={handleContinue}
          disabled={guestCount < 1 || guestCount > 250}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default VenueGuestCountScreen;