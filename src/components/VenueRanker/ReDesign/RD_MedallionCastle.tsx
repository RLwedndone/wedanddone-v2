// src/components/VenueRanker/ReDesign/RD_MedallionCastle.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../../styles/globals/boutique.master.css";
import CastleModal from "../CastleModal";
import VenueDateEditor from "../VenueDateEditor";
import VenueGuestEditor from "../VenueGuestEditor";
import { venuePricing } from "../../../data/venuePricing"; // adjust path if yours differs
import { getVenueDateAvailability, type BlockedRange } from "../../../utils/venueAvailability";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { venueDetails } from "../../../utils/venueDetails";
import SaveProgressMini from "../SaveProgressMini";
import { auth } from "../../../firebase/firebaseConfig";

import type {
  RDInterviewState,
  VenueSlug,
  VenueScoreResult,
  MedallionTier,
} from "./rdVenueTypes";

import { scoreAllVenues } from "./rdVenueScoring";


const LS_STARRED_KEY = "venueStarred";

function readStarred(): string[] {
  try {
    const raw = localStorage.getItem(LS_STARRED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(parsed)
      ? (parsed as unknown[]).filter(
        (v): v is string =>
          typeof v === "string" && v.trim().length > 0
      )
      : [];
    return Array.from(new Set(arr));
  } catch {
    return [];
  }
}

const LS_INTERVIEW_SIG_KEY = "rd_ranker_interview_sig";

function makeInterviewSig(interview: RDInterviewState) {
  try {
    return JSON.stringify(interview);
  } catch {
    return String(Date.now());
  }
}

/* ------------------------------------------------------------------ */
/* 🏅 Medallion image resolver (matches your exact file names)       */
/* ------------------------------------------------------------------ */

function getMedallionSrc(slug: VenueSlug, tier: MedallionTier) {
  return `${import.meta.env.BASE_URL}assets/images/venue-ranker/medallions/Medallion-${slug}-${tier}.png`;
}

function getScrollSrc(slug: VenueSlug) {
    return `${import.meta.env.BASE_URL}assets/images/venue-ranker/scrolls/${slug}_scroll.png`;
  }

  function getTierGlow(tier: MedallionTier) {
    switch (tier) {
      case "blue":
        return "drop-shadow(0 0 10px rgba(80,160,255,0.9)) drop-shadow(0 0 18px rgba(80,160,255,0.55))";
      case "purple":
        return "drop-shadow(0 0 10px rgba(175,120,255,0.9)) drop-shadow(0 0 18px rgba(175,120,255,0.55))";
      case "pink":
        return "drop-shadow(0 0 10px rgba(255,120,190,0.9)) drop-shadow(0 0 18px rgba(255,120,190,0.55))";
      default:
        return "none";
    }
  }
  
  function getTierGlowHover(tier: MedallionTier) {
    switch (tier) {
      case "blue":
        return "drop-shadow(0 0 14px rgba(80,160,255,1)) drop-shadow(0 0 26px rgba(80,160,255,0.75))";
      case "purple":
        return "drop-shadow(0 0 14px rgba(175,120,255,1)) drop-shadow(0 0 26px rgba(175,120,255,0.75))";
      case "pink":
        return "drop-shadow(0 0 14px rgba(255,120,190,1)) drop-shadow(0 0 26px rgba(255,120,190,0.75))";
      default:
        return "none";
    }
  }
/* ------------------------------------------------------------------ */

type Props = {
    interview: RDInterviewState;
    disabledVenues?: Set<string>;
    invitedVenueSlug?: VenueSlug | null;
  
    onOpenVenue: (slug: VenueSlug) => void;
    onPreviewVenue: (slug: VenueSlug) => void;
    onRequestSwap: (slugToAdd: VenueSlug) => void;
    requireAuthForBooking?: (intent: "venuecontract" | "manual") => boolean;
  
    onStartOver: () => void;   // ✅ NEW
    onClose: () => void;
    onBack?: () => void;
  };

const LS_TOP5_KEY = "rd_ranker_top5";

function readTop5(): VenueSlug[] | null {
  try {
    const raw = localStorage.getItem(LS_TOP5_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : null;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(Boolean) as VenueSlug[];
  } catch {
    return null;
  }
}

function writeTop5(list: VenueSlug[]) {
  try {
    localStorage.setItem(LS_TOP5_KEY, JSON.stringify(list));
  } catch {}
}

const TIER_LABEL: Record<MedallionTier, string> = {
  blue: "✨ Royal Match",
  purple: "🌙 Promising Possibility",
  pink: "🔮 Bold Dream",
};

const RD_MedallionCastle: React.FC<Props> = ({
  interview,
  disabledVenues,
  invitedVenueSlug,
  onOpenVenue,
  onPreviewVenue,
  onRequestSwap,
  onStartOver,
  onClose,
  onBack,
  requireAuthForBooking,
}) => {

    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth < 900 : false
      );
      
      useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 900);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
      }, []);
    
    const castleBg = isMobile
      ? `${import.meta.env.BASE_URL}assets/images/venue-ranker/castle_background_mobile.webp`
      : `${import.meta.env.BASE_URL}assets/images/venue-ranker/castle_background2.webp`;

  const scrollBg = `${import.meta.env.BASE_URL}assets/images/venue-ranker/ScrollBaseDesktop.webp`;

  const castlePaneRef = useRef<HTMLDivElement | null>(null);
  const mobileModalPortalRef = useRef<HTMLDivElement | null>(null);

  const [bodyPortal, setBodyPortal] = useState<HTMLElement | null>(null);

  // ✅ Always mark Medallion as the resume point as soon as this screen renders
