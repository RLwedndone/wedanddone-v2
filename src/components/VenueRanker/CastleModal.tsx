// src/components/VenueRanker/CastleModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { venueDetails } from "../../utils/venueDetails";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  limit,
} from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";
import "../../styles/layouts/CastleModal.css";
import { venueIncludedItems } from "../../data/venueIncludedItems";
import VenueDateEditor from "./VenueDateEditor";
import VenueGuestEditor from "./VenueGuestEditor";
import { getGuestState } from "../../utils/guestCountStore";
import { calculatePlan } from "../../utils/calculatePlan";
import emailjs from "@emailjs/browser";

import { getVenueDateAvailability } from "../../utils/venueAvailability";
import type {
  BlockedRange,
  VenueAvailabilityReason,
} from "../../utils/venueAvailability";

import {
  venuePricing,
  Weekday,
  getSelectedSpacesForTier,
  DEFAULT_INCLUDED_STRIP_PATTERNS,
  applyPostFeesDiscount,
} from "../../data/venuePricing";

interface CastleModalProps {
  venueSlug: string;
  onClose: () => void;
  onBook: (venueSlug: string) => void;
  requireAuthForBooking?: (intent: "venuecontract" | "manual") => boolean;

  handleStartContract: (data: {
    venueSlug: string;
    venueName: string;
    guestCount: number;
    weddingDate: string;
    price: number;
  }) => void;

  onBackToIntro: () => void;

  onOpenDateEditor?: () => void;
  onOpenGuestEditor?: () => void;
  swapMode?: boolean;

  autoOpenManualConfirm?: boolean;
  setAutoOpenManualConfirm?: React.Dispatch<React.SetStateAction<boolean>>;
  portalTarget?: Element | null;
}

const CastleModal: React.FC<CastleModalProps> = ({
  venueSlug,
  onClose,
  onBook,
  requireAuthForBooking,
  handleStartContract,
  onBackToIntro,

  onOpenDateEditor,
  onOpenGuestEditor,
  swapMode,

  autoOpenManualConfirm = false,
  setAutoOpenManualConfirm,
  portalTarget,
}) => {
  /* ───────────────────────── State ───────────────────────── */

const LS_STARRED_KEY = "venueStarred";
const LS_BONUS_500_KEY = "wd_bonus500";
const BONUS_DISCOUNT_AMOUNT = 500;
const LS_BONUS_500_ACTIVE_KEY = "wd_bonus500_active";

const hasBonus500 = () => {
  try {
    return (
      localStorage.getItem(LS_BONUS_500_KEY) === "true" ||
      localStorage.getItem(LS_BONUS_500_ACTIVE_KEY) === "true"
    );
  } catch {
    return false;
  }
};

const isInviteFlowForThisVenue = () => {
  try {
    const inviteSlug = localStorage.getItem("wd_inviteVenueSlug") || "";
    const inviteCode = localStorage.getItem("wd_inviteCode") || "";
    return !!inviteSlug && inviteSlug === venueSlug && !!inviteCode;
  } catch {
    return false;
  }
};

// Keep bonus state stable so planPreview can re-run when it changes
const bonus500Active = useMemo(() => hasBonus500(), [venueSlug]);

const [isFavorited, setIsFavorited] = useState(false);

const readStarred = (): string[] => {
  try {
    const raw = localStorage.getItem(LS_STARRED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(parsed)
      ? (parsed as unknown[]).filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0
        )
      : [];
    return Array.from(new Set(arr));
  } catch {
    return [];
  }
};

// Re-sync whenever we open a different venue modal
useEffect(() => {
  // default false immediately while we load (prevents “flash of filled”)
  setIsFavorited(false);

  if (!venueSlug) return;

  const starred = readStarred();
  setIsFavorited(starred.includes(venueSlug));
}, [venueSlug]);

const toggleStarred = () => {
  try {
    const current = readStarred();

    const next = current.includes(venueSlug)
      ? current.filter((v) => v !== venueSlug)
      : [...current, venueSlug];

    localStorage.setItem(LS_STARRED_KEY, JSON.stringify(next));
    setIsFavorited(next.includes(venueSlug));

    // Tell any listeners (Scroll) that starred venues changed
    window.dispatchEvent(
      new CustomEvent("venueStarredUpdated", { detail: { starred: next } })
    );
  } catch {
    setIsFavorited((prev) => !prev);
  }
};
  const [showConsiderations, setShowConsiderations] = useState(false);
const [showIncluded, setShowIncluded] = useState(false);

  // availability / booking state
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [unavailableReason, setUnavailableReason] = useState<VenueAvailabilityReason | null>(null);

const [blockedRanges, setBlockedRanges] = useState<BlockedRange[]>([]);
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
    const swapSealSrc = `${import.meta.env.BASE_URL}assets/images/venue-ranker/swap_seal.png`;

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

  const [showSwapPicker, setShowSwapPicker] = useState(false);

  // 📱 Mobile detector (used for fullscreen portal styling)
const [isMobile, setIsMobile] = useState(() =>
  typeof window !== "undefined"
    ? window.matchMedia("(max-width: 768px)").matches
    : false
);

useEffect(() => {
  if (!isMobile) return;

  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  return () => {
    document.body.style.overflow = prev;
  };
}, [isMobile]);

useEffect(() => {
  if (typeof window === "undefined") return;

  const mq: MediaQueryList = window.matchMedia("(max-width: 768px)");

  // set initial
  setIsMobile(mq.matches);

  const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);

  // modern
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }

  // safari/old
  mq.addListener(onChange);
  return () => mq.removeListener(onChange);
}, []);

