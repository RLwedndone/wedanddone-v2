import { useEffect, useState } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { User } from "firebase/auth";
import { getGuestState } from "../utils/guestCountStore";
import React, { useCallback } from "react";
import GuestCountReminderModal from "../components/common/GuestCountReminderModal";
import PaymentSettingsOverlay from "../components/account/PaymentSettingsOverlay";


import DashboardButtons from "../components/DashboardButtons";
import MagicCloud from "../components/MagOMeter/MagicCloud";
import AccountScreen from "../components/MenuScreens/AccountScreen";
import GuestListScroll from "../components/MenuScreens/GuestListScroll";
import FloralPickerOverlay from "../components/FloralPicker/FloralPickerOverlay";
import JamOverlay from "../components/JamGroove/JamOverlay";
import PhotoStylerOverlay from "../components/PhotoStyler/PhotoStylerOverlay";
import VenueRankerOverlay from "../components/VenueRanker/VenueRankerOverlay";
import PixiePlannerOverlay from "../components/PixiePlanner/PixiePlannerOverlay";
import UserMenu from "../components/UserMenu";
import DocumentsScreen from "../components/MenuScreens/DocumentsScreen";
import Bookings from "../components/MenuScreens/Bookings";
import LogoutModal from "../components/LogoutModal";
import { signOut } from "firebase/auth";
import type { JamStep } from "../components/JamGroove/JamOverlay";
import NoVenueOverlay from "../components/NewYumBuild/shared/NoVenueOverlay";
import { YumStep } from "../components/NewYumBuild/yumTypes";
import MagicBookOverlay from "../components/MagicBook/MagicBookOverlay";
import WedAndDoneOverlay from "../components/WedAndDoneInfo/WedAndDoneOverlay";
import LoginModal from "./LoginModal";
import FloatingMadge from "../components/MadgeChat/FloatingMadge";
import MadgeChatModal from "../components/MadgeChat/MadgeChatModal";
import MenuController from "../components/NewYumBuild/shared/MenuController";


import "../styles/globals/boutique.master.css";
import "./Dashboard.css";

// --- unify completion flags from Firestore + legacy fields + localStorage ---
function deriveCompletionFlags(data: any) {
  const b = data?.bookings ?? {};

  const floral =
    (b.floral === true) ||
    (data?.floralSigned === true) ||
    (localStorage.getItem("floralSigned") === "true");

  const jam =
    (b.jam === true) ||
    (data?.jamSigned === true) ||
    (localStorage.getItem("jamGrooveCompleted") === "true");

  const photography =
    (b.photography === true) ||
    (data?.photoCompleted === true) ||
    (localStorage.getItem("photoCompleted") === "true");

  const catering =
    (b.catering === true) ||
    (data?.yumCateringCompleted === true) ||
    (localStorage.getItem("yumBookedCatering") === "true");

  const dessert =
    (b.dessert === true) ||
    (data?.yumDessertCompleted === true) ||
    (localStorage.getItem("yumBookedDessert") === "true");

  const venue =
    (b.venue === true) ||
    (data?.venueCompleted === true) ||
    (localStorage.getItem("venueCompleted") === "true");

  const planner =
    (b.planner === true) ||
    (data?.plannerCompleted === true) ||
    (localStorage.getItem("plannerCompleted") === "true");

  return { floral, jam, photography, catering, dessert, venue, planner };
}

type OverlayType =
  | "menu"
  | "account"
  | "docs"
  | "messages"
  | "bookings"
  | "jamgroove"
  | "pixiegrooveaddoncart"
  | "floralpicker-initial"
  | "floralpicker-addon"
  | "photostyler-initial"
  | "photostyler-addon"
  | "venueranker"
  | "menuController"
  | "noVenueOverlay"
  | "pixieplanner"
  | "magicbook"
  | "wedanddoneinfo"
  | "payments"        // 👈 added here
  | null;

