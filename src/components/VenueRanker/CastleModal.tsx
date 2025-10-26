import React, { useEffect, useState, useMemo } from "react";
import { venueDetails } from "../../utils/venueDetails";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";
import "../../styles/layouts/CastleModal.css";
import { venueIncludedItems } from "../../data/venueIncludedItems";
import VenueDateEditor from "./VenueDateEditor";
import VenueGuestEditor from "./VenueGuestEditor";
import { getGuestState } from "../../utils/guestCountStore";
// ADD this import
import { calculatePlan } from "../../utils/calculatePlan";

import {
  venuePricing,
  Weekday,
  getSelectedSpacesForTier,
  DEFAULT_INCLUDED_STRIP_PATTERNS,
} from "../../data/venuePricing";

interface CastleModalProps {
  venueSlug: string;
  onClose: () => void;
  onBook: (venueSlug: string) => void;
  handleStartContract: (data: {
    venueSlug: string;
    venueName: string;
    guestCount: number;
    weddingDate: string;
    price: number;
  }) => void;
}

const CastleModal: React.FC<CastleModalProps> = ({
  venueSlug,
  onClose,
  onBook,
  handleStartContract,
}) => {
  const [showMadgeTip, setShowMadgeTip] = useState(false);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [weddingDate, setWeddingDate] = useState<string | null>(null);
  const [plannerPaidCents, setPlannerPaidCents] = useState<number>(0);

  const [guestCount, setGuestCount] = useState<number | null>(null);
  const [confirmedGuestCount, setConfirmedGuestCount] = useState<number | null>(null);

  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isOverCapacity, setIsOverCapacity] = useState(false);
  const [isNewDateConfirmed, setIsNewDateConfirmed] = useState<boolean>(false);
  const [hasBookedOtherVendors, setHasBookedOtherVendors] = useState(false);
  const [hasBookedCatering, setHasBookedCatering] = useState(false);
  const [hasPlannerBooked, setHasPlannerBooked] = useState(false);
  const maxCapacity = venuePricing[venueSlug]?.maxCapacity ?? null;

  const [showDateEditor, setShowDateEditor] = useState(false);
  const [showGuestEditor, setShowGuestEditor] = useState(false);
  const venueInfo = venuePricing[venueSlug];
  const [proposedDate, setProposedDate] = useState<string | null>(null);
const [setCurrentScreen] = useState<(screen: string) => void>(() => () => {});
const [isClosedOnThatDay, setIsClosedOnThatDay] = useState<boolean>(false);
const [hasOpenedConsiderations, setHasOpenedConsiderations] = useState(false);

  const details = venueDetails[venueSlug];
  const includedList = (venueIncludedItems[venueSlug] ?? []) as string[];

  const includedDisplay = useMemo(() => {
    const base = Array.isArray(includedList) ? includedList.slice() : [];
  
    // Which substrings should be stripped from the static bullets?
    const strip = venuePricing[venueSlug]?.includedStripPatterns ?? DEFAULT_INCLUDED_STRIP_PATTERNS;
  
    // Remove generic space bullets (so we don’t duplicate the selected-space lines we add next)
    const filtered = base.filter((item) => {
      const lower = String(item || "").toLowerCase();
      return !strip.some((pattern) => lower.includes(String(pattern).toLowerCase()));
    });
  
    // Pick the ceremony/reception based on guest count, if configured for this venue
    const gc = Number(confirmedGuestCount || 0);
    const { ceremony, reception, note } = getSelectedSpacesForTier(venueSlug, gc);
  
    const dynamic: string[] = [];
  
    if (ceremony || reception) {
      dynamic.push(
        `<strong>Selected for your guest count</strong>: ` +
        `${ceremony ? `Ceremony — ${ceremony}` : ""}` +
        `${ceremony && reception ? "; " : ""}` +
        `${reception ? `Reception — ${reception}` : ""}`
      );
    }
  
    if (note) dynamic.push(note);
  
    // Final list: dynamic selection lines first, then the rest of the bullets
    return [...dynamic, ...filtered];
  }, [venueSlug, confirmedGuestCount, includedList]);

const storedVenueName = localStorage.getItem("venueName");
const storedWeddingDate = localStorage.getItem("venueWeddingDate");
const storedVenuePrice = localStorage.getItem("venuePrice");