try {
  localStorage.setItem("venueRankerCheckpoint", "medallion");
} catch {}

  useEffect(() => {
    if (typeof document !== "undefined") setBodyPortal(document.body);
  }, []);


   /* ------------------------------------------------------------------ */
  /* Change Date and Change Guest Count State                            */
  /* ------------------------------------------------------------------ */

  const [showDateEditor, setShowDateEditor] = useState(false);
const [showGuestEditor, setShowGuestEditor] = useState(false);

// which venue are we editing for?
const [editorVenueSlug, setEditorVenueSlug] = useState<VenueSlug | null>(null);

// date state (VenueDateEditor expects these)
const [weddingDate, setWeddingDate] = useState<string | null>(() => readWeddingDateLS());
const [selectedDate, setSelectedDate] = useState<string | null>(() => readWeddingDateLS());
const [proposedDate, setProposedDate] = useState<string | null>(null);
const [newDate, setNewDate] = useState<Date | null>(null);
const [isNewDateConfirmed, setIsNewDateConfirmed] = useState(false);

const isUltraWide = typeof window !== "undefined" && window.innerWidth >= 1700;

const STAGE_W = isMobile ? 430 : 880;
const STAGE_H = isMobile ? 760 : 720;

// 👇 ADD THESE RIGHT UNDER
const MED_SIZE = isMobile ? 140 : 170;
const STAR_SIZE = isMobile ? 48 : 60;
const STAR_TOP = isMobile ? 28 : 34;

const [stageScale, setStageScale] = useState(1);

// availability inputs for VenueDateEditor
const [bookedDates, setBookedDates] = useState<string[]>([]);
const [blockedRanges, setBlockedRanges] = useState<BlockedRange[]>([]);

const openDateEditorFor = (slug: VenueSlug) => {
    setOpenCastleSlug(null);
    setEditorVenueSlug(slug);
  
    const d = readWeddingDateLS();
  
    setWeddingDate(d);
    setSelectedDate(d);
    setProposedDate(null);
    setIsNewDateConfirmed(false);
  
    setShowDateEditor(true);
  };
  
  const openGuestEditorFor = (slug: VenueSlug) => {
    setOpenCastleSlug(null);     // ✅ close castle modal first
    setEditorVenueSlug(slug);
    setShowGuestEditor(true);
  };

  function readWeddingDateLS(): string | null {
    try {
      return (
        localStorage.getItem("venueWeddingDate") ||
        localStorage.getItem("weddingDate") ||
        null
      );
    } catch {
      return null;
    }
  }
  
  const persistWeddingDateEverywhere = async (dateStr: string) => {
    if (!dateStr) return;
  
    try {
      // keep both keys in sync (backwards compatible)
      localStorage.setItem("weddingDate", dateStr);
      localStorage.setItem("venueWeddingDate", dateStr);
    } catch {}
  
    // if logged in, also sync to Firestore (source-of-truth)
    const uid = auth.currentUser?.uid;
    if (!uid) return;
  
    try {
      const { setDoc, serverTimestamp } = await import("firebase/firestore");
      await setDoc(doc(db, "users", uid), { weddingDate: dateStr }, { merge: true });
      await setDoc(
        doc(db, "users", uid, "venueRankerData", "booking"),
        { weddingDate: dateStr, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.warn("⚠️ Could not persist weddingDate to Firestore:", e);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!showDateEditor) return;
      if (!editorVenueSlug) {
        // generic mode
        setBookedDates([]);
        setBlockedRanges([]);
        return;
      }
  
      try {
        const venueRef = doc(db, "venues", editorVenueSlug);
        const snap = await getDoc(venueRef);
  
        if (!snap.exists()) {
          setBookedDates([]);
          setBlockedRanges([]);
          return;
        }
  
        const data = snap.data() as any;
  
        // legacy + current bookedDates
        const legacy: string[] = Array.isArray(data.bookedDates)
          ? data.bookedDates
              .map((d: any) => {
                if (typeof d === "string") return d;
                if (d?.toDate) return d.toDate().toISOString().split("T")[0];
                return "";
              })
              .filter(Boolean)
          : [];
  
        // blockedRanges
        const rangesRaw = Array.isArray(data.blockedRanges) ? data.blockedRanges : [];
        const ranges: BlockedRange[] = rangesRaw
          .map((r: any) => ({
            start: typeof r?.start === "string" ? r.start.trim() : "",
            end: typeof r?.end === "string" ? r.end.trim() : "",
          }))
          .filter(
            (r: any) =>
              /^\d{4}-\d{2}-\d{2}$/.test(r.start) && /^\d{4}-\d{2}-\d{2}$/.test(r.end)
          );
  
        setBookedDates(legacy);
        setBlockedRanges(ranges);
      } catch (e) {
        console.error("Failed loading venue availability for editor:", e);
        setBookedDates([]);
        setBlockedRanges([]);
      }
    };
  
    run();
  }, [showDateEditor, editorVenueSlug]);

  /* ------------------------------------------------------------------ */
  /* 🔢 Scoring                                                          */
  /* ------------------------------------------------------------------ */

  const scoredAll = useMemo(() => {
    const results = scoreAllVenues(interview);
    const disabled = disabledVenues ?? new Set<string>();
    return results.filter((r) => !disabled.has(r.slug));
  }, [interview, disabledVenues]);


  /* ------------------------------------------------------------------ */
  /* 🏰 Top 5 Logic                                                      */
  /* ------------------------------------------------------------------ */

  const [topFive, setTopFive] = useState<VenueSlug[]>([]);

  const rightGrid = useMemo(() => {
    const topSet = new Set(topFive);
    return scoredAll.filter((r) => !topSet.has(r.slug));
  }, [scoredAll, topFive]);

  const topFiveResults: VenueScoreResult[] = useMemo(() => {
    const map = new Map(scoredAll.map((r) => [r.slug, r]));
    return topFive
      .map((s) => map.get(s))
      .filter(Boolean) as VenueScoreResult[];
  }, [topFive, scoredAll]);

  useEffect(() => {
    const saved = readTop5();

    if (saved && saved.length) {
      const allowed = new Set(scoredAll.map((r) => r.slug));
      const cleaned = saved.filter((s) => allowed.has(s)).slice(0, 5);
      if (cleaned.length === 5) {
        setTopFive(cleaned);
        return;
      }
    }

    const auto = scoredAll.slice(0, 5).map((r) => r.slug);
    setTopFive(auto);
    writeTop5(auto);
  }, [scoredAll]);

  const [swapCandidate, setSwapCandidate] = useState<VenueSlug | null>(null);