type UserMenuScreenType =
  | "menu"
  | "account"
  | "docs"
  | "messages"
  | "bookings"
  | "guestListScroll"
  | "payments"        // 👈 added here
  | null;

const Dashboard = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMagicCloud, setShowMagicCloud] = useState(false);
  const [user, setUser] = useState<User | null>(null);
const [showLoginModal, setShowLoginModal] = useState(false);
const [showSignupModal, setShowSignupModal] = useState(false);
  const [activeOverlay, _setActiveOverlay] = useState<OverlayType>(null);
  const [overlayProps, setOverlayProps] = useState<{ startAt?: YumStep | JamStep | string } | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [floralCompleted, setFloralCompleted] = useState(false);
  const [jamGrooveComplete, setJamGrooveComplete] = useState(false);
  const [yumCompleted, setYumCompleted] = useState(false);
  const [dessertCompleted, setDessertCompleted] = useState(false);
  const [photoCompleted, setPhotoCompleted] = useState(false);
  const [venueCompleted, setVenueCompleted] = useState(false);
  const [plannerCompleted, setPlannerCompleted] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false); 
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalBudget, setTotalBudget] = useState(0);
  const [activeUserMenuScreen, setActiveUserMenuScreen] = useState<UserMenuScreenType>(null);
  const [guestCount, setGuestCountState] = useState(0);
const [guestLocked, setGuestLocked] = useState(false);
const [guestLockedBy, setGuestLockedBy] = useState<string[]>([]);
const [showGuestListButton, setShowGuestListButton] = useState(false);

// inside your Dashboard component
const [overlay, setOverlay] = React.useState<null | { 
  type: "venueRanker" | "photo" | "floral" | "planner" | "yumyum" | "jam"; 
  startAt?: string;
}>(null);

const closeOverlay = () => setOverlay(null);

// 👇 add this
const [showGuestCountFlow, setShowGuestCountFlow] = useState(false);

// 👇 add this (with your other callbacks or just below the state is fine)
const handleOpenGuestCountFlow = useCallback(() => {
  setShowGuestCountFlow(true);
}, []);

// launcher used by Bookings modal buttons
const handleLaunchBoutique = (
  type: "venueRanker" | "photo" | "floral" | "planner" | "yumyum" | "jam",
  startAt?: string
) => {
const normalized = type === "yumyum" ? "menuController" : type;
setOverlay({ type: normalized as any, startAt });
};

// (optional) support the fallback event path Bookings can emit
React.useEffect(() => {
  const onOpen = (e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    if (!detail?.type) return;
const normalized = detail.type === "yumyum" ? "menuController" : detail.type;
setOverlay({ type: normalized, startAt: detail.startAt });
  };
  window.addEventListener("openOverlay", onOpen as EventListener);
  return () => window.removeEventListener("openOverlay", onOpen as EventListener);
}, []);
  

// centralize routing from the UserMenu
const handleMenuSelect = (section: UserMenuScreenType) => {
  switch (section) {
    case "account":
    case "docs":
    case "bookings":
    case "menu":
    case "payments":   // 👈 new payments overlay route
      setActiveUserMenuScreen(section);
      break;
    case "guestListScroll":
      setActiveUserMenuScreen("guestListScroll");
      break;
    default:
      break;
  }
};


  const [showPlanner, setShowPlanner] = useState(false);

  const [floralSavedStep, setFloralSavedStep] = useState<string | null>(null);
  const [jamSavedStep, setJamSavedStep] = useState<string | null>(null);
  const [photoSavedStep, setPhotoSavedStep] = useState<string | null>(null);
  const [yumSavedStep, setYumSavedStep] = useState<string | null>(null);
  const [plannerSavedStep, setPlannerSavedStep] = useState<string | null>(null);
const [venueSavedStep, setVenueSavedStep] = useState<string | null>(null);

