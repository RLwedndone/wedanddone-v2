// src/components/DashboardButtons.tsx
import ResponsiveStage, { Hotspot } from "./layouts/ResponsiveStage";
import {
  DESKTOP_ASPECT,
  MOBILE_ASPECT,
  DESKTOP_POS,
  MOBILE_POS,
} from "./layouts/dashboardPositions";
import { useMagometerTotals } from "./MagOMeter/useMagometerTotals";
import React, { useMemo, useState, useEffect } from "react";
import "./DashboardButtons.css";
import { track, trackBoutiqueOpened } from "../utils/analytics";

interface DashboardButtonsProps {
  isMobile: boolean;
  isLoggedIn: boolean;
  profileImageUrl?: string;

  onFloralClick: () => void;
  floralCompleted: boolean;

  onJamGrooveClick?: () => void;
  jamGrooveCompleted?: boolean;

  onPhotoStylerClick?: () => void;
  photoCompleted?: boolean;

  onVenueRankerClick: () => void;

  onYumClick: () => void;
  cateringCompleted?: boolean;

  plannerCompleted?: boolean;
  venueRankerCompleted?: boolean;

  onPixiePlannerClick: () => void;

  hasPixieNotifications?: boolean;
  hasDocsNotifications?: boolean;

  onOpenWedAndDoneInfo?: () => void;

  // HUD handlers
  onOpenMenu?: () => void;
  onOpenMadge?: () => void;
  onOpenBudget?: () => void;
  onOpenMagicBook?: () => void;

  // ✅ Dedicated account handler (opens AccountScreen modal)
  onOpenAccount: () => void;

  /** Percent-based tuning so it scales with the stage */
  wandScaleDesktop?: number;
  wandScaleMobile?: number;
  wandNudgeXPctDesktop?: number;
  wandNudgeYPctDesktop?: number;
  wandNudgeXPctMobile?: number;
  wandNudgeYPctMobile?: number;
}

// --- venue-agnostic yum completion check (catering) ---
const readYumCompletedLS = () => {
  try {
    const explicit =
      localStorage.getItem("schnepfCateringBooked") === "true" ||
      localStorage.getItem("vvCateringBooked") === "true" ||
      localStorage.getItem("batesCateringBooked") === "true" ||
      localStorage.getItem("yumYumCompleted") === "true";

    if (explicit) return true;

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      if (/cateringBooked/i.test(k) && localStorage.getItem(k) === "true") {
        return true;
      }
    }
  } catch {}
  return false;
};

// --- dessert-only completion check (venue-agnostic) ---
const readDessertCompletedLS = () => {
  try {
    const explicit =
      localStorage.getItem("schnepfDessertBooked") === "true" ||
      localStorage.getItem("vvDessertBooked") === "true" ||
      localStorage.getItem("batesDessertBooked") === "true" ||
      localStorage.getItem("yumDessertBooked") === "true";

    if (explicit) return true;

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      if (/dessertBooked/i.test(k) && localStorage.getItem(k) === "true") {
        return true;
      }
    }
  } catch {}
  return false;
};

// --- which Yum step was completed last? ("catering" | "dessert") ---
const readYumLastCompleted = (): "catering" | "dessert" | null => {
  try {
    const v = localStorage.getItem("yumLastCompleted");
    return v === "catering" || v === "dessert" ? v : null;
  } catch {}
  return null;
};

