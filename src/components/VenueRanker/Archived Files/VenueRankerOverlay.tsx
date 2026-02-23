// src/components/VenueRanker/VenueRankerOverlay.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useOverlayOpen } from "../../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../../hooks/useScrollToTop";
import VenueRankerIntro from "../VenueRankerIntro";
import { generateScreenList } from "../../../utils/generateScreenList";
import { db, auth } from "../../../firebase/firebaseConfig";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import VenueExploreSelector from "./VenueExploreSelector";
import WeddingDateScreen from "../../common/WeddingDateScreen";
import WeddingDateConfirmScreen from "../../common/WeddingDateConfirmScreen";
import { onAuthStateChanged } from "firebase/auth";
import VenueAccountModal from "../VenueAccountModal";
import VenueGuestCountScreen from "../VenueGuestCountScreen";
import VenueRankerContract from "../VenueRankerContract";
import VenueThankYou from "../VenueThankYou";
import ScrollofPossibilities from "./ScrollofPossibilities";
import VenueCheckOut from "../VenueCheckOut";
import VenueVibeIntro from "./VenueVibeIntro";
import { venueDetails } from "../../../utils/venueDetails";
import VenueInviteIntro from "../VenueInviteIntro";
import VenueInviteBanner from "../VenueInviteBanner";
import { resetVenueRankerSession } from "../../../utils/resetVenueRanker";
import RD_MadgeInterviewQ1_Budget from "../ReDesign/RD_MadgeInterviewQ1_Budget";
import "../../../styles/globals/boutique.master.css";

// Venues
import BatesMansion from "./BatesMansion";
import DesertFoothills from "./DesertFoothills";
import Encanterra from "./Encanterra";
import Fabric from "./Fabric";
import FarmHouse from "./FarmHouse";
import HaciendaDelSol from "./HaciendaDelSol";
import HotelValleyHo from "./HotelValleyHo";
import LakeHouse from "./LakeHouse";
import Ocotillo from "./Ocotillo";
import RubiHouse from "./RubiHouse";
import Soho63 from "./Soho63";
import Sunkist from "./Sunkist";
import TheMeadow from "./TheMeadow";
import TheVic from "./TheVic";
import Tubac from "./Tubac";
import VerradoGolfClub from "./VerradoGolfClub";
import SchnepfBarn from "./SchnepfBarn";
import WindmillBarn from "./WindmillBarn";
import RankerCompleteScreen from "./RankerCompleteScreen";

import "../../styles/globals/boutique.master.css";
import "../../styles/layouts/ScrollOfPossibilities.css";

const LS_KEY = "venueRankerSelections";
const DIRECT_BOOKING_SCREENS = new Set<string>([
  "calendar",
  "confirm",
  "editdate",
  "venueGuestCount",
  "scroll-of-possibilities",
  "venuecontract",
  "checkout",
  "thankyou",
]);
const LS_LOCKED_VENUE_KEY = "wd_lockedVenueSlug";
const LS_INVITE_VENUE_KEY = "wd_inviteVenueSlug";
const LS_INVITE_CODE_KEY = "wd_inviteCode";
const LS_INVITE_EXPLORE_KEY = "wd_inviteExploreMode";
const LS_LAST_RANKER_SCREEN = "venueRankerLastScreen";
const LS_BONUS_500_KEY = "wd_bonus500";
const LS_SCREENLIST_KEY = "venueRankerScreenList";

const LEGACY_LS_KEY = "venueSelections"; // guest fallback (from saveVenueSelection)