const isPortaled = !!portalTarget;
const isFullscreenMobile = isMobile && isPortaled;

  // misc
  const maxCapacity = venuePricing[venueSlug]?.maxCapacity ?? null;

  // The user's just-clicked candidate in VenueDateEditor
  const [proposedDate, setProposedDate] = useState<string | null>(null);


  // Editors still expect this prop. No-op keeps compile happy.
  const setCurrentScreen = (_screen: string) => {};

  const details = venueDetails[venueSlug];
  const includedList = (venueIncludedItems[venueSlug] ?? []) as string[];

  // manual confirm status for this user/venue/date
  const [approvalStatus, setApprovalStatus] = useState<
    "none" | "requested" | "approved" | "declined"
  >("none");

  const lockedVenueSlug =
  (() => {
    try {
      return localStorage.getItem("wd_lockedVenueSlug");
    } catch {
      return null;
    }
  })();

const isVenueLocked = Boolean(lockedVenueSlug);

  /* ───────────────────────── Helpers ───────────────────────── */

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

// Single source of truth for “what date are we using right now?”
const activeDate: string | null =
  selectedDate ||
  weddingDate ||
  localStorage.getItem("venueWeddingDate") ||
  localStorage.getItem("weddingDate") ||
  null;

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

  return [...dynamic, ...filtered];
}, [venueSlug, confirmedGuestCount, includedList]);

// price preview (what we show under "Cost")
const planPreview = useMemo(() => {
  if (!confirmedGuestCount || !venueSlug || !activeDate) {
    return {
      isClosed: false,
      total: null as number | null,        // total after fees/taxes (original)
      discount: 0,
      finalTotal: null as number | null,   // total after promo
    };
  }

  const weekdayName = new Date(activeDate + "T12:00:00")
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();

  const isClosed =
    Array.isArray(venuePricing[venueSlug]?.closedWeekdays) &&
    venuePricing[venueSlug]!.closedWeekdays!.includes(weekdayName as Weekday);

  if (isClosed) {
    return { isClosed: true, total: null, discount: 0, finalTotal: null };
  }

  const plan = calculatePlan({
    venueSlug,
    guestCount: confirmedGuestCount,
    weddingDate: activeDate,
    payFull: true,
    plannerPaidCents,
  });

  const total = Number(plan?.total || 0);

  const promoAmount = bonus500Active ? BONUS_DISCOUNT_AMOUNT : 0;
  const { discount, finalTotal } = applyPostFeesDiscount(total, promoAmount);

  return {
    isClosed: false,
    total,
    discount,
    finalTotal,
  };
}, [confirmedGuestCount, venueSlug, activeDate, plannerPaidCents, bonus500Active]);

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

