// src/components/VenueRanker/ReDesign/RD_MadgeInterviewQ3_Guest.tsx
import React, { useEffect, useMemo, useState } from "react";
import "../../../styles/globals/boutique.master.css";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../firebase/firebaseConfig";
import { getGuestState, setGuestCount } from "../../../utils/guestCountStore";
import type { RDInterviewState } from "./rdVenueTypes";

type InterviewState = {
  weddingDate?: string;
  dayOfWeek?: string;
  guestCount?: number;
};

const LS_KEY = "rd_ranker_interview";

/** ✅ If LS is just the overlay “seed defaults”, treat as unanswered (so nothing is pre-selected). */
function isSeedDefault(parsed: any) {
  return (
    parsed &&
    parsed.budgetTier === "notsure" &&
    parsed.collectionLean === "neutral" &&
    typeof parsed.includeCatering !== "boolean" && // null/undefined
    typeof parsed.guestCount !== "number" &&
    Array.isArray(parsed.vibes) &&
    parsed.vibes.length === 0
  );
}

function readInterview(): InterviewState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    // ✅ IMPORTANT: don’t hydrate UI from the default seed object
    if (isSeedDefault(parsed)) return {};

    return parsed || {};
  } catch {
    return {};
  }
}

function writeInterview(next: InterviewState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function toPrettyDate(input: string): string {
  const maybeISO = /^\d{4}-\d{2}-\d{2}$/;
  const d = new Date(maybeISO.test(input) ? `${input}T12:00:00` : input);

  if (isNaN(d.getTime())) return input;

  const month = d.toLocaleString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();

  const suffix = (() => {
    if (day >= 11 && day <= 13) return "th";
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  })();

  return `${month} ${day}${suffix}, ${year}`;
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n || 0));

interface Props {
  onNext: (data: Partial<RDInterviewState>) => void;
  onBack: () => void;
  onClose: () => void;
}