const [showSwapPicker, setShowSwapPicker] = useState(false);

const swapIntoTopFive = (slugToReplace: VenueSlug) => {
    if (!swapCandidate) return;
  
    setTopFive((prev) =>
      prev.map((slug) =>
        slug === slugToReplace ? swapCandidate : slug
      )
    );
  
    setShowSwapPicker(false);
    setSwapCandidate(null);
  };

  useEffect(() => {
    const el = castlePaneRef.current;
    if (!el) return;
  
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      const scale = Math.min(width / STAGE_W, height / STAGE_H);
      setStageScale(scale);
    });
  
    ro.observe(el);
    return () => ro.disconnect();
  }, []);


  useEffect(() => {
    // VenueDateEditor uses isNewDateConfirmed as the “user committed the date”
    if (!isNewDateConfirmed) return;
    if (!selectedDate) return;
  
    persistWeddingDateEverywhere(selectedDate);
  }, [isNewDateConfirmed, selectedDate]);

  useEffect(() => {
    if (topFive.length) writeTop5(topFive);
  }, [topFive]);

  const [openCastleSlug, setOpenCastleSlug] = useState<VenueSlug | null>(null);
  const [castleSwapMode, setCastleSwapMode] = useState(false);

  // ✅ lock background scroll when CastleModal is open on mobile
useEffect(() => {
    if (!isMobile) return;
    if (!openCastleSlug) return;
  
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile, openCastleSlug]);

const primeVenueContextAndOpen = (slug: VenueSlug) => {
  try {
    // ✅ wedding date (must be YYYY-MM-DD)
    const d =
      (interview as any)?.weddingDate ||
      (interview as any)?.date ||
      localStorage.getItem("weddingDate") ||
      "";

    if (d) {
      localStorage.setItem("weddingDate", d);
      localStorage.setItem("venueWeddingDate", d);
    }

    // ✅ guest count
    const gc =
      Number((interview as any)?.guestCount) ||
      Number((interview as any)?.guests) ||
      Number(localStorage.getItem("guestCount") || 0);

    if (gc > 0) {
      localStorage.setItem("guestCount", String(gc));
      localStorage.setItem("venueGuestCount", String(gc));
      window.dispatchEvent(new Event("guestCountUpdated"));
    }
  } catch {}

  setOpenCastleSlug(slug);
};

useEffect(() => {
    try {
      const sig = makeInterviewSig(interview);
      const prev = localStorage.getItem(LS_INTERVIEW_SIG_KEY);
  
      if (prev && prev !== sig) {
        localStorage.removeItem(LS_TOP5_KEY); // nuke old top5 if answers changed
      }
  
      localStorage.setItem(LS_INTERVIEW_SIG_KEY, sig);
    } catch {}
  }, [interview]);

useEffect(() => {
    const onRequestSwap = (e: Event) => {
      const ce = e as CustomEvent<{ slugToAdd?: string }>;
      const slug = ce.detail?.slugToAdd;
  
      if (!slug) return;
  
      setSwapCandidate(slug as VenueSlug);
      setShowSwapPicker(true);
    };
  
    window.addEventListener("rd_requestSwap", onRequestSwap);
    return () => window.removeEventListener("rd_requestSwap", onRequestSwap);

    const swapIntoTopFive = (slugToReplace: VenueSlug) => {
        if (!swapCandidate) return;
      
        setTopFive((prev) => {
          const next = prev.slice();
          const idx = next.indexOf(slugToReplace);
          if (idx === -1) return prev;
      
          next[idx] = swapCandidate;
          writeTop5(next);
          return next;
        });
      
        setShowSwapPicker(false);
        setSwapCandidate(null);
      };
  }, []);

const [starredSet, setStarredSet] = useState<Set<string>>(() => new Set(readStarred()));
const handleStartOver = () => {
    try {
      // ✅ Clear saved favorites
      localStorage.removeItem(LS_STARRED_KEY);
  
      // ✅ Tell any listeners “favorites are now empty”
      window.dispatchEvent(
        new CustomEvent("venueStarredUpdated", { detail: { starred: [] } })
      );
    } catch {}
  
    // ✅ Clear current session UI immediately (so stars vanish now)
    setStarredSet(new Set());
  
    // ✅ Continue with your existing reset flow (intro, etc.)
    onStartOver();
  };

