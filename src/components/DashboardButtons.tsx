import { useNavigate } from "react-router-dom";
import { auth } from "../firebase/firebaseConfig";
import ResponsiveStage, { Hotspot } from "./layouts/ResponsiveStage";
import {
  DESKTOP_ASPECT,
  MOBILE_ASPECT,
  DESKTOP_POS,
  MOBILE_POS,
} from "./layouts/dashboardPositions";
import WandMagicMeter from "./MagOMeter/WandMagicMeter";
import { useMagometerTotals } from "./MagOMeter/useMagometerTotals";
import React, { useMemo, useState, useEffect } from "react";

interface DashboardButtonsProps {
  isMobile: boolean;

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

  // HUD handlers
  onOpenMenu?: () => void;
  onOpenMadge?: () => void;
  onOpenBudget?: () => void;
  onOpenMagicBook?: () => void;
  onOpenLogin: () => void;

  /** Percent-based tuning so it scales with the stage */
  wandScaleDesktop?: number;     // 1 = HUD widthPct
  wandScaleMobile?: number;
  wandNudgeXPctDesktop?: number; // +/- % from leftPct
  wandNudgeYPctDesktop?: number; // +/- % from topPct
  wandNudgeXPctMobile?: number;
  wandNudgeYPctMobile?: number;
}

// --- venue-agnostic yum completion check ---
const readYumCompletedLS = () => {
  try {
    // explicit known flags
    const explicit =
      localStorage.getItem("schnepfCateringBooked") === "true" ||
      localStorage.getItem("vvCateringBooked") === "true" ||
      localStorage.getItem("batesCateringBooked") === "true" ||
      localStorage.getItem("yumYumCompleted") === "true";

    if (explicit) return true;

    // generic catch-all: any key like "*cateringBooked"
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      if (/cateringBooked/i.test(k) && localStorage.getItem(k) === "true") {
        return true;
      }
    }
  } catch {}
  return false;
};