const displayDate = newDate ? newDate.toISOString().split("T")[0] : selectedDate;
const isDateAvailable = !!displayDate && !bookedDates.includes(displayDate);

  /* ───────────────────────── Effects ───────────────────────── */

  // 1. Load bookedDates for this venue
  useEffect(() => {
    const fetchBookedDates = async () => {
      try {
        const venueRef = doc(db, "venues", venueSlug);
        const venueSnap = await getDoc(venueRef);

        if (venueSnap.exists()) {
          const data = venueSnap.data() as any;
        
          // bookedDates (legacy + current)
          let legacyDates: string[] = [];
          if (Array.isArray(data.bookedDates)) {
            legacyDates = data.bookedDates
              .map((d: any) => {
                if (typeof d === "string") return d;
                if (d?.toDate) return d.toDate().toISOString().split("T")[0];
                return "";
              })
              .filter(Boolean);
          }
        
          // blockedRanges (new)
          const rangesRaw = Array.isArray(data.blockedRanges) ? data.blockedRanges : [];
          const parsedRanges = rangesRaw
            .map((r: any) => ({
              start: typeof r?.start === "string" ? r.start.trim() : "",
              end: typeof r?.end === "string" ? r.end.trim() : "",
            }))
            .filter(
              (r: any) =>
                /^\d{4}-\d{2}-\d{2}$/.test(r.start) && /^\d{4}-\d{2}-\d{2}$/.test(r.end)
            );
        
          console.log("🔥 Loaded bookedDates:", legacyDates);
          console.log("🧊 Loaded blockedRanges:", parsedRanges);
        
          setBookedDates(legacyDates);
          setBlockedRanges(parsedRanges);
        } else {
          console.warn("📛 Venue document not found:", venueSlug);
          setBookedDates([]);
          setBlockedRanges([]);
        }
        } catch (err) {
          console.error("Error loading booked dates:", err);
          setBookedDates([]);
          setBlockedRanges([]);
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

            setHasBookedCatering(bookings?.catering === true);
            setHasPlannerBooked(!!(bookings?.planner === true || bookings?.venue === true));

            // planner credit
            try {
              const purchases = Array.isArray(data?.purchases) ? data.purchases : [];
              const totalPlannerDollars = purchases
                .filter(
                  (p: any) =>
                    p?.category === "planner" ||
                    (typeof p?.label === "string" &&
                      p.label.toLowerCase().includes("planner"))
                )
                .reduce((sum: number, p: any) => sum + Number(p?.amount || 0), 0);

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
            const count = parseInt(localGuests, 10);
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
    if (maxCapacity !== null && gcValue > maxCapacity) setIsOverCapacity(true);
    else setIsOverCapacity(false);
  }, [gcValue, maxCapacity]);

  // 5. Recompute availability (single source of truth)
  useEffect(() => {
    const activeDate =
      selectedDate ||
      weddingDate ||
      localStorage.getItem("venueWeddingDate") ||
      localStorage.getItem("weddingDate") ||
      null;
  
    if (!activeDate) {
      setIsAvailable(null);
      setUnavailableReason(null);
      setIsClosedOnThatDay(false);
      return;
    }
  
    const availability = getVenueDateAvailability({
      venueSlug,
      isoDate: activeDate,
      bookedDates,
      blockedRanges,
    });
  
    console.log("📅 Date availability check:", {
      venueSlug,
      date: activeDate,
      ...availability,
    });
  
    setIsAvailable(!availability.unavailable);
    setUnavailableReason(availability.unavailable ? availability.reason : null);
  
    // This flag is used ONLY for messaging/UI (not booking logic)
    setIsClosedOnThatDay(
      availability.reason === "closed_weekday" ||
        availability.reason === "sunday_not_allowed" ||
        availability.reason === "no_pricing_for_day" ||
        availability.reason === "blocked_range"
    );
  }, [selectedDate, weddingDate, bookedDates, blockedRanges, venueSlug]);

  // ✅ Auto-open manual confirm modal after auth (for manual-confirm venues)
useEffect(() => {
  if (!autoOpenManualConfirm) return;

  // Only relevant for manual-confirm venues
  if (!isManualConfirm) {
    setAutoOpenManualConfirm?.(false);
    return;
  }

  setShowManualConfirmModal(true);
  setAutoOpenManualConfirm?.(false);
}, [autoOpenManualConfirm, isManualConfirm, setAutoOpenManualConfirm]);

  // 6. Watch for manual-confirm status for this user+venue+date
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const activeDate =
  selectedDate ||
  weddingDate ||
  localStorage.getItem("venueWeddingDate") ||
  localStorage.getItem("weddingDate") ||
  null;

    if (!activeDate) {
      setApprovalStatus("none");
      return;
    }

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
        setRequestSent(true);
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

  const handleDateChange = async (date: Date) => {
    setNewDate(date);
    const formatted = date.toISOString().split("T")[0];
    localStorage.setItem("venueWeddingDate", formatted);
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

  const savePendingVenueBooking = (payload: {
    venueSlug: string;
    venueName: string;
    weddingDate: string;
    guestCount: number;
    price: number;
    intent: "contract" | "manual_confirm";
  }) => {
    try {
      localStorage.setItem("wd_pendingVenueBooking", JSON.stringify(payload));
      localStorage.setItem("venueRankerCheckpoint", "castle-modal"); // helps us resume correctly
    } catch (e) {
      console.warn("Could not save wd_pendingVenueBooking:", e);
    }
  };

  const handleSwapItClick = () => {
    console.log("🟠 swap seal clicked", venueSlug);
  
    window.dispatchEvent(
      new CustomEvent("rd_requestSwap", { detail: { slugToAdd: venueSlug } })
    );
  
    onClose();
  };

  const handleBookItClick = () => {
    console.log("🟣 Book It clicked", {
      venueSlug,
      isLoggedIn: !!auth.currentUser,
      selectedDate,
      weddingDate,
      activeDate: selectedDate || weddingDate || localStorage.getItem("venueWeddingDate") || localStorage.getItem("weddingDate"),
      confirmedGuestCount,
      gcValue,
      planPreviewTotal: planPreview?.total,
      planPreviewFinalTotal: planPreview?.finalTotal,
      isManualConfirm,
      approvalStatus,
    });
    try {
      const venueMeta = venueDetails[venueSlug];
      const venueName = venueMeta?.title || "Your Venue";
  
      const dateToUse =
        selectedDate || weddingDate || localStorage.getItem("venueWeddingDate") || "";
  
      const count = Number(confirmedGuestCount ?? gcValue ?? 0);
  
      // We may not have planPreview yet if date/guests are missing — keep safe
      const total =
  planPreview && (planPreview.finalTotal ?? planPreview.total) != null
    ? Number(planPreview.finalTotal ?? planPreview.total)
    : 0;
  
      // Decide what they *intended* to do when clicking the seal
      const intent: "contract" | "manual_confirm" =
        isManualConfirm && approvalStatus !== "approved" ? "manual_confirm" : "contract";
  
      // ✅ If they’re not authed, store intent + details, then trigger account gate
      const ok = requireAuthForBooking
  ? requireAuthForBooking(intent === "manual_confirm" ? "manual" : "venuecontract")
  : !!auth.currentUser;
  if (!ok) {
    console.log("🟠 Auth gate hit — saving pending booking and exiting", { intent });
  
    if (venueSlug && venueName && dateToUse && count > 0) {
      savePendingVenueBooking({
        venueSlug,
        venueName,
        weddingDate: dateToUse,
        guestCount: count,
        price: total,
        intent,
      });
    } else {
      console.warn("Auth gate hit but missing date/guestCount to save pending booking.");
    }
  
    // ✅ KEY FIX: close the CastleModal so the post-auth contract can appear cleanly
    onClose();
    return;
  }
  
      // ✅ Now proceed exactly like before once authed:
      if (intent === "manual_confirm") {
        setShowManualConfirmModal(true);
        return;
      }
  
      // ---- keep the rest of your existing success flow below ----
      if (!dateToUse) {
        console.warn("🚫 No wedding date available, cannot start contract.");
        return;
      }
  
      if (!count || count <= 0) {
        console.warn("🚫 No guest count available, cannot start contract.");
        return;
      }
  
      if (!planPreview || planPreview.total == null) {
        console.warn("🚫 No plan total available yet, cannot start contract.");
        return;
      }

      // 🎁 Apply Pixie Booking Bonus (if present)
      const promoAmount = Number(planPreview?.discount || 0);

try {
  localStorage.setItem("venuePromoDiscount", String(promoAmount));
  localStorage.setItem(
    "venuePromoLabel",
    promoAmount ? "$500 Pixie Booking Bonus" : ""
  );
} catch {
  // non-fatal — booking can still proceed
}
  
      const finalTotal =
  planPreview.finalTotal != null ? Number(planPreview.finalTotal) : Number(planPreview.total);
  
      localStorage.setItem("venueName", venueName);
      localStorage.setItem("venueSlug", venueSlug || "");
      localStorage.setItem("venueWeddingDate", dateToUse);
      localStorage.setItem("venueGuestCount", String(count));
      localStorage.setItem("venuePrice", finalTotal.toFixed(2));
  
      // ✅ Only lock Scroll to a single venue for VENUE-SPECIFIC INVITES
if (isInviteFlowForThisVenue()) {
  localStorage.setItem("wd_lockedVenueSlug", venueSlug);
} else {
  // ✅ $500 URL promo should NOT lock Scroll
  localStorage.removeItem("wd_lockedVenueSlug");
}
      localStorage.setItem("venueRankerCheckpoint", "scroll-of-possibilities");
  
      console.log("📝 BookIt stored:", { venueName, venueSlug, dateToUse, count, finalTotal });
  
      if (typeof handleStartContract === "function") {
        handleStartContract({
          venueSlug,
          venueName,
          guestCount: count,
          weddingDate: dateToUse,
          price: finalTotal,
        });
        return;
      }
    } catch (err) {
      console.error("💥 Error in handleBookItClick:", err);
    }
  };

  const prettyYMD = (ymd: string) => {
    const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return ymd;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const saveVenueRequestToFirestore = async () => {
    try {
      const user = auth.currentUser;
      const uid = user?.uid ?? "guest";
  
      const dateToUse =
  selectedDate ||
  weddingDate ||
  localStorage.getItem("venueWeddingDate") ||
  localStorage.getItem("weddingDate") ||
  "";
  
      const count = Number(confirmedGuestCount ?? gcValue ?? 0);
  
      const total =
  planPreview && (planPreview.finalTotal ?? planPreview.total) != null
    ? Number(planPreview.finalTotal ?? planPreview.total)
    : null;

    const payload = {
      userId: uid,
      venueSlug,
      venueName: details?.title || venueSlug,
      requestedDate: dateToUse,
      guestCount: count || 0,
      quotedTotal: total,
      promoDiscount: planPreview?.discount ?? 0,
      promoLabel: (planPreview?.discount ?? 0) > 0 ? "$500 Pixie Booking Bonus" : "",
      status: "requested",
      createdAt: serverTimestamp(),
      source: "venueRanker",
    };

      const docRef = await addDoc(collection(db, "venueRequests"), payload);
      console.log("✨ Venue request saved:", { id: docRef.id, ...payload });

      try {
        const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

        if (publicKey) {
          await emailjs.send(
            "service_xayel1i",
            "template_vawsamm",
            {
              user_name: auth.currentUser?.displayName || "Unknown User",
              user_email: auth.currentUser?.email || "unknown@wedanddone.com",
              email: auth.currentUser?.email || "unknown@wedanddone.com",
              venue_name: details?.title || venueSlug,
              venue_slug: venueSlug,
              requested_date: payload.requestedDate || "TBD",
              guest_count: String(payload.guestCount || 0),
              quoted_total: payload.quotedTotal != null ? payload.quotedTotal.toFixed(2) : "N/A",
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

  const activeIsoDate =
  selectedDate ||
  weddingDate ||
  localStorage.getItem("venueWeddingDate") ||
  localStorage.getItem("weddingDate") ||
  null;

const blockedYear = activeIsoDate ? activeIsoDate.slice(0, 4) : "";

const showUnavailable =
  !!activeDate &&
  (
    !isAvailable ||
    !planPreview ||
    planPreview.total == null ||
    (maxCapacity !== null && gcValue > maxCapacity)
  );

  const openDateEditor = () => {
    // If parent is handling the editor, close this modal first
    if (onOpenDateEditor) {
      onClose();
      // let the unmount happen first so we don't stack modals
      requestAnimationFrame(() => onOpenDateEditor());
      return;
    }
  
    // fallback: editor lives inside this modal
    setShowDateEditor(true);
  };
  
  const openGuestEditor = () => {
    if (onOpenGuestEditor) {
      onClose();
      requestAnimationFrame(() => onOpenGuestEditor());
      return;
    }
  
    setShowGuestEditor(true);
  };

  // Little "dashboard castle" icon (swap filename to your actual asset)
  const dateChangeIcon = `${import.meta.env.BASE_URL}assets/images/venue-ranker/date_change.png`;
  const guestChangeIcon = `${import.meta.env.BASE_URL}assets/images/venue-ranker/guest_change.png`;
  const castleMagicBannerSrc = `${import.meta.env.BASE_URL}assets/images/venue-ranker/castleMagicBanner.png`;
// What exactly is wrong?
const isGuestProblem =
  maxCapacity !== null && gcValue > maxCapacity;

const isDateProblem =
  isAvailable === false;

// Show the unavailable helper if we have an active date AND at least one problem
const showUnavailableHelper = !!activeDate && (isGuestProblem || isDateProblem);

// Build the red message + which action to show
const unavailableCopy = useMemo(() => {
  if (!showUnavailableHelper) return null;

  // Guest issue wins if both happen
  if (isGuestProblem) {
    return {
      message: `Your guest count is too high for this venue (max ${maxCapacity} guests).`,
      helper: "Lower my guest count",
      icon: guestChangeIcon,
      onClick: openGuestEditor,
    };
  }

  // Date issue
  if (unavailableReason === "blocked_range") {
    return {
      message: `Bookings haven’t been opened yet for ${blockedYear} (pricing pending).`,
      helper: "Change my date",
      icon: dateChangeIcon,
      onClick: openDateEditor,
    };
  }

  if (unavailableReason === "booked") {
    return {
      message: "This venue is already booked for your wedding date.",
      helper: "Change my date",
      icon: dateChangeIcon,
      onClick: openDateEditor,
    };
  }

  if (unavailableReason === "sunday_not_allowed") {
    return {
      message: "This venue isn’t available on Sundays.",
      helper: "Change my date",
      icon: dateChangeIcon,
      onClick: openDateEditor,
    };
  }

  if (
    unavailableReason === "closed_weekday" ||
    unavailableReason === "no_pricing_for_day"
  ) {
    return {
      message: "This venue isn’t available on that day of the week.",
      helper: "Change my date",
      icon: dateChangeIcon,
      onClick: openDateEditor,
    };
  }

  return {
    message: "This venue isn’t available for your selected date.",
    helper: "Change my date",
    icon: dateChangeIcon,
    onClick: openDateEditor,
  };
}, [
  showUnavailableHelper,
  isGuestProblem,
  maxCapacity,
  unavailableReason,
  blockedYear,
  openGuestEditor,
  openDateEditor,
  dateChangeIcon,
  guestChangeIcon,
]);



  /* ───────────────────────── Render ───────────────────────── */

  if (!details) {
    return createPortal(
      <div
      className={`castle-modal-overlay ${
        portalTarget ? "castle-modal-overlay--pane" : ""
      } ${isFullscreenMobile ? "castle-modal-overlay--fullscreen" : ""}`}
  onClick={onClose}
>
<div
  className={`castle-modal ${isFullscreenMobile ? "castle-modal--fullscreen" : ""}`}
  onClick={(e) => e.stopPropagation()}
>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <img
              src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`}
              alt="Close"
            />
          </button>
          <p>Oops! No details found for this venue.</p>
        </div>
      </div>,
      portalTarget ?? document.body
    );
  }

  console.log("🏰 venueSlug:", venueSlug);
  console.log("📦 venueInfo:", venuePricing[venueSlug]);
  console.log("🧪 Availability:", isAvailable);
  console.log("🧪 Plan preview total:", planPreview?.total);

  return createPortal(
    <div
  className={`castle-modal-overlay ${
    portalTarget ? "castle-modal-overlay--pane" : ""
  }`}
  onClick={onClose}
  style={
    !portalTarget && isMobile
      ? {
          position: "fixed",
          inset: 0,
          background: "#fff",     // ✅ no dark backdrop on mobile
          padding: 0,
          margin: 0,
          zIndex: 9999,
        }
      : undefined
  }
>
  <div
    className="castle-modal"
    onClick={(e) => e.stopPropagation()}
    style={
      !portalTarget && isMobile
        ? {
            width: "100vw",
            height: "100vh",
            maxWidth: "none",
            maxHeight: "none",
            borderRadius: 0,
            boxShadow: "none",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }
        : undefined
    }
  >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`}
            alt="Close"
          />
        </button>

        <div style={{ padding: "2rem" }}>
          <h2 className="modal-title">{details.title}</h2>

          {activeDate && (
  <p className="modal-subtext">
    <strong>Cost:</strong>{" "}
    {!isAvailable ||
    !planPreview ||
    planPreview.total == null ||
    (maxCapacity !== null && gcValue > maxCapacity)
      ? "Unavailable"
      : `$${(planPreview.finalTotal ?? planPreview.total).toLocaleString()}`}
  </p>
)}

{unavailableCopy && (
  <div
    style={{
      marginTop: 14,
      textAlign: "center",
      paddingBottom: 10, // creates breathing room so bonus line never collides
    }}
  >
    <p
      style={{
        fontWeight: 800,
        color: "#b00020",
        margin: "0 0 10px",
        fontSize: "1.05rem",
        lineHeight: 1.35,
      }}
    >
      {unavailableCopy.message}
    </p>

    <button
      type="button"
      onClick={unavailableCopy.onClick}
      aria-label={unavailableCopy.helper}
      title={unavailableCopy.helper}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <img
  src={unavailableCopy.icon}
  alt=""
  style={{
    width: 80,
    height: 80,
    objectFit: "contain",
    filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.18))",
  }}
  draggable={false}
/>
      <div style={{ color: "#777", fontSize: "0.92rem", fontWeight: 600 }}>
        {unavailableCopy.helper}
      </div>
    </button>
  </div>
)}

{planPreview?.discount > 0 &&
  planPreview?.finalTotal != null &&
  planPreview?.total != null && (
    <p
  className="modal-subtext"
  style={{ marginTop: unavailableCopy ? "0.25rem" : "-0.5rem" }}
>
      <span style={{ color: "#2c62ba", fontWeight: 700 }}>
        Pixie Booking Bonus:
      </span>{" "}
      <span style={{ color: "#1a7f37", fontWeight: 800 }}>
        -${planPreview.discount.toLocaleString()}
      </span>{" "}
      <span style={{ color: "#777", fontSize: "0.9rem" }}>
        (was ${planPreview.total.toLocaleString()})
      </span>
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
            />
          </div>

          {/* ✨ Castle Magic Banner (below video) */}
<div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "center" }}>
  <img
    src={castleMagicBannerSrc}
    alt="Castle Magic"
    style={{
      width: "min(720px, 100%)",
      height: "auto",
      borderRadius: 18,
      boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
    }}
    draggable={false}
  />
</div>

{/* 🔽 Two big glowing buttons */}
<div
  style={{
    marginTop: "1.25rem",
    display: "grid",
    gap: 14,
    justifyItems: "center",
  }}
>
  {/* Castle Considerations Button */}
  <button
    type="button"
    onClick={() => {
      setShowConsiderations((prev) => !prev);
      // optional: only one open at a time
      setShowIncluded(false);
    }}
    style={{
      width: "min(640px, 100%)",
      padding: "18px 18px",
      borderRadius: 18,
      border: "none",
      cursor: "pointer",
      color: "#fff",
      fontFamily: "'Jenna Sue','JennaSue',cursive",
      fontSize: "2.2rem",
      lineHeight: 1.05,
      background: "linear-gradient(180deg, #2c62ba 0%, #1f4f9f 100%)",
      boxShadow: showConsiderations
        ? "0 0 0 4px rgba(44,98,186,0.18), 0 12px 28px rgba(44,98,186,0.42)"
        : "0 0 14px 5px rgba(44,98,186,0.35), 0 10px 26px rgba(44,98,186,0.28)",
      transform: showConsiderations ? "translateY(-1px)" : "none",
      transition: "transform 180ms ease, box-shadow 220ms ease",
      textAlign: "center",
    }}
    aria-expanded={showConsiderations}
  >
    Castle Considerations
    <span style={{ display: "block", fontFamily: "Nunito, system-ui, sans-serif", fontSize: "1rem", marginTop: 6, opacity: 0.92 }}>
      Tap to {showConsiderations ? "hide" : "read"} the important stuff ✨
    </span>
  </button>

  {showConsiderations && (
    <div
      style={{
        width: "min(720px, 100%)",
        background: "#fff",
        borderRadius: 18,
        padding: "16px 18px 12px",
        boxShadow: "0 10px 26px rgba(0,0,0,0.10)",
        border: "1px solid rgba(44,98,186,0.12)",
      }}
    >
      <p
        style={{
          margin: "0 0 12px",
          color: "#444",
          fontSize: "1rem",
          lineHeight: 1.5,
          fontFamily: "Nunito, system-ui, sans-serif",
        }}
      >
        These are key contract notes + pixie-planner tips Madge wants you to know before you book.
      </p>

      <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
        {details.castleConsiderations.map((item, index) => (
          <li
            key={index}
            dangerouslySetInnerHTML={{ __html: item }}
            style={{ marginBottom: "0.65rem", color: "#222", fontFamily: "Nunito, system-ui, sans-serif", fontSize: "1.05rem", lineHeight: 1.55 }}
          />
        ))}
      </ul>
    </div>
  )}

  {/* What's Included Button */}
  <button
    type="button"
    onClick={() => {
      setShowIncluded((prev) => !prev);
      // optional: only one open at a time
      setShowConsiderations(false);
    }}
    style={{
      width: "min(640px, 100%)",
      padding: "18px 18px",
      borderRadius: 18,
      border: "none",
      cursor: "pointer",
      color: "#fff",
      fontFamily: "'Jenna Sue','JennaSue',cursive",
      fontSize: "2.2rem",
      lineHeight: 1.05,
      background: "linear-gradient(180deg, #6a3df2 0%, #8b5bff 100%)",
boxShadow: showIncluded
  ? "0 0 0 4px rgba(106,61,242,0.18), 0 12px 28px rgba(106,61,242,0.42)"
  : "0 0 14px 5px rgba(106,61,242,0.32), 0 10px 26px rgba(106,61,242,0.26)",
      transform: showIncluded ? "translateY(-1px)" : "none",
      transition: "transform 180ms ease, box-shadow 220ms ease",
      textAlign: "center",
    }}
    aria-expanded={showIncluded}
    disabled={includedDisplay.length === 0}
  >
    What&apos;s Included
    <span style={{ display: "block", fontFamily: "Nunito, system-ui, sans-serif", fontSize: "1rem", marginTop: 6, opacity: 0.92 }}>
      Tap to {showIncluded ? "hide" : "see"} what you get 🪄
    </span>
  </button>

  {showIncluded && includedDisplay.length > 0 && (
    <div
      style={{
        width: "min(720px, 100%)",
        background: "#fff",
        borderRadius: 18,
        padding: "16px 18px 12px",
        boxShadow: "0 10px 26px rgba(0,0,0,0.10)",
        border: "1px solid rgba(59,124,255,0.14)",
      }}
    >
      <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
        {includedDisplay.map((item, idx) => (
          <li
            key={idx}
            dangerouslySetInnerHTML={{ __html: item }}
            style={{ marginBottom: "0.65rem", color: "#222", fontFamily: "Nunito, system-ui, sans-serif", fontSize: "1.05rem", lineHeight: 1.55 }}
          />
        ))}
      </ul>
    </div>
  )}
</div>

          {/* if the date is blocked / closed */}

          {/* Date editor modal */}
          {showDateEditor && (
            <VenueDateEditor
              venueSlug={venueSlug}
              venueTitle={details.title}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              weddingDate={weddingDate}
              setWeddingDate={setWeddingDate}
              bookedDates={bookedDates}
              blockedRanges={blockedRanges} 
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
            />
          )}

          {/* Guest editor modal */}
{showGuestEditor && (
  <VenueGuestEditor
    guestCount={guestCount}
    setGuestCount={setGuestCount}
    confirmedGuestCount={confirmedGuestCount}
    setConfirmedGuestCount={setConfirmedGuestCount}
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
                    While many Wed&amp;Done venues allow you to book instantly <b>{details.title}</b>{" "}
                    is one of our magical partners who asks us to double-check{" "}
                    <strong>availability and pricing</strong> before we open the booking seal.
                    <br />
                    <br />
                    If you continue, we’ll <strong>request your exact date</strong> and email you as
                    soon as it’s confirmed.
                    <br />
                    <br />
                    Want that instant “done and dusted” feeling? Pick a venue marked as{" "}
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
                    <button
  onClick={() => {
    setShowManualConfirmModal(false);

    // ✅ POST-AUTH RESUME CASE:
    // If we auto-opened this manual confirm after account creation,
    // "Nevermind" should ALWAYS return to Scroll (close castle modal),
    // NOT restart the whole overlay.
    if (autoOpenManualConfirm) {
      setAutoOpenManualConfirm?.(false);
      onClose();
      return;
    }
  
    // Exploring mode → stay in scroll, compare other venues
    if (!isVenueLocked) {
      onClose();
      return;
    }
  
    // Direct booking → hard reset to intro screen
    onBackToIntro();
  }}
  style={{
    padding: "10px 18px",
    borderRadius: 10,
    border: "none",
    background: "#e86b95",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.95rem",
    boxShadow: "0 4px 12px rgba(232,107,149,0.35), 0 0 10px rgba(232,107,149,0.4)",
    transition: "all 0.2s ease",
  }}
>
  {isVenueLocked ? "Back to the beginning" : "Nevermind, I’ll compare other venues"}
</button>

<button
  onClick={async () => {
    // ✅ Account gate here too (otherwise guests can submit requests)
    const ok = requireAuthForBooking
      ? requireAuthForBooking("manual")
      : !!auth.currentUser;

    if (!ok) {
      // ✅ Save pending manual booking so we can reopen this castle after auth
      try {
        const venueName = details?.title || venueSlug;

        const dateToUse =
          selectedDate ||
          weddingDate ||
          localStorage.getItem("venueWeddingDate") ||
          localStorage.getItem("weddingDate") ||
          "";

        const count = Number(confirmedGuestCount ?? gcValue ?? 0);

        const total =
  planPreview && planPreview.finalTotal != null
    ? Number(planPreview.finalTotal)
    : planPreview && planPreview.total != null
    ? Number(planPreview.total)
    : 0;

        if (venueSlug && venueName && dateToUse && count > 0) {
          savePendingVenueBooking({
            venueSlug,
            venueName,
            weddingDate: dateToUse,
            guestCount: count,
            price: total,
            intent: "manual_confirm",
          });
        }
      } catch (e) {
        console.warn("Could not save pending manual booking before auth:", e);
      }

      // ✅ KEY FIX: close modals so post-auth resume can take over cleanly
  setShowManualConfirmModal(false);
  onClose();
  return;
    }

    // ✅ User is authed → actually submit the manual request
    try {
      setRequestSent(true);
      await saveVenueRequestToFirestore();
      setTimeout(() => setShowManualConfirmModal(false), 1500);
      console.log("✅ Manual venue request submitted and email sent");
    } catch (err) {
      console.error("❌ Error submitting manual venue request:", err);
      setRequestSent(false);
      alert("Something went wrong while sending your request — please try again!");
    }
  }}
  disabled={requestSent}
  style={{
    padding: "10px 18px",
    borderRadius: 10,
    background: requestSent ? "#999" : "#2c62ba",
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
  {requestSent ? "Request Sent ✨" : "I understand — please check my date"}
</button>
                  </div>

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

                    {/* Seal CTA (booking OR swap) only if no conflicts and we have a price */}
                    {isAvailable === true &&
            !isOverCapacity &&
            (planPreview?.finalTotal ?? planPreview?.total) != null && (
              <div style={{ textAlign: "center", marginTop: "2rem" }}>
                {swapMode ? (
                  <>
                    <img
                      src={swapSealSrc}
                      alt="Swap it in"
                      onClick={handleSwapItClick}
                      style={{
                        width: "170px",
                        height: "auto",
                        cursor: "pointer",
                        transition: "transform 0.3s ease, filter 0.3s ease",
                        filter: "drop-shadow(0 0 10px rgba(120,190,255,0.65))",
                        display: "block",
                        margin: "0 auto",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.12)";
                        e.currentTarget.style.filter =
                          "drop-shadow(0 0 18px rgba(120,190,255,0.95))";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.filter =
                          "drop-shadow(0 0 10px rgba(120,190,255,0.65))";
                      }}
                    />

                    <div
                      style={{
                        marginTop: 10,
                        fontSize: "0.95rem",
                        color: "#666",
                        fontWeight: 700,
                      }}
                    >
                      Swap this venue into your Top 5 ✨
                    </div>
                  </>
                ) : (
                  <>
                    {/* ✅ KEEP YOUR EXISTING BOOKING SEAL LOGIC */}
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
                          <p
                            style={{
                              fontSize: "1rem",
                              fontWeight: 600,
                              color: "#2c62ba",
                              lineHeight: 1.4,
                              marginBottom: "0.75rem",
                            }}
                          >
                            Request Sent ✨
                          </p>
                          <p
                            style={{
                              fontSize: "0.9rem",
                              color: "#444",
                              maxWidth: 360,
                              margin: "0 auto",
                              lineHeight: 1.4,
                            }}
                          >
                            We’re double-checking your date with {details.title}. We’ll email you as
                            soon as we confirm!
                          </p>
                        </>
                      ) : approvalStatus === "declined" ? (
                        <p
                          style={{
                            fontSize: "1rem",
                            fontWeight: 600,
                            color: "#b30000",
                            lineHeight: 1.4,
                          }}
                        >
                          Sorry — that date isn’t available. Please pick another.
                        </p>
                      ) : (
                        <img
                          src={bookSealSrc}
                          alt="Check Availability"
                          onClick={() => setShowManualConfirmModal(true)}
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
                      )
                    ) : (
                      <img
                        src={bookSealSrc}
                        alt="Pixie Perfect • Insta-Book!"
                        onClick={handleBookItClick}
                        style={{
                          width: "180px",
                          height: "auto",
                          cursor: "pointer",
                          transition: "transform 0.3s ease, filter 0.3s ease",
                          filter: "drop-shadow(0 0 12px rgba(80,160,255,0.9))",
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

                    {/* ⭐ Star (secondary CTA – venueStarred) */}
                    <div style={{ textAlign: "center", marginTop: "0.9rem" }}>
                      <button
                        type="button"
                        onClick={toggleStarred}
                        aria-label={isFavorited ? "Remove star" : "Star this venue"}
                        title={isFavorited ? "Starred" : "Save for later"}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <div style={{ position: "relative", width: 60, height: 60 }}>
                          {/* Clear (unstarred) */}
                          <img
                            src={`${import.meta.env.BASE_URL}assets/images/clear_star.png`}
                            alt=""
                            style={{
                              position: "absolute",
                              inset: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              opacity: isFavorited ? 0 : 1,
                              transition: "opacity 300ms ease-in-out",
                              filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.2))",
                            }}
                          />

                          {/* Filled (starred) */}
                          <img
                            src={`${import.meta.env.BASE_URL}assets/images/filled_star.png`}
                            alt=""
                            style={{
                              position: "absolute",
                              inset: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              opacity: isFavorited ? 1 : 0,
                              transition: "opacity 300ms ease-in-out",
                              filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.25))",
                            }}
                          />
                        </div>
                      </button>

                      <div
                        style={{
                          marginTop: 6,
                          fontSize: "0.92rem",
                          color: "#666",
                          lineHeight: 1.3,
                        }}
                      >
                        {isFavorited ? "Starred for later ✨" : "Tap the star to remember this one."}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
        </div>
      </div>
    </div>,
    portalTarget ?? document.body
  );
};

export default CastleModal;