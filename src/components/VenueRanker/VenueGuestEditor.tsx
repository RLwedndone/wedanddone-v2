// src/components/VenueRanker/VenueGuestEditor.tsx
import React, { useEffect, useState } from "react";
import { getGuestState, setGuestCount } from "../../utils/guestCountStore";

interface VenueGuestEditorProps {
  guestCount: number | null;
  setGuestCount: (count: number | null) => void;
  confirmedGuestCount: number | null;
  setConfirmedGuestCount: (count: number | null) => void;

  onClose: () => void;
  setCurrentScreen: (screen: string) => void; // keeping prop so parent doesn’t break
}

const VenueGuestEditor: React.FC<VenueGuestEditorProps> = ({
  guestCount,
  setGuestCount: setGuestCountInParent,
  confirmedGuestCount,
  setConfirmedGuestCount,
  onClose,
  setCurrentScreen, // unused but kept
}) => {
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string[]>([]);
  const [storeGC, setStoreGC] = useState<number>(
    guestCount ?? confirmedGuestCount ?? 0
  );

  // text input value so user can type freely
  const [newGuestCount, setNewGuestCount] = useState<string>(
    String(storeGC || "")
  );

  // pull from the single source of truth
  useEffect(() => {
    let mounted = true;

    const pull = async () => {
      const st = await getGuestState();
      if (!mounted) return;

      const current = Number(st.value || 0);
      const isLocked = !!st.locked;
      const who = st.lockedBy || [];

      setStoreGC(current);
      setNewGuestCount(current > 0 ? String(current) : "");
      setLocked(isLocked);
      setLockedBy(who);
      setLoading(false);
    };

    pull();

    const sync = async () => pull();

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

  const parsed = Number(newGuestCount);
  const isValidNumber = Number.isFinite(parsed) && parsed > 0 && parsed <= 2000; // sanity cap
  const displayGC = storeGC > 0 ? storeGC : parsed;

  const handleConfirm = async () => {
    // If locked, we do not try to change the value—just confirm and continue
    if (locked) {
      setConfirmedGuestCount(storeGC);
      setGuestCountInParent(storeGC);
      onClose();
      return;
    }

    // Editable path: validate and persist
    if (!isValidNumber) return;

    const chosen = Math.round(parsed);

    await setGuestCount(chosen); // persist to store/Firestore
    setConfirmedGuestCount(chosen);
    setGuestCountInParent(chosen);
    onClose();
  };

  if (loading) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "18px",
          padding: "2rem",
          maxWidth: "640px",
          width: "100%",
          boxShadow: "0 0 10px rgba(0,0,0,0.25)",
          fontFamily: "'Nunito', sans-serif",
          textAlign: "center",
          position: "relative",
        }}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            border: "none",
            background: "transparent",
            fontSize: 20,
            cursor: "pointer",
          }}
        >
          ✖
        </button>

        {/* Header / Visual */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/wedding_guests.mp4`}
          autoPlay
          muted
          loop
          playsInline
          style={{
            width: 200,
            borderRadius: 10,
            margin: "0 auto 1rem",
            display: "block",
          }}
        />

        {locked ? (
          <>
            <h2 style={{ marginBottom: "0.5rem", fontSize: "1.8rem", color: "#2c62ba" }}>
              Guest Count Locked
            </h2>
            <p style={{ marginBottom: "1rem" }}>
              Your guest count is locked after a booking
              {lockedBy.length ? ` (from: ${lockedBy.join(", ")})` : ""}.
            </p>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontWeight: 700, marginRight: 8 }}>Confirmed guests:</label>
              <span style={{ fontSize: "1.1rem" }}>{storeGC}</span>
            </div>

            <button onClick={handleConfirm} className="boutique-primary-btn" style={{ marginTop: 0 }}>
              Continue with {storeGC} guests
            </button>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: "0.5rem", fontSize: "1.8rem", color: "#2c62ba" }}>
              Update your guest count
            </h2>

            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={newGuestCount}
              onChange={(e) => setNewGuestCount(e.target.value)}
              placeholder="Enter your guest count"
              style={{
                padding: "0.8rem",
                fontSize: "1.1rem",
                marginBottom: "1.25rem",
                borderRadius: "12px",
                width: "100%",
                maxWidth: 320,
                marginInline: "auto",
                display: "block",
                border: "1px solid #ccc",
                textAlign: "center",
              }}
            />

<button
  onClick={handleConfirm}
  className="boutique-primary-btn"
  style={{ marginTop: 0 }}
  disabled={!isValidNumber}
>
  Set Guest Count
</button>
          </>
        )}
      </div>
    </div>
  );
};

export default VenueGuestEditor;