const DashboardButtons: React.FC<DashboardButtonsProps> = ({
  isMobile,
  isLoggedIn,
  profileImageUrl,

  onFloralClick,
  floralCompleted,
  onJamGrooveClick,
  jamGrooveCompleted,
  onPhotoStylerClick,
  photoCompleted,
  onVenueRankerClick,
  onYumClick,
  cateringCompleted,
  plannerCompleted,
  venueRankerCompleted,
  onPixiePlannerClick,
  onOpenWedAndDoneInfo = () => {},
  onOpenAccount,

  onOpenMenu = () => {},
  onOpenMadge = () => {},
  onOpenBudget = () => {},
  onOpenMagicBook = () => {},
  hasDocsNotifications = false,
  hasPixieNotifications = false,
  
}) => {
  // ✅ Use the prop, not auth.currentUser (avoids auth race + double-icons)
  const loggedIn = isLoggedIn;

  const device = isMobile ? "mobile" : "desktop";

const trackHudClick = (item: string) => {
  track("hud_click", { item, device, logged_in: loggedIn });
};

const trackBoutiqueClick = (boutique: string) => {
  trackBoutiqueOpened(boutique);
  track("boutique_click", { boutique, device, logged_in: loggedIn });
};

  const bg = isMobile
    ? `${import.meta.env.BASE_URL}assets/images/dashboard_bg_mobile.jpg`
    : `${import.meta.env.BASE_URL}assets/images/dashboard_bg_desktop.jpg`;

  const aspect = isMobile ? MOBILE_ASPECT : DESKTOP_ASPECT;
  const POS = isMobile ? MOBILE_POS : DESKTOP_POS;

  const DEFAULT_AVATAR = `${import.meta.env.BASE_URL}assets/images/profile_placeholder.png`;

  // 1) Live totals (Firestore)
  const { totalBudget: liveBudget, totalSpent: liveSpent } = useMagometerTotals();

  const [yumCompletedLocal, setYumCompletedLocal] = useState(readYumCompletedLS);
  const [dessertCompletedLocal, setDessertCompletedLocal] = useState(readDessertCompletedLS);
  const [yumLastCompleted, setYumLastCompleted] = useState<"catering" | "dessert" | null>(
    readYumLastCompleted
  );

  // ✨ One-time “click me” glow for the logo cloud (per device)
  const [logoIntroGlow, setLogoIntroGlow] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem("wd_seen_logo_glow");
      if (!seen) {
        setLogoIntroGlow(true);

        const t = window.setTimeout(() => {
          setLogoIntroGlow(false);
          localStorage.setItem("wd_seen_logo_glow", "true");
        }, 4000);

        return () => window.clearTimeout(t);
      }
    } catch {}
  }, []);

  // keep catering "done" in sync with LS + events (legacy + generic)
  useEffect(() => {
    const update = () => setYumCompletedLocal(readYumCompletedLS());
    window.addEventListener("purchaseMade", update);
    window.addEventListener("cateringCompletedNow", update);
    window.addEventListener("yum:booked", update);
    return () => {
      window.removeEventListener("purchaseMade", update);
      window.removeEventListener("cateringCompletedNow", update);
      window.removeEventListener("yum:booked", update);
    };
  }, []);

  // listen for dessert completion + last-completed breadcrumbs
  useEffect(() => {
    const updateDessertFromLS = () => setDessertCompletedLocal(readDessertCompletedLS());
    const updateLastFromLS = () => setYumLastCompleted(readYumLastCompleted());

    const onDessertNow = () => {
      setDessertCompletedLocal(true);
      setYumLastCompleted("dessert");
      try {
        localStorage.setItem("yumDessertBooked", "true");
        localStorage.setItem("yumLastCompleted", "dessert");
      } catch {}
    };

    const onCateringNow = () => {
      setYumLastCompleted("catering");
      try {
        localStorage.setItem("yumLastCompleted", "catering");
      } catch {}
    };

    window.addEventListener("purchaseMade", updateDessertFromLS);
    window.addEventListener("dessertCompletedNow", onDessertNow);
    window.addEventListener("yum:dessertBooked", updateDessertFromLS);

    window.addEventListener("cateringCompletedNow", onCateringNow);
    window.addEventListener("yum:lastCompleted", updateLastFromLS);

    return () => {
      window.removeEventListener("purchaseMade", updateDessertFromLS);
      window.removeEventListener("dessertCompletedNow", onDessertNow);
      window.removeEventListener("yum:dessertBooked", updateDessertFromLS);

      window.removeEventListener("cateringCompletedNow", onCateringNow);
      window.removeEventListener("yum:lastCompleted", updateLastFromLS);
    };
  }, []);

  // 2) LocalStorage fallback (for guests) — init synchronously to avoid PNG flash
  const [lsBudget, setLsBudget] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem("magicBudget") || "0", 10);
    } catch {
      return 0;
    }
  });

  const [lsOutsideSpent, setLsOutsideSpent] = useState<number>(() => {
    try {
      const arr = JSON.parse(localStorage.getItem("outsidePurchases") || "[]");
      return Array.isArray(arr)
        ? arr.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
        : 0;
    } catch {
      return 0;
    }
  });

  // keep LS values in sync when things change
  useEffect(() => {
    const pull = () => {
      try {
        setLsBudget(parseInt(localStorage.getItem("magicBudget") || "0", 10));
        const arr = JSON.parse(localStorage.getItem("outsidePurchases") || "[]");
        setLsOutsideSpent(
          Array.isArray(arr)
            ? arr.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
            : 0
        );
      } catch {}
    };

    pull();
    window.addEventListener("purchaseMade", pull);
    window.addEventListener("outsidePurchaseMade", pull);
    window.addEventListener("budgetUpdated", pull);

    return () => {
      window.removeEventListener("purchaseMade", pull);
      window.removeEventListener("outsidePurchaseMade", pull);
      window.removeEventListener("budgetUpdated", pull);
    };
  }, []);

  // 3) Choose ONE source of truth to avoid double counting
  const hasLive = (liveBudget ?? 0) > 0 || (liveSpent ?? 0) > 0;
  const totalBudgetForWand = hasLive ? (liveBudget ?? 0) : lsBudget;
  const totalSpentForWand = hasLive ? (liveSpent ?? 0) : lsOutsideSpent;

  // 🔮 Pick the correct wand PNG based on % spent
  const percent =
    totalBudgetForWand > 0 ? (totalSpentForWand / totalBudgetForWand) * 100 : 0;

  const BASE = import.meta.env.BASE_URL || "/";
  const wandIconSrc =
    percent >= 100
      ? `${BASE}assets/images/wand_100.png`
      : percent >= 75
      ? `${BASE}assets/images/wand_75.png`
      : percent >= 50
      ? `${BASE}assets/images/wand_50.png`
      : percent >= 25
      ? `${BASE}assets/images/wand_25.png`
      : totalSpentForWand > 0
      ? `${BASE}assets/images/wandfirst.png`
      : `${BASE}assets/images/budget_wand.png`;

  // Icons
  const ICONS = {
    madge: `${import.meta.env.BASE_URL}assets/images/madgeGuide.png`,
    menu:
      hasPixieNotifications || hasDocsNotifications
        ? `${import.meta.env.BASE_URL}assets/images/golden_menu_tab_alert.png`
        : `${import.meta.env.BASE_URL}assets/images/golden_menu_tab.png`,
    goldKey: `${import.meta.env.BASE_URL}assets/images/gold_key.png`,
    budgetWand: wandIconSrc,
    magicBook: `${import.meta.env.BASE_URL}assets/images/magic_book.png`,
    logoCloud: `${import.meta.env.BASE_URL}assets/images/logo_cloud.png`,
      // Social
  facebook: `${import.meta.env.BASE_URL}assets/images/social/FB.png`,
  instagram: `${import.meta.env.BASE_URL}assets/images/social/IG.png`,
  youtube: `${import.meta.env.BASE_URL}assets/images/social/YouTube.png`,
  tiktok: `${import.meta.env.BASE_URL}assets/images/social/TikTok.png`,

    venue: venueRankerCompleted
      ? `${import.meta.env.BASE_URL}assets/images/completed_venue_button.png`
      : `${import.meta.env.BASE_URL}assets/images/venue_ranker_button_start_here.png`,

    photo: photoCompleted
      ? `${import.meta.env.BASE_URL}assets/images/completed_photo_button.png`
      : `${import.meta.env.BASE_URL}assets/images/photo_style_button.png`,

    floral: floralCompleted
      ? `${import.meta.env.BASE_URL}assets/images/completed_floral_button.png`
      : `${import.meta.env.BASE_URL}assets/images/floral_picker_button.png`,

    yum:
      dessertCompletedLocal || cateringCompleted || yumCompletedLocal
        ? yumLastCompleted === "dessert"
          ? `${import.meta.env.BASE_URL}assets/images/completed_dessert_button.png`
          : yumLastCompleted === "catering"
          ? `${import.meta.env.BASE_URL}assets/images/completed_catering_button.png`
          : dessertCompletedLocal
          ? `${import.meta.env.BASE_URL}assets/images/completed_dessert_button.png`
          : `${import.meta.env.BASE_URL}assets/images/completed_catering_button.png`
        : `${import.meta.env.BASE_URL}assets/images/yum_yum_button.png`,

    jam: jamGrooveCompleted
      ? `${import.meta.env.BASE_URL}assets/images/completed_jam_button.png`
      : `${import.meta.env.BASE_URL}assets/images/jam_groove_button.png`,

    planner: plannerCompleted
      ? `${import.meta.env.BASE_URL}assets/images/completed_planner_button.png`
      : `${import.meta.env.BASE_URL}assets/images/planner_button.png`,
  };

  // Hotspots
  const hotspots: Hotspot[] = useMemo(() => {
    const hs: Hotspot[] = [];

    hs.push(
      {
        id: "hud-madge",
        ...POS.hud.madge,
        iconSrc: ICONS.madge,
        onClick: () => {
          trackHudClick("madge");
          onOpenMadge();
        },
        zIndex: 3,
      },
      {
        id: "hud-menu",
        ...POS.hud.menu,
        iconSrc: ICONS.menu,
        onClick: () => {
          trackHudClick("menu");
          onOpenMenu();
        },
        zIndex: 3,
      },
    
      // ✅ Auth indicator:
      ...(loggedIn
        ? [
            {
              id: "hud-avatar",
              ...POS.hud.avatar,
              iconSrc: profileImageUrl || DEFAULT_AVATAR,
              onClick: () => {
                trackHudClick("account");
                onOpenAccount();
              },
              zIndex: 4,
              className: "hud-avatar",
            },
          ]
        : [
            {
              id: "hud-goldkey",
              ...POS.hud.avatar,
              iconSrc: ICONS.goldKey,
              onClick: () => {
                trackHudClick("account");
                onOpenAccount();
              },
              zIndex: 3,
              className: "hud-avatar",
            },
          ]),
    
      {
        id: "hud-wand",
        ...POS.hud.budgetWand,
        iconSrc: ICONS.budgetWand,
        onClick: () => {
          trackHudClick("budget_wand");
          onOpenBudget();
        },
        zIndex: 3,
      },
      {
        id: "hud-book",
        ...POS.hud.magicBook,
        iconSrc: ICONS.magicBook,
        onClick: () => {
          trackHudClick("magic_book");
          onOpenMagicBook();
        },
        zIndex: 3,
      },
      {
        id: "hud-logo",
        ...POS.hud.logoCloud,
        iconSrc: ICONS.logoCloud,
        className: logoIntroGlow ? "logoIntroGlow" : "",
        onClick: () => {
          trackHudClick("logo_cloud");
          setLogoIntroGlow(false);
          try {
            localStorage.setItem("wd_seen_logo_glow", "true");
          } catch {}
          onOpenWedAndDoneInfo();
        },
        zIndex: 5,
      },

      // ✅ Social icons
      {
        id: "hud-facebook",
        ...POS.hud.facebook,
        iconSrc: ICONS.facebook,
        onClick: () => {
          trackHudClick("facebook");
          window.open("https://www.facebook.com/wedndone", "_blank", "noopener,noreferrer");
        },
        zIndex: 3,
      },
      {
        id: "hud-instagram",
        ...POS.hud.instagram,
        iconSrc: ICONS.instagram,
        onClick: () => {
          trackHudClick("instagram");
          window.open("https://www.instagram.com/wed_and_done", "_blank", "noopener,noreferrer");
        },
        zIndex: 3,
      },
      {
        id: "hud-youtube",
        ...POS.hud.youtube,
        iconSrc: ICONS.youtube,
        onClick: () => {
          trackHudClick("youtube");
          window.open("https://www.youtube.com/@weddone9267", "_blank", "noopener,noreferrer");
        },
        zIndex: 3,
      },
      {
        id: "hud-tiktok",
        ...POS.hud.tiktok,
        iconSrc: ICONS.tiktok,
        onClick: () => {
          trackHudClick("tiktok");
          window.open("https://www.tiktok.com/@wedndone", "_blank", "noopener,noreferrer");
        },
        zIndex: 3,
      },

    );

    // Boutiques
    hs.push(
      {
        id: "btn-venue",
        ...POS.boutiques.venue,
        iconSrc: ICONS.venue,
        className: venueRankerCompleted ? "" : "featured-venue", // ✅ ADD THIS
        onClick: () => {
          console.log("🔥 VENUE BUTTON CLICKED (DashboardButtons)");
      
          console.log("gtag exists?", typeof (window as any).gtag);
          console.log(
            "dataLayer exists?",
            Array.isArray((window as any).dataLayer),
            (window as any).dataLayer
          );
      
          try {
            (window as any).gtag("event", "venue_ranker_opened", {
              debug_mode: true,
              engagement_time_msec: 1000,
            });
            console.log("✅ gtag event call executed");
          } catch (e) {
            console.error("❌ gtag call failed", e);
          }
      
          trackBoutiqueClick("venue_ranker");
          onVenueRankerClick();
        },
      },
      {
        id: "btn-photo",
        ...POS.boutiques.photo,
        iconSrc: ICONS.photo,
        onClick: () => {
          trackBoutiqueClick("photo_styler");
          onPhotoStylerClick?.();
        },
      },
      {
        id: "btn-floral",
        ...POS.boutiques.floral,
        iconSrc: ICONS.floral,
        onClick: () => {
          trackBoutiqueClick("floral_picker");
          onFloralClick();
        },
      },
      {
        id: "btn-yum",
        ...POS.boutiques.yum,
        iconSrc: ICONS.yum,
        onClick: () => {
          trackBoutiqueClick("yum_yum");
          onYumClick();
        },
      },
      {
        id: "btn-jam",
        ...POS.boutiques.jam,
        iconSrc: ICONS.jam,
        onClick: () => {
          trackBoutiqueClick("jam_groove");
          onJamGrooveClick?.();
        },
      },
      {
        id: "btn-planner",
        ...POS.boutiques.planner,
        iconSrc: ICONS.planner,
        onClick: () => {
          trackBoutiqueClick("pixie_planner");
          onPixiePlannerClick();
        },
      },
    );

    return hs;
  }, [
    POS,
    ICONS,
    loggedIn,
    profileImageUrl,
    onOpenMadge,
    onOpenMenu,
    onOpenBudget,
    onOpenMagicBook,
    onOpenAccount,
    onVenueRankerClick,
    onPhotoStylerClick,
    onFloralClick,
    onYumClick,
    onJamGrooveClick,
    onPixiePlannerClick,
    logoIntroGlow,
  ]);

  return (
    <div style={{ position: "relative" }}>
      <ResponsiveStage bg={bg} aspectW={aspect.w} aspectH={aspect.h} hotspots={hotspots} />
    </div>
  );
};

export default DashboardButtons;