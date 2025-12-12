import React, { useEffect, useState, useMemo } from "react";
import { venueDetails } from "../../utils/venueDetails";
import {
  doc, getDoc, updateDoc, collection, addDoc, serverTimestamp,
  query, where, onSnapshot, limit
} from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";
import "../../styles/layouts/CastleModal.css";
import { venueIncludedItems } from "../../data/venueIncludedItems";
import VenueDateEditor from "./VenueDateEditor";
import VenueGuestEditor from "./VenueGuestEditor";
import { getGuestState } from "../../utils/guestCountStore";
import { calculatePlan } from "../../utils/calculatePlan";
import emailjs from "@emailjs/browser";

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
  /* ───────────────────────── State ───────────────────────── */

  const [showMadgeTip, setShowMadgeTip] = useState(false);

  // availability / booking state
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [weddingDate, setWeddingDate] = useState<string | null>(null);

    // manual confirm logic
    const [showManualConfirmModal, setShowManualConfirmModal] = useState(false);
    const [requestSent, setRequestSent] = useState(false); // optional UI lock after they confirm
  
    // grab this venue's pricing/config info
    const venueInfo = venuePricing[venueSlug];
  
    // does this venue require manual confirmation before contract/payment?
    const isManualConfirm = !!venueInfo?.manualConfirm;

    const isInstaBook = !isManualConfirm;

const bookSealSrc = isInstaBook
  ? `${import.meta.env.BASE_URL}assets/images/book_gold_seal_insta.png`
  : `${import.meta.env.BASE_URL}assets/images/book_gold_seal.png`;

  // planner credit ($ already paid toward planner)
  const [plannerPaidCents, setPlannerPaidCents] = useState<number>(0);

  // guests
  const [guestCount, setGuestCount] = useState<number | null>(null);
  const [confirmedGuestCount, setConfirmedGuestCount] = useState<number | null>(
    null
  );
  const [gcValue, setGcValue] = useState<number>(0);
  const [gcLocked, setGcLocked] = useState<boolean>(false);

  // flags
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isOverCapacity, setIsOverCapacity] = useState(false);
  const [isNewDateConfirmed, setIsNewDateConfirmed] = useState<boolean>(false);
  const [hasBookedOtherVendors, setHasBookedOtherVendors] = useState(false);
  const [hasBookedCatering, setHasBookedCatering] = useState(false);
  const [hasPlannerBooked, setHasPlannerBooked] = useState(false);

  // we set this when we evaluate weekday restrictions
  const [isClosedOnThatDay, setIsClosedOnThatDay] = useState<boolean>(false);

  // UI modals
  const [showDateEditor, setShowDateEditor] = useState(false);
  const [showGuestEditor, setShowGuestEditor] = useState(false);

  // misc
  const maxCapacity = venuePricing[venueSlug]?.maxCapacity ?? null;

  // The user's just-clicked candidate in VenueDateEditor
  const [proposedDate, setProposedDate] = useState<string | null>(null);

  // CastleModal used to sit in an overlay with screen steps. Editors still expect this prop.
  const [setCurrentScreen] = useState<(screen: string) => void>(() => () => {});

  const details = venueDetails[venueSlug];
  const includedList = (venueIncludedItems[venueSlug] ?? []) as string[];

  // manual confirm status for this user/venue/date