const [gcValue, setGcValue] = useState<number>(0);
const [gcLocked, setGcLocked] = useState<boolean>(false);
  

  const weekdayMap: Weekday[] = [
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  ];

  const weekdayUnavailable =
  venueInfo?.closedWeekdays?.length &&
  weddingDate &&
  venueInfo.closedWeekdays?.includes(
    new Date(`${weddingDate}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "America/Phoenix", // or whatever you're defaulting to
    }).toLowerCase() as Weekday
  );

    console.log("🧠 Inputs to cost calc:", {
      confirmedGuestCount,
      venueSlug,
      weddingDate
    });


    const planPreview = useMemo(() => {
      if (!confirmedGuestCount || !venueSlug || !weddingDate) {
        return { isClosed: false, total: null as number | null };
      }
    
      const weekdayName = new Date(weddingDate + "T12:00:00")
        .toLocaleDateString("en-US", { weekday: "long" })
        .toLowerCase();
    
      const isClosed =
        Array.isArray(venuePricing[venueSlug]?.closedWeekdays) &&
        venuePricing[venueSlug]!.closedWeekdays!.includes(weekdayName as Weekday);
    
      if (isClosed) {
        return { isClosed: true, total: null };
      }
    
      const plan = calculatePlan({
        venueSlug,
        guestCount: confirmedGuestCount,
        weddingDate,
        payFull: true,                 // doesn’t change the total
        plannerPaidCents,              // 👈 NEW: pass credit
      });
    
      return { isClosed: false, total: Number(plan?.total || 0) }; // 👈 no manual subtraction
    }, [confirmedGuestCount, venueSlug, weddingDate, plannerPaidCents]);

useEffect(() => {
  const fetchBookedDates = async () => {
    try {
      const venueRef = doc(db, "venues", venueSlug);
      const venueSnap = await getDoc(venueRef);

      if (venueSnap.exists()) {
        const data = venueSnap.data();
        console.log("🔥 Loaded bookedDates:", data.bookedDates);
        setBookedDates(data.bookedDates || []);
      } else {
        console.warn("📛 Venue document not found:", venueSlug);
      }
    } catch (err) {
      console.error("Error loading booked dates:", err);
    }
  };

  fetchBookedDates();
}, [venueSlug]);

useEffect(() => {
  let mounted = true;

  const pull = async () => {
    const st = await getGuestState();
    if (!mounted) return;
    setGcValue(Number(st.value || 0));
    setGcLocked(!!st.locked);

    // Keep your pricing inputs in sync with the single source:
    setConfirmedGuestCount(Number(st.value || 0));
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

useEffect(() => {
  if (maxCapacity !== null && gcValue > maxCapacity) {
    setIsOverCapacity(true);
  } else {
    setIsOverCapacity(false);
  }
}, [gcValue, maxCapacity]);

useEffect(() => {
  const fetchData = async () => {
    let dateToUse: string | null = null;
    let guestCountToUse: number | null = null;

    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data() as any;

          // ——— wedding date / guests from Firestore ———
          const fsDate = data?.weddingDate;
          const fsGuests = data?.guestCount;

          if (fsDate) {
            dateToUse = fsDate;
            setWeddingDate(fsDate);
            setSelectedDate(fsDate);
          }

          if (fsGuests !== undefined && fsGuests !== null) {
            guestCountToUse = fsGuests;
            setGuestCount(fsGuests);
            setConfirmedGuestCount(fsGuests);
          }

          // ——— bookings flags ———
          const bookings = data?.bookings || {};
          const bookedSomething = Object.values(bookings).some((val: any) => val === true);
          setHasBookedOtherVendors(bookedSomething);

          const hasCatering = bookings?.catering === true;
          setHasBookedCatering(hasCatering);

          setHasPlannerBooked(!!(bookings?.planner === true || bookings?.venue === true));

          // ——— NEW: sum planner purchases → plannerPaidCents ———
          try {
            const purchases = Array.isArray(data?.purchases) ? data.purchases : [];
            const totalPlannerDollars = purchases
              .filter((p: any) =>
                p?.category === "planner" ||
                (typeof p?.label === "string" && p.label.toLowerCase().includes("planner"))
              )
              .reduce((sum: number, p: any) => sum + Number(p?.amount || 0), 0);

            setPlannerPaidCents(Math.round(totalPlannerDollars * 100));
          } catch (e) {
            console.warn("Could not sum planner purchases:", e);
            setPlannerPaidCents(0);
          }
        }
      }

      // ——— fallbacks from localStorage ———
      if (!dateToUse) {
        const localDate = localStorage.getItem("weddingDate");
        if (localDate) {
          dateToUse = localDate;
          setWeddingDate(localDate);
          setSelectedDate(localDate);
        }
      }

      const localGuests = localStorage.getItem("guestCount");
      if (!guestCountToUse && localGuests) {
        const count = parseInt(localGuests);
        guestCountToUse = count;
        setGuestCount(count);
        setConfirmedGuestCount(count);
      }

      // ——— venue booked dates + availability ———
      const venueRef = doc(db, "venues", venueSlug);
      const docSnap = await getDoc(venueRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        const booked = data.bookedDates || [];

        const normalized = booked.map((d: any) =>
          typeof d === "string" ? d : d.toDate().toISOString().split("T")[0]
        );

        setBookedDates(normalized);

        if (dateToUse) {
          const weekday = new Date(dateToUse).getDay(); // 0..6
          const weekdayName = weekdayMap[weekday];

          const isBookedDate = normalized.includes(dateToUse);
          const isClosedDay = venuePricing[venueSlug]?.closedWeekdays?.includes(weekdayName) || false;
          setIsAvailable(!(isBookedDate || isClosedDay));
        }
      }

      // guard
      if (guestCountToUse === null || !dateToUse) return;
    } catch (err) {
      console.error("🔥 Error fetching data:", err);
    }
  };

  fetchData();
}, [venueSlug, selectedDate, guestCount]);

const handleDateChange = async (date: Date) => {
  setNewDate(date);
  const formatted = date.toISOString().split("T")[0];
  localStorage.setItem("weddingDate", formatted);
  setSelectedDate(formatted);

  if (auth.currentUser) {
    const userRef = doc(db, "users", auth.currentUser.uid);
    try {
      await updateDoc(userRef, { weddingDate: formatted });
    } catch (err) {
      console.error("Error updating wedding date:", err);
    }
  }
}; // ✅ <-- close this before adding anything else

// ✅ Define this AFTER handleDateChange, not inside it
const formatDateString = (isoDate: string | null): string => {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

  const displayDate = newDate
    ? newDate.toISOString().split("T")[0]
    : selectedDate;

    const isDateAvailable = displayDate && !bookedDates.includes(displayDate);

  if (!details) {
    return (
      <div className="castle-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">
  <img src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`} alt="Close" />
</button>
        <p>Oops! No details found for this venue.</p>
      </div>
    );
  }

  console.log("🏰 venueSlug:", venueSlug);