useEffect(() => {
  // initial sync (in case LS changed before mount)
  setStarredSet(new Set(readStarred()));

  const onStarredUpdated = (e: Event) => {
    const ce = e as CustomEvent<{ starred?: string[] }>;
    const incoming = ce.detail?.starred;
    if (Array.isArray(incoming)) {
      setStarredSet(new Set(incoming));
      return;
    }
    // fallback: read from LS
    setStarredSet(new Set(readStarred()));
  };

  window.addEventListener("venueStarredUpdated", onStarredUpdated);

  // optional: catch manual LS changes / multi-tab
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_STARRED_KEY) setStarredSet(new Set(readStarred()));
  };
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("venueStarredUpdated", onStarredUpdated);
    window.removeEventListener("storage", onStorage);
  };
}, []);

  /* ------------------------------------------------------------------ */
  /* 🎯 Explainer modal                                                  */
  /* ------------------------------------------------------------------ */

  const [explainSlug, setExplainSlug] = useState<VenueSlug | null>(null);

  const explainResult = useMemo(() => {
    if (!explainSlug) return null;
    return scoredAll.find((r) => r.slug === explainSlug) || null;
  }, [explainSlug, scoredAll]);

    /* ------------------------------------------------------------------ */
  /* 🆘 Help modal (Madge)                                               */
  /* ------------------------------------------------------------------ */

  const LS_HELP_SEEN_KEY = "rd_medallion_help_seen";

const [showHelp, setShowHelp] = useState(false);
const [helpSlideIndex, setHelpSlideIndex] = useState(0);

const [isHelpAnimating, setIsHelpAnimating] = useState(false);
const [helpAnimPhase, setHelpAnimPhase] = useState<"in" | "out">("in");

const goToHelpSlide = (nextIndex: number) => {
  if (isHelpAnimating) return;
  if (nextIndex === helpSlideIndex) return;
  if (nextIndex < 0 || nextIndex > HELP_SLIDES.length - 1) return;

  setIsHelpAnimating(true);
  setHelpAnimPhase("out");

  window.setTimeout(() => {
    setHelpSlideIndex(nextIndex);
    setHelpAnimPhase("in");

    window.setTimeout(() => {
      setIsHelpAnimating(false);
    }, 200);
  }, 160);
};

// auto-open help on first visit to Medallion screen
useEffect(() => {
  try {
    // ✅ stamp resume point BEFORE anything else happens
    localStorage.setItem("venueRankerCheckpoint", "medallion");

    const seen = localStorage.getItem(LS_HELP_SEEN_KEY);
    if (!seen) {
      setHelpSlideIndex(0);
      setShowHelp(true);
    }
  } catch {
    // if LS is blocked, just don't auto-open
  }
}, []);

const closeHelp = () => {
  setShowHelp(false);
  try {
    localStorage.setItem(LS_HELP_SEEN_KEY, "1");
    localStorage.setItem("venueRankerCheckpoint", "medallion");
  } catch {}
};

const openHelp = () => {
  setHelpSlideIndex(0);
  setShowHelp(true);
};

  const helpImg = `${import.meta.env.BASE_URL}assets/images/venue-ranker/MadgeHelp.png`;
  const dateIcon = `${import.meta.env.BASE_URL}assets/images/venue-ranker/date_change.png`;
const guestIcon = `${import.meta.env.BASE_URL}assets/images/venue-ranker/guest_change.png`;
const helpImgMobile = `${import.meta.env.BASE_URL}assets/images/venue-ranker/MadgeHelp_mobile.png`;
const dateIconMobile = `${import.meta.env.BASE_URL}assets/images/venue-ranker/date_change_mobile.png`;
const guestIconMobile = `${import.meta.env.BASE_URL}assets/images/venue-ranker/guest_change_mobile.png`;
// placeholder slide images (swap these later with your real assets)
const helpSlide1Img = `${import.meta.env.BASE_URL}assets/images/venue-ranker/help/help_slide_1.png`;
const helpSlide2Img = `${import.meta.env.BASE_URL}assets/images/venue-ranker/help/help_slide_2.png`;
const helpSlide3Img = `${import.meta.env.BASE_URL}assets/images/venue-ranker/help/help_slide_3.png`;
const helpSlide4Img = `${import.meta.env.BASE_URL}assets/images/venue-ranker/help/help_slide_4.png`;

