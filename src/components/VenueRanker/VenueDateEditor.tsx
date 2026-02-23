// src/components/VenueRanker/VenueDateEditor.tsx
import React, { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";
import {
  getVenueDateAvailability,
  type BlockedRange,
} from "../../utils/venueAvailability";

interface VenueDateEditorProps {
  // 👇 make venue-specific inputs optional
  venueSlug?: string | null;
  bookedDates?: string[];
  blockedRanges?: BlockedRange[];

  // optional title for display
  venueTitle?: string;

  isUnavailable?: boolean;
  isClosedOnThatDay?: boolean;
  hasBookedOtherVendors?: boolean;

  weddingDate: string | null;
  setWeddingDate: (date: string) => void;

  selectedDate: string | null;
  setSelectedDate: (date: string) => void;

  isNewDateConfirmed: boolean;
  setIsNewDateConfirmed: (confirmed: boolean) => void;

  newDate: Date | null;
  setNewDate: (date: Date | null) => void;

  onClose: () => void;

  proposedDate: string | null;
  setProposedDate: (date: string | null) => void;

  setCurrentScreen?: (screen: string) => void;

  
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatWeddingDatePretty(dateStr: string) {
  // dateStr should be YYYY-MM-DD
  const d = new Date(`${dateStr}T12:00:00`); // ✅ avoids timezone day-shift
  const month = d.toLocaleString("en-US", { month: "long" });
  const day = ordinal(d.getDate());
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}

const VenueDateEditor: React.FC<VenueDateEditorProps> = ({
  // ✅ venue-specific inputs become optional + safe defaults
  venueSlug = null,
  venueTitle,
  bookedDates = [],
  blockedRanges = [],

  // ✅ these can be optional too (generic mode won’t use them)
  isUnavailable = false,
  hasBookedOtherVendors = false,

  weddingDate,
  setWeddingDate,
  selectedDate,
  setSelectedDate,
  proposedDate,
  setProposedDate,
  setIsNewDateConfirmed,
  newDate,
  setNewDate,

  onClose,
}) => {
  // helper to parse "YYYY-MM-DD" safely into Date
  const parseISOToDate = (iso: string | null | undefined): Date | null => {
    if (!iso) return null;
    const d = new Date(iso + "T12:00:00"); // ✅ midday to avoid TZ shifts
    if (isNaN(d.getTime())) return null;
    return d;
  };

  // ✅ Safer ISO date helper (midday) so bookedDates match reliably
  const toISODate = (d: Date) => {
    const safe = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    return safe.toISOString().split("T")[0];
  };

  // ✅ Decide what month/year the calendar should open on
  const initialVisibleMonth: Date = useMemo(() => {
    const fromProposed = parseISOToDate(proposedDate || undefined);
    const fromSelected = parseISOToDate(selectedDate || undefined);
    const fromWedding = parseISOToDate(weddingDate || undefined);

    const base = fromProposed || fromSelected || fromWedding || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [proposedDate, selectedDate, weddingDate]);

  // ✅ Allow calendar arrows/year nav to work (controlled properly)
  const [activeStartDate, setActiveStartDate] = useState<Date>(initialVisibleMonth);

  useEffect(() => {
    setActiveStartDate(initialVisibleMonth);
  }, [initialVisibleMonth]);

  const isTileUnavailable = (date: Date) => {
    if (!venueSlug) return false; // ✅ generic mode: allow all dates
    const iso = toISODate(date);
    return getVenueDateAvailability({
      venueSlug,
      isoDate: iso,
      bookedDates,
      blockedRanges,
    }).unavailable;
  };

  // ✅ Build a “reason” message for why THEIR current date isn’t valid (top warning)
const unavailableReason = useMemo(() => {
  // ✅ GENERIC MODE: if no venue, do not calculate venue-based warnings
  if (!venueSlug) return "";

  const selectedISO = selectedDate || weddingDate || null;
  if (!selectedISO) return "";

  const res = getVenueDateAvailability({
    venueSlug,
    isoDate: selectedISO,
    bookedDates: bookedDates ?? [],
    blockedRanges: blockedRanges ?? [],
  });

  if (!res.unavailable) return "";

  // 🧊 BLOCKED RANGE (pricing not open yet, seasonal holds, etc.)
  if (res.reason === "blocked_range") {
    const year = selectedISO.slice(0, 4);
    return `Bookings haven’t been opened yet for ${year} (pricing pending).`;
  }

  // 🔒 BOOKED ALWAYS WINS
  if (res.reason === "booked") {
    return "This venue is already booked for your date.";
  }

  // 📆 Weekday closures
  const blocked = res.blockedWeekdays ?? [];
  const blocksWeekdays =
    blocked.includes("monday") &&
    blocked.includes("tuesday") &&
    blocked.includes("wednesday") &&
    blocked.includes("thursday");

  if (
    blocksWeekdays &&
    (res.reason === "closed_weekday" || res.reason === "no_pricing_for_day")
  ) {
    return "This venue doesn’t allow weekday bookings.";
  }

  if (res.reason === "closed_weekday" || res.reason === "no_pricing_for_day") {
    const d = new Date(selectedISO + "T12:00:00");
    const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
    return `This venue is not available on ${weekday}s.`;
  }

  if (res.reason === "sunday_not_allowed") {
    return "This venue isn’t available on Sundays.";
  }

  return "That date isn’t available. Pick a new available date below.";
}, [selectedDate, weddingDate, venueSlug, bookedDates, blockedRanges]);

const currentIso = (weddingDate || selectedDate || "").trim(); // YYYY-MM-DD

const isSameISO = (d: Date, iso: string) => {
  if (!iso) return false;
  const tileIso = toISODate(d); // you already have this helper
  return tileIso === iso;
};

  return (
    <div
      className="pixie-overlay"
      style={{
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflowY: "auto",
        padding: "2rem",
      }}
    >
      <div
        className="pixie-card pixie-card--modal wd-page-turn"
        style={{
          backgroundColor: "#fff",
          borderRadius: "20px",
          maxWidth: "900px",
          width: "92vw",
          padding: "2rem",
          boxShadow: "0 8px 20px rgba(0, 0, 0, 0.2)",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* ✅ Pink X (matches your pixie close icon) */}
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>

        {isUnavailable && hasBookedOtherVendors ? (
          <div
            style={{
              backgroundColor: "#fff6f6",
              border: "1px solid #ffaaaa",
              borderRadius: "12px",
              padding: "1.5rem",
              marginTop: "1rem",
              textAlign: "center",
              color: "#990000",
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            <p style={{ fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>
              Sorry, this venue is unavailable for your wedding date.
            </p>
            <p style={{ fontSize: "1rem", marginTop: "0.5rem", marginBottom: 0 }}>
              Because you’ve already booked other vendors for this date, you’ll need to pick a
              different venue.
            </p>
          </div>
        ) : (
          <div className="calendar-wrapper">
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <video
                src={`${import.meta.env.BASE_URL}assets/videos/calendar_loop.mp4`}
                autoPlay
                muted
                loop
                playsInline
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "12px",
                  marginBottom: "0.5rem",
                }}
              />

{venueTitle ? (
  <div style={{ marginBottom: "0.25rem", fontWeight: 800, color: "#2c62ba" }}>
    {venueTitle}
  </div>
) : null}

{(weddingDate || selectedDate) && (
  <div
    style={{
      marginTop: 6,
      marginBottom: 8,
      fontSize: "1.05rem",
      fontWeight: 800,
      color: "#2c62ba",
      textAlign: "center",
      lineHeight: 1.4,
    }}
  >
    You’ve selected{" "}
    <span style={{ fontWeight: 900 }}>
      {formatWeddingDatePretty((weddingDate || selectedDate) as string)}
    </span>
    .
    <div style={{ marginTop: 6, fontSize: "0.98rem", fontWeight: 700, color: "#444" }}>
      Use the calendar below to select a new date.
    </div>
  </div>
)}

              {unavailableReason ? (
                <div
                  className="venue-warning-top"
                  style={{
                    marginTop: "12px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    color: "#d93025",
                    fontWeight: 800,
                    fontSize: "1.05rem",
                    textAlign: "center",
                  }}
                >
                  <span className="emoji" aria-hidden="true">
                    ⚠️
                  </span>
                  <span>{unavailableReason}</span>
                  <span className="emoji" aria-hidden="true">
                    ⚠️
                  </span>
                </div>
              ) : null}
            </div>

            <div className="calendar-container" style={{ maxWidth: 760, margin: "0 auto" }}>
              <Calendar
                className="wd-calendar"
                activeStartDate={activeStartDate}
                onActiveStartDateChange={({ activeStartDate }) => {
                  if (activeStartDate) setActiveStartDate(activeStartDate);
                }}
                onChange={(date) => {
                  if (!(date instanceof Date)) return;
                
                  const iso = toISODate(date);
                
                  // ✅ generic mode: accept any date
                  if (!venueSlug) {
                    setProposedDate(iso);
                    setIsNewDateConfirmed(false);
                    return;
                  }
                
                  const res = getVenueDateAvailability({
                    venueSlug,
                    isoDate: iso,
                    bookedDates,
                    blockedRanges,
                  });
                
                  // 🚫 Don't allow selecting unavailable dates
                  if (res.unavailable) return;
                
                  setProposedDate(iso);
                  setIsNewDateConfirmed(false);
                }}
                tileDisabled={({ date }) => isTileUnavailable(date)}
                tileClassName={({ date, view }) => {
                  if (view !== "month") return null;
                  if (isTileUnavailable(date)) return "px-cal-unavailable";
                  return null;
                }}
                tileContent={({ date, view }) => {
                  if (view !== "month") return null;
                
                  const unavailable = isTileUnavailable(date);
                  const isCurrent = isSameISO(date, currentIso);
                
                  // If it's unavailable, keep showing the X (your existing behavior)
                  if (unavailable) {
                    return (
                      <span className="px-cal-x" aria-hidden="true">
                        ✕
                      </span>
                    );
                  }
                
                  // If it's the user's currently saved date, show a blue dot
                  if (isCurrent) {
                    return (
                      <span
                        aria-hidden="true"
                        style={{
                          display: "block",
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: "#2c62ba",
                          margin: "4px auto 0",
                        }}
                      />
                    );
                  }
                
                  return null;
                }}
              />

{proposedDate && (
  <div style={{ marginTop: "1rem" }}>
    <p
      className="venue-warning"
      style={{
        fontWeight: 800,
        fontSize: "1.1rem",
        textAlign: "center",
        marginBottom: 12,
      }}
    >
      Selected:{" "}
      {new Date(proposedDate + "T12:00:00").toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}
    </p>

    <div style={{ textAlign: "center", marginTop: "1rem" }}>
      <button
        className="boutique-primary-btn"
        onClick={async () => {
          const confirmedDate = new Date(proposedDate + "T12:00:00");
          const formattedDate = confirmedDate.toISOString().split("T")[0];

          setNewDate(confirmedDate);
          setIsNewDateConfirmed(true);
          setWeddingDate(formattedDate);
          setSelectedDate(formattedDate);

          // ✅ write to the same keys CastleModal checks
localStorage.setItem("venueWeddingDate", formattedDate);
localStorage.setItem("weddingDate", formattedDate);

// ✅ let anything listening update immediately
window.dispatchEvent(
  new CustomEvent("weddingDateUpdated", { detail: { weddingDate: formattedDate } })
);

if (auth.currentUser) {
  try {
    const { setDoc, serverTimestamp } = await import("firebase/firestore");

    // ✅ users/{uid} (CastleModal reads this in some flows)
    await setDoc(
      doc(db, "users", auth.currentUser.uid),
      { weddingDate: formattedDate },
      { merge: true }
    );

    // ✅ users/{uid}/venueRankerData/booking (other flows read this)
    await setDoc(
      doc(db, "users", auth.currentUser.uid, "venueRankerData", "booking"),
      { weddingDate: formattedDate, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    console.error("Error updating weddingDate in Firestore:", e);
  }
}

          onClose();
        }}
      >
        Pick This New Date
      </button>
    </div>
  </div>
)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VenueDateEditor;