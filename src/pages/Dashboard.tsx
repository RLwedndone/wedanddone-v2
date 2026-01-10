import React, { useEffect, useState, useCallback } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import VenueAvailabilityAdmin from "../components/admin/VenueAvailabilityAdmin"; // adjust path
import AdminPixiePurchasePanel from "../components/admin/AdminPixiePurchasePanel";
import { useLocation } from "react-router-dom";
import { getGuestState } from "../utils/guestCountStore";

import GuestCountReminderModal from "../components/common/GuestCountReminderModal";
import PaymentSettingsOverlay from "../components/account/PaymentSettingsOverlay";

import DashboardButtons from "../components/DashboardButtons";
import MagicCloud from "../components/MagOMeter/MagicCloud";
import AccountScreen from "../components/MenuScreens/AccountScreen";
import GuestListScroll from "../components/MenuScreens/GuestListScroll";
import FloralPickerOverlay from "../components/FloralPicker/FloralPickerOverlay";
import JamOverlay, { JamStep } from "../components/JamGroove/JamOverlay";
import PhotoStylerOverlay from "../components/PhotoStyler/PhotoStylerOverlay";
import VenueRankerOverlay from "../components/VenueRanker/VenueRankerOverlay";
import PixiePlannerOverlay from "../components/PixiePlanner/PixiePlannerOverlay";
import UserMenu from "../components/UserMenu";
import DocumentsScreen from "../components/MenuScreens/DocumentsScreen";
import Bookings from "../components/MenuScreens/Bookings";
import LogoutModal from "../components/LogoutModal";
import NoVenueOverlay from "../components/NewYumBuild/shared/NoVenueOverlay";
import { YumStep } from "../components/NewYumBuild/yumTypes";
import MagicBookOverlay from "../components/MagicBook/MagicBookOverlay";
import WedAndDoneOverlay from "../components/WedAndDoneInfo/WedAndDoneOverlay";
import LoginModal from "./LoginModal";
import MadgeChatModal from "../components/MadgeChat/MadgeChatModal";
import MenuController from "../components/NewYumBuild/shared/MenuController";
import PixiePurchaseCenter from "../components/MenuScreens/PixiePurchaseCenter";
import PixiePurchaseCheckout from "../components/MenuScreens/PixiePurchaseCheckout";
import type { PixiePurchase } from "../utils/pixiePurchaseTypes";
import { track } from "../utils/analytics";

import "../styles/globals/boutique.master.css";
import "./Dashboard.css";
import { trackOpen } from "../utils/trackPosthog";

// --- unify completion flags from Firestore + legacy fields + localStorage ---
function deriveCompletionFlags(data: any) {
  const b = data?.bookings ?? {};

  // ✅ COMPLETED = PAID/BOOKED (not merely signed)
  const floral =
    b.floral === true ||
    localStorage.getItem("floralBooked") === "true";

  const jam =
    b.jam === true ||
    localStorage.getItem("jamBooked") === "true";

  const photography =
    b.photography === true ||
    localStorage.getItem("photoBooked") === "true";

  const catering =
    b.catering === true ||
    localStorage.getItem("yumBookedCatering") === "true" ||
    localStorage.getItem("yumCateringBooked") === "true";

  const dessert =
    b.dessert === true ||
    localStorage.getItem("yumBookedDessert") === "true" ||
    localStorage.getItem("yumDessertBooked") === "true";

  const venue =
    b.venue === true ||
    localStorage.getItem("venueCompleted") === "true"; // only keep if this truly means paid

  const planner =
    b.planner === true ||
    localStorage.getItem("plannerBooked") === "true";

  return { floral, jam, photography, catering, dessert, venue, planner };
}

// overlays that can float over dashboard
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
  | "payments"
  | null;

// which "tab" inside UserMenu we're showing
type UserMenuScreenType =
  | "menu"
  | "account"
  | "docs"
  | "messages"
  | "bookings"
  | "guestListScroll"
  | "payments"
  | "pixiePurchases"
  | null;

const MS_DAY = 24 * 60 * 60 * 1000;


const isIos = () => {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
};

const isAndroid = () => /android/i.test(navigator.userAgent);

const isStandalone = () => {
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)")?.matches
  );
};

function computeShowInstallIcon(opts: {
  isMobile: boolean;
  canInstall: boolean;
}) {
  const { isMobile, canInstall } = opts;

  if (!isMobile) return false;
  if (isStandalone()) return false;

  // iOS: show unless they previously said yes (we hide permanently after that)
  const iosYesClicked = (() => {
    try {
      return localStorage.getItem("wd_a2hs_yes_clicked") === "true";
    } catch {
      return false;
    }
  })();

  const showIOS = isIos() && !iosYesClicked;

  // Android: show only if install prompt is available and they haven't dismissed it
  const androidDismissed = (() => {
    try {
      return localStorage.getItem("wd_android_install_dismissed") === "true";
    } catch {
      return false;
    }
  })();

  const showAndroid = isAndroid() && canInstall && !androidDismissed;

  return showIOS || showAndroid;
}