const HELP_SLIDES = [
  {
    id: "top5",
    title: "Your Top 5!",
    img: helpSlide1Img,
    body: (
      <>
        <p style={{ margin: "0 0 10px" }}>
          We took your answers — including your wedding date, guest count, vibe, and flexibility — and matched you with five top venues.
        </p>
        <p style={{ margin: 0 }}>
          The circles on The "Venue Matches" screen are your top five!
        </p>
        <p>Tap a circle to virtually tour a venue and see pricing and details.</p>
      </>
    ),
  },
  {
    id: "colors",
    title: "Castle Colors",
    img: helpSlide2Img,
    body: (
      <div style={{ lineHeight: 1.6 }}>
        <div style={{ marginBottom: 10 }}>
          💙 <strong>Blue — Royal Match</strong><br />
          Your strongest overall fit based on availability, guest count, and preferences.
        </div>
        <div style={{ marginBottom: 10 }}>
          💜 <strong>Purple — Promising Possibility</strong><br />
          A solid match that fits well and is worth exploring.
        </div>
        <div>
          💖 <strong>Pink — Bold Dream</strong><br />
          A venue that may stretch one factor — but could still be perfect for your vision.
        </div>
      </div>
    ),
  },
  {
    id: "actions",
    title: "Save, Compare, or Book",
    img: helpSlide3Img,
    body: (
      <div style={{ lineHeight: 1.6 }}>
        <p style={{ margin: "0 0 10px" }}>
        Tap the ⭐ to save a venue as a favorite.
        </p>
        <p style={{ margin: "0 0 10px" }}>
        Tap a scroll in Explore the Rest to view other venues and swap one into your Top 5.
        </p>
        <p style={{ margin: 0 }}>
        Click Book It Now on any Top 5 when you’re ready to lock it in.
        </p>
      </div>
    ),
  },
  {
    id: "helpers",
    title: "Need to Adjust?",
    img: helpSlide4Img,
    body: (
      <div style={{ lineHeight: 1.6 }}>
        <p style={{ margin: "0 0 10px" }}>
          Tap the calendar icon to update your wedding date.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          Tap the guest icon to adjust your guest count.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          Your venue matches and pricing update automatically.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          Tap Madge anytime to come back here!
        </p>
      </div>
    ),
  },
] as const;

  

  /* ------------------------------------------------------------------ */
  /* 📍 Arch Positions                                                   */
  /* ------------------------------------------------------------------ */

  const slotPositions = isMobile
  ? ([
      // ⭐ 5-point-ish, shifted DOWN so it clears “Your Venue Matches”
      { left: "50%", top: "24%" }, // top point (was 18)
      { left: "18%", top: "38%" }, // upper-left (was 34)
      { left: "50%", top: "38%" }, // center (was 34)
      { left: "82%", top: "38%" }, // right (was 54)
      { left: "50%", top: "52%" }, // bottom (was 54)
    ] as const)
  : ([
      { left: "20%", top: "44%" },
      { left: "35%", top: "33%" },
      { left: "50%", top: "21%" },
      { left: "65%", top: "33%" },
      { left: "80%", top: "44%" },
    ] as const);

  /* ------------------------------------------------------------------ */
  /* 🎨 Render                                                           */
  /* ------------------------------------------------------------------ */

  return (
    <div className="pixie-card wd-page-turn rd-medallion-stage"
      style={{
        width: "96vw",
        height: "94vh",
        maxWidth: isUltraWide ? 2300 : 1900,
        maxHeight: 1100,
        margin: "0 auto",
        padding: 0,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Pink X */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
        style={{ zIndex: 50 }}
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      {/* ✅ Full-height body */}
      <div
        className="pixie-card__body"
        style={{
            height: "100%",
            padding: 0,      // was 18
            boxSizing: "border-box",
          }}
      >
        {/* ✅ Main layout (fills the card) */}
<div
  style={{
    display: "grid",
    gridTemplateColumns: isMobile
      ? "1fr"
      : isUltraWide
      ? "3.6fr 1.1fr"
      : "3.2fr 1.2fr",
    gap: 8,
    alignItems: "stretch",

    // ✅ desktop stays “locked card”
    height: isMobile ? "auto" : "100%",
    minHeight: isMobile ? "auto" : 0,

    // ✅ on mobile, let rows size naturally (castle then scroll panel)
    gridAutoRows: isMobile ? "auto" : undefined,

    // ✅ desktop hides overflow so right panel scroll behaves;
    // ✅ mobile allows natural page flow
    overflow: isMobile ? "visible" : "hidden",
  }}
>
{/* LEFT: Castle */}
<div
  ref={castlePaneRef}
  style={{
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #e6e6ef",
    boxShadow: "0 12px 26px rgba(0,0,0,0.10)",

    // ✅ key: prevent the “absolute children = 0 height” collapse on mobile
    minHeight: isMobile ? 620 : 0,
height: isMobile ? "72vh" : "auto",

    background: "#fff",
  }}
>
  {/* ✅ Centered scaler wrapper */}
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none", // stage holds visuals; children re-enable
    }}
  >
    {/* ✅ The "stage" that scales as one unit */}
    <div
      style={{
        width: STAGE_W,
        height: STAGE_H,
        transform: `scale(${stageScale})`,
        transformOrigin: "center center",
        position: "relative",
        pointerEvents: "auto",
      }}
    >
      {/* ✅ Background fills the stage */}
      <img
        src={castleBg}
        alt="Medallion Castle"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: isMobile ? "cover" : "contain",
          objectPosition: "center",
          display: "block",
        }}
        draggable={false}
      />
    {/* 💾 Save Progress Disk */}
<div
  style={{
    position: "absolute",
    ...(isMobile ? { right: 14 } : { right: 18 }),
    bottom: isMobile ? 95 : 95,
    zIndex: 65,
  }}
>
  <div
    style={{
      transform: `scale(${isMobile ? 1.25 : 1})`, // 👈 change this number
      transformOrigin: "bottom right",            // 👈 keeps it anchored nicely
    }}
  >
    <SaveProgressMini
      onClick={() => {
        try {
          localStorage.setItem("venueRankerCheckpoint", "medallion");
        } catch {}

        if (requireAuthForBooking) {
          requireAuthForBooking("manual");
        }
      }}
    />
  </div>