const RD_MadgeInterviewQ3_Guest: React.FC<Props> = ({ onNext, onBack, onClose }) => {
  const existing = useMemo(() => readInterview(), []);

  // --- Wedding date (source of truth = Firestore user doc) ---
  const [weddingDate, setWeddingDate] = useState<string>(existing.weddingDate || "");
  const [dayOfWeek, setDayOfWeek] = useState<string>(existing.dayOfWeek || "");
  const [weddingDateLocked, setWeddingDateLocked] = useState<boolean>(false);

  const [isEditingDate, setIsEditingDate] = useState<boolean>(false);
  const [dateInput, setDateInput] = useState<string>("");
  const [dateError, setDateError] = useState<string>("");

  // --- Guest count (source of truth = guestCountStore) ---
  // ✅ Start EMPTY (not 0) so nothing looks “pre-filled”
  const [guestCount, setGC] = useState<number>(() => {
    return typeof existing.guestCount === "number" ? existing.guestCount : 0;
  });
  const [guestLocked, setGuestLocked] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // ✅ GUEST fallback: hydrate from localStorage
      if (!user) {
        try {
          const wd = localStorage.getItem("weddingDate") || "";
          const dow = localStorage.getItem("dayOfWeek") || "";
          if (wd) setWeddingDate(wd);
          if (dow) setDayOfWeek(dow);

          // keep interview object in sync too
          if (wd || dow) {
            const cur = readInterview();
            writeInterview({
              ...cur,
              weddingDate: wd || cur.weddingDate,
              dayOfWeek: dow || cur.dayOfWeek,
            });
          }
        } catch {}
        return;
      }

      // ✅ LOGGED IN: hydrate from Firestore
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) return;

        const d = snap.data() as any;

        const wdRaw = typeof d?.weddingDate === "string" ? d.weddingDate.trim() : "";
        const dowRaw = typeof d?.dayOfWeek === "string" ? d.dayOfWeek.trim() : "";
        const locked = !!(d?.weddingDateLocked ?? d?.dateLocked);

        setWeddingDateLocked(locked);

        if (wdRaw) setWeddingDate(wdRaw);
        if (dowRaw) setDayOfWeek(dowRaw);

        // mirror to LS so other screens (CastleModal etc) can read it
        if (wdRaw || dowRaw) {
          try {
            if (wdRaw) localStorage.setItem("weddingDate", wdRaw);
            if (dowRaw) localStorage.setItem("dayOfWeek", dowRaw);
          } catch {}

          const cur = readInterview();
          writeInterview({
            ...cur,
            weddingDate: wdRaw || cur.weddingDate,
            dayOfWeek: dowRaw || cur.dayOfWeek,
          });
        }
      } catch (e) {
        console.warn("Could not load wedding date:", e);
      }
    });

    return () => unsub();
  }, []);

  // hydrate guest count from store + listen to events
  useEffect(() => {
    let mounted = true;

    const pull = async () => {
      const st = await getGuestState();
      if (!mounted) return;

      const nextVal = Number(st.value || 0);

      setGC(nextVal);
      setGuestLocked(!!st.locked);

      // ✅ Only mirror guestCount into interview LS if it is a real value (>=1).
      // This prevents “0” from becoming a sticky saved answer after reset.
      if (nextVal >= 1) {
        const cur = readInterview();
        writeInterview({ ...cur, guestCount: nextVal });
      } else {
        // if it’s 0/empty, remove guestCount from interview object
        const cur = readInterview();
        const { guestCount: _gc, ...rest } = cur as any;
        writeInterview(rest);
      }
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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setDateInput(input);
    setDateError("");

    const date = new Date(input + "T12:00:00"); // ✅ avoids timezone shift
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(date.getTime())) {
      setDayOfWeek("");
      return;
    }

    if (date <= today) {
      setDateError("Please choose a date in the future.");
      return;
    }

    const dow = date.toLocaleDateString("en-US", { weekday: "long" });
    setDayOfWeek(dow);
  };

  const saveWeddingDate = async () => {
    if (!dateInput || !dayOfWeek || dateError) return;

    const user = auth.currentUser;

    // ✅ If logged in, mirror to Firestore
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          weddingDate: dateInput,
          dayOfWeek,
          weddingDateLocked: false,
          dateLocked: false,
        });
      } catch (e) {
        console.warn("Could not save wedding date:", e);
      }
    }

    // ✅ ALWAYS update local React state
    setWeddingDate(dateInput);
    setIsEditingDate(false);

    // ✅ Mirror to interview LS
    const cur = readInterview();
    writeInterview({ ...cur, weddingDate: dateInput, dayOfWeek });

    try {
      localStorage.setItem("weddingDate", dateInput);
      localStorage.setItem("dayOfWeek", dayOfWeek);
    } catch {
      // ignore
    }
  };

  const handleGuestChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (guestLocked) return;

    const raw = Number(e.target.value);

    // ✅ allow blank field without snapping to “1”
    if (!Number.isFinite(raw)) return;

    // if user clears the field, e.target.value becomes "" -> Number("") = 0
    if (e.target.value === "") {
      setGC(0);
      // also clear mirrored interview value
      const cur = readInterview();
      const { guestCount: _gc, ...rest } = cur as any;
      writeInterview(rest);
      return;
    }

    const next = clamp(raw, 1, 250);

    setGC(next);

    // ✅ source of truth write
    await setGuestCount(next);

    // ✅ mirror to interview LS
    const cur = readInterview();
    writeInterview({ ...cur, guestCount: next });
  };

  const hasDate = !!weddingDate && !!dayOfWeek;
  const guestOk = guestCount >= 1 && guestCount <= 250;
  const canContinue = hasDate && guestOk;

  const heroSrc = `${import.meta.env.BASE_URL}assets/images/venue-ranker/MadgeQ3Guests.webp`;

  const railStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 460,
    margin: "0 auto",
  };

  return (
    <div className="pixie-card wd-page-turn">
      {/* Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body">
        {/* HERO */}
        <img
          src={heroSrc}
          alt="Madge Guests + Date Question"
          className="px-media px-media--lg"
          onError={(e) => {
            console.warn("❌ Hero image failed to load:", heroSrc);
            (e.currentTarget as HTMLImageElement).src =
              "/assets/images/venue-ranker/MadgeQ3Guests.webp";
          }}
        />

        <h2 className="px-intro-title" style={{ textAlign: "center", fontSize: "2rem" }}>
          Your Date + Your Guests
        </h2>

        <br />

        <p className="px-prose-narrow" style={{ textAlign: "center" }}>
          Your date and guest count both impact pricing and venue fit. Weekdays and seasons vary in
          cost, and different venues are built for different crowd sizes.
          <br />
          <br />
          <span style={{ color: "#777" }}>
            We’ll use your answers here as a starting point — you can adjust your date and your guest
            count anytime before booking.
          </span>
        </p>

        {/* DATE SECTION */}
        <div style={{ ...railStyle, marginTop: 18 }}>
          <h1 style={{ textAlign: "center", marginBottom: 10, color: "#2c62ba" }}>
            What’s your wedding date?
          </h1>

          {!isEditingDate && hasDate ? (
            <div
              style={{
                border: "1px solid #e6e6ef",
                borderRadius: 18,
                padding: "16px 14px",
                textAlign: "center",
                boxShadow: "0 6px 14px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: "1.1rem" }}>
                {toPrettyDate(weddingDate)} —{" "}
                <span style={{ color: "#2c62ba" }}>{dayOfWeek}</span>
              </div>

              {weddingDateLocked ? (
                <div style={{ marginTop: 8, color: "#777", fontSize: "0.95rem" }}>
                  This date is currently locked.
                </div>
              ) : (
                <button
                  type="button"
                  className="boutique-back-btn"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    setIsEditingDate(true);
                    setDateInput(weddingDate || "");
                    setDateError("");
                  }}
                >
                  ✏️ Change My Date
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                border: "1px solid #e6e6ef",
                borderRadius: 18,
                padding: "16px 14px",
                textAlign: "center",
                boxShadow: "0 6px 14px rgba(0,0,0,0.05)",
              }}
            >
              <input
                type="date"
                value={dateInput}
                onChange={handleDateChange}
                className="px-input-number"
                style={{
                  width: "100%",
                  textAlign: "center",
                  fontFamily: "var(--font-body, 'Nunito', sans-serif)",
                }}
              />

              {dayOfWeek && !dateError && (
                <p style={{ marginTop: 10, color: "#2c62ba" }}>
                  Lovely! That’s a <strong>{dayOfWeek}</strong>.
                </p>
              )}

              {dateError && <p style={{ marginTop: 10, color: "#e53935" }}>{dateError}</p>}

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="boutique-primary-btn"
                  onClick={saveWeddingDate}
                  disabled={!dateInput || !dayOfWeek || !!dateError}
                  style={{
                    opacity: !dateInput || !dayOfWeek || !!dateError ? 0.5 : 1,
                    cursor:
                      !dateInput || !dayOfWeek || !!dateError ? "not-allowed" : "pointer",
                  }}
                >
                  Set Date
                </button>

                {hasDate && !weddingDateLocked && (
                  <button
                    type="button"
                    className="boutique-back-btn"
                    onClick={() => setIsEditingDate(false)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* GUESTS SECTION */}
        <div style={{ ...railStyle, marginTop: 26 }}>
          <h1 style={{ textAlign: "center", marginBottom: 10, color: "#2c62ba" }}>
            How many guests?
          </h1>

          <div
            style={{
              border: "1px solid #e6e6ef",
              borderRadius: 18,
              padding: "16px 14px",
              textAlign: "center",
              boxShadow: "0 6px 14px rgba(0,0,0,0.05)",
            }}
          >
            <p className="px-prose-narrow" style={{ marginBottom: 12 }}>
              Enter any number up to 250.
            </p>

            <div style={{ maxWidth: 360, margin: "0 auto 12px" }}>
              <input
                className="px-input"
                type="number"
                min={1}
                max={250}
                value={guestCount === 0 ? "" : guestCount}
                onChange={handleGuestChange}
                disabled={guestLocked}
                placeholder="e.g., 120"
                inputMode="numeric"
                style={{
                  textAlign: "center",
                  fontWeight: 700,
                }}
              />
            </div>

            {guestLocked && (
              <p className="px-prose-narrow" style={{ color: "#777", marginTop: 6 }}>
                Guest count is locked after booking. You can increase it later with the Guest Count
                Scroll.
              </p>
            )}
          </div>
        </div>

        {/* Continue + Back */}
        <div
          style={{
            textAlign: "center",
            marginTop: 30,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (!canContinue) return;
              onNext({ guestCount });
            }}
            className="boutique-primary-btn"
            disabled={!canContinue}
            style={{
              opacity: canContinue ? 1 : 0.5,
              cursor: canContinue ? "pointer" : "not-allowed",
            }}
          >
            Continue
          </button>

          <button type="button" onClick={onBack} className="boutique-back-btn">
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default RD_MadgeInterviewQ3_Guest;