// helpers for guest list timing logic
function parseLocalYMD(ymd?: string | null): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  // noon local to reduce timezone slip
  return new Date(`${ymd}T12:00:00`);
}

function daysUntil(d: Date) {
  const today = new Date();
  const t0 = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();
  const t1 = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  ).getTime();
  return Math.round((t1 - t0) / MS_DAY);
}

function shouldShowGuestScroll(opts: {
  weddingDateYMD?: string | null;
  confirmedAt?: number | null;
  hasGuestDependentBooking?: boolean;
  finalLocked?: boolean;
  increaseRequested?: number | null;
}) {
  const {
    weddingDateYMD,
    confirmedAt = null,
    hasGuestDependentBooking = true,
    finalLocked = false,
    increaseRequested = null,
  } = opts;

  if (!hasGuestDependentBooking) return false;

  // 🚫 stop showing if:
  // - guest count is final-locked
  // - or an increase request is already in the system
  // - or they already confirmed
  if (finalLocked) return false;
  if (increaseRequested != null) return false;
  if (confirmedAt) return false;

  const date = parseLocalYMD(weddingDateYMD || "");
  if (!date) return false;

  const du = daysUntil(date);
  // ✅ show only between 45 and 30 days out
  return du <= 45 && du >= 30;
}

const Dashboard: React.FC = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const location = useLocation() as { state?: any };
  const [showAvailabilityAdmin, setShowAvailabilityAdmin] = useState(false);
  const [showPixieAdmin, setShowPixieAdmin] = useState(false);

  const [showMagicCloud, setShowMagicCloud] = useState(false);

  const [pixiePurchases, setPixiePurchases] = useState<PixiePurchase[]>([]);
  const [hasPixieNotifications, setHasPixieNotifications] = useState(false);
  const [hasDocsNotifications, setHasDocsNotifications] = useState(false);

  // auth / user
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // app state / overlays
  const [activeOverlay, _setActiveOverlay] = useState<OverlayType>(null);
  const [overlayProps, setOverlayProps] = useState<{
    startAt?: YumStep | JamStep | string;
  } | null>(null);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  // completion flags
  const [floralCompleted, setFloralCompleted] = useState(false);
  const [jamGrooveComplete, setJamGrooveComplete] = useState(false);
  const [yumCompleted, setYumCompleted] = useState(false);
  const [dessertCompleted, setDessertCompleted] = useState(false);
  const [photoCompleted, setPhotoCompleted] = useState(false);
  const [venueCompleted, setVenueCompleted] = useState(false);
  const [plannerCompleted, setPlannerCompleted] = useState(false);

  // budget view
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalBudget, setTotalBudget] = useState(0); // currently unused in UI, but we keep it

  // user menu sub-screens
  const [activeUserMenuScreen, setActiveUserMenuScreen] =
    useState<UserMenuScreenType>(null);

  // guest count state
  const [guestCount, setGuestCountState] = useState(0);
  const [guestLocked, setGuestLocked] = useState(false);
  const [guestLockedBy, setGuestLockedBy] = useState<string[]>([]);
  const [showGuestListButton, setShowGuestListButton] = useState(false);

  // boutique resume steps
  const [floralSavedStep, setFloralSavedStep] = useState<string | null>(null);
  const [jamSavedStep, setJamSavedStep] = useState<string | null>(null);
  const [photoSavedStep, setPhotoSavedStep] = useState<string | null>(null);
  const [yumSavedStep, setYumSavedStep] = useState<string | null>(null);
  const [plannerSavedStep, setPlannerSavedStep] = useState<string | null>(null);
  const [venueSavedStep, setVenueSavedStep] = useState<string | null>(null);

  // chat
  const [isChatOpen, setIsChatOpen] = useState(false);

  // guest confirmation flow
  const [showGuestCountFlow, setShowGuestCountFlow] = useState(false);

  const [showA2HS, setShowA2HS] = useState(false);
const [a2hsStep, setA2hsStep] = useState<"ask" | "howto">("ask");


const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
const [canInstall, setCanInstall] = useState(false);

const isAndroidInstallReady =
  isAndroid() && canInstall && !!deferredInstallPrompt;


const showInstallIcon = computeShowInstallIcon({ isMobile, canInstall });


  // mini overlay system (separate from activeOverlay state)
type InlineOverlay =
| {
    type: "venueRanker" | "photo" | "floral" | "planner" | "jam";
    startAt?: string;
  }
| {
    type: "menuController";
    startAt?: YumStep;
  }
| {
    type: "pixiePurchaseCheckout";
    purchase: PixiePurchase;
  };

const [overlay, setOverlay] = useState<InlineOverlay | null>(null);