</div>

      {/* Start over ↺ (now scales with the stage) */}
      <button
  type="button"
  onClick={handleStartOver}
  className="boutique-back-btn"
  style={{
    position: "absolute",
  
    // 📱 Mobile → bottom-right
    ...(isMobile ? { right: 14 } : { right: 18 }),
  
    bottom: isMobile ? 24 : 35,
    zIndex: 60,
  
    padding: "8px 15px",
    fontSize: "1.00rem",
    fontWeight: 800,
  
    width: "auto",
    minWidth: "unset",
    whiteSpace: "nowrap",
  }}
>
  Start over ↺
</button>

      {/* ✅ Medallions float on top */}
      {topFiveResults.map((r, idx) => {
        const pos = slotPositions[idx];

        return (
            <button
            key={r.slug}
            type="button"
            className="castle-button"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCastleSwapMode(false);     // ✅ booking mode
                primeVenueContextAndOpen(r.slug);
              }}
            style={{
              position: "absolute",
              left: pos.left,
              top: pos.top,
              transform: "translate(-50%, -50%)",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              zIndex: 120,
            }}
          >
  <div
  className="castle-medallion"
  style={{
    position: "relative",
    width: MED_SIZE,
    height: MED_SIZE,
  }}
>
              <img
                src={getMedallionSrc(r.slug, r.tier)}
                alt={`${r.slug} medallion`}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 12px 16px rgba(0,0,0,0.28))",
                }}
              />

              {/* ⭐ Overlay Star */}
              {starredSet.has(r.slug) && (
                <img
                  src={`${import.meta.env.BASE_URL}assets/images/filled_star.png`}
                  alt="Starred"
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: STAR_TOP,
                    transform: "translate(-50%, -50%)",
                    width: STAR_SIZE,
                    height: STAR_SIZE,
                    objectFit: "contain",
                    zIndex: 5,
                    pointerEvents: "none",
                    filter: "drop-shadow(0 10px 16px rgba(0,0,0,0.25))",
                  }}
                />
              )}
            </div>
          </button>
        );
      })}

      {/* Castle modal stays exactly the same */}
      {openCastleSlug && (() => {
  const slug = openCastleSlug;

  return (
    <CastleModal
  venueSlug={slug}
  portalTarget={isMobile ? null : castlePaneRef.current}
      swapMode={castleSwapMode} 

      onClose={() => setOpenCastleSlug(null)}
      onBook={() => {}}
      onBackToIntro={() => {
        setOpenCastleSlug(null);
        onBack?.();
      }}
       // ✅ ADD THIS LINE (this is the missing link)
    requireAuthForBooking={requireAuthForBooking}
      handleStartContract={(data) => {
        try {
          // ✅ Canonical keys the legacy contract/checkout flow expects
          localStorage.setItem("venueSlug", data.venueSlug);
          localStorage.setItem("venueName", data.venueName);
      
          // keep both date keys in sync (old + new)
          if (data.weddingDate) {
            localStorage.setItem("venueWeddingDate", data.weddingDate);
            localStorage.setItem("weddingDate", data.weddingDate);
          }
      
          // keep both guest keys in sync (old + new)
          if (Number.isFinite(data.guestCount) && data.guestCount > 0) {
            localStorage.setItem("venueGuestCount", String(data.guestCount));
            localStorage.setItem("guestCount", String(data.guestCount));
            window.dispatchEvent(new Event("guestCountUpdated"));
          }
      
          // total keys used by contract/checkout
if (Number.isFinite(data.price) && data.price > 0) {
    localStorage.setItem("venueTotal", String(data.price)); // newer key
    localStorage.setItem("venuePrice", String(data.price)); // legacy key the contract reads
  }
        } catch (e) {
          console.warn("⚠️ Could not persist contract context:", e);
        }
      
        setOpenCastleSlug(null);
        onOpenVenue(data.venueSlug as VenueSlug);
      }}
      onOpenDateEditor={() => openDateEditorFor(slug)}
      onOpenGuestEditor={() => openGuestEditorFor(slug)}
    />
  );
})()}

      {/* 🆘 Madge help button */}
<button
  type="button"
  className="castle-icon-button"
  onClick={() => openHelp()}
  aria-label="Help: How Medallion Castle works"
  style={{
    position: "absolute",

    // 📍 Vertical position
    bottom: isMobile ? 170 : 8,

    // 📱 Mobile → bottom-right
    // 💻 Desktop → bottom-left
    ...(isMobile ? { right: 0 } : { left: 18 }),

    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer",
    zIndex: 80,
  }}
>
  <img
    src={isMobile ? helpImgMobile : helpImg}
    alt="Madge Help"
    style={{
      width: isMobile ? 140 : 250,
      height: isMobile ? 190 : 250,
      objectFit: "contain",
      filter: "drop-shadow(0 16px 22px rgba(0,0,0,0.28))",
    }}
    draggable={false}
  />
</button>

    {/* 📅 Date + 👥 Guest quick-edit icons */}
<div
  style={{
    position: "absolute",
    left: isMobile ? 12 : 220,
    bottom: isMobile ? 12 : 2,

    display: "flex",
    flexDirection: isMobile ? "column" : "row", // ✅ stack on mobile
    gap: isMobile ? 8 : 14,                    // ✅ tighter gap on mobile

    zIndex: 85,
    alignItems: isMobile ? "flex-start" : "center",
  }}