console.log("📦 venueInfo:", venuePricing[venueSlug]);


console.log("🧪 Availability:", isAvailable);
console.log("🧪 Plan preview total:", planPreview?.total);

// 🔁 Start contract with the SAME total the contract will show
const handleBookItClick = () => {
  try {
    const venueMeta = venueDetails[venueSlug];
    const venueName = venueMeta?.title || "Your Venue";
    const dateToUse =
      selectedDate || localStorage.getItem("venueWeddingDate") || "";
    const count =
      guestCount || parseInt(localStorage.getItem("venueGuestCount") || "0", 10);

    // Guard: we must have a computed total from planPreview
    if (!planPreview || planPreview.total == null) {
      console.warn("🚫 No plan total available yet, cannot start contract.");
      return;
    }

    // ✅ Do NOT add extra fee/tax here — keep this number identical to the contract
    const total = Number(planPreview.total);

    // Minimal mirrors (optional now that you pass via handleStartContract)
    localStorage.setItem("venueName", venueName);
    localStorage.setItem("venueSlug", venueSlug || "");
    localStorage.setItem("venueWeddingDate", dateToUse);
    localStorage.setItem("venueGuestCount", String(count));
    localStorage.setItem("venuePrice", total.toFixed(2));

    console.log("📝 BookIt: wrote to localStorage:");
    console.log("📝 venueName →", venueName);
    console.log("📝 venueWeddingDate →", dateToUse);
    console.log("📝 venuePrice →", total.toFixed(2));

    // If you are using handleStartContract (preferred), call it with the SAME total:
    if (typeof handleStartContract === "function") {
      handleStartContract({
        venueSlug,
        venueName,
        guestCount: count,
        weddingDate: dateToUse,
        price: total, // 👈 EXACT number the contract will use
      });
      return;
    }

    // Fallback: navigate by screen switch if you aren’t using handleStartContract
    setTimeout(() => {
      setCurrentScreen("venuecontract");
    }, 50);
  } catch (err) {
    console.error("💥 Error in handleBookItClick:", err);
  }
};

