// src/components/VenueRanker/VenueGuestEditor.tsx
import React, { useEffect, useMemo, useState } from "react";
import { getGuestState, setGuestCount } from "../../utils/guestCountStore";

interface VenueGuestEditorProps {
  // These props can remain for your parent flow,
  // but we will prefer the store’s value to prefill.
  guestCount: number | null;
  setGuestCount: (count: number | null) => void;
  confirmedGuestCount: number | null;
  setConfirmedGuestCount: (count: number | null) => void;

  venueInfo: { maxCapacity: number };
  onClose: () => void;

  // You had this to jump back to a specific screen
  setCurrentScreen: (screen: string) => void;
}

const VenueGuestEditor: React.FC<VenueGuestEditorProps> = ({
  guestCount,
  setGuestCount: setGuestCountInParent,
  confirmedGuestCount,
  setConfirmedGuestCount,
  venueInfo,
  onClose,
  setCurrentScreen,
}) => {
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string[]>([]);
  const [storeGC, setStoreGC] = useState<number>(guestCount ?? confirmedGuestCount ?? 0);

  // local editable field mirrors either the locked value or store value
  const [newGuestCount, setNewGuestCount] = useState<number>(storeGC);

  // pull from the single source of truth
  useEffect(() => {
    let mounted = true;
    (async () => {
      const st = await getGuestState();
      if (!mounted) return;

      const current = Number(st.value || 0);
      const isLocked = !!st.locked;
      const who = st.lockedBy || [];

      setStoreGC(current);
      setNewGuestCount(current);
      setLocked(isLocked);
      setLockedBy(who);
      setLoading(false);
    })();

    const sync = async () => {
      const st = await getGuestState();
      if (!mounted) return;
      setStoreGC(Number(st.value || 0));
      setNewGuestCount(Number(st.value || 0));
      setLocked(!!st.locked);
      setLockedBy(st.lockedBy || []);
    };

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

  const maxCap = Math.max(0, Number(venueInfo?.maxCapacity || 0));

  // build options: 25-steps up to maxCap, plus exact current value if it’s not aligned
  const guestOptions = useMemo(() => {
    const opts: number[] = [];
    const step = 25;
    for (let i = step; i <= maxCap; i += step) opts.push(i);
    if (storeGC > 0 && !opts.includes(storeGC) && storeGC <= maxCap) {
      opts.push(storeGC);
    }
    return opts.sort((a, b) => a - b);
  }, [maxCap, storeGC]);

  const handleConfirm = async () => {
    // If locked, we do not try to change the value—just confirm and continue
    if (locked) {
      // still let parent know the value we're using
      setConfirmedGuestCount(storeGC);
      onClose();
      return;
    }

    // Editable path: clamp and persist
    const chosen = Math.max(0, Math.min(newGuestCount || 0, maxCap));
    await setGuestCount(chosen);            // persist to the store/Firestore
    setConfirmedGuestCount(chosen);         // notify parent flow
    setGuestCountInParent(chosen);          // if your parent needs it too
    onClose();
  };

  if (loading) {
    return null;
  }

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
        {/* Close (returns to your scroll view) */}
        <button
          aria-label="Close"
          onClick={() => setCurrentScreen("scroll")}
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

            <button
              onClick={handleConfirm}
              className="boutique-primary-btn"
              style={{ marginTop: 0 }}
            >
              Continue with {storeGC} guests
            </button>

            <button
              className="boutique-back-btn"
              style={{ marginTop: "0.75rem" }}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("openUserMenuScreen", { detail: "guestListScroll" })
                )
              }
            >
              Change my guest count
            </button>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: "0.5rem", fontSize: "1.8rem", color: "#2c62ba" }}>
              Confirm Your Guest Count
            </h2>
            <p style={{ marginBottom: "1rem" }}>
              This venue allows a maximum of <strong>{maxCap}</strong> guests.
            </p>

            <select
              value={newGuestCount || ""}
              onChange={(e) => {
                const val = Number(e.target.value);
                setNewGuestCount(Math.min(Math.max(val, 0), maxCap));
              }}
              style={{
                padding: "0.6rem",
                fontSize: "1rem",
                marginBottom: "1.25rem",
                borderRadius: "10px",
                width: "100%",
                maxWidth: 320,
                marginInline: "auto",
                display: "block",
                border: "1px solid #ccc",
              }}
            >
              <option value="" disabled>
                Select guest count
              </option>
              {guestOptions.map((count) => (
                <option key={count} value={count}>
                  {count} guests
                </option>
              ))}
            </select>

            <button
              onClick={handleConfirm}
              className="boutique-primary-btn"
              style={{ marginTop: 0 }}
              disabled={!newGuestCount}
            >
              Use {newGuestCount || 0} guests
            </button>

            <div style={{ marginTop: ".75rem", fontSize: ".9rem", color: "#666" }}>
              We’ll apply this number to venue pricing and availability.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VenueGuestEditor;