const [approvalStatus, setApprovalStatus] =
useState<"none" | "requested" | "approved" | "declined">("none");

  /* ───────────────────────── Helpers ───────────────────────── */

  // weekdayMap is stable
  const weekdayMap: Weekday[] = useMemo(
    () => [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ],
    []
  );

  // build the dynamic "What’s Included" list
  const includedDisplay = useMemo(() => {
    const base = Array.isArray(includedList) ? includedList.slice() : [];

    const strip =
      venuePricing[venueSlug]?.includedStripPatterns ??
      DEFAULT_INCLUDED_STRIP_PATTERNS;

    // remove generic bullets so we don't duplicate spaces
    const filtered = base.filter((item) => {
      const lower = String(item || "").toLowerCase();
      return !strip.some((pattern) =>
        lower.includes(String(pattern).toLowerCase())
      );
    });

    const gc = Number(confirmedGuestCount || 0);
    const { ceremony, reception, note } = getSelectedSpacesForTier(
      venueSlug,
      gc
    );

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

    return [...dynamic, ...filtered];
  }, [venueSlug, confirmedGuestCount, includedList]);

  // price preview (what we show under "Cost")
  const planPreview = useMemo(() => {
    if (!confirmedGuestCount || !venueSlug || !weddingDate) {
      return { isClosed: false, total: null as number | null };
    }

    const weekdayName = new Date(weddingDate + "T12:00:00")
      .toLocaleDateString("en-US", { weekday: "long" })
      .toLowerCase();

    const isClosed =
      Array.isArray(venuePricing[venueSlug]?.closedWeekdays) &&
      venuePricing[venueSlug]!.closedWeekdays!.includes(
        weekdayName as Weekday
      );

    if (isClosed) {
      return { isClosed: true, total: null };
    }

    const plan = calculatePlan({
      venueSlug,
      guestCount: confirmedGuestCount,
      weddingDate,
      payFull: true,
      plannerPaidCents,
    });

    return { isClosed: false, total: Number(plan?.total || 0) };
  }, [confirmedGuestCount, venueSlug, weddingDate, plannerPaidCents]);

  // pretty date helper (not heavily used in current JSX but keeping it)
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

  /* ───────────────────────── Effects ───────────────────────── */

  // 1. Load bookedDates for this venue
  useEffect(() => {
    const fetchBookedDates = async () => {
      try {
        const venueRef = doc(db, "venues", venueSlug);
        const venueSnap = await getDoc(venueRef);

        if (venueSnap.exists()) {
          const data = venueSnap.data() as any;

          let legacyDates: string[] = [];
          if (Array.isArray(data.bookedDates)) {
            legacyDates = data.bookedDates
              .map((d: any) => {
                if (typeof d === "string") return d;
                if (d?.toDate) {
                  // Timestamp -> YYYY-MM-DD
                  return d.toDate().toISOString().split("T")[0];
                }
                return "";
              })
              .filter(Boolean);
          }

          console.log("🔥 Loaded bookedDates:", legacyDates);
          setBookedDates(legacyDates);
        } else {
          console.warn("📛 Venue document not found:", venueSlug);
          setBookedDates([]);
        }
      } catch (err) {
        console.error("Error loading booked dates:", err);
        setBookedDates([]);
      }
    };

    fetchBookedDates();
  }, [venueSlug]);

  // 2. Load guestCount / weddingDate / planner credit from Firestore (and localStorage fallback)
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

            // pull wedding date
            const fsDate = data?.weddingDate;
            if (fsDate) {
              dateToUse = fsDate;
              setWeddingDate(fsDate);
              setSelectedDate(fsDate);
            }

            // pull guest count
            const fsGuests = data?.guestCount;
            if (fsGuests !== undefined && fsGuests !== null) {
              guestCountToUse = fsGuests;
              setGuestCount(fsGuests);
              setConfirmedGuestCount(fsGuests);
            }

            // booking flags
            const bookings = data?.bookings || {};
            const bookedSomething = Object.values(bookings).some(
              (val: any) => val === true
            );
            setHasBookedOtherVendors(bookedSomething);

            const hasCatering = bookings?.catering === true;
            setHasBookedCatering(hasCatering);

            setHasPlannerBooked(
              !!(bookings?.planner === true || bookings?.venue === true)
            );

            // planner credit
            try {
              const purchases = Array.isArray(data?.purchases)
                ? data.purchases
                : [];
              const totalPlannerDollars = purchases
                .filter(
                  (p: any) =>
                    p?.category === "planner" ||
                    (typeof p?.label === "string" &&
                      p.label.toLowerCase().includes("planner"))
                )
                .reduce(
                  (sum: number, p: any) =>
                    sum + Number(p?.amount || 0),
                  0
                );

              setPlannerPaidCents(Math.round(totalPlannerDollars * 100));
            } catch (e) {
              console.warn("Could not sum planner purchases:", e);
              setPlannerPaidCents(0);
            }
          }
        }

        // fallbacks if Firestore didn't have them
        if (!dateToUse) {
          const localDate = localStorage.getItem("weddingDate");
          if (localDate) {
            dateToUse = localDate;
            setWeddingDate(localDate);
            setSelectedDate(localDate);
          }
        }

        if (!guestCountToUse) {
          const localGuests = localStorage.getItem("guestCount");
          if (localGuests) {
            const count = parseInt(localGuests);
            guestCountToUse = count;
            setGuestCount(count);
            setConfirmedGuestCount(count);
          }
        }
      } catch (err) {
        console.error("🔥 Error fetching data:", err);
      }
    };

    fetchData();
  }, [venueSlug]);

  // 3. Sync guestCount from the global guestCountStore and stay in sync when it changes
  useEffect(() => {
    let mounted = true;

    const pull = async () => {
      const st = await getGuestState();
      if (!mounted) return;

      const valNum = Number(st.value || 0);

      setGcValue(valNum);
      setGcLocked(!!st.locked);
      setConfirmedGuestCount(valNum); // drives pricing
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

  // 4. Capacity warning
  useEffect(() => {
    if (maxCapacity !== null && gcValue > maxCapacity) {
      setIsOverCapacity(true);
    } else {
      setIsOverCapacity(false);
    }
  }, [gcValue, maxCapacity]);

  // 5. 🔁 Recompute availability EVERY TIME:
  //    - user changes date in the picker
  //    - bookedDates refresh
  //    - weddingDate / selectedDate changes
  //    This is what fixes "still shows Uh Oh even after I pick a good date".
  useEffect(() => {
    // figure out which date we're evaluating
    const activeDate =
      selectedDate ||
      weddingDate ||
      localStorage.getItem("weddingDate") ||
      null;

    if (!activeDate) {
      setIsAvailable(null);
      setIsClosedOnThatDay(false);
      return;
    }

    // weekday
    const weekdayIdx = new Date(activeDate + "T12:00:00").getDay(); // 0-6
    const weekdayName = weekdayMap[weekdayIdx];

    const isBooked = bookedDates.includes(activeDate);

    const isClosed =
      Array.isArray(venuePricing[venueSlug]?.closedWeekdays) &&
      venuePricing[venueSlug]!.closedWeekdays!.includes(
        weekdayName as Weekday
      );

    setIsClosedOnThatDay(isClosed);
    setIsAvailable(!(isBooked || isClosed));
  }, [selectedDate, weddingDate, bookedDates, venueSlug, weekdayMap]);

  // 6. Watch for manual-confirm status (requested/approved/declined) for this user+venue+date
useEffect(() => {
  const user = auth.currentUser;
  if (!user) return;

  // whichever date we're actually using
  const activeDate =
    selectedDate || weddingDate || localStorage.getItem("weddingDate") || null;
  if (!activeDate) {
    setApprovalStatus("none");
    return;
  }

  // look for the request that matches this venue + date
  const q = query(
    collection(db, "venueRequests"),
    where("userId", "==", user.uid),
    where("venueSlug", "==", venueSlug),
    where("requestedDate", "==", activeDate),
    limit(1)
  );

  const unsub = onSnapshot(q, (snap) => {
    if (snap.empty) {
      setApprovalStatus("none");
      setRequestSent(false);
      return;
    }
    const data = snap.docs[0].data() as any;
    const s = String(data?.status || "requested").toLowerCase();
    if (s === "approved") {
      setApprovalStatus("approved");
      setRequestSent(true); // shows your “request sent” confirmation until they click
    } else if (s === "declined") {
      setApprovalStatus("declined");
      setRequestSent(false);
    } else {
      setApprovalStatus("requested");
      setRequestSent(true);
    }
  });

  return () => unsub();
}, [venueSlug, selectedDate, weddingDate]);

  /* ───────────────────────── Handlers ───────────────────────── */

  // user manually changes date (not used directly in current JSX, but keeping)
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
  };

    // Gold seal click
const handleBookItClick = () => {
  // If this venue needs manual confirmation, only block when not approved yet
  if (isManualConfirm && approvalStatus !== "approved") {
    setShowManualConfirmModal(true);
    return;
  }
  
      // STEP 2: normal instant-book flow (your existing logic)
      try {
        const venueMeta = venueDetails[venueSlug];
        const venueName = venueMeta?.title || "Your Venue";
  
        const dateToUse =
          selectedDate ||
          weddingDate ||
          localStorage.getItem("venueWeddingDate") ||
          "";
  
        if (!dateToUse) {
          console.warn("🚫 No wedding date available, cannot start contract.");
          return;
        }
  
        const count =
          guestCount ||
          parseInt(localStorage.getItem("venueGuestCount") || "0", 10);
  
        if (!planPreview || planPreview.total == null) {
          console.warn("🚫 No plan total available yet, cannot start contract.");
          return;
        }
  
        const total = Number(planPreview.total);
  
        // Save for downstream screens + checkout + PDF
        localStorage.setItem("venueName", venueName);
        localStorage.setItem("venueSlug", venueSlug || "");
        localStorage.setItem("venueWeddingDate", dateToUse); // used in checkout to block date
        localStorage.setItem("venueGuestCount", String(count));
        localStorage.setItem("venuePrice", total.toFixed(2));
  
        console.log("📝 BookIt stored:", {
          venueName,
          venueSlug,
          dateToUse,
          count,
          total,
        });
  
        if (typeof handleStartContract === "function") {
          handleStartContract({
            venueSlug,
            venueName,
            guestCount: count,
            weddingDate: dateToUse,
            price: total,
          });
          return;
        }
  
        // fallback legacy nav
        setTimeout(() => {
          setCurrentScreen("venuecontract");
        }, 50);
      } catch (err) {
        console.error("💥 Error in handleBookItClick:", err);
      }
    };

// Format "YYYY-MM-DD" safely → "Month D, YYYY"
const prettyYMD = (ymd: string) => {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

      // Save a manual confirmation request to Firestore AND email admin
const saveVenueRequestToFirestore = async () => {
  try {
    const user = auth.currentUser;
    const uid = user?.uid ?? "guest";

    // grab the selected date and guest count
    const dateToUse =
      selectedDate ||
      weddingDate ||
      localStorage.getItem("venueWeddingDate") ||
      "";

    const count =
      guestCount ||
      parseInt(localStorage.getItem("venueGuestCount") || "0", 10);

    const total =
      planPreview && planPreview.total != null ? Number(planPreview.total) : null;

    const payload = {
      userId: uid,
      venueSlug,
      venueName: details.title || venueSlug,
      requestedDate: dateToUse,
      guestCount: count || 0,
      quotedTotal: total,
      status: "requested",
      createdAt: serverTimestamp(),
      source: "venueRanker",
    };

    const docRef = await addDoc(collection(db, "venueRequests"), payload);
    console.log("✨ Venue request saved:", { id: docRef.id, ...payload });

    // after: const docRef = await addDoc(collection(db, "venueRequests"), payload);
//        console.log("✨ Venue request saved:", { id: docRef.id, ...payload });

try {
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (publicKey) {
    await emailjs.send(
      "service_xayel1i",
      "template_vawsamm",
      {
        user_name: auth.currentUser?.displayName || "Unknown User",
        user_email: auth.currentUser?.email || "unknown@wedanddone.com",
        email: auth.currentUser?.email || "unknown@wedanddone.com", // for {{email}} Reply-To
        venue_name: details.title || venueSlug,
        venue_slug: venueSlug,
        requested_date: payload.requestedDate || "TBD",
        guest_count: String(payload.guestCount || 0),
        quoted_total:
          payload.quotedTotal != null
            ? payload.quotedTotal.toFixed(2)
            : "N/A",
        firestore_path: `venueRequests/${docRef.id}`,
      },
      publicKey
    );
    console.log("📧 Manual venue request email sent");
  } else {
    console.warn("⚠️ EMAILJS public key missing; skipping admin email.");
  }
} catch (e) {
  console.error("❌ EmailJS send failed", e);
}

  } catch (err) {
    console.error("🔥 Error saving venue request:", err);
  }
};

  /* ───────────────────────── Render ───────────────────────── */

  if (!details) {
    return (
      <div className="castle-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`}
            alt="Close"
          />
        </button>
        <p>Oops! No details found for this venue.</p>
      </div>
    );
  }

  console.log("🏰 venueSlug:", venueSlug);
  console.log("📦 venueInfo:", venuePricing[venueSlug]);
  console.log("🧪 Availability:", isAvailable);
  console.log("🧪 Plan preview total:", planPreview?.total);

  return (
    <div className="castle-modal">
      <button className="modal-close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`}
          alt="Close"
        />
      </button>

      <div style={{ padding: "2rem" }}>
        <h2 className="modal-title">{details.title}</h2>

        {weddingDate && (
          <p className="modal-subtext">
            <strong>Cost:</strong>{" "}
            {!isAvailable ||
            !planPreview ||
            planPreview.total == null ||
            (guestCount !== null &&
              maxCapacity !== null &&
              guestCount > maxCapacity)
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
    allow="autoplay; fullscreen; picture-in-picture"
    allowFullScreen
    // no width/height attributes—CSS will size it
  />
</div>

        <div className="considerations-block" style={{ marginTop: "1.25rem" }}>
        <button
  className="castle-considerations-btn"
  onClick={() => setShowMadgeTip((prev) => !prev)}
  style={{
    animation: !showMadgeTip ? "pulseGlow 1.6s ease-in-out infinite" : "none",
    fontFamily: "'Jenna Sue','JennaSue',cursive",
    fontSize: "1.8rem",
    lineHeight: 1.2,
    fontWeight: 400,
    color: "#fff",
    backgroundColor: "#2c62ba",
    border: "0",
    borderRadius: "12px",
    padding: "0.75rem 1rem",
    width: "fit-content",
    minWidth: "240px",
    maxWidth: "90%",
    margin: "1.25rem auto 0", // ✅ ensures perfect centering
    textAlign: "center",
    display: "block",
    cursor: "pointer",
    boxShadow: !showMadgeTip
      ? "0 0 10px 2px rgba(44, 98, 186, 0.6), 0 8px 20px rgba(44,98,186,0.35)"
      : "0 8px 20px rgba(44,98,186,0.35)",
    transition: "box-shadow 0.2s ease, transform 0.2s ease, background-color 0.2s ease",
    alignSelf: "center", // ✅ keeps it centered in flex/column layouts
  }}
  onMouseEnter={(e) => {
    (e.currentTarget as HTMLButtonElement).style.boxShadow =
      "0 10px 24px rgba(44,98,186,0.5)";
    (e.currentTarget as HTMLButtonElement).style.transform =
      "translateY(-1px)";
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
                These Castle Considerations are key details from the venue’s
                contract or just pixie planner knowledge we have that we're
                sharing with you — Madge thinks you should be aware of them
                before booking!
              </p>

              <ul
                className="castle-considerations-list"
                style={{ paddingLeft: "1.25rem", marginTop: "1rem" }}
              >
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

        {/* if the date is blocked / closed */}
        {isAvailable === false && (
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
                color: "#b30000",
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

        {/* if guest count is too high */}
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
              <div
                style={{
                  backgroundColor: "#fff0f0",
                  padding: "1rem",
                  borderRadius: "10px",
                  marginTop: "0.5rem",
                }}
              >
                <p
                  style={{
                    fontSize: "1rem",
                    color: "#b30000",
                    fontWeight: 500,
                  }}
                >
                  Your guest count is locked due to an existing booking, so you
                  can’t lower it here. Please choose a different venue, or email
                  Madge if you need help:{" "}
                  <a href="mailto:madge@wedanddone.com">
                    madge@wedanddone.com
                  </a>
                </p>
              </div>
            ) : (
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

        {/* Date editor modal */}
        {showDateEditor && (
          <VenueDateEditor
            venueSlug={venueSlug}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            weddingDate={weddingDate}
            setWeddingDate={setWeddingDate}
            bookedDates={bookedDates}
            setNewDate={setNewDate}
            newDate={newDate}
            isNewDateConfirmed={isNewDateConfirmed}
            setIsNewDateConfirmed={setIsNewDateConfirmed}
            proposedDate={proposedDate}
            setProposedDate={setProposedDate}
            isUnavailable={isAvailable === false}
            isClosedOnThatDay={isClosedOnThatDay}
            hasBookedOtherVendors={hasBookedOtherVendors}
            setCurrentScreen={setCurrentScreen}
            onClose={() => setShowDateEditor(false)}

            /* NOTE:
               We WANT to control which month the calendar opens to (your ask),
               but VenueDateEditor doesn't yet take initialMonthDate in its props.
               We'll add that next in VenueDateEditor after this file compiles.
            */
          />
        )}

        {/* Guest editor modal */}
        {showGuestEditor && (
          <VenueGuestEditor
            guestCount={guestCount}
            setGuestCount={setGuestCount}
            confirmedGuestCount={confirmedGuestCount}
            setConfirmedGuestCount={setConfirmedGuestCount}
            venueInfo={venueInfo}
            onClose={() => setShowGuestEditor(false)}
            setCurrentScreen={setCurrentScreen}
          />
        )}

{showManualConfirmModal && (
  <>
    {/* backdrop */}
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 9998,
      }}
      onClick={() => setShowManualConfirmModal(false)}
    />

    {/* card */}
    <div
      style={{
        position: "fixed",
        zIndex: 9999,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(560px, 92vw)",
        maxHeight: "80vh",
        overflowY: "auto",
        background: "#fff",
        borderRadius: "16px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
        padding: "20px 20px 26px",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ textAlign: "center", padding: "6px 10px 14px" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/lightbulb.png`}
          alt="Heads up"
          style={{
            width: 130,
            height: 90,
            display: "block",
            margin: "0 auto 8px",
          }}
        />

        <h3 style={{ margin: "6px 0 10px", fontSize: "1.8rem" }}>
        ✨ Booking Heads-up from Madge ✨ 
        </h3>

        <p
  style={{
    lineHeight: 1.5,
    color: "#444",
    margin: "0 12px 20px",
    fontSize: "1rem",
  }}
>
   
  While many Wed&amp;Done venues allow you to book instantly <b>{details.title}</b> is one of
  our magical partners who asks us to double-check{" "}
  <strong>availability and pricing</strong> before we open the booking seal.
  <br />
  <br />
  If you continue, we’ll <strong>request your exact date</strong> and email you
  as soon as it’s confirmed.
  <br />
  <br />
  Want that instant “done and dusted” feeling? Pick a venue marked as {" "}
  <strong>Pixie Perfect • Insta-Book!</strong> 🪄
</p>

        <div
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    marginTop: 24,
marginBottom: 14,
  }}
>
  {/* cancel / pick different venue */}
  <button
    onClick={() => setShowManualConfirmModal(false)}
    style={{
      padding: "10px 18px",
      borderRadius: 10,
      border: "none",
      background: "#e86b95", // 💕 soft pink
      color: "#fff",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: "0.95rem",
      boxShadow:
        "0 4px 12px rgba(232,107,149,0.35), 0 0 10px rgba(232,107,149,0.4)",
      transition: "all 0.2s ease",
    }}
  >
    Nevermind, I’ll pick a different venue
  </button>

  {/* yes, please check my date */}
  <button
    onClick={async () => {
      try {
        setRequestSent(true);
        await saveVenueRequestToFirestore();
        setTimeout(() => {
          setShowManualConfirmModal(false);
        }, 1500);
        console.log("✅ Manual venue request submitted and email sent");
      } catch (err) {
        console.error("❌ Error submitting manual venue request:", err);
        setRequestSent(false);
        alert(
          "Something went wrong while sending your request — please try again!"
        );
      }
    }}
    disabled={requestSent}
    style={{
      padding: "10px 18px",
      borderRadius: 10,
      background: requestSent ? "#999" : "#2c62ba", // 💙 dark blue
      color: "#fff",
      cursor: requestSent ? "default" : "pointer",
      fontWeight: 600,
      fontSize: "0.95rem",
      boxShadow: requestSent
        ? "none"
        : "0 4px 12px rgba(44,98,186,0.35), 0 0 10px rgba(44,98,186,0.4)",
      transition: "all 0.2s ease",
    }}
  >
    {requestSent
      ? "Request Sent ✨"
      : "I understand — please check my date"}
  </button>
</div>

        {/* confirmation text */}
        {requestSent && (
          <p
            style={{
              marginTop: "1rem",
              fontSize: "0.9rem",
              color: "#2c62ba",
              fontWeight: 500,
            }}
          >
            We’re on it ✨ You’ll get an email soon.
          </p>
        )}
      </div>
    </div>
  </>
)}

        {/* Gold seal button only if no conflicts and we have a price */}
{isAvailable === true &&
  !isOverCapacity &&
  planPreview?.total != null && (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      {isManualConfirm ? (
  approvalStatus === "approved" ? (
    <>
      <p
        style={{
          fontSize: "1rem",
          fontWeight: 700,
          color: "#1a7f37",
          marginBottom: "0.5rem",
        }}
      >
        ✅ Approved by {details.title}! You can book now.
      </p>
      <img
  src={bookSealSrc}
  alt={isManualConfirm ? "Book It Now" : "Pixie Perfect • Insta-Book!"}
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
    </>
  ) : approvalStatus === "requested" ? (
    <>
      <p style={{ fontSize: "1rem", fontWeight: 600, color: "#2c62ba", lineHeight: 1.4, marginBottom: "0.75rem" }}>
        Request Sent ✨
      </p>
      <p style={{ fontSize: "0.9rem", color: "#444", maxWidth: 360, margin: "0 auto", lineHeight: 1.4 }}>
        We’re double-checking your date with {details.title}. We’ll email you as soon as we confirm!
      </p>
    </>
  ) : approvalStatus === "declined" ? (
    <p style={{ fontSize: "1rem", fontWeight: 600, color: "#b30000", lineHeight: 1.4 }}>
      Sorry — that date isn’t available. Please pick another.
    </p>
  ) : (
    // approvalStatus === "none" (default) → prompt to check availability
    <>
      <img
  src={bookSealSrc}
  alt="Check Availability"
  onClick={() => setShowManualConfirmModal(true)}  // or handleBookItClick (it opens the modal when not approved)
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
    </>
  )
) : (
  // Not a manual venue → normal immediate booking UI
  <img
  src={bookSealSrc}
  alt="Pixie Perfect • Insta-Book!"
  onClick={handleBookItClick}
  style={{
    width: "180px", // ✨ BIGGER for insta-book
    height: "auto",
    cursor: "pointer",
    transition: "transform 0.3s ease, filter 0.3s ease",
    filter: "drop-shadow(0 0 12px rgba(80,160,255,0.9))", // 💙 light blue glow
    display: "block",
    margin: "0 auto",
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.12)";
    e.currentTarget.style.filter =
      "drop-shadow(0 0 22px rgba(120,190,255,1))";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.filter =
      "drop-shadow(0 0 12px rgba(80,160,255,0.9))";
  }}
/>
)}
    </div>
  )}
      </div>
    </div>
  );
};

export default CastleModal;