return (
  <div className="castle-modal">
    <button className="modal-close" onClick={onClose} aria-label="Close">
  <img src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`} alt="Close" />
</button>

    <div style={{ padding: "2rem" }}>
      <h2 className="modal-title">{details.title}</h2>

      {weddingDate && (
  <p className="modal-subtext">
    <strong>Cost:</strong>{" "}
    {!isAvailable ||
     !planPreview ||
     planPreview.total == null ||
     (guestCount !== null && maxCapacity !== null && guestCount > maxCapacity)
      ? "Unavailable"
      : `$${planPreview.total.toLocaleString()}`}
  </p>
)}

      <p className="modal-subtext">
        <strong>Max Capacity:</strong>{" "}
        {venuePricing[venueSlug]?.maxCapacity
          ? `${venuePricing[venueSlug].maxCapacity} guests`
          : "N/A"}
      </p>
  
        <div className="video-container">
          <iframe
            src={details.videoLink}
            title={`${details.title} walkthrough`}
            width="100%"
            height="360"
            frameBorder="0"
            allow="autoplay; fullscreen"
            allowFullScreen
          ></iframe>
        </div>
  
        <div className="considerations-block" style={{ marginTop: "1.25rem" }}>
        <button
  className="castle-considerations-btn"
  onClick={() => setShowMadgeTip((prev) => !prev)}
  style={{
    // keep the pulse glow if it's not open
    animation: !showMadgeTip ? "pulseGlow 1.6s ease-in-out infinite" : "none",

    // 🔵 VISUAL STYLE (force it inline so nothing can override)
    fontFamily: "'Jenna Sue','JennaSue',cursive",
    fontSize: "1.8rem",
    lineHeight: 1.2,
    fontWeight: 400,
    color: "#fff",

    backgroundColor: "#2c62ba",
    border: "0",
    borderRadius: "12px",
    padding: "0.75rem 1rem",
    minWidth: "280px",
    maxWidth: "90%",
    margin: "1rem auto 0",
    textAlign: "center",
    display: "block",
    cursor: "pointer",

    // glow / hover base
    boxShadow: !showMadgeTip
      ? "0 0 10px 2px rgba(44, 98, 186, 0.6), 0 8px 20px rgba(44,98,186,0.35)"
      : "0 8px 20px rgba(44,98,186,0.35)",
    transition: "box-shadow 0.2s ease, transform 0.2s ease",
  }}
  onMouseEnter={(e) => {
    (e.currentTarget as HTMLButtonElement).style.boxShadow =
      "0 10px 24px rgba(44,98,186,0.5)";
    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
  }}
  onMouseLeave={(e) => {
    (e.currentTarget as HTMLButtonElement).style.boxShadow = !showMadgeTip
      ? "0 0 10px 2px rgba(44, 98, 186, 0.6), 0 8px 20px rgba(44,98,186,0.35)"
      : "0 8px 20px rgba(44,98,186,0.35)";
    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
  }}
>
  Castle Considerations
</button>

  {showMadgeTip && (
    <>
      <p className="madge-explainer">
        These Castle Considerations are key details from the venue’s contract or just pixie planner knowledge we have that we're sharing with you —
        Madge thinks you should be aware of them before booking!
      </p>

      <ul className="castle-considerations-list" style={{ paddingLeft: "1.25rem", marginTop: "1rem" }}>
      {details.castleConsiderations.map((item, index) => (
        <li
          key={index}
          dangerouslySetInnerHTML={{ __html: item }}
          style={{ marginBottom: "0.5rem" }}
        />
      ))}
    </ul>
  </>
)}

  {/* inline animation keyframes */}
  <style>
    {`
      @keyframes pulseGlow {
        0%   { box-shadow: 0 0 0 rgba(44, 98, 186, 0.0); }
        50%  { box-shadow: 0 0 12px 4px rgba(44, 98, 186, 0.6); }
        100% { box-shadow: 0 0 0 rgba(44, 98, 186, 0.0); }
      }
    `}
  </style>
</div>
  
{includedDisplay.length > 0 && (
  <div className="included-block">
    <h4 className="modal-subtext">What’s Included:</h4>
    <ul
      className="included-list"
      style={{ paddingLeft: "1.25rem", marginTop: "1rem" }}
    >
      {includedDisplay.map((item, idx) => (
        <li
          key={idx}
          dangerouslySetInnerHTML={{ __html: item }}
          style={{ marginBottom: "0.5rem" }}
        />
      ))}
    </ul>
  </div>
)}

{/* ❗ Warning block if date is unavailable */}
{!isAvailable && (
  <div
    style={{
      textAlign: "center",
      marginTop: "2rem",
    }}
  >
    <p
      style={{
        fontSize: "1.3rem",
        fontWeight: "bold",
        color: "#b30000", // bold red
        marginBottom: "1rem",
      }}
    >
      Uh oh! Your selected date isn’t available for this venue
    </p>
    <button
      style={{
        backgroundColor: "#f78da7",
        color: "#fff",
        border: "none",
        padding: "0.6rem 1.2rem",
        fontSize: "1rem",
        borderRadius: "8px",
        cursor: "pointer",
        fontWeight: "bold",
      }}
      onClick={() => setShowDateEditor(true)}
    >
      Change My Date
    </button>
  </div>
)}

{/* ❗ Warning block if guest count is too high */}
{isOverCapacity && (
  <div style={{ textAlign: "center", marginTop: "2rem" }}>
    <p
      style={{
        fontSize: "1.3rem",
        fontWeight: "bold",
        color: "#b30000",
        marginBottom: "1rem",
      }}
    >
      ⚠️ Too many guests! This venue can’t host your current count ⚠️
    </p>

    {gcLocked ? (
      // Locked by planner/catering/dessert/etc. → cannot lower here
      <div
        style={{
          backgroundColor: "#fff0f0",
          padding: "1rem",
          borderRadius: "10px",
          marginTop: "0.5rem",
        }}
      >
        <p style={{ fontSize: "1rem", color: "#b30000", fontWeight: 500 }}>
          Your guest count is locked due to an existing booking, so you can’t
          lower it here. Please choose a different venue, or email Madge if you
          need help:
          {" "}
          <a href="mailto:madge@wedanddone.com">madge@wedanddone.com</a>
        </p>
      </div>
    ) : (
      // Not locked → allow lowering via editor (same as before)
      <button
        style={{
          backgroundColor: "#f78da7",
          color: "#fff",
          border: "none",
          padding: "0.6rem 1.2rem",
          fontSize: "1rem",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
        onClick={() => setShowGuestEditor(true)}
      >
        Lower My Guest Count
      </button>
    )}
  </div>
)}

{/* ✅ Render date editor modal if triggered */}
{showDateEditor && (
  <VenueDateEditor
    venueSlug={venueSlug}
    selectedDate={selectedDate}
    setSelectedDate={setSelectedDate}
    weddingDate={weddingDate}
    setWeddingDate={setWeddingDate}
    bookedDates={bookedDates}
    setNewDate={setNewDate}
    newDate={newDate} // ✅ keep
    isNewDateConfirmed={isNewDateConfirmed}
    setIsNewDateConfirmed={setIsNewDateConfirmed}
    proposedDate={proposedDate}
    setProposedDate={setProposedDate}
    isUnavailable={!isAvailable} // ✅ keep
    isClosedOnThatDay={isClosedOnThatDay} // ✅ keep
    hasBookedOtherVendors={hasBookedOtherVendors} // ✅ keep
    setCurrentScreen={setCurrentScreen}
    onClose={() => setShowDateEditor(false)}
  />
)}

{/* ✅ Render guest editor modal if triggered */}
{showGuestEditor && (
  <VenueGuestEditor
    guestCount={guestCount}
    setGuestCount={setGuestCount}
    confirmedGuestCount={confirmedGuestCount}
    setConfirmedGuestCount={setConfirmedGuestCount}
    venueInfo={venueInfo}
    onClose={() => setShowGuestEditor(false)}
    setCurrentScreen={setCurrentScreen} // ✅ Add this line
  />
)}

{/* ✅ Show "Book It" button only if no conflicts and we have a total */}
{isAvailable === true && !isOverCapacity && planPreview?.total != null && (
  <div style={{ textAlign: "center", marginTop: "2rem" }}>
    <img
      src={`${import.meta.env.BASE_URL}assets/images/book_gold_seal.png`}
      alt="Book It Now"
      onClick={handleBookItClick}
      style={{
        width: "120px",
        height: "auto",
        cursor: "pointer",
        transition: "transform 0.3s ease, filter 0.3s ease",
        filter: "drop-shadow(0 0 4px gold)",
        display: "block",
        margin: "0 auto",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.1)";
        e.currentTarget.style.filter = "drop-shadow(0 0 14px gold)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.filter = "drop-shadow(0 0 4px gold)";
      }}
    />
  </div>
)}
      </div>
    </div>
  );
}

export default CastleModal;