>
  {/* 👥 Guests (TOP on mobile) */}
  <button
    type="button"
    className="castle-icon-button"
    onClick={() => setShowGuestEditor(true)}
    title="Change guest count"
    style={{
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
      
        // 👇 NEW
        position: "relative",
        left: isMobile ? -110 : 0,  // adjust this number to taste
      }}
  >
    <img
      src={isMobile ? guestIconMobile : guestIcon}
      alt="Change guests"
      style={{
        width: isMobile ? 270 : 150,
        height: isMobile ? 270 : 150,
        objectFit: "contain",
        filter: "drop-shadow(0 12px 18px rgba(0,0,0,0.25))",
      }}
      draggable={false}
    />
  </button>

  {/* 📅 Calendar (BOTTOM on mobile) */}
  <button
    type="button"
    className="castle-icon-button"
    onClick={() => {
      setEditorVenueSlug(null);

      const d = readWeddingDateLS();
      setWeddingDate(d);
      setSelectedDate(d);
      setProposedDate(null);
      setIsNewDateConfirmed(false);

      setShowDateEditor(true);
    }}
    title="Change your date"
    style={{
      border: "none",
      background: "transparent",
      padding: 0,
      cursor: "pointer",
    }}
  >
    <img
      src={isMobile ? dateIconMobile : dateIcon}
      alt="Change date"
      style={{
        width: isMobile ? 110 : 140,
        height: isMobile ? 110 : 140,
        objectFit: "contain",
        filter: "drop-shadow(0 12px 18px rgba(0,0,0,0.25))",
      }}
      draggable={false}
    />
  </button>
</div>

      {/* Editors remain outside castle modal logic; fine to keep here */}
      {showDateEditor && (
        <VenueDateEditor
          venueSlug={editorVenueSlug}
          venueTitle={
            editorVenueSlug
              ? venueDetails[editorVenueSlug]?.title ?? editorVenueSlug
              : undefined
          }
          bookedDates={bookedDates}
          blockedRanges={blockedRanges}
          weddingDate={weddingDate}
          setWeddingDate={setWeddingDate}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          isNewDateConfirmed={isNewDateConfirmed}
          setIsNewDateConfirmed={setIsNewDateConfirmed}
          newDate={newDate}
          setNewDate={setNewDate}
          proposedDate={proposedDate}
          setProposedDate={setProposedDate}
          onClose={() => {
            setShowDateEditor(false);
            setEditorVenueSlug(null);
          }}
        />
      )}

      {showGuestEditor && (
        <VenueGuestEditor
          guestCount={null}
          setGuestCount={() => {}}
          confirmedGuestCount={null}
          setConfirmedGuestCount={() => {}}
          onClose={() => setShowGuestEditor(false)}
          setCurrentScreen={() => {}}
        />
      )}
    </div>
  </div>
</div>