function getLocalRankerSelections(): any | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getLegacyGuestRankings(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function hasAnyRankingsLocal(): boolean {
  const saved = getLocalRankerSelections();
  const r1 =
    saved?.rankings && typeof saved.rankings === "object" ? saved.rankings : {};
  const r2 = getLegacyGuestRankings();
  return Object.keys(r1).length > 0 || Object.keys(r2).length > 0;
}

function computeBuckets(rankings: Record<string, number>) {
  const favorites: string[] = [];
  const couldWork: string[] = [];
  for (const [slug, score] of Object.entries(rankings || {})) {
    const n = Number(score);
    if (n >= 3) favorites.push(slug);
    else if (n >= 2) couldWork.push(slug);
  }
  return { favorites, couldWork };
}

function hasAnyRankings(rankings: Record<string, number>) {
  return Object.values(rankings || {}).some((v) => Number(v) > 0);
}

interface VenueRankerOverlayProps {
  onClose: () => void;
  startAt?: string;
}

const ALL_VENUE_SCREENS: string[] = [
  "batesmansion", "desertfoothills", "encanterra", "fabric", "farmhouse", "haciendadelsol",
  "valleyho", "lakehouse", "ocotillo", "rubihouse", "schnepfbarn", "soho63",
  "sunkist", "themeadow", "tubac", "vic", "verrado", "windmillbarn",
];

const DISABLED_VENUES = new Set<string>([
  "fabric",
  "haciendadelsol",
]);

const VenueRankerOverlay: React.FC<VenueRankerOverlayProps> = ({ onClose, startAt = "intro" }) => {
  type VenueRankerSelections = {
    exploreMode: "all" | "vibe";
    vibeSelections: string[];
    rankings: Record<string, number>;
  };

  const [venueRankerSelections, setVenueRankerSelections] = useState<VenueRankerSelections>({
    exploreMode: "vibe",
    vibeSelections: [],
    rankings: {},
  });

  const flushVenueSelections = async () => {
    // 1) Local cache
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(venueRankerSelections));
      const { favorites, couldWork } = computeBuckets(venueRankerSelections.rankings);
      localStorage.setItem("venueRankerFavorites", JSON.stringify(favorites));
      localStorage.setItem("venueRankerCouldWork", JSON.stringify(couldWork));
    } catch {}
  
    // 2) Firestore mirror (if logged in)
    const user = auth.currentUser;
    if (!user) return;
  
    try {
      const { favorites, couldWork } = computeBuckets(venueRankerSelections.rankings);
  
      await updateDoc(doc(db, "users", user.uid), {
        venueRankerSelections: venueRankerSelections,
        venueRanker: { rankings: venueRankerSelections.rankings, favorites, couldWork },
        "progress.ranker.updatedAt": serverTimestamp(),
      });
  
      // optional: also keep a tiny subdoc where some readers expect it
      await updateDoc(
        doc(db, "users", user.uid, "venueRankerData", "prefs"),
        {
          rankings: venueRankerSelections.rankings,
          favorites,
          couldWork,
          exploreMode: venueRankerSelections.exploreMode,
          vibeSelections: venueRankerSelections.vibeSelections,
        }
      ).catch(() => {}); // ignore if subcollection doesn’t exist
    } catch (e) {
      // non-fatal; UI still has local copy
      console.warn("Could not flush venue selections:", e);
    }
  };

  // --- hydrate saved selections (local) ---
  useEffect(() => {
    try {
      const saved = getLocalRankerSelections();
      const legacyRankings = getLegacyGuestRankings();
  
      if (saved || Object.keys(legacyRankings).length > 0) {
        setVenueRankerSelections((prev) => {
          const next = {
            exploreMode:
              saved?.exploreMode === "all" || saved?.exploreMode === "vibe"
                ? saved.exploreMode
                : prev.exploreMode ?? "vibe",
            vibeSelections: Array.isArray(saved?.vibeSelections)
              ? saved.vibeSelections
              : prev.vibeSelections ?? [],
            rankings: {
              ...(prev.rankings ?? {}),
              ...(saved?.rankings && typeof saved.rankings === "object" ? saved.rankings : {}),
              ...(legacyRankings ?? {}),
            },
          };
  
          // keep LS in sync (optional but nice)
          try {
            localStorage.setItem(LS_KEY, JSON.stringify(next));
          } catch {}
  
          return next;
        });
      }
    } catch {}
  }, []);

// --- persist selections (local) ---
useEffect(() => {
  try {
    localStorage.setItem("venueRankerSelections", JSON.stringify(venueRankerSelections));
  } catch {}
}, [venueRankerSelections]);

const [showAccountModal, setShowAccountModal] = useState(false);

const [currentScreen, setCurrentScreen] = useState<string>(() => {
  // 0) Read invite + direct booking flags first
  let inviteSlug = "";
  let lockedSlug = "";
  let checkpoint = "";

  try {
    inviteSlug = localStorage.getItem(LS_INVITE_VENUE_KEY) || "";
    lockedSlug = localStorage.getItem(LS_LOCKED_VENUE_KEY) || "";
    checkpoint = localStorage.getItem("venueRankerCheckpoint") || "";
  } catch {}

  let hasBonus500 = false;
try {
  hasBonus500 =
    localStorage.getItem("wd_bonus500") === "true" ||
    localStorage.getItem("wd_bonus500_active") === "true";
} catch {}


  const hasInvite = !!inviteSlug;

  // "Actively in direct-booking flow" = they are locked to a venue AND
  // their checkpoint is one of the direct-booking screens.
  const isDirectBookingInProgress =
    !!lockedSlug && DIRECT_BOOKING_SCREENS.has(checkpoint);

  // ✅ Rule: If invite exists, always start at inviteIntro
  // unless they are actively in direct-booking flow.
  if (hasInvite && !isDirectBookingInProgress) {
    return "inviteIntro";
  }

  // If they ARE in direct-booking flow, honor the checkpoint
  if (isDirectBookingInProgress) {
    return checkpoint; // calendar/confirm/editdate/guestcount/scroll/etc.
  }

    // ✅ Highest priority resume (non-direct-booking):
  // If they already reached Scroll or RankerComplete, ALWAYS resume there
  // (prevents reopening the overlay and landing back on a venue page).
  try {
    if (checkpoint === "scroll-of-possibilities") return "scroll-of-possibilities";
    if (checkpoint === "rankerComplete") return "rankerComplete";
  } catch {}

  // ✅ If they were mid-ranking, resume to last venue screen
  try {
    const last = localStorage.getItem(LS_LAST_RANKER_SCREEN) || "";
    const saved = getLocalRankerSelections();

    // only resume if last is one of your venue screens
    if (last && ALL_VENUE_SCREENS.includes(last)) {
      return last;
    }

    // fallback: if they picked vibes, go back to vibe (so they can see/edit)
    if (
      saved?.exploreMode === "vibe" &&
      Array.isArray(saved?.vibeSelections) &&
      saved.vibeSelections.length
    ) {
      return "vibeIntro";
    }

    // fallback: rankings exist but no last screen → go to explore (NOT complete)
    if (hasAnyRankingsLocal()) {
      return "rdQ1Budget";
    }
  } catch {}

return startAt || "intro";
});


  const [screenList, setScreenList] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const [lockedVenueSlug, setLockedVenueSlug] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_LOCKED_VENUE_KEY);
    } catch {
      return null;
    }
  });

  const directBooking = !!lockedVenueSlug;
  const [invitedVenueSlug, setInvitedVenueSlug] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_INVITE_VENUE_KEY);
    } catch {
      return null;
    }
  });

  const [inviteExploreMode, setInviteExploreMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_INVITE_EXPLORE_KEY) === "true";
    } catch {
      return false;
    }
  });
  
  const [inviteCode, setInviteCode] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_INVITE_CODE_KEY);
    } catch {
      return null;
    }
  });

  
  
  const isInviteFlow = !!invitedVenueSlug;
const hasInvite = !!invitedVenueSlug;

// ✅ Hide envelope on invite screen + direct-booking flow + account modal.
// (Castle modals are NOT a "screen" here, so see Change 2 below.)
const INVITE_BANNER_BLOCKED_SCREENS = new Set<string>([
  "inviteIntro",                // don't show on invite screen itself
  ...Array.from(DIRECT_BOOKING_SCREENS), // calendar/confirm/editdate/guestcount/scroll/contract/checkout/thankyou
]);

const shouldShowInviteBanner =
  hasInvite &&
  !showAccountModal &&
  !INVITE_BANNER_BLOCKED_SCREENS.has(currentScreen);

  const [userHasWeddingDate, setUserHasWeddingDate] = useState(false);
  const [weddingDate, setWeddingDate] = useState<string>("");
  const [dateLocked, setDateLocked] = useState<boolean>(false);
  const [dayOfWeek, setDayOfWeek] = useState<string>("");
  const userHasLockedDate = !!weddingDate && !!dayOfWeek;

  const [payFull, setPayFull] = useState(true);
  const [signatureImage, setSignatureImage] = useState<string>("");
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);
  const [hasVenueBooked, setHasVenueBooked] = useState(false);
  const [activeVenueSlugs, setActiveVenueSlugs] = useState<string[] | null>(null);
  const [accountPurpose, setAccountPurpose] = useState<"save" | "booking" | null>(null);

  const [postAuthScreen, setPostAuthScreen] = useState<string | null>(null);

  const requireAuthForCastleBooking = (
    venueSlug: string,
    intent: "venuecontract" | "manual"
  ) => {
    const user = auth.currentUser;
  
    if (user) return true; // ✅ already logged in
  
    // ❌ gate + remember what they were trying to do
    try {
      localStorage.setItem(
        "wd_pendingCastleBooking",
        JSON.stringify({
          venueSlug,
          intent,
          createdAt: Date.now(),
        })
      );
    } catch {}
  
    setAccountPurpose("booking");
  
    // ✅ If contract booking, go straight to contract after auth
    // ✅ If manual booking, return to scroll so we can reopen the castle modal + show popup there
    setPostAuthScreen(intent === "venuecontract" ? "venuecontract" : "scroll-of-possibilities");
  
    setShowAccountModal(true);
    return false;
  };

  const requireAuthThenGo = (screen: string) => {
  const user = auth.currentUser;

  // ✅ already logged in → just go
  if (user) {
    setCurrentScreen(screen);
    return;
  }

  // ❌ not logged in → open account modal, remember where to go next
  setAccountPurpose("booking");
  setPostAuthScreen(screen);
  setShowAccountModal(true);
};

  const VENUE_COMPONENTS = useMemo<Record<string, React.ComponentType<any>>>(() => ({
    batesmansion: BatesMansion,
    desertfoothills: DesertFoothills,
    encanterra: Encanterra,
    fabric: Fabric,
    farmhouse: FarmHouse,
    haciendadelsol: HaciendaDelSol,
    valleyho: HotelValleyHo,
    lakehouse: LakeHouse,
    ocotillo: Ocotillo,
    rubihouse: RubiHouse,
    schnepfbarn: SchnepfBarn,
    soho63: Soho63,
    sunkist: Sunkist,
    themeadow: TheMeadow,
    tubac: Tubac,
    vic: TheVic,
    verrado: VerradoGolfClub,
    windmillbarn: WindmillBarn,
  }), []);

  const venueOptions = useMemo(() => {
    const base = (activeVenueSlugs && activeVenueSlugs.length)
      ? activeVenueSlugs
      : ALL_VENUE_SCREENS;
  
    // Only show venues that exist in your component map (avoid “active but not built yet” weirdness)
    const built = base.filter((slug) => Object.prototype.hasOwnProperty.call(VENUE_COMPONENTS, slug));
  
    return built.map((slug) => ({
      slug,
      label: venueDetails?.[slug]?.title || slug,
    }));
  }, [activeVenueSlugs, VENUE_COMPONENTS]);

  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([currentScreen, currentIndex], { targetRef: cardRef });

  // Firestore mirrors
  const venueSlug = localStorage.getItem("venueSlug");
  const venueGuestCount = parseInt(localStorage.getItem("venueGuestCount") || "0");
  const venueDate =
  localStorage.getItem("venueWeddingDate") ||
  localStorage.getItem("venueDate") ||
  "";

const venueTotal = parseFloat(
  localStorage.getItem("venuePrice") ||
  localStorage.getItem("venueTotal") ||
  "0"
);

  // tiny debounce helper
function debounce<T extends (...args: any[]) => void>(fn: T, ms = 800) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// --- persist selections (remote, if signed in) ---
useEffect(() => {
  const user = auth.currentUser;
  if (!user) return;

  const saveRemote = debounce(async () => {
    try {
      await updateDoc(doc(db, "users", user.uid), {
        venueRankerSelections: venueRankerSelections,
        "progress.ranker.updatedAt": serverTimestamp(),
      });
    } catch (e) {
      // swallow; user still has local persistence
      console.warn("Could not save venueRankerSelections to Firestore:", e);
    }
  }, 800);

  saveRemote();
}, [venueRankerSelections]);

  // Load active venues
  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, "venues"), where("isActive", "==", true));
        const snap = await getDocs(q);
        const slugs = snap.docs.map((d) => d.id);
        setActiveVenueSlugs(slugs);
      } catch (e) {
        console.warn("⚠️ Could not load active venues; showing all.");
        setActiveVenueSlugs(null);
      }
    })();
  }, []);

  const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const check = () => setIsMobile(window.innerWidth <= 520);
  check();
  window.addEventListener("resize", check);
  return () => window.removeEventListener("resize", check);
}, []);

  // Auth watcher
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data?.weddingDate) {
            setWeddingDate(data.weddingDate);
            setDayOfWeek(data.dayOfWeek || "");
            setUserHasWeddingDate(true);
          } else {
            setUserHasWeddingDate(false);
          }
          
          // ✅ ADD THIS LINE (always, regardless of whether they have a date yet)
          setDateLocked(!!data?.weddingDateLocked);

          const bookings = (data?.bookings ?? {}) as Record<string, any>;
          setHasVenueBooked(!!bookings.venue);
        }
      } else {
        setUserHasWeddingDate(false);
        setHasVenueBooked(false);
      
        // ✅ ADD THIS
        setDateLocked(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
  
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) return;
  
        const d = snap.data() as any;
  
        // Prefer the overlay-friendly structure first
        const fromRanker = d?.venueRankerSelections;
  
        // Fallback: legacy path (in case old users only have venueSelections)
        const fromLegacy = d?.venueSelections;
  
        const rankings =
          (fromRanker?.rankings && typeof fromRanker.rankings === "object" && fromRanker.rankings) ||
          (fromLegacy && typeof fromLegacy === "object" && fromLegacy) ||
          {};
  
        const exploreMode =
          fromRanker?.exploreMode === "all" || fromRanker?.exploreMode === "vibe"
            ? fromRanker.exploreMode
            : undefined;
  
        const vibeSelections = Array.isArray(fromRanker?.vibeSelections)
          ? fromRanker.vibeSelections
          : undefined;
  
        setVenueRankerSelections((prev) => {
          const next = {
            exploreMode: exploreMode ?? prev.exploreMode,
            vibeSelections: vibeSelections ?? prev.vibeSelections,
            rankings: { ...(prev.rankings ?? {}), ...(rankings ?? {}) },
          };
  
          // mirror to local for instant resume
          try {
            localStorage.setItem("venueRankerSelections", JSON.stringify(next));
          } catch {}
  
          return next;
        });
      } catch (e) {
        console.warn("Could not hydrate ranker selections from Firestore:", e);
      }
    });
  
    return () => unsub();
  }, []);

  const isVenueScreen = Object.prototype.hasOwnProperty.call(VENUE_COMPONENTS, currentScreen);

  const isActivelyRanking = useMemo(() => {
    return screenList.length > 0 && isVenueScreen;
  }, [screenList, isVenueScreen]);

  const didAutoResumeRef = useRef(false);

  useEffect(() => {
    // Read partner link params once
    try {
      const params = new URLSearchParams(window.location.search);

          // ✅ Bonus param (e.g. /venue-ranker?bonus=500)
    const bonus = params.get("bonus");
    if (bonus === "500") {
      try {
        localStorage.setItem(LS_BONUS_500_KEY, "true");
      } catch {}
    }
  
      const slug =
        params.get("venueInvite") ||
        params.get("inviteVenue") ||
        params.get("venue") ||
        "";
  
      const code =
        params.get("code") ||
        params.get("discount") ||
        params.get("promo") ||
        "";
  
      if (!slug) return;
  
      // Persist invite context
      localStorage.setItem(LS_INVITE_VENUE_KEY, slug);
      if (code) localStorage.setItem(LS_INVITE_CODE_KEY, code);
  
      setInvitedVenueSlug(slug);
      setInviteCode(code || null);
  
      // ✅ NEW: start in invite-only mode (no sticker until they click Explore)
      try {
        localStorage.removeItem(LS_INVITE_EXPLORE_KEY);
      } catch {}
      setInviteExploreMode(false);
  
      // Lock venue immediately (partner-safe)
      localStorage.setItem(LS_LOCKED_VENUE_KEY, slug);
      setLockedVenueSlug(slug);
  
      // Start them at invite intro unless they’re already mid-flow
      const ck = localStorage.getItem("venueRankerCheckpoint");
      if (!ck || ck === "intro") {
        setCurrentScreen("inviteIntro");
      }
    } catch {
      // silent
    }
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (didAutoResumeRef.current) return;
    if (hasVenueBooked) return;
  
    // ✅ Invite users should not be auto-sent to rankerComplete
    if (hasInvite) return;
  
    // ✅ If we are on a venue screen, never auto-jump away
    if (isVenueScreen) return;
  
    // ✅ If localStorage says we were mid-ranking, never auto-jump away
    try {
      const ck = localStorage.getItem("venueRankerCheckpoint") || "";
      const last = localStorage.getItem(LS_LAST_RANKER_SCREEN) || "";
  
      if (ck === "ranking") return;
      if (last && ALL_VENUE_SCREENS.includes(last)) return;
    } catch {}
  
    // (Extra safety) if actively ranking, don’t redirect
    if (isActivelyRanking) return;
  
    const hasRankings = Object.keys(venueRankerSelections.rankings || {}).length > 0;
  
    if (hasRankings) {
      if (lockedVenueSlug) return;
      didAutoResumeRef.current = true;
      try {
        localStorage.setItem("venueRankerCheckpoint", "rankerComplete");
      } catch {}
      setCurrentScreen("rankerComplete");
    }
  }, [
    venueRankerSelections.rankings,
    hasVenueBooked,
    hasInvite,
    lockedVenueSlug,
    isActivelyRanking,
    isVenueScreen,
  ]);

  // If user already booked → go straight to thank you
  useEffect(() => {
    if (hasVenueBooked) setCurrentScreen("thankyou");
  }, [hasVenueBooked]);

  const filterActive = (list: string[]) => {
    // ✅ Always remove hard-disabled venues first
    const withoutDisabled = list.filter(
      (slug) => !DISABLED_VENUES.has(slug)
    );
  
    // If Firestore active list hasn’t loaded yet, use hard-filtered list
    if (!activeVenueSlugs || activeVenueSlugs.length === 0) {
      return withoutDisabled;
    }
  
    // Then apply Firestore "isActive" filter
    const activeSet = new Set(activeVenueSlugs);
    return withoutDisabled.filter((slug) => activeSet.has(slug));
  };

  const persistScreenList = (list: string[]) => {
    try {
      localStorage.setItem(LS_SCREENLIST_KEY, JSON.stringify(list));
    } catch {}
  };

  // Try to rebuild a screen list from saved selections
  const rebuildListFromSaved = () => {
    try {
      // ✅ 1) Best source of truth: the exact list we computed last time
      const listRaw = localStorage.getItem(LS_SCREENLIST_KEY);
      if (listRaw) {
        const parsedList = JSON.parse(listRaw);
        if (Array.isArray(parsedList) && parsedList.length) {
          const filtered = filterActive(parsedList);
          return filtered.length ? filtered : parsedList;
        }
      }
  
      // ✅ 2) Fallback: rebuild from selections (respect exploreMode)
      const raw = localStorage.getItem(LS_KEY);
      const parsed = raw
        ? (JSON.parse(raw) as { exploreMode?: "all" | "vibe"; vibeSelections?: string[] })
        : null;
  
      const base =
        parsed?.exploreMode === "all"
          ? ALL_VENUE_SCREENS
          : parsed?.vibeSelections?.length
            ? generateScreenList(parsed.vibeSelections)
            : ALL_VENUE_SCREENS;
  
      const filtered = filterActive(base);
      return filtered.length ? filtered : base;
    } catch {
      return ALL_VENUE_SCREENS;
    }
  };

useEffect(() => {
  if (!isVenueScreen) return;

  // If list is missing (common after refresh/reopen), rebuild it once.
  if (!screenList || screenList.length === 0) {
    const list = rebuildListFromSaved();
    setScreenList(list);

    const idx = Math.max(0, list.indexOf(currentScreen));
    setCurrentIndex(idx);

    try {
      localStorage.setItem("venueRankerCheckpoint", "ranking");
      localStorage.setItem(LS_LAST_RANKER_SCREEN, currentScreen);
    } catch {}

    return;
  }

  // If list exists, just keep index aligned with current screen.
  const idx = screenList.indexOf(currentScreen);
  if (idx >= 0 && idx !== currentIndex) {
    setCurrentIndex(idx);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isVenueScreen, currentScreen, screenList]);

  /// Explore mode handler
const handleSelectExploreMode = (mode: "all" | "vibe") => {
  setVenueRankerSelections((prev) => ({
    ...prev,
    exploreMode: mode,
    vibeSelections: prev.vibeSelections, // don't wipe them here
  }));

  const handleSaveProgress = () => {
    // open account modal, but in "save" mode (no booking flow)
    setAccountPurpose("save");
    setShowAccountModal(true);
  };

  // ⭐ If user chooses "vibe", go to the NEW vibe intro screen
  if (mode === "vibe") {
    setScreenList([]);
    setCurrentIndex(0);
    setCurrentScreen("vibeIntro");
    return;
  }

 // ⭐ If user chooses "all", build the full venue list
const baseList = ALL_VENUE_SCREENS;
const filtered = filterActive(baseList);
const list = filtered.length > 0 ? filtered : baseList;

setScreenList(list);
setCurrentIndex(0);
setCurrentScreen(list[0]);

persistScreenList(list); // ✅ NEW
};



  const handleNextScreen = () => {
    const nextIndex = currentIndex + 1;
    const next = screenList[nextIndex];
    if (next) {
      setCurrentIndex(nextIndex);
      setCurrentScreen(next);
    } else {
      try {
        localStorage.setItem("venueRankerCheckpoint", "rankerComplete");
      } catch {}
      setCurrentScreen("rankerComplete");
    }
  };

  const handleDirectBook = (slug: string) => {
    setLockedVenueSlug(slug);
    try {
      localStorage.setItem(LS_LOCKED_VENUE_KEY, slug);
      localStorage.setItem("venueRankerCheckpoint", "scroll-of-possibilities"); // so refresh is safe
    } catch {}
  
    const user = auth.currentUser;
    if (!user) {
      setAccountPurpose("booking");
      setShowAccountModal(true);
      return;
    }
  
    // If logged in, go into the same date flow you already use.
    if (userHasWeddingDate) setCurrentScreen("confirm");
    else setCurrentScreen("calendar");
  };

  const handleBackScreen = () => {
    const prevIndex = currentIndex - 1;
  
    if (prevIndex >= 0) {
      // Go to the previous venue in the list
      setCurrentIndex(prevIndex);
      setCurrentScreen(screenList[prevIndex]);
      return;
    }
  
    // We were on the *first* venue in the list.
    // Send them back based on how they started the Ranker:
    if (venueRankerSelections.exploreMode === "all") {
      setCurrentScreen("explore");
    } else {
      setCurrentScreen("vibeIntro");
    }
  };

  const handleShowMagicalOptions = async () => {
    // Make sure selections are persisted before we leave this screen
    await flushVenueSelections();
  
    try {
      // ✅ This is now just a browsing step, not a booking gate
      localStorage.setItem("venueRankerCheckpoint", "scroll-of-possibilities");
      localStorage.setItem("rankerCompleted", "true");
      localStorage.setItem("rankerLastStep", "scroll-of-possibilities");
    } catch {}
  
    // ✅ Always go to the scroll (no auth, no date screens, no guest screens)
    setCurrentScreen("scroll-of-possibilities");
  };

  const handleSaveProgress = () => {
    setAccountPurpose("save");
    setShowAccountModal(true);
  };

  const openAccountModalForSave = () => {
    setAccountPurpose("save");
    setShowAccountModal(true);
  };

  /**
   * ✅ STABLE venue component map (no inline arrow components).
   * This prevents React from treating the child as a different type
   * on every render, which stops the iframe from remounting (no flash).
   */
  

  
  const VenueComp = isVenueScreen ? VENUE_COMPONENTS[currentScreen] : null;

  // ✅ Save last visited venue screen so we can resume correctly after refresh / login
useEffect(() => {
  if (!isVenueScreen) return;

  try {
    localStorage.setItem("venueRankerLastScreen", currentScreen);

    // ✅ IMPORTANT:
    // If they've already reached Scroll or RankerComplete, NEVER downgrade them back to "ranking"
    const ck = localStorage.getItem("venueRankerCheckpoint") || "";
    const isAlreadyPastRanking =
      ck === "scroll-of-possibilities" || ck === "rankerComplete";

    if (!isAlreadyPastRanking) {
      localStorage.setItem("venueRankerCheckpoint", "ranking");
    }
  } catch {}
}, [currentScreen, isVenueScreen]);

  const formattedWeddingDate = weddingDate
    ? new Date(weddingDate + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

    const handleStartOverToIntro = () => {
      // ✅ wipe ranker session + resume pointers
      try {
        resetVenueRankerSession(); // you already import this
      } catch {}
    
      try {
        localStorage.removeItem(LS_LAST_RANKER_SCREEN);
        localStorage.removeItem("venueRankerCheckpoint");
        localStorage.removeItem(LS_SCREENLIST_KEY);
      } catch {}
    
      // ✅ reset in-memory state too
      setVenueRankerSelections({
        exploreMode: "vibe",
        vibeSelections: [],
        rankings: {},
      });
    
      setScreenList([]);
      setCurrentIndex(0);
      setCurrentScreen("intro");
    };

  // --- Render
return (
  <>
    {/* Main flow overlay — render ONLY when account modal is NOT open */}
    {!showAccountModal && (
      <div className="pixie-overlay">
        {/* scrollable area; each child renders its own .pixie-card */}
        <div ref={cardRef} style={{ width: "100%" }}>
  {/* ✅ Card-width stage so absolute positioning hugs the white card, not the screen */}
  <div
    style={{
      width: "100%",
      display: "flex",
      justifyContent: "center",
    }}
  >
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 680, // ✅ match your pixie-card max width
      }}
    >
      {/* ✅ Invite sticker pinned to the card area */}
      {shouldShowInviteBanner && (
  <div
    style={{
      position: "absolute",
      zIndex: 999,

      // Desktop: inside the card corner
      left: 10,
      top: 10,

      // Mobile: pull it UP and slightly LEFT so it sits above the card
      ...(isMobile
        ? {
            top: -70,     // ✅ above the title area
            left: -6,
          }
        : {}),
    }}
  >
    <VenueInviteBanner
      invitedVenueSlug={invitedVenueSlug || undefined}
      onClick={() => {
        setCurrentIndex(0);
        setCurrentScreen("inviteIntro");
      }}
    />
  </div>
)}


      {/* ✅ Render your currentScreen content exactly as before */}
      {currentScreen === "inviteIntro" && (
        <VenueInviteIntro
          invitedVenueSlug={invitedVenueSlug || undefined}
          invitedVenueName={
            invitedVenueSlug
              ? (venueDetails?.[invitedVenueSlug]?.title || undefined)
              : undefined
          }
          discountLabel={
            inviteCode
              ? `Pixie Booking Bonus ($500 off — ${inviteCode})`
              : "Pixie Booking Bonus ($500 off)"
          }
          onExplore={() => {
            try {
              // ✅ user chose to explore — allow the sticker from here on out
              localStorage.setItem(LS_INVITE_EXPLORE_KEY, "true");
            } catch {}
            setInviteExploreMode(true);
          
            try {
              // ✅ unlock competitors
              localStorage.removeItem(LS_LOCKED_VENUE_KEY);
              localStorage.removeItem("venueRankerCheckpoint");
              localStorage.removeItem("venueRankerSelectedVenues");
            } catch {}
          
            setLockedVenueSlug(null);
            setCurrentIndex(0);
            setCurrentScreen("explore");
          }}
          onDirectBook={(slug) => handleDirectBook(slug)}
          venueOptions={venueOptions}
          onClose={onClose}
        />
      )}

      {currentScreen === "intro" && (
        <VenueRankerIntro
        onExplore={() => setCurrentScreen("rdQ1Budget")}
          onDirectBook={(slug) => handleDirectBook(slug)}
          venueOptions={venueOptions}
          onClose={onClose}
        />
      )}

{currentScreen === "rdQ1Budget" && (
 <RD_MadgeInterviewQ1_Budget
 onNext={(data) => { /* next screen */ }}
 onBack={() => setCurrentScreen("intro")} // or wherever
 onClose={onClose}
/>
)}

            {/* Explore */}
            {currentScreen === "explore" && (
              <VenueExploreSelector
                onSelectExploreMode={handleSelectExploreMode}
                onClose={onClose}
              />
            )}

            {/* Vibe intro */}
            {currentScreen === "vibeIntro" && (
  <VenueVibeIntro
    venueRankerSelections={venueRankerSelections}
    setVenueRankerSelections={setVenueRankerSelections}
    onContinue={() => {
      const raw = generateScreenList(venueRankerSelections.vibeSelections);
      const list = filterActive(raw);

      if (list.length === 0) {
        setScreenList([]);
        setCurrentIndex(0);
        setCurrentScreen("vibeIntro");
      } else {
        setScreenList(list);
        setCurrentIndex(0);
        setCurrentScreen(list[0]);
        persistScreenList(list);
      }
    }}
    onBack={() => setCurrentScreen("explore")}
    onClose={onClose}
  />
)}

            {/* Date flow */}
            {currentScreen === "calendar" &&
              (userHasLockedDate ? (
                <WeddingDateConfirmScreen
                  formattedDate={weddingDate || ""}
                  dayOfWeek={dayOfWeek || ""}
                  userHasDate={!!weddingDate}
                  weddingDateLocked={dateLocked}
                  onConfirm={() => setCurrentScreen("venueGuestCount")}
                  onEditDate={() => setCurrentScreen("editdate")}
                  onClose={onClose}
                />
              ) : (
                <WeddingDateScreen
                  onContinue={({ weddingDate, dayOfWeek }) => {
                    setWeddingDate(weddingDate);
                    setDayOfWeek(dayOfWeek);
                    setCurrentScreen("venueGuestCount");
                  }}
                  onClose={onClose}
                />
              ))}

            {currentScreen === "confirm" && (
              <WeddingDateConfirmScreen
                formattedDate={formattedWeddingDate}
                dayOfWeek={dayOfWeek || ""}
                userHasDate={!!weddingDate}
                weddingDateLocked={dateLocked}
                onConfirm={() => setCurrentScreen("venueGuestCount")}
                onEditDate={() => setCurrentScreen("editdate")}
                onClose={onClose}
              />
            )}

            {currentScreen === "editdate" && (
              <WeddingDateScreen
                onContinue={({ weddingDate, dayOfWeek }) => {
                  setWeddingDate(weddingDate);
                  setDayOfWeek(dayOfWeek);
                  setCurrentScreen("venueGuestCount");
                }}
                onClose={onClose}
              />
            )}

            {/* Guest count */}
            {currentScreen === "venueGuestCount" && (
              <VenueGuestCountScreen
              onContinue={() => {
                try {
                  const hasInvite = !!localStorage.getItem(LS_INVITE_VENUE_KEY);
                  const locked = !!localStorage.getItem(LS_LOCKED_VENUE_KEY);
              
                  // ✅ Only persist "scroll-of-possibilities" as a resume point
                  // if they are in direct-booking flow OR not in an invite context.
                  if (!hasInvite || locked) {
                    localStorage.setItem("venueRankerCheckpoint", "scroll-of-possibilities");
                  } else {
                    // Invite + explore path: don't let Scroll become the resume trap.
                    localStorage.removeItem("venueRankerCheckpoint");
                  }
                } catch {}
              
                setCurrentScreen("scroll-of-possibilities");
              }}
                onClose={onClose}
              />
            )}

            {/* Scroll of Possibilities */}
{currentScreen === "scroll-of-possibilities" && (
  <ScrollofPossibilities
    onClose={onClose}
    setCurrentScreen={setCurrentScreen}
    setCurrentIndex={setCurrentIndex}
    screenList={screenList}
    requireAuthForCastleBooking={requireAuthForCastleBooking}

    // ✅ NEW: save-only (optional) account prompt
    onSaveProgress={() => {
      setAccountPurpose("save");
      setShowAccountModal(true);
    }}

    onBackToIntro={() => {
      try {
        resetVenueRankerSession();
      } catch {}

      setCurrentIndex(0);
      setCurrentScreen(
        localStorage.getItem(LS_INVITE_VENUE_KEY)
          ? "inviteIntro"
          : "intro"
      );
    }}
  />
)}

            {/* ✅ Venue detail screens with stable component type */}
            {isVenueScreen && VenueComp && (
              <VenueComp
                onContinue={handleNextScreen}
                onBack={handleBackScreen}
                onClose={onClose}
                onSaveProgress={handleSaveProgress}
                screenList={screenList}
                currentIndex={currentIndex}
                venueRankerSelections={venueRankerSelections}
                setVenueRankerSelections={setVenueRankerSelections}
                goToExplore={handleStartOverToIntro}
              />
            )}

            {/* Ranker complete */}
            {currentScreen === "rankerComplete" && (
              <RankerCompleteScreen
                weddingDateSet={Boolean(weddingDate)}
                guestCountSet={
                  Number.isFinite(venueGuestCount) && venueGuestCount > 0
                }
                isDirectBooking={!!lockedVenueSlug}
                onStartScroll={handleShowMagicalOptions}
                onEditRankings={() => {
                  try {
                    localStorage.removeItem("venueRankerCheckpoint");
                  } catch {}

                  if (lockedVenueSlug) {
                    setCurrentScreen("intro");
                    return;
                  }

                  setCurrentScreen("explore");
                }}
                onClose={onClose}
                onSaveProgress={handleSaveProgress}
              />
            )}

            {/* Contract */}
            {currentScreen === "venuecontract" && (
              <VenueRankerContract
                venueSlug={venueSlug ?? ""}
                venueName={localStorage.getItem("venueName") ?? ""}
                venueWeddingDate={venueDate ?? ""}
                venuePrice={Number.isFinite(venueTotal) ? venueTotal : 0}
                guestCount={
                  Number.isFinite(venueGuestCount) ? venueGuestCount : 0
                }
                payFull={payFull}
                setPayFull={setPayFull}
                signatureImage={signatureImage}
                setSignatureImage={setSignatureImage}
                signatureSubmitted={signatureSubmitted}
                setSignatureSubmitted={setSignatureSubmitted}
                onBack={() => setCurrentScreen("scroll-of-possibilities")}
                onContinue={() => setCurrentScreen("checkout")}
                setCurrentScreen={setCurrentScreen}
                setLineItems={(items: string[]) => {}}
                setPaymentSummary={(summary: string) => {}}
                setFinalVenuePrice={(amount: number) => {}}
                setFinalDeposit={(amount: number) => {}}
                setFinalMonthlyPayment={(amount: number) => {}}
                setFinalPaymentCount={(count: number) => {}}
              />
            )}

            {/* Checkout */}
            {currentScreen === "checkout" && (
              <VenueCheckOut
                setCurrentScreen={setCurrentScreen}
                onClose={onClose}
              />
            )}

            {/* Thank you */}
            {currentScreen === "thankyou" && (
              <VenueThankYou onClose={onClose} />
            )}
          </div>
        </div>
      </div>
    </div>
    )}

    {/* Account modal overlay — rendered separately when open */}
    {showAccountModal && (
      <VenueAccountModal
      onSuccess={() => {
        setShowAccountModal(false);
      
        // ✅ save-only flow: do nothing special
        if (accountPurpose === "save") {
          setAccountPurpose(null);
          return;
        }
      
        // ✅ If a CastleModal saved a pending action, honor it FIRST.
        // This covers both Insta-Book -> contract AND Manual Confirm -> reopen modal.
        try {
          const raw = localStorage.getItem("wd_pendingVenueBooking");
          if (raw) {
            const pending = JSON.parse(raw) as {
              venueSlug: string;
              venueName: string;
              weddingDate: string;
              guestCount: number;
              price: number;
              intent: "contract" | "manual_confirm";
            };
        
            if (pending.intent === "contract") {
              // ✅ Contract flow: safe to clear immediately
              localStorage.removeItem("wd_pendingVenueBooking");
        
              // Go straight to contract
              setCurrentScreen("venuecontract");
              setPostAuthScreen(null);
              setAccountPurpose(null);
              return;
            }
        
            if (pending.intent === "manual_confirm") {
              // ✅ Manual flow: DO NOT clear here.
              // Scroll needs this payload to reopen the modal and auto-open the manual confirm.
        
              // IMPORTANT: don’t lock them to one venue for manual request
              try {
                localStorage.removeItem("wd_lockedVenueSlug");
              } catch {}
        
              setCurrentScreen("scroll-of-possibilities");
              setPostAuthScreen(null);
              setAccountPurpose(null);
              return;
            }
          }
        } catch (e) {
          console.warn("Could not parse wd_pendingVenueBooking:", e);
        }
      
        // ✅ booking flow: go where we intended (usually "venuecontract")
        if (postAuthScreen) {
          setCurrentScreen(postAuthScreen);
          setPostAuthScreen(null);
        } else {
          setCurrentScreen("scroll-of-possibilities"); // safe fallback
        }
      
        setAccountPurpose(null);
      }}
      onClose={() => {
        setShowAccountModal(false);
        setPostAuthScreen(null);
        setAccountPurpose(null);
      }}
    />
    )}
  </>
  
);
};

export default VenueRankerOverlay;