// ✅ GA: Track overlay opens (inline overlay system)
useEffect(() => {
  if (!overlay) return;

  track("overlay_open", {
    overlay: overlay.type,
    system: "inlineOverlay",
    device: isMobile ? "mobile" : "desktop",
    logged_in: !!user,
  });
}, [overlay, isMobile, user]);

  const closeOverlay = () => setOverlay(null);

  const handleOpenGuestCountFlow = useCallback(() => {
    setShowGuestCountFlow(true);
  }, []);

  const handleAndroidInstall = async () => {
    try {
      if (!deferredInstallPrompt) return;
  
      deferredInstallPrompt.prompt();
  
      const choice = await deferredInstallPrompt.userChoice;
      const accepted = choice?.outcome === "accepted";
  
      if (accepted) {
        setDeferredInstallPrompt(null);
        setCanInstall(false);
        setShowA2HS(false);
        return;
      }
  
      try {
        localStorage.setItem("wd_android_install_dismissed", "true");
      } catch {}
      setShowA2HS(false);
    } catch (e) {
      console.warn("Android install prompt failed:", e);
      setShowA2HS(false);
    }
  };

  // launcher used by Bookings modal buttons
  const handleLaunchBoutique = (
    type: "venueRanker" | "photo" | "floral" | "planner" | "yumyum" | "jam",
    startAt?: string
  ) => {
    if (type === "yumyum") {
      setOverlay({
        type: "menuController",
        startAt: startAt as YumStep | undefined, // no default
      });
      return;
    }
  
    setOverlay({ type, startAt });
  };

  // allow other parts of app to fire window.dispatchEvent(new CustomEvent("openOverlay", { detail: {type,...} }))
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (!detail?.type) return;
  
      if (detail.type === "yumyum") {
        setOverlay({
          type: "menuController",
          startAt: detail.startAt as YumStep | undefined, // no default
        });
        return;
      }
  
      setOverlay({ type: detail.type, startAt: detail.startAt });
    };
  
    window.addEventListener("openOverlay", onOpen as EventListener);
    return () =>
      window.removeEventListener("openOverlay", onOpen as EventListener);
  }, []);

  // menu selection router
  const handleMenuSelect = (section: UserMenuScreenType) => {
    switch (section) {
      case "account":
      case "docs":
      case "bookings":
      case "menu":
      case "payments":
        setActiveUserMenuScreen(section);
        break;
      case "pixiePurchases":
  setActiveUserMenuScreen("pixiePurchases");
  break;
      case "guestListScroll":
        setActiveUserMenuScreen("guestListScroll");
        break;
      default:
        break;
    }
  };

  // logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      console.log("👋 User signed out!");
      setActiveUserMenuScreen(null);
      setShowLogoutModal(true);
    } catch (error) {
      console.error("❌ Logout failed:", error);
    }
  };

// wrapper so we can also stash overlayProps (startAt, etc)
const setActiveOverlay = (
  ov: OverlayType,
  props?: { startAt?: YumStep | JamStep | string }
) => {
  if (ov) {
    trackOpen(ov, {
      system: "activeOverlay",
      startAt: props?.startAt ?? null,
      device: isMobile ? "mobile" : "desktop",
      loggedIn: !!user,
    });
  }

  _setActiveOverlay(ov);
  setOverlayProps(props || null);
};