const [isChatOpen, setIsChatOpen] = useState(false);
  
  const handleLogout = async () => {
    try {
      await signOut(auth); // ✅ Firebase logout
      localStorage.clear(); // ✅ Clear any local data
      console.log("👋 User signed out!");
      setActiveUserMenuScreen(null);
      setShowLogoutModal(true); // ✅ Show the farewell modal
    } catch (error) {
      console.error("❌ Logout failed:", error);
    }
  };
  const setActiveOverlay = (
    overlay: OverlayType,
    props?: { startAt?: YumStep | JamStep | string }
  ) => {
    _setActiveOverlay(overlay);
    setOverlayProps(props || null);
  };

  // ---- Guest Scroll visibility helpers ----
const MS_DAY = 24 * 60 * 60 * 1000;

function parseLocalYMD(ymd?: string | null): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00`); // noon to avoid TZ slip
}

function daysUntil(d: Date) {
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const t1 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((t1 - t0) / MS_DAY);
}

function shouldShowGuestScroll(opts: {
  weddingDateYMD?: string | null;
  confirmedAt?: number | null;
  hasGuestDependentBooking?: boolean;
}) {
  const { weddingDateYMD, confirmedAt = null, hasGuestDependentBooking = true } = opts;
  if (!hasGuestDependentBooking) return false;    // optionally gate by bookings
  if (confirmedAt) return false;                  // hide if already confirmed

  const date = parseLocalYMD(weddingDateYMD || "");
  if (!date) return false;

  const du = daysUntil(date);
  return du <= 45 && du >= 30;                    // only in the 45→30 window
}

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);              // keep user in state
      setIsAuthReady(true);    // mark auth as initialized
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let mounted = true;
  
    const pull = async () => {
      const st = await getGuestState();
      if (!mounted) return;
      setGuestCountState(st.value || 0);
      setGuestLocked(!!st.locked);
      setGuestLockedBy(st.lockedBy || []);
    };
  
    // initial load
    pull();
  
    // keep in sync with all store events
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
    const handleOverlayOpen = (e: any) => {
      const customEvent = e as CustomEvent<OverlayType>;
      console.log("✨ Overlay Event Received:", customEvent.detail);
      setActiveOverlay(customEvent.detail);
    };
    window.addEventListener("openOverlay", handleOverlayOpen);
    return () => window.removeEventListener("openOverlay", handleOverlayOpen);
  }, []);

  

  useEffect(() => {
    if (!isAuthReady) return;
  
    const fetchSavedSteps = async () => {
      const u = auth.currentUser;
      const ls = (k: string) => localStorage.getItem(k) || null;
      const pick = (a?: string | null, b?: string | null) => (a ?? b ?? null);
  
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data();
            const floralFS  = (data.floralSavedStep as string) || null;
            const jamFS     = (data.jamGrooveSavedStep as string) || null;
            const photoFS   = (data.photoSavedStep as string) || null;
            const yumFS     = (data.yumSavedStep as string) || null;
            const plannerFS = (data.plannerSavedStep as string) || null;
            const venueFS   = (data.venueSavedStep as string) || null;
  
            setFloralSavedStep( pick(floralFS,  ls("floralSavedStep")) );
            setJamSavedStep(    pick(jamFS,     ls("jamGrooveStep")) );
            setPhotoSavedStep(  pick(photoFS,   ls("photoSavedStep")) );
            setYumSavedStep(    pick(yumFS,     ls("yumSavedStep")) );
            setPlannerSavedStep(pick(plannerFS, ls("plannerSavedStep")) );
            setVenueSavedStep(  pick(venueFS,   ls("venueSavedStep")) );
          } else {
            setFloralSavedStep(ls("floralSavedStep"));
            setJamSavedStep(ls("jamGrooveStep"));
            setPhotoSavedStep(ls("photoSavedStep"));
            setYumSavedStep(ls("yumSavedStep"));
            setPlannerSavedStep(ls("plannerSavedStep"));
            setVenueSavedStep(ls("venueSavedStep"));
          }
        } catch (err) {
          console.error("❌ Failed to load saved steps from Firestore:", err);
          setFloralSavedStep(ls("floralSavedStep"));
          setJamSavedStep(ls("jamGrooveStep"));
          setPhotoSavedStep(ls("photoSavedStep"));
          setYumSavedStep(ls("yumSavedStep"));
          setPlannerSavedStep(ls("plannerSavedStep"));
          setVenueSavedStep(ls("venueSavedStep"));
        }
      } else {
        setFloralSavedStep(ls("floralSavedStep"));
        setJamSavedStep(ls("jamGrooveStep"));
        setPhotoSavedStep(ls("photoSavedStep"));
        setYumSavedStep(ls("yumSavedStep"));
        setPlannerSavedStep(ls("plannerSavedStep"));
        setVenueSavedStep(ls("venueSavedStep"));
      }
    };
  
    fetchSavedSteps();
  }, [isAuthReady, user]);

  useEffect(() => {
    const openMenuScreen = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail === "docs") setActiveUserMenuScreen("docs");
    };
    window.addEventListener("openUserMenuScreen", openMenuScreen);
    return () => window.removeEventListener("openUserMenuScreen", openMenuScreen);
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;       // wait until onAuthStateChanged has fired at least once
  
    const handleRefresh = async () => {
      console.log("✨ Refreshing dashboard state...");
      const u = auth.currentUser;
      if (!u) {
        console.log("[REFRESH] no user; skipping FS read");
        return;
      }
  
      try {
        const docRef = doc(db, "users", u.uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return;
  
        const data = docSnap.data();
  
        // ✅ use your derive helper
        const flags = deriveCompletionFlags(data);
        console.log("[REFRESH] derived flags:", flags);
  
        setFloralCompleted(flags.floral);
        setJamGrooveComplete(flags.jam);
        setPhotoCompleted(flags.photography);
        setYumCompleted(flags.catering);
        setDessertCompleted(flags.dessert);
        setPlannerCompleted(flags.planner);
        setVenueCompleted(flags.venue);
        // NEW: get wedding date and confirmation status
        const weddingDateYMD: string | null =
          (data.weddingDate as string) || data.profileData?.weddingDate || null;
        
        // read guestCountConfirmedAt from subdoc used by GuestListScroll
        let confirmedAt: number | null = null;
        try {
          const bookingRef = doc(db, "users", u.uid, "venueRankerData", "booking");
          const bookingSnap = await getDoc(bookingRef);
          if (bookingSnap.exists()) {
            const bd = bookingSnap.data() as any;
            confirmedAt = typeof bd?.guestCountConfirmedAt === "number" ? bd.guestCountConfirmedAt : null;
          }
        } catch (e) {
          console.warn("⚠️ Could not read guestCountConfirmedAt:", e);
        }
        
        // You can choose what “guest-dependent” means.
        // This matches your earlier logic: venue OR catering OR dessert booked.
        // Guest-dependent = any of: venue, catering, dessert, planner
const hasGuestDependentBooking =
!!(flags.venue || flags.catering || flags.dessert || flags.planner);
        
        // decide visibility
        setShowGuestListButton(
          shouldShowGuestScroll({
            weddingDateYMD,
            confirmedAt,
            hasGuestDependentBooking,
          })
        );
        // totals unchanged...
        const purchases = data.purchases || [];
        const total = purchases.reduce(
          (acc: number, item: { amount: number }) => acc + item.amount,
          0
        );
        const localOutside = localStorage.getItem("outsidePurchases");
        const outsideParsed = localOutside ? JSON.parse(localOutside) : [];
        const outsideSpend = outsideParsed.reduce(
          (sum: number, p: { amount: number }) => sum + Number(p.amount),
          0
        );
        setTotalSpent(total + outsideSpend);
      } catch (error) {
        console.error("❌ Error refreshing dashboard state:", error);
      }
    };
  
    // 🔔 event hooks that should trigger a refresh
    window.addEventListener("purchaseMade", handleRefresh);
    window.addEventListener("jamCompletedNow", handleRefresh);
    window.addEventListener("budgetUpdated", handleRefresh);
    window.addEventListener("outsidePurchaseMade", handleRefresh);
  
    // initial load (after auth becomes ready)
    handleRefresh();
  
    return () => {
      window.removeEventListener("purchaseMade", handleRefresh);
      window.removeEventListener("jamCompletedNow", handleRefresh);
      window.removeEventListener("budgetUpdated", handleRefresh);
      window.removeEventListener("outsidePurchaseMade", handleRefresh);
    };
  }, [isAuthReady, user]); // 👈 key change

  // just before your JSX return, define:
const showingMenuController = activeOverlay === "menuController";
const menuStartAt = (overlayProps?.startAt as YumStep) || "intro";
if (showingMenuController) {
  console.log("[Dashboard] Mounting MenuController with startAt:", menuStartAt);
}




  return (
    <div style={{ position: "relative", height: "100vh", width: "100vw", overflow: "hidden" }}>
      <picture>
        <source
          srcSet={isMobile ? "/assets/images/dashboard_mobile.webp" : "/assets/images/dashboard_wide.webp"}
          type="image/webp"
        />
        <img
          src={isMobile ? "/assets/images/dashboard_mobile.jpg" : "/assets/images/dashboard_wide.jpg"}
          alt="Background"
          style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", zIndex: -1 }}
        />
      </picture>


      {showMagicCloud && <MagicCloud isMobile={isMobile} onClose={() => setShowMagicCloud(false)} triggerLogin={() => {}} triggerSignupModal={() => setShowSignupModal(true)} />}


{activeUserMenuScreen === "menu" && (
  <>
    {console.log("[UI] Menu flags", {
      venueCompleted,
      yumCompleted,
      dessertCompleted,
      showGuestListButton,
    })}

    <UserMenu
      onClose={() => setActiveUserMenuScreen(null)}
      onSelect={handleMenuSelect}
      onLogout={handleLogout}
      showGuestListScroll={showGuestListButton} 
    />
  </>
)}

{activeUserMenuScreen === "account" && (
  <AccountScreen onClose={() => setActiveUserMenuScreen("menu")} />
)}

{activeUserMenuScreen === "docs" && (
  <DocumentsScreen onClose={() => setActiveUserMenuScreen("menu")} />
)}

{activeUserMenuScreen === "bookings" && (
  <Bookings
    onClose={() => setActiveUserMenuScreen(null)}
    onLaunchBoutique={handleLaunchBoutique}
  />
)}

{activeUserMenuScreen === "payments" && (
  <PaymentSettingsOverlay onClose={() => setActiveUserMenuScreen("menu")} />
)}

{/* Global overlay mount */}
{overlay && (
  <div style={{ position: "fixed", inset: 0, zIndex: 2000 }}>
    {overlay.type === "photo" && (
      <PhotoStylerOverlay onClose={closeOverlay} startAt="intro" />
    )}
    {overlay.type === "floral" && (
      <FloralPickerOverlay onClose={closeOverlay} startAt="intro" />
    )}
    {overlay.type === "planner" && (
      <PixiePlannerOverlay onClose={closeOverlay} startAt="intro" />
    )}
    {overlay.type === "jam" && (
      <JamOverlay onClose={closeOverlay} startAt="intro" />
    )}
    {overlay.type === "venueRanker" && (
      <VenueRankerOverlay onClose={closeOverlay} startAt="intro" />
    )}
  </div>
)}

{activeUserMenuScreen === "guestListScroll" && (
  <GuestListScroll onClose={() => setActiveUserMenuScreen("menu")} />
)}

{showLogoutModal && (
  <LogoutModal
    onClose={() => {
      setShowLogoutModal(false);
      window.location.reload(); // fully reload as guest
    }}
  />
)}

<DashboardButtons
  isMobile={isMobile}

  /* existing boutique props ... */
  floralCompleted={floralCompleted}
  jamGrooveCompleted={jamGrooveComplete}
  photoCompleted={photoCompleted}
  cateringCompleted={yumCompleted}
  plannerCompleted={plannerCompleted}
  venueRankerCompleted={venueCompleted}
  onPhotoStylerClick={() =>
    setActiveOverlay(photoCompleted ? "photostyler-addon" : "photostyler-initial",
      { startAt: (photoSavedStep || "intro") as any })
  }
  onFloralClick={() =>
    setActiveOverlay("floralpicker-initial",
      { startAt: (floralSavedStep || "intro") as any })
  }
  onJamGrooveClick={() => {
    setActiveOverlay("jamgroove",
      { startAt: (jamSavedStep as JamStep) || "intro" });
  }}
  onPixiePlannerClick={() =>
    setActiveOverlay("pixieplanner",
      { startAt: (localStorage.getItem("plannerSavedStep") as string) || "intro" })
  }
  onVenueRankerClick={() => {
    const checkpoint = localStorage.getItem("venueRankerCheckpoint");
    setActiveOverlay("venueranker");
    if (checkpoint === "scroll-of-possibilities") {
      window.dispatchEvent(new CustomEvent("resumeVenueRankerFromScroll"));
    }
  }}
  onYumClick={async () => {
    console.log("🍕 Yum Yum clicked");
  
    const user = auth.currentUser;
    let startStep: YumStep = "intro";
  
    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
  
        const hasCatering = userData?.bookings?.catering === true;
        const hasDessert  = userData?.bookings?.dessert === true;
  
        if (hasCatering && !hasDessert)       startStep = "returnNoDessert";
        else if (!hasCatering && hasDessert)  startStep = "returnNoCatering";
        else if (hasCatering && hasDessert)   startStep = "returnBothBooked";
      } catch (error) {
        console.warn("🔥 Error fetching user bookings:", error);
      }
    } else {
      const localCatering = localStorage.getItem("yumBookedCatering") === "true";
      const localDessert  = localStorage.getItem("yumBookedDessert") === "true";
  
      if (localCatering && !localDessert)       startStep = "returnNoDessert";
      else if (!localCatering && localDessert)  startStep = "returnNoCatering";
      else if (localCatering && localDessert)   startStep = "returnBothBooked";
    }
  
    localStorage.setItem("yumStep", startStep);
    setActiveOverlay("menuController", { startAt: startStep }); // 👈 use controller now
  }}
 /* ✅ NEW: HUD handlers */
 onOpenMenu={() => setActiveUserMenuScreen("menu")}
 onOpenMadge={() => setIsChatOpen(true)}
 onOpenBudget={() => setShowMagicCloud(true)}
 onOpenMagicBook={() =>
   setActiveOverlay("magicbook", {
     startAt: (localStorage.getItem("magicStep") || "intro") as any,
   })
 }
 onOpenLogin={() => setShowLoginModal(true)}

/* video wand tuning — percentage-based so it scales with the HUD */
wandScaleDesktop={0.90}        // 1 = same width as HUD slot; 1.15 ≈ 15% wider
wandNudgeXPctDesktop={-8}     // move right by 0.8% of stage width
wandNudgeYPctDesktop={10.6}     // move down by 0.6% of stage height

wandScaleMobile={1.10}
wandNudgeXPctMobile={-15.3}     // move left a bit on mobile
wandNudgeYPctMobile={2.0}
/>

{/* 🔔 Guest Count Reminder (shows when 45→30 days out) */}
<GuestCountReminderModal
  onOpenGuestCountFlow={handleOpenGuestCountFlow}
/>

      {/* 🧪 Full System Reset for Testing */}
      
      {process.env.NODE_ENV !== "production" && (
        <div style={{
          position: "absolute",
          bottom: "1rem",
          left: "1rem",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}>
          <button
            style={{
              padding: "0.5rem 1rem",
              background: "#ff5555",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
            onClick={async () => {
              const user = auth.currentUser;
              if (user) {
                const userRef = doc(db, "users", user.uid);
                await setDoc(userRef, {
                  jamGrooveCompleted: false,
                  floralSigned: false,
                  photoCompleted: false,
                  documents: [],
                  purchases: [],
                  budget: 0,
                }, { merge: true });
                await signOut(auth);
              }

              localStorage.clear();
              console.log("🧼 Fully reset system. Reloading as guest...");
              window.location.reload();
            }}
          >
            🧼 Start Fresh as Guest
          </button>
        </div>
      )}
      
    

{activeOverlay === "jamgroove" && (
  <>
    {console.log("🚨 Attempting to mount JamGrooveOverlay")}
    {console.log("🎯 overlayProps.startAt:", overlayProps?.startAt)}
    <JamOverlay
      key="jamgroove"
      onClose={() => setActiveOverlay(null)}
      onComplete={() => setJamGrooveComplete(true)}
      startAt={(overlayProps?.startAt as JamStep) || "intro"} // THIS IS PROBABLY WHAT'S MISSING
    />
  </>
)}
     {activeOverlay === "pixiegrooveaddoncart" && (
  <JamOverlay
    mode="addon"
    onClose={() => setActiveOverlay(null)}
    onComplete={() => setActiveOverlay(null)}
  />
)}

{activeOverlay === "floralpicker-initial" && (
  <FloralPickerOverlay
    mode="initial"
    onClose={() => setActiveOverlay(null)}
    onComplete={() => setFloralCompleted(true)}
  />
)}

{activeOverlay === "floralpicker-addon" && (
  <FloralPickerOverlay
    mode="addon"
    onClose={() => setActiveOverlay(null)}
    onComplete={() => setActiveOverlay(null)}
  />
)}

{activeOverlay === "photostyler-initial" && (
  <PhotoStylerOverlay
    mode="initial"
    onClose={() => setActiveOverlay(null)}
    onComplete={() => setPhotoCompleted(true)}
  />
)}

{activeOverlay === "photostyler-addon" && (
  <PhotoStylerOverlay
    mode="addon"
    onClose={() => setActiveOverlay(null)}
    onComplete={() => setActiveOverlay(null)}
  />
)}

{activeOverlay === "venueranker" && (
  <VenueRankerOverlay onClose={() => setActiveOverlay(null)} />
)}

{showingMenuController && (
  <MenuController
    onClose={() => setActiveOverlay(null)}
    startAt={menuStartAt}
  />
)}

{activeOverlay === "pixieplanner" && (
  <PixiePlannerOverlay
    onClose={() => setActiveOverlay(null)}
    startAt={(overlayProps?.startAt as
      | "intro"
      | "calendar"
      | "contract"
      | "checkout"
      | "thankyou"
      | "explainer"
      | "guestcount") || "intro"}
  />
)}
{activeOverlay === "magicbook" && (
  <MagicBookOverlay
  setActiveOverlay={setActiveOverlay}
  startAt="intro"
/>
)}
{activeOverlay === "wedanddoneinfo" && (
  <WedAndDoneOverlay onClose={() => setActiveOverlay(null)} />
)}

{showLoginModal && (
  <LoginModal onClose={() => setShowLoginModal(false)} />
)}

{isChatOpen && (
  <MadgeChatModal onClose={() => setIsChatOpen(false)} />
)}

{/* Guest count flow opened from the reminder */}
{showGuestCountFlow && (
  <GuestListScroll
    onClose={() => {
      setShowGuestCountFlow(false);
      // optional: bounce them back to the user menu view if that’s your UX
      // setActiveUserMenuScreen("menu");
    }}
  />
)}
    </div>
    
  );
};

export default Dashboard;