const DashboardButtons: React.FC<DashboardButtonsProps> = ({
  isMobile,
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
  onOpenLogin,

  onOpenMenu = () => {},
  onOpenMadge = () => {},
  onOpenBudget = () => {},
  onOpenMagicBook = () => {},

  // percent-based defaults (scale around the HUD slot)
  wandScaleDesktop = 1,
  wandScaleMobile = 1,
  wandNudgeXPctDesktop = 0,
  wandNudgeYPctDesktop = 0,
  wandNudgeXPctMobile = 0,
  wandNudgeYPctMobile = 0,
}) => {
  const navigate = useNavigate();
  const loggedIn = !!auth.currentUser;

  const bg = isMobile
  ? `${import.meta.env.BASE_URL}assets/images/dashboard_bg_mobile.jpg`
  : `${import.meta.env.BASE_URL}assets/images/dashboard_bg_desktop.jpg`;
  const aspect = isMobile ? MOBILE_ASPECT : DESKTOP_ASPECT;
  const POS = isMobile ? MOBILE_POS : DESKTOP_POS;

  // 1) Live totals (Firestore)
  const { totalBudget: liveBudget, totalSpent: liveSpent } = useMagometerTotals();

  // 2) LocalStorage fallback (for guests)
  const [lsBudget, setLsBudget] = useState(0);
  const [lsOutsideSpent, setLsOutsideSpent] = useState(0);

  const [yumCompletedLocal, setYumCompletedLocal] = useState(readYumCompletedLS);

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

  useEffect(() => {
    const pull = () => {
      const b = parseInt(localStorage.getItem("magicBudget") || "0", 10);
      const outside = JSON.parse(localStorage.getItem("outsidePurchases") || "[]");
      const outsideSum = outside.reduce(
        (sum: number, p: any) => sum + Number(p.amount || 0),
        0
      );
      setLsBudget(b);
      setLsOutsideSpent(outsideSum);
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
  const totalSpentForWand  = hasLive ? (liveSpent  ?? 0) : lsOutsideSpent;
  const videoOn = totalBudgetForWand > 0 && totalSpentForWand > 0;

  // (optional) debug
  useEffect(() => {
    console.log("🪄 Wand gate", {
      liveBudget, liveSpent, lsBudget, lsOutsideSpent,
      hasLive, totalBudgetForWand, totalSpentForWand, videoOn,
    });
  }, [liveBudget, liveSpent, lsBudget, lsOutsideSpent, hasLive, totalBudgetForWand, totalSpentForWand, videoOn]);

  // Icons
  const ICONS = {
    madge: `${import.meta.env.BASE_URL}assets/images/question_mark.png`,
    menu: `${import.meta.env.BASE_URL}assets/images/golden_menu_tab.png`,
    goldKey: `${import.meta.env.BASE_URL}assets/images/gold_key.png`,
    budgetWand: `${import.meta.env.BASE_URL}assets/images/budget_wand.png`,
    magicBook: `${import.meta.env.BASE_URL}assets/images/magic_book.png`,
  
    // ✅ BASE_URL so it works under /wedanddone-v2/
    logoCloud: `${import.meta.env.BASE_URL}assets/images/logo_cloud.png`,
  
    venue: venueRankerCompleted
      ? `${import.meta.env.BASE_URL}assets/images/completed_venue_button.png`
      : `${import.meta.env.BASE_URL}assets/images/venue_ranker_button_start_here.png`,
  
    photo: photoCompleted
      ? `${import.meta.env.BASE_URL}assets/images/completed_photo_button.png`
      : `${import.meta.env.BASE_URL}assets/images/photo_style_button.png`,
  
    floral: floralCompleted
      ? `${import.meta.env.BASE_URL}assets/images/completed_floral_button.png`
      : `${import.meta.env.BASE_URL}assets/images/floral_picker_button.png`,
  
    yum: (cateringCompleted || yumCompletedLocal)
      ? `${import.meta.env.BASE_URL}assets/images/completed_yum_button.png`
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
      { id: "hud-madge", ...POS.hud.madge, iconSrc: ICONS.madge, onClick: onOpenMadge, zIndex: 3 },
      { id: "hud-menu", ...POS.hud.menu, iconSrc: ICONS.menu, onClick: onOpenMenu, zIndex: 3 },
      ...(loggedIn
        ? []
        : ([
            {
              id: "hud-goldkey",
              ...POS.hud.goldKey,
              iconSrc: ICONS.goldKey,
              onClick: onOpenLogin,
              zIndex: 3,
            },
          ] as Hotspot[])),
      // PNG wand only if video not ready
      ...(!videoOn
        ? ([
            {
              id: "hud-wand",
              ...POS.hud.budgetWand,
              iconSrc: ICONS.budgetWand,
              onClick: onOpenBudget,
              zIndex: 3,
            },
          ] as Hotspot[])
        : []),
      { id: "hud-book", ...POS.hud.magicBook, iconSrc: ICONS.magicBook, onClick: onOpenMagicBook, zIndex: 3 },
      { id: "hud-logo", ...POS.hud.logoCloud, iconSrc: ICONS.logoCloud, onClick: () => window.dispatchEvent(new CustomEvent("openOverlay", { detail: "wedanddoneinfo" })), zIndex: 5 }
    );

    // Boutiques
    hs.push(
      { id: "btn-venue", ...POS.boutiques.venue, iconSrc: ICONS.venue, onClick: onVenueRankerClick },
      { id: "btn-photo", ...POS.boutiques.photo, iconSrc: ICONS.photo, onClick: onPhotoStylerClick || (() => {}) },
      { id: "btn-floral", ...POS.boutiques.floral, iconSrc: ICONS.floral, onClick: onFloralClick },
      { id: "btn-yum", ...POS.boutiques.yum, iconSrc: ICONS.yum, onClick: onYumClick },
      { id: "btn-jam", ...POS.boutiques.jam, iconSrc: ICONS.jam, onClick: onJamGrooveClick || (() => {}) },
      { id: "btn-planner", ...POS.boutiques.planner, iconSrc: ICONS.planner, onClick: onPixiePlannerClick }
    );

    return hs;
  }, [POS, ICONS, loggedIn, onOpenMadge, onOpenMenu, onOpenBudget, onOpenMagicBook, onOpenLogin,
      onVenueRankerClick, onPhotoStylerClick, onFloralClick, onYumClick, onJamGrooveClick, onPixiePlannerClick, navigate, videoOn]);

  // ---- position the VIDEO wand using the same HUD slot, in % so it scales ----
  const slotTopPct   = typeof POS.hud.budgetWand.topPct   === "number" ? POS.hud.budgetWand.topPct   : 2;
  const slotLeftPct  = typeof POS.hud.budgetWand.leftPct  === "number" ? POS.hud.budgetWand.leftPct  : 2;
  const slotWidthPct = typeof POS.hud.budgetWand.widthPct === "number" ? POS.hud.budgetWand.widthPct : 12;

  const nudgeXPct = isMobile ? wandNudgeXPctMobile : wandNudgeXPctDesktop;
  const nudgeYPct = isMobile ? wandNudgeYPctMobile : wandNudgeYPctDesktop;
  const scaleMult = isMobile ? wandScaleMobile     : wandScaleDesktop;

  const wandTopPct   = slotTopPct   + nudgeYPct;
  const wandLeftPct  = slotLeftPct  + nudgeXPct;
  const wandWidthPct = slotWidthPct * scaleMult;

  return (
    <div style={{ position: "relative" }}>
      <ResponsiveStage bg={bg} aspectW={aspect.w} aspectH={aspect.h} hotspots={hotspots} />

      {/* video wand overlays PNG slot once purchases+budget exist */}
      {videoOn && (
        <div
          style={{
            position: "absolute",
            top:  `${wandTopPct}%`,
            left: `${wandLeftPct}%`,
            width:`${wandWidthPct}%`,
            zIndex: 10,
            pointerEvents: "auto",
          }}
        >
          <WandMagicMeter
            totalSpent={totalSpentForWand}
            totalBudget={totalBudgetForWand}
            onClick={onOpenBudget}
          />
        </div>
      )}
    </div>
  );
};

export default DashboardButtons;