// If we navigated here from Wedding Wisdom with a request...
useEffect(() => {
  if (location.state?.openWedAndDoneInfo) {
    setActiveOverlay("wedanddoneinfo");
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, [location.state]);

// ✅ Auto-open Venue Ranker from partner invite links
useEffect(() => {
  try {
    const params = new URLSearchParams(window.location.search);

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

    // Persist invite context for the overlay (overlay also does this, but this ensures it’s set before open)
    localStorage.setItem("wd_inviteVenueSlug", slug);
    if (code) localStorage.setItem("wd_inviteCode", code);

    // Open the venue ranker overlay
    setActiveOverlay("venueranker");

    // Clean the URL so refresh doesn’t re-trigger forever
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch {}
  // run once on initial mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  // resize listener for isMobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // auth listener + live profile image subscription
useEffect(() => {
  let unsubUserDoc: (() => void) | null = null;

  const unsubAuth = onAuthStateChanged(auth, (u) => {
    setUser(u);
    setIsAuthReady(true);

    // stop listening to previous user's doc
    if (unsubUserDoc) {
      unsubUserDoc();
      unsubUserDoc = null;
    }

    if (!u) {
      setProfileImageUrl(null);
      return;
    }

    // ✅ live sync: updates immediately after AccountScreen writes profileImage
    unsubUserDoc = onSnapshot(
      doc(db, "users", u.uid),
      (snap) => {
        const data = snap.exists() ? (snap.data() as any) : null;

        // prefer Firestore profileImage, then auth.photoURL
        setProfileImageUrl(data?.profileImage || u.photoURL || null);
      },
      (err) => {
        console.warn("⚠️ Profile image listener failed:", err);
        setProfileImageUrl(u.photoURL || null);
      }
    );
  });

  return () => {
    if (unsubUserDoc) unsubUserDoc();
    unsubAuth();
  };
}, []);

  // sync guest count (from guestCountStore)
  useEffect(() => {
    let mounted = true;

    const pull = async () => {
      const st = await getGuestState();
      if (!mounted) return;
      setGuestCountState(st.value || 0);
      setGuestLocked(!!st.locked);
      setGuestLockedBy(st.lockedBy || []);
    };

    pull(); // initial

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

  // load saved boutique steps (resume points)
  useEffect(() => {
    if (!isAuthReady) return;

    const fetchSavedSteps = async () => {
      const u = auth.currentUser;
      const ls = (k: string) => localStorage.getItem(k) || null;
      const pick = (a?: string | null, b?: string | null) =>
        a ?? b ?? null;

      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;

            const floralFS = (data.floralSavedStep as string) || null;
            const jamFS = (data.jamGrooveSavedStep as string) || null;
            const photoFS = (data.photoSavedStep as string) || null;
            const yumFS = (data.yumSavedStep as string) || null;
            const plannerFS = (data.plannerSavedStep as string) || null;
            const venueFS = (data.venueSavedStep as string) || null;

            setFloralSavedStep(pick(floralFS, ls("floralSavedStep")));
            setJamSavedStep(pick(jamFS, ls("jamGrooveStep")));
            setPhotoSavedStep(pick(photoFS, ls("photoSavedStep")));
            setYumSavedStep(pick(yumFS, ls("yumSavedStep")));
            setPlannerSavedStep(pick(plannerFS, ls("plannerSavedStep")));
            setVenueSavedStep(pick(venueFS, ls("venueSavedStep")));
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

  // listen for "openUserMenuScreen" custom events (like docs shortcut)
  useEffect(() => {
    const openMenuScreen = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail === "docs") setActiveUserMenuScreen("docs");
    };
    window.addEventListener("openUserMenuScreen", openMenuScreen);
    return () =>
      window.removeEventListener("openUserMenuScreen", openMenuScreen);
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      // Chrome fires this when install is available
      e.preventDefault();
      setDeferredInstallPrompt(e);
      setCanInstall(true);
    };
  
    window.addEventListener("beforeinstallprompt", handler);
  
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);


  // pull completion flags, totals, and guest list timing
  useEffect(() => {
    if (!isAuthReady) return;
  
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
  
        const data = docSnap.data() as any;

        // 📄 Docs “new items” alert
const docs = Array.isArray(data.documents) ? data.documents : [];
const docsLastViewedAt = data.docsLastViewedAt || null;

const newDocs = computeHasNewDocs(docs, docsLastViewedAt);
setHasDocsNotifications(newDocs);
  
        const flags = deriveCompletionFlags(data);
        console.log("[REFRESH] derived flags:", flags);
  
        setFloralCompleted(flags.floral);
        setJamGrooveComplete(flags.jam);
        setPhotoCompleted(flags.photography);
        setYumCompleted(flags.catering);
        setDessertCompleted(flags.dessert);
        setPlannerCompleted(flags.planner);
        setVenueCompleted(flags.venue);
  
        const weddingDateYMD: string | null =
  (data.weddingDate as string) ||
  data.profileData?.weddingDate ||
  null;

// 🔒 final lock + increase-request flags (top-level on user doc)
const finalLocked =
  data.guestCountFinalLocked === true;

const increaseRequested =
  typeof data.guestCountIncreaseRequested === "number"
    ? data.guestCountIncreaseRequested
    : null;

let confirmedAt: number | null = null;
try {
  const bookingRef = doc(
    db,
    "users",
    u.uid,
    "venueRankerData",
    "booking"
  );
  const bookingSnap = await getDoc(bookingRef);
  if (bookingSnap.exists()) {
    const bd = bookingSnap.data() as any;
    confirmedAt =
      typeof bd?.guestCountConfirmedAt === "number"
        ? bd.guestCountConfirmedAt
        : null;
  }
} catch (e) {
  console.warn("⚠️ Could not read guestCountConfirmedAt:", e);
}

const hasGuestDependentBooking = !!(
  flags.venue ||
  flags.catering ||
  flags.dessert ||
  flags.planner
);

// 👇 This now controls BOTH:
// - GuestCountReminderModal visibility
// - GuestListScroll tile in the Menu
setShowGuestListButton(
  shouldShowGuestScroll({
    weddingDateYMD,
    confirmedAt,
    hasGuestDependentBooking,
    finalLocked,
    increaseRequested,
  })
);
  
        // 🔹 NEW Pixie purchase load (top-level field)
const pixData: PixiePurchase[] = Array.isArray(data.pixiePurchases)
? data.pixiePurchases
: [];

setPixiePurchases(pixData);

const unpaid = pixData.some((p) => p.status === "pending");
setHasPixieNotifications(unpaid);

// 📄 Docs notification logic
setHasDocsNotifications(
  computeHasNewDocs(data.documents, data.docsLastViewedAt)
);
  
        // 💰 Mag-o-Meter totals
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
  
    window.addEventListener("purchaseMade", handleRefresh);
    window.addEventListener("cateringCompletedNow", handleRefresh);
    window.addEventListener("dessertCompletedNow", handleRefresh);
    window.addEventListener("jamCompletedNow", handleRefresh);
    window.addEventListener("budgetUpdated", handleRefresh);
    window.addEventListener("outsidePurchaseMade", handleRefresh);
    window.addEventListener("documentsUpdated", handleRefresh);
  
    handleRefresh();
  
    return () => {
      window.removeEventListener("purchaseMade", handleRefresh);
      window.removeEventListener("cateringCompletedNow", handleRefresh);
      window.removeEventListener("dessertCompletedNow", handleRefresh);
      window.removeEventListener("jamCompletedNow", handleRefresh);
      window.removeEventListener("budgetUpdated", handleRefresh);
      window.removeEventListener("outsidePurchaseMade", handleRefresh);
      window.removeEventListener("documentsUpdated", handleRefresh);
    };
  }, [isAuthReady, user]);

  // shortcut vars for showing MenuController
  const showingMenuController = activeOverlay === "menuController";
  const menuStartAt = overlayProps?.startAt as YumStep | undefined;
  if (showingMenuController) {
    console.log(
      "[Dashboard] Mounting MenuController with startAt:",
      menuStartAt
    );
  }

  function computeHasNewDocs(
    documents: any[] | undefined,
    docsLastViewedAt: any | undefined
  ) {
    const docs = Array.isArray(documents) ? documents : [];
    if (!docs.length) return false;
  
    // If they've never opened Docs before, anything counts as "new"
    if (!docsLastViewedAt) return true;
  
    const lastViewedMs =
      typeof docsLastViewedAt?.toDate === "function"
        ? docsLastViewedAt.toDate().getTime() // Firestore Timestamp
        : new Date(docsLastViewedAt).getTime(); // ISO string fallback
  
    const newestDocMs = Math.max(
      ...docs
        .map((d) => d?.uploadedAt)
        .filter(Boolean)
        .map((v) => new Date(v).getTime())
        .filter((n) => Number.isFinite(n))
    );
  
    if (!Number.isFinite(newestDocMs)) return false;
    return newestDocMs > lastViewedMs;
  }

  const isAnyOverlayOpen =
  !!activeOverlay ||
  !!overlay ||
  !!activeUserMenuScreen ||
  showLoginModal ||
  isChatOpen ||
  showGuestCountFlow ||
  showMagicCloud ||
  showAvailabilityAdmin ||
  showPixieAdmin ||
  showLogoutModal ||
  showA2HS;

  return (
    <div
    style={{
      position: "relative",
      width: "100%",
      minHeight: "100vh",
      overflowX: "hidden",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
    }}
    >
      {/* full-screen BG */}
      <picture>
        <source
          srcSet={
            isMobile
              ? `${import.meta.env.BASE_URL}assets/images/dashboard_mobile.webp`
              : `${import.meta.env.BASE_URL}assets/images/dashboard_wide.webp`
          }
          type="image/webp"
        />
        <img
          src={
            isMobile
              ? `${import.meta.env.BASE_URL}assets/images/dashboard_mobile.jpg`
              : `${import.meta.env.BASE_URL}assets/images/dashboard_wide.jpg`
          }
          alt="Background"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            zIndex: -1,
          }}
        />
      </picture>

      {/* ⭐ ADMIN TOOLS — visible ONLY to Rachel */}
{user?.email === "rachel@wedanddone.com" && (
  <>
    {/* Venue Availability button */}
    <button
      className="px-button px-button--ghost"
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        zIndex: 9999,
        opacity: 0.85,
      }}
      onClick={() => setShowAvailabilityAdmin(true)}
    >
      Venue Availability Admin
    </button>

    {/* Pixie Purchases admin button */}
    <button
      className="px-button px-button--ghost"
      style={{
        position: "absolute",
        top: 60,
        right: 20,
        zIndex: 9999,
        opacity: 0.85,
      }}
      onClick={() => setShowPixieAdmin(true)}
    >
      Pixie Purchases Admin
    </button>

    {showAvailabilityAdmin && (
      <VenueAvailabilityAdmin
        onClose={() => setShowAvailabilityAdmin(false)}
      />
    )}

    {showPixieAdmin && (
      <AdminPixiePurchasePanel
        onClose={() => setShowPixieAdmin(false)}
      />
    )}
  </>
)}

      {/* Magic/budget bubble overlay */}
      {showMagicCloud && (
        <MagicCloud
          isMobile={isMobile}
          onClose={() => setShowMagicCloud(false)}
          triggerLogin={() => {}}
          triggerSignupModal={() => setShowSignupModal(true)}
        />
      )}

      {/* USER MENU VARIANTS */}
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
  showPixiePurchases={hasPixieNotifications}
  hasDocsNotifications={hasDocsNotifications}
/>
        </>
      )}

      {activeUserMenuScreen === "account" && (
        <AccountScreen
          onClose={() => setActiveUserMenuScreen("menu")}
        />
      )}

{activeUserMenuScreen === "docs" && (
  <DocumentsScreen
    onClose={() => setActiveUserMenuScreen("menu")}
    onViewed={async () => {
      const u = auth.currentUser;
      if (!u) return;

      try {
        // ✅ mark the last time they opened Docs
        await setDoc(
          doc(db, "users", u.uid),
          { docsLastViewedAt: new Date().toISOString() },
          { merge: true }
        );
      } catch (e) {
        console.warn("⚠️ Failed to set docsLastViewedAt:", e);
      }

      // ✅ clear UI alerts immediately (don’t wait for refresh)
      setHasDocsNotifications(false);
      try {
        localStorage.setItem("wd_docs_last_viewed_at", new Date().toISOString());
      } catch {}
    }}
  />
)}

      {activeUserMenuScreen === "bookings" && (
        <Bookings
          onClose={() => setActiveUserMenuScreen(null)}
          onLaunchBoutique={handleLaunchBoutique}
        />
      )}

      {activeUserMenuScreen === "payments" && (
        <PaymentSettingsOverlay
          onClose={() => setActiveUserMenuScreen("menu")}
        />
      )}

      {/* Inline one-off overlay launcher results */}
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

    {overlay.type === "pixiePurchaseCheckout" && (
      <PixiePurchaseCheckout
        purchase={overlay.purchase}
        onClose={closeOverlay}
        onMarkPaid={() => {
          window.dispatchEvent(new Event("purchaseMade"));
          closeOverlay();
        }}
      />
    )}

{overlay.type === "menuController" && (
  <MenuController onClose={closeOverlay} startAt={overlay.startAt} />
)}
  </div>
)}

{activeUserMenuScreen === "guestListScroll" && (
  <GuestListScroll onClose={() => setActiveUserMenuScreen("menu")} />
)}

      {/* Logout "goodbye" modal */}
      {showLogoutModal && (
        <LogoutModal
          onClose={() => {
            setShowLogoutModal(false);
            window.location.reload(); // reload as guest
          }}
        />
      )}

{activeUserMenuScreen === "pixiePurchases" && (
  <PixiePurchaseCenter
    onClose={() => setActiveUserMenuScreen("menu")}
    onOpenCheckout={(purchase) => {
      setActiveUserMenuScreen(null);
      setOverlay({
        type: "pixiePurchaseCheckout",
        purchase,
      });
    }}
  />
)}
      {/* MAIN HUD + BOUTIQUE BUTTONS */}
      <DashboardButtons
        isMobile={isMobile}
        isLoggedIn={!!user}
        profileImageUrl={profileImageUrl ?? user?.photoURL ?? undefined}
        floralCompleted={floralCompleted}
        jamGrooveCompleted={jamGrooveComplete}
        photoCompleted={photoCompleted}
        cateringCompleted={yumCompleted}
        plannerCompleted={plannerCompleted}
        venueRankerCompleted={venueCompleted}
        onOpenWedAndDoneInfo={() => setActiveOverlay("wedanddoneinfo")}
        onPhotoStylerClick={() =>
          setActiveOverlay(
            photoCompleted ? "photostyler-addon" : "photostyler-initial",
            { startAt: (photoSavedStep || "intro") as any }
          )
        }
        onFloralClick={() =>
          setActiveOverlay("floralpicker-initial", {
            startAt: (floralSavedStep || "intro") as any,
          })
        }
        onJamGrooveClick={() => {
          setActiveOverlay("jamgroove", {
            startAt: (jamSavedStep as JamStep) || "intro",
          });
        }}
        onPixiePlannerClick={() =>
          setActiveOverlay("pixieplanner", {
            startAt:
              (localStorage.getItem(
                "plannerSavedStep"
              ) as string) || "intro",
          })
        }
        onVenueRankerClick={() => {
          const checkpoint = localStorage.getItem(
            "venueRankerCheckpoint"
          );
          setActiveOverlay("venueranker");
          if (checkpoint === "scroll-of-possibilities") {
            window.dispatchEvent(
              new CustomEvent("resumeVenueRankerFromScroll")
            );
          }
        }}
        onYumClick={async () => {
          console.log("🍕 Yum Yum clicked");
        
          // ✅ 0) RESUME FIRST (cart/menu/contract/etc beats "return" screens)
          const resumeStep = (() => {
            try {
              return (localStorage.getItem("yumStep") as YumStep) || null;
            } catch {
              return null;
            }
          })();
        
          const resumableSteps: YumStep[] = [
            "cateringTier",
            "cateringCuisine",
            "cateringMenu",
            "cateringCart",
            "cateringContract",
            "cateringCheckout",
            "dessertStyle",
            "dessertMenu",
            "dessertCart",
            "dessertContract",
            "dessertCheckout",
            "calendar",
            "confirm",
            "updateGuests",
            
          ];
        
          if (resumeStep && resumableSteps.includes(resumeStep)) {
            setActiveOverlay("menuController", { startAt: resumeStep });
            return;
          }
        
          const currentUser = auth.currentUser;
          let startStep: YumStep = "intro";
        
          if (currentUser) {
            try {
              const userRef = doc(db, "users", currentUser.uid);
              const userSnap = await getDoc(userRef);
              const userData = userSnap.data() as any;
        
              const hasCatering = userData?.bookings?.catering === true;
              const hasDessert = userData?.bookings?.dessert === true;
        
              if (hasCatering && !hasDessert) startStep = "returnNoDessert";
              else if (!hasCatering && hasDessert) startStep = "returnNoCatering";
              else if (hasCatering && hasDessert) startStep = "returnBothBooked";
            } catch (error) {
              console.warn("🔥 Error fetching user bookings:", error);
            }
          } else {
            const localCatering =
              localStorage.getItem("yumBookedCatering") === "true" ||
              localStorage.getItem("yumCateringBooked") === "true";
            const localDessert =
              localStorage.getItem("yumBookedDessert") === "true" ||
              localStorage.getItem("yumDessertBooked") === "true";
        
            if (localCatering && !localDessert) startStep = "returnNoDessert";
            else if (!localCatering && localDessert) startStep = "returnNoCatering";
            else if (localCatering && localDessert) startStep = "returnBothBooked";
          }
        
          const isReturn =
            startStep === "returnNoDessert" ||
            startStep === "returnNoCatering" ||
            startStep === "returnBothBooked";
        
          if (isReturn) {
            try {
              localStorage.setItem("yumStep", startStep);
            } catch {}
            setActiveOverlay("menuController", { startAt: startStep });
          } else {
            setActiveOverlay("menuController", { startAt: "intro" });
          }
        }}
        

 // 🧚 NEW:
 hasPixieNotifications={hasPixieNotifications}
 hasDocsNotifications={hasDocsNotifications}
        
        /* HUD handlers */
        onOpenMenu={() => setActiveUserMenuScreen("menu")}
        onOpenMadge={() => setIsChatOpen(true)}
        onOpenBudget={() => setShowMagicCloud(true)}
        onOpenMagicBook={() =>
          setActiveOverlay("magicbook", {
            startAt:
              (localStorage.getItem("magicStep") ||
                "intro") as any,
          })
        }
        onOpenAccount={() => {
          if (user) {
            setActiveUserMenuScreen("account"); // opens AccountScreen.tsx
          } else {
            setShowLoginModal(true);            // opens LoginModal
          }
        }}
        /* video wand tuning */
        wandScaleDesktop={0.9}
        wandNudgeXPctDesktop={-8}
        wandNudgeYPctDesktop={10.6}
        wandScaleMobile={1.1}
        wandNudgeXPctMobile={-15.3}
        wandNudgeYPctMobile={2.0}
      />

      {/* 📱 Add to Home Screen / Install */}
{showInstallIcon && (
  <>
    {/* Phone HUD icon — hide ONLY the icon when overlays are open */}
    {!isAnyOverlayOpen && (
      <button
        onClick={() => {
          // ✅ Android: trigger native install immediately if ready
          if (isAndroidInstallReady) {
            handleAndroidInstall();
            return;
          }

          // ✅ Otherwise open modal (iOS instructions or Android fallback)
          setA2hsStep("ask");
          setShowA2HS(true);
        }}
        style={{
          position: "fixed",
          left: 22,   // mirror of the blue ?
          bottom: 24, // same baseline as ?
          zIndex: 1500,
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
        }}
        aria-label="Add Wed&Done to Home Screen"
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/images/add_to_home_phone.png`}
          alt=""
          style={{
            width: "clamp(110px, 18vw, 150px)",
            height: "clamp(110px, 18vw, 150px)",
            display: "block",
            filter: "drop-shadow(0 10px 22px rgba(0,0,0,0.45))",
          }}
        />
      </button>
    )}

    {/* Modal — allowed to render EVEN when overlays are open */}
    {showA2HS && (
      <div
        onClick={() => setShowA2HS(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "14px",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 420,
            background: "rgba(255,255,255,0.96)",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
          }}
        >
          {a2hsStep === "ask" ? (
            <>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
                Want the Wed&Done app on your phone? ✨
              </div>

              <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.35 }}>
                Quick access, faster loading, and all your planning magic in one tap.
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                {/* ANDROID: real install */}
                {isAndroidInstallReady ? (
                  <button
                    className="px-button"
                    style={{ flex: 1 }}
                    onClick={handleAndroidInstall}
                  >
                    Add to Home Screen ✨
                  </button>
                ) : (
                  /* iOS: show how-to */
                  <button
                    className="px-button"
                    style={{ flex: 1 }}
                    onClick={() => setA2hsStep("howto")}
                  >
                    Yes, add it ✨
                  </button>
                )}

                <button
                  className="px-button px-button--ghost"
                  style={{ flex: 1 }}
                  onClick={() => {
                    if (isAndroid()) {
                      try {
                        localStorage.setItem(
                          "wd_android_install_dismissed",
                          "true"
                        );
                      } catch {}
                    }
                    setShowA2HS(false);
                  }}
                >
                  Not now
                </button>
              </div>

              {/* Android fallback message if not install-ready */}
              {isAndroid() && !isAndroidInstallReady && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    opacity: 0.75,
                    lineHeight: 1.35,
                  }}
                >
                  If you don’t see the “Add” button yet, Chrome hasn’t enabled
                  install for this page (usually after a refresh or a bit of
                  browsing).
                </div>
              )}
            </>
          ) : (
            <>
              {/* iOS instructions */}
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
                Quick iPhone steps
              </div>

              <ol
                style={{
                  margin: "10px 0 0 18px",
                  fontSize: 14,
                  lineHeight: 1.4,
                }}
              >
                <li>Tap the <b>Share</b> button in Safari</li>
                <li>Tap <b>Add to Home Screen</b></li>
              </ol>

              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button
                  className="px-button"
                  style={{ flex: 1 }}
                  onClick={() => {
                    try {
                      localStorage.setItem(
                        "wd_a2hs_yes_clicked",
                        "true"
                      );
                    } catch {}
                    setShowA2HS(false);
                  }}
                >
                  Got it
                </button>

                <button
                  className="px-button px-button--ghost"
                  style={{ flex: 1 }}
                  onClick={() => setShowA2HS(false)}
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
  </>
)}

      {/* Guest Count Reminder ribbon (timing logic already handled in setShowGuestListButton) */}
      <GuestCountReminderModal
  visible={showGuestListButton}
  onOpenGuestCountFlow={handleOpenGuestCountFlow}
/>

      {/* 🧪 Dev-only tools (preset loader + reset) */}
{process.env.NODE_ENV !== "production" && (
  <div
    style={{
      position: "absolute",
      bottom: "1rem",
      left: "1rem",
      zIndex: 10,
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem",
      padding: "0.75rem",
      background: "rgba(0,0,0,0.5)",
      borderRadius: "8px",
      color: "#fff",
      maxWidth: "240px",
    }}
  >

    {/* --- DEV RESET BUTTON --- */}
    <button
      style={{
        padding: "0.5rem 1rem",
        background: "#ff5555",
        color: "white",
        border: "none",
        borderRadius: "8px",
        fontWeight: "bold",
        cursor: "pointer",
        width: "100%",
      }}
      onClick={async () => {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const userRef = doc(db, "users", currentUser.uid);
          await setDoc(
            userRef,
            {
              jamGrooveCompleted: false,
              floralSigned: false,
              photoCompleted: false,
              documents: [],
              purchases: [],
              budget: 0,
            },
            { merge: true }
          );
          await signOut(auth);
        }
      
        // ✅ explicit “booked” guest flags (belt + suspenders)
        try {
          localStorage.removeItem("floralBooked");
          localStorage.removeItem("jamBooked");
          localStorage.removeItem("photoBooked");
          localStorage.removeItem("plannerBooked");
        } catch {}
      
        localStorage.clear();
        console.log("🧼 Fully reset system. Reloading as guest...");
        window.location.reload();
      }}
    >
      🧼 Start Fresh as Guest
    </button>
  </div>
)}

      {/* overlay stack driven by activeOverlay (new system) */}
      {activeOverlay === "jamgroove" && (
  <JamOverlay
    key="jamgroove"
    onClose={() => setActiveOverlay(null)}
    startAt={(overlayProps?.startAt as JamStep) || "intro"}
  />
)}

{activeOverlay === "pixiegrooveaddoncart" && (
  <JamOverlay
    mode="addon"
    onClose={() => setActiveOverlay(null)}
  />
)}

{activeOverlay === "floralpicker-initial" && (
  <FloralPickerOverlay
    mode="initial"
    onClose={() => setActiveOverlay(null)}
  />
)}

{activeOverlay === "floralpicker-addon" && (
  <FloralPickerOverlay
    mode="addon"
    onClose={() => setActiveOverlay(null)}
  />
)}

{activeOverlay === "photostyler-initial" && (
  <PhotoStylerOverlay
    mode="initial"
    onClose={() => setActiveOverlay(null)}
  />
)}

{activeOverlay === "photostyler-addon" && (
  <PhotoStylerOverlay
    mode="addon"
    onClose={() => setActiveOverlay(null)}
  />
)}

      {activeOverlay === "venueranker" && (
        <VenueRankerOverlay
          onClose={() => setActiveOverlay(null)}
        />
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
          startAt={
            (overlayProps?.startAt as
              | "intro"
              | "calendar"
              | "contract"
              | "checkout"
              | "thankyou"
              | "explainer"
              | "guestcount") || "intro"
          }
        />
      )}

      {activeOverlay === "magicbook" && (
        <MagicBookOverlay
          setActiveOverlay={setActiveOverlay}
          startAt="intro"
        />
      )}

      {activeOverlay === "wedanddoneinfo" && (
        <WedAndDoneOverlay
          onClose={() => setActiveOverlay(null)}
        />
      )}

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {isChatOpen && (
        <MadgeChatModal
          onClose={() => setIsChatOpen(false)}
        />
      )}

      {/* Guest count flow via reminder badge */}
      {showGuestCountFlow && (
        <GuestListScroll
          onClose={() => {
            setShowGuestCountFlow(false);
            // optional: setActiveUserMenuScreen("menu");
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;