{/* RIGHT: List Panel (hidden on mobile when castle is open) */}
{!(isMobile && openCastleSlug) && (
  <div
    style={{
      borderRadius: 22,
      overflow: "hidden",
      border: "1px solid #e6e6ef",
      boxShadow: "0 12px 26px rgba(0,0,0,0.10)",
      minHeight: isMobile ? "auto" : 0,
      background: "#fff",
      display: "flex",
      flexDirection: "column",
    }}
  >
  {/* Header */}
<div
  style={{
    padding: "18px 18px 14px",
    borderBottom: "1px solid #eee",
  }}
>
  <div style={{ fontWeight: 900, fontSize: "1.15rem", color: "#2c62ba" }}>
    Explore the rest
  </div>

  <div style={{ marginTop: 8, color: "#556", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.35 }}>
    Click a scroll to peek inside a venue, then swap it into your Top 5 if you’re feeling it ✨
  </div>
</div>

  {/* Scrollable body */}
  <div
    style={{
      padding: 16,
      overflowY: isMobile ? "visible" : "auto",
      overflowX: "hidden",
      minHeight: 0,
      marginTop: isMobile ? 8 : 0,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}
  >
    {rightGrid.map((r) => (
  <button
    key={r.slug}
    type="button"
    onClick={() => {
        setCastleSwapMode(true);      // ✅ swap mode
        primeVenueContextAndOpen(r.slug);
      }}
    style={{
      width: "100%",
      border: "none",
      background: "transparent",
      padding: 0,
      cursor: "pointer",
      display: "flex",
      justifyContent: "center",
    }}
  >
    <img
  src={getScrollSrc(r.slug)}
  alt={`${r.slug} scroll`}
  style={{
    width: "100%",
    maxWidth: 260,
    height: "auto",
    objectFit: "contain",
    display: "block",
    transition: "transform 180ms ease, filter 180ms ease",
    filter: getTierGlow(r.tier), // ✅ base glow by tier
  }}
  draggable={false}
  onMouseEnter={(e) => {
    const img = e.currentTarget as HTMLImageElement;
    img.style.transform = "scale(1.04)";
    img.style.filter = getTierGlowHover(r.tier); // ✅ stronger glow on hover
  }}
  onMouseLeave={(e) => {
    const img = e.currentTarget as HTMLImageElement;
    img.style.transform = "scale(1)";
    img.style.filter = getTierGlow(r.tier); // ✅ return to base glow
  }}
/>
  </button>
))}
  </div> 
</div>  
)}      
</div>

{/* 🆘 Help modal (Slide Deck) */}
{showHelp && (
  <div
    onClick={closeHelp}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 5000,
      padding: 16,
      boxSizing: "border-box",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="pixie-card wd-page-turn"
      style={{
        width: "min(720px, 92vw)",
        maxHeight: "82vh",
        minHeight: 420,
        padding: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <button
        className="pixie-card__close"
        onClick={closeHelp}
        aria-label="Close"
        style={{ zIndex: 10 }}
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      {(() => {
  const slide = HELP_SLIDES[helpSlideIndex];

  return (
    <div
      className="pixie-card__body"
      style={{
        alignItems: "stretch",
        padding: "18px 18px 50px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* ✅ Animated wrapper */}
      <div
        style={{
          transition: "opacity 220ms ease, transform 220ms ease",
          opacity: helpAnimPhase === "out" ? 0 : 1,
          transform: helpAnimPhase === "out" ? "translateY(10px)" : "translateY(0px)",
          willChange: "opacity, transform",
        }}
      >
        <h2 className="px-title" style={{ margin: 0 }}>
          {slide.title}
        </h2>

        {/* image + arrows */}
        <div style={{ width: "100%" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr 28px",
              alignItems: "center",
              gap: 16,
              width: "100%",
              justifyItems: "center",
              marginBottom: 6,
              padding: "0 26px",
              boxSizing: "border-box",
            }}
          >
            {/* ‹ Back */}
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => goToHelpSlide(helpSlideIndex - 1)}
              disabled={helpSlideIndex === 0 || isHelpAnimating}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                cursor:
                  helpSlideIndex === 0 || isHelpAnimating ? "not-allowed" : "pointer",
                opacity: helpSlideIndex === 0 ? 0.25 : isHelpAnimating ? 0.6 : 1,
                fontWeight: 900,
                fontSize: 60,
                lineHeight: 1,
                color: "#2c62ba",
                userSelect: "none",
              }}
            >
              ‹
            </button>

            {/* Image */}
            <img
              src={slide.img}
              alt={slide.title}
              style={{
                width: isMobile ? "100%" : "min(520px, 100%)",
                maxWidth: isMobile ? 420 : 520,
                height: "auto",
                objectFit: "contain",
                display: "block",
                borderRadius: 0,
                border: "none",
                boxShadow: "none",
                background: "transparent",
              }}
              draggable={false}
            />

            {/* › Next / Done */}
            <button
              type="button"
              aria-label={
                helpSlideIndex < HELP_SLIDES.length - 1 ? "Next slide" : "Close help"
              }
              onClick={() => {
                if (helpSlideIndex < HELP_SLIDES.length - 1) {
                  goToHelpSlide(helpSlideIndex + 1);
                } else {
                  closeHelp();
                }
              }}
              disabled={isHelpAnimating}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: isHelpAnimating ? "not-allowed" : "pointer",
                opacity: isHelpAnimating ? 0.6 : 1,
                fontWeight: 900,
                fontSize: 60,
                lineHeight: 1,
                color: "#2c62ba",
                userSelect: "none",
              }}
            >
              ›
            </button>
          </div>

          {/* Dots centered in the card */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            {HELP_SLIDES.map((_, idx) => {
              const active = idx === helpSlideIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Go to slide ${idx + 1}`}
                  onClick={() => goToHelpSlide(idx)}
                  disabled={isHelpAnimating}
                  style={{
                    width: active ? 12 : 10,
                    height: active ? 12 : 10,
                    borderRadius: 999,
                    border: "none",
                    cursor: isHelpAnimating ? "not-allowed" : "pointer",
                    background: active ? "#2c62ba" : "rgba(44,98,186,0.25)",
                    transform: active ? "scale(1.05)" : "scale(1)",
                    opacity: isHelpAnimating ? 0.65 : 1,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* text */}
        <div
          style={{
            color: "#1f2a44",
            fontWeight: 600,
            padding: "0 44px",
            boxSizing: "border-box",
            margin: "0 auto",
            maxWidth: 640,
            textAlign: "center",
          }}
        >
          {slide.body}
        </div>
      </div>
    </div>
  );
})()}
    </div>
  </div>
)}

            {/* 🔁 Swap Picker Overlay */}
{showSwapPicker && swapCandidate && (
  <div
    onClick={() => {
      setShowSwapPicker(false);
      setSwapCandidate(null);
    }}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 6000,
      padding: 16,
      boxSizing: "border-box",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="pixie-card"
      style={{
        width: "min(520px, 92vw)",   // ✅ narrower
        maxHeight: "80vh",           // ✅ prevents giant tall card
        overflow: "auto",            // ✅ scroll if needed
        borderRadius: 18,
        padding: 18,
        background: "#fff",
        boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: "1.35rem", color: "#2c62ba" }}>
        Swap into your Top 5?
      </div>

      <div style={{ marginTop: 8, color: "#556", fontWeight: 700 }}>
        Pick which medallion to replace:
      </div>

      <div
        style={{
          marginTop: 18,
          display: "flex",
          flexDirection: "column",   // ✅ column
          alignItems: "center",
          gap: 18,
        }}
      >
        {topFiveResults.map((r) => (
          <button
            key={r.slug}
            type="button"
            onClick={() => swapIntoTopFive(r.slug)}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <img
              src={getMedallionSrc(r.slug, r.tier)}
              alt={`Replace ${r.slug}`}
              style={{
                width: isMobile ? 130 : 170,
                height: isMobile ? 130 : 170,
                objectFit: "contain",
                filter: "drop-shadow(0 14px 18px rgba(0,0,0,0.25))",
              }}
              draggable={false}
            />
          </button>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <button
          className="boutique-back-btn"
          onClick={() => {
            setShowSwapPicker(false);
            setSwapCandidate(null);
          }}
          style={{ padding: "10px 18px", borderRadius: 999, fontWeight: 900 }}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
        
)}
      
          </div>
          </div>
        );
      };
      
      export default RD_MedallionCastle;