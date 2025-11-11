// src/components/VenueRanker/VenueRankerOverlay.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useOverlayOpen } from "../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../hooks/useScrollToTop";
import VenueRankerIntro from "./VenueRankerIntro";
import VenueVibeSelector from "./VenueVibeSelector";
import { generateScreenList } from "../../utils/generateScreenList";
import { db, auth } from "../../firebase/firebaseConfig";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import VenueExploreSelector from "./VenueExploreSelector";
import WeddingDateScreen from "../common/WeddingDateScreen";
import WeddingDateConfirmScreen from "../common/WeddingDateConfirmScreen";
import { onAuthStateChanged } from "firebase/auth";
import VenueAccountModal from "./VenueAccountModal";
import VenueGuestCountScreen from "./VenueGuestCountScreen";
import VenueRankerContract from "./VenueRankerContract";
import VenueThankYou from "./VenueThankYou";
import ScrollofPossibilities from "./ScrollofPossibilities";
import VenueCheckOut from "./VenueCheckOut";


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

interface VenueRankerOverlayProps {
  onClose: () => void;
  startAt?: string;
}

const ALL_VENUE_SCREENS: string[] = [
  "batesmansion", "desertfoothills", "encanterra", "fabric", "farmhouse", "haciendadelsol",
  "valleyho", "lakehouse", "ocotillo", "rubihouse", "schnepfbarn", "soho63",
  "sunkist", "themeadow", "tubac", "vic", "verrado", "windmillbarn",
];

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
    const raw = localStorage.getItem("venueRankerSelections");
    if (raw) {
      const saved = JSON.parse(raw);
      // light validation + merge
      setVenueRankerSelections(prev => ({
        exploreMode: saved?.exploreMode === "all" || saved?.exploreMode === "vibe" ? saved.exploreMode : (prev.exploreMode ?? "vibe"),
        vibeSelections: Array.isArray(saved?.vibeSelections) ? saved.vibeSelections : (prev.vibeSelections ?? []),
        rankings: typeof saved?.rankings === "object" && saved?.rankings ? saved.rankings : (prev.rankings ?? {}),
      }));
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
  const [currentScreen, setCurrentScreen] = useState<string>(startAt || "intro");
  const [screenList, setScreenList] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const [userHasWeddingDate, setUserHasWeddingDate] = useState(false);
  const [weddingDate, setWeddingDate] = useState<string>("");
  const [dayOfWeek, setDayOfWeek] = useState<string>("");

  const [payFull, setPayFull] = useState(true);
  const [signatureImage, setSignatureImage] = useState<string>("");
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);
  const [hasVenueBooked, setHasVenueBooked] = useState(false);
  const [activeVenueSlugs, setActiveVenueSlugs] = useState<string[] | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([currentScreen, currentIndex], { targetRef: cardRef });

  // Firestore mirrors
  const venueSlug = localStorage.getItem("venueSlug");
  const venueDate = localStorage.getItem("venueDate");
  const venueGuestCount = parseInt(localStorage.getItem("venueGuestCount") || "0");
  const venueTotal = parseFloat(localStorage.getItem("venueTotal") || "0");

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

          const bookings = (data?.bookings ?? {}) as Record<string, any>;
          setHasVenueBooked(!!bookings.venue);
        }
      } else {
        setUserHasWeddingDate(false);
        setHasVenueBooked(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // If user already booked → go straight to thank you
  useEffect(() => {
    if (hasVenueBooked) setCurrentScreen("thankyou");
  }, [hasVenueBooked]);

  const filterActive = (list: string[]) => {
    if (!activeVenueSlugs) return list;
    const allow = new Set(activeVenueSlugs);
    return list.filter((slug) => allow.has(slug));
  };

  // Resume from checkpoint if user already reached the Scroll
useEffect(() => {
  // Respect hard redirects first (e.g., already booked → thank you)
  if (hasVenueBooked) return;

  const ck = localStorage.getItem("venueRankerCheckpoint");
  if (ck === "scroll-of-possibilities") {
    const list = rebuildListFromSaved();
    setScreenList(list);
    setCurrentIndex(0);
    setCurrentScreen("scroll-of-possibilities");
  }
  // else: no checkpoint → normal flow starting at "intro" or provided startAt
}, [hasVenueBooked, activeVenueSlugs]); // run again once active venues load

  // Try to rebuild a screen list from saved selections
const rebuildListFromSaved = () => {
  try {
    // First preference: localStorage (instant). Firestore can be slower and you
    // already sync Firestore -> localStorage elsewhere.
    const raw = localStorage.getItem("venueRankerSelections");
    const parsed = raw ? JSON.parse(raw) as { vibeSelections?: string[] } : null;

    // If we don't have saved vibes, just show all active venues
    const base = parsed?.vibeSelections?.length
      ? generateScreenList(parsed.vibeSelections)
      : ALL_VENUE_SCREENS;

    const filtered = filterActive(base);
    return (Array.isArray(filtered) && filtered.length > 0) ? filtered : base;
  } catch {
    return ALL_VENUE_SCREENS;
  }
};

  // Explore mode handler
  const handleSelectExploreMode = (mode: "all" | "vibe") => {
    setVenueRankerSelections((prev) => ({
      ...prev,
      exploreMode: mode,
      vibeSelections: mode === "all" ? [] : prev.vibeSelections,
    }));

    if (mode === "vibe") {
      setScreenList([]);
      setCurrentIndex(0);
      setCurrentScreen("vibe");
      return;
    }

    // mode === "all" → show every active venue immediately
    const baseList = ALL_VENUE_SCREENS;
    const filtered = filterActive(baseList);
    const list = (Array.isArray(filtered) && filtered.length > 0) ? filtered : baseList;

    if (!list || list.length === 0) {
      console.warn("[Explore] No venue screens available.");
      setScreenList([]);
      setCurrentIndex(0);
      setCurrentScreen("explore");
      return;
    }

    setScreenList(list);
    setCurrentIndex(0);
    setCurrentScreen(list[0]);
  };

  const handleNextScreen = () => {
    const nextIndex = currentIndex + 1;
    const next = screenList[nextIndex];
    if (next) {
      setCurrentIndex(nextIndex);
      setCurrentScreen(next);
    } else {
      setCurrentScreen("rankerComplete");
    }
  };

  const handleBackScreen = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setCurrentIndex(prevIndex);
      setCurrentScreen(screenList[prevIndex]);
    } else {
      setCurrentScreen("vibe");
    }
  };

  const handleShowMagicalOptions = async () => {
    // Make sure selections are persisted before we leave this screen
    await flushVenueSelections();
  
    const user = auth.currentUser;
    if (!user) {
      setShowAccountModal(true);
      return;
    }
    if (userHasWeddingDate) {
      setCurrentScreen("confirm");
    } else {
      setCurrentScreen("calendar");
    }
  };

  /**
   * ✅ STABLE venue component map (no inline arrow components).
   * This prevents React from treating the child as a different type
   * on every render, which stops the iframe from remounting (no flash).
   */
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

  const isVenueScreen = Object.prototype.hasOwnProperty.call(VENUE_COMPONENTS, currentScreen);
  const VenueComp = isVenueScreen ? VENUE_COMPONENTS[currentScreen] : null;

  const formattedWeddingDate = weddingDate
    ? new Date(weddingDate + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

  // --- Render
  return (
    <div
      className="pixie-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(22,22,22,0.45)",
        zIndex: 999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "auto",
      }}
    >
      {/* IMPORTANT: not a pixie-card, just a scroll host */}
      <div ref={cardRef} style={{ width: "100%" }}>
        {/* Intro */}
        {currentScreen === "intro" && (
          <VenueRankerIntro onContinue={() => setCurrentScreen("explore")} onClose={onClose} />
        )}

        {/* Explore */}
        {currentScreen === "explore" && (
          <VenueExploreSelector onSelectExploreMode={handleSelectExploreMode} onClose={onClose} />
        )}

        {/* Vibe */}
        {currentScreen === "vibe" && (
          <VenueVibeSelector
            venueRankerSelections={venueRankerSelections}
            setVenueRankerSelections={setVenueRankerSelections}
            onContinue={() => {
              const raw = generateScreenList(venueRankerSelections.vibeSelections);
              const list = filterActive(raw);
              if (list.length === 0) {
                setScreenList([]);
                setCurrentIndex(0);
                setCurrentScreen("vibe");
              } else {
                setScreenList(list);
                setCurrentIndex(0);
                setCurrentScreen(list[0]);
              }
            }}
            onBack={() => setCurrentScreen("explore")}
            onClose={onClose}
          />
        )}

        {/* Date flow */}
        {currentScreen === "calendar" && (
          userHasWeddingDate ? (
            <WeddingDateConfirmScreen
              formattedDate={weddingDate || ""}
              dayOfWeek={dayOfWeek || ""}
              userHasDate={!!weddingDate}
              weddingDateLocked={true}
              onConfirm={() => setCurrentScreen("venueGuestCount")}
              onEditDate={() => {}}
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
          )
        )}

        {currentScreen === "confirm" && (
          <WeddingDateConfirmScreen
            formattedDate={formattedWeddingDate}
            dayOfWeek={dayOfWeek || ""}
            userHasDate={!!weddingDate}
            weddingDateLocked={true}
            onConfirm={() => setCurrentScreen("venueGuestCount")}
            onEditDate={() => setCurrentScreen("calendar")}
            onClose={onClose}
          />
        )}

        {/* Guest count */}
        {currentScreen === "venueGuestCount" && (
          <VenueGuestCountScreen
            onContinue={() => setCurrentScreen("scroll-of-possibilities")}
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
          />
        )}

        {/* ✅ Venue detail screens with stable component type */}
        {isVenueScreen && VenueComp && (
          <VenueComp
            onContinue={handleNextScreen}
            onBack={handleBackScreen}
            onClose={onClose}
            screenList={screenList}
            currentIndex={currentIndex}
            venueRankerSelections={venueRankerSelections}
            setVenueRankerSelections={setVenueRankerSelections}
            goToExplore={() => setCurrentScreen("explore")}
          />
        )}

       {/* Ranker complete */}
{currentScreen === "rankerComplete" && (
  <RankerCompleteScreen
    weddingDateSet={Boolean(weddingDate)}
    guestCountSet={Number.isFinite(venueGuestCount) && venueGuestCount > 0}
    onStartScroll={handleShowMagicalOptions}
    onEditRankings={() => setCurrentScreen("explore")}
    onClose={onClose}
  />
)}

{/* Contract */}
{currentScreen === "venuecontract" && (
  <VenueRankerContract
    venueSlug={venueSlug ?? ""}
    venueName={localStorage.getItem("venueName") ?? ""}

    // 👇 match VenueRankerContractProps exactly
    venueWeddingDate={venueDate ?? ""}               // was “venueDate”
    venuePrice={Number.isFinite(venueTotal) ? venueTotal : 0} // was “total”

    guestCount={Number.isFinite(venueGuestCount) ? venueGuestCount : 0}
    payFull={payFull}
    setPayFull={setPayFull}

    signatureImage={signatureImage}
    setSignatureImage={setSignatureImage}
    signatureSubmitted={signatureSubmitted}
    setSignatureSubmitted={setSignatureSubmitted}

    // navigation for the contract step
    onBack={() => setCurrentScreen("scroll-of-possibilities")}
    onContinue={() => setCurrentScreen("checkout")}

    // still passing this through if the child uses it
    setCurrentScreen={setCurrentScreen}

    // required setters — if you don’t use these upstream, no-op is fine
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
  <VenueCheckOut setCurrentScreen={setCurrentScreen} onClose={onClose} />
)}

{currentScreen === "thankyou" && <VenueThankYou onClose={onClose} />}

        {/* Account modal (its own pixie-card) */}
        {showAccountModal && (
          <VenueAccountModal
            onSuccess={() => {
              setShowAccountModal(false);
              setCurrentScreen("calendar");
            }}
            onClose={() => setShowAccountModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default VenueRankerOverlay;