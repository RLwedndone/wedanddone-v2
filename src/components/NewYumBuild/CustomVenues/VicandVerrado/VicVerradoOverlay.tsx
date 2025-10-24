// src/components/NewYumBuild/CustomVenues/VicandVerrado/VicVerradoOverlay.tsx
import React, { useEffect, useRef, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

// Hooks
import { useOverlayOpen } from "../../../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../../../hooks/useScrollToTop";

// ── Catering screens ─────────────────────────────────────────
import VicVerradoIntro from "./VicVerradoIntro";
import FlowerTierSelector, {
  type FlowerTierId,
  type FlowerTierSelection,
} from "./FlowerTierSelector";
import VicVerradoMenuBuilderCatering, {
  type VicVerradoMenuSelections as VVSelections,
} from "./VicVerradoMenuBuilder";
import VicVerradoCartCatering from "./VicVerradoCartCatering";
import VicVerradoContractCatering from "./VicVerradoContractCatering";
import VicVerradoCheckOutCatering from "./VicVerradoCheckOutCatering";

// NEW: Linear thank-you screens
import VicVerradoCateringThankYou from "./VicVerradoCateringThankYou";
import VicVerradoDessertThankYou from "./VicVerradoDessertThankYou";
import VicVerradoBothDoneThankYou from "./VicVerradoBothDoneThankYou";

// ── Local Dessert flow (Vic/Verrado) ─────────────────────────
import VicVerradoDessertType from "./VicVerradoDessertSelector";
import VicVerradoDessertMenu from "./VicVerradoDessertMenu";
import VicVerradoDessertCart from "./VicVerradoDessertCart";
import VicVerradoDessertContract from "./VicVerradoDessertContract";
import VicVerradoDessertCheckout from "./VicVerradoDessertCheckout";

// ---------------- Types & constants ----------------
export type VicVerradoStep =
  | "intro"
  | "tier"
  | "menu"
  | "vicVerradoCart"
  | "vicVerradoContract"
  | "vicVerradoCheckout"
  | "vicVerradoCateringThankYou" // NEW
  | "vicVerradoDessertThankYou"  // NEW
  | "vicVerradoBothDoneThankYou" // NEW
  | "dessertStyle"
  | "dessertMenu"
  | "dessertCart"
  | "dessertContract"
  | "dessertCheckout";

type VenueName = "The Vic" | "The Verrado";

const STORAGE = {
  step: "yumStep",
  tierLabel: "vicVerradoFlowerTier",
  perGuest: "vicVerradoPerGuest",
  guestCount: "vicVerradoGuestCount",
};

const PRETTY_TIER: Record<FlowerTierId, "Sunflower" | "Rose" | "Lily" | "Dahlia"> = {
  sunflower: "Sunflower",
  rose: "Rose",
  lily: "Lily",
  dahlia: "Dahlia",
};

// ---------------- Component ----------------
interface Props {
  onClose: () => void;
  startAt?: VicVerradoStep;
}

const VicVerradoOverlay: React.FC<Props> = ({ onClose, startAt = "intro" }) => {
  // UI
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<VicVerradoStep>(startAt);
  useEffect(() => console.log("[VV][Overlay] step ->", step), [step]);

  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([step], { targetRef: cardRef });

  // Venue label for copy
  const [venueName, setVenueName] = useState<VenueName>("The Vic");

  // Catering selections
  const [tierSel, setTierSel] = useState<FlowerTierSelection | null>(null);
  const [menuSelections, setMenuSelections] = useState<VVSelections>({
    tier: "sunflower",
    hors: [],
    salads: [],
    entrees: [],
    starch: [],
    veg: [],
  });

  // Totals / contract
  const [total, setTotal] = useState<number>(0);
  const [lineItems, setLineItems] = useState<string[]>([]);
  const [paymentSummaryText, setPaymentSummaryText] = useState<string>("");

  // Signature state
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);

  // Date labels
  const [userWeddingDate, setUserWeddingDate] = useState<string | null>(null);
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null);

  const [guestCount] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(STORAGE.guestCount) || 0);
    } catch {
      return 0;
    }
  });

  // 🍰 Local Dessert flow state
  type DessertType = "tieredCake" | "smallCakeTreats" | "treatsOnly";
  const [dessertType, setDessertType] = useState<DessertType>(
    (localStorage.getItem("yumDessertType") as DessertType) || "tieredCake"
  );
  const [flavorFilling, setFlavorFilling] = useState<string[]>(
    (() => {
      try {
        return JSON.parse(localStorage.getItem("yumDessertFlavorFilling") || "[]");
      } catch {
        return [];
      }
    })()
  );
  const [cakeStyle, setCakeStyle] = useState<string>("");
  const [treatType, setTreatType] = useState<"" | "cupcakes" | "goodies">("");
  const [goodies, setGoodies] = useState<string[]>([]);
  const [cupcakes, setCupcakes] = useState<string[]>([]);

  // --------- Boot: hydrate venue + progress + date ----------
  useEffect(() => {
    const auth = getAuth();

    const allowedPreCatering: VicVerradoStep[] = [
      "intro",
      "tier",
      "menu",
      "vicVerradoCart",
      "vicVerradoContract",
      "vicVerradoCheckout",
    ];

    const dessertStepsLinear: VicVerradoStep[] = [
      "dessertStyle",
      "dessertMenu",
      "dessertCart",
      "dessertContract",
      "dessertCheckout",
      "vicVerradoDessertThankYou",
    ];

    const unsub = onAuthStateChanged(auth, async (user) => {
      console.log("[VV][Overlay] onAuthStateChanged user:", !!user);
      if (!user) {
        setStep("intro");
        setLoading(false);
        window.scrollTo(0, 0);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        const data = (snap.data() || {}) as any;

        // Venue detection
        const vName =
          data?.bookings?.venueName ||
          data?.venueName ||
          data?.venueRankerData?.booking?.venueName ||
          data?.selectedVenueName ||
          "";
        setVenueName(/verrado/i.test(vName) ? "The Verrado" : "The Vic");

        // Wedding date labels
        const fsDate = data?.weddingDate || data?.profileData?.weddingDate || null;
        const dayOfWeek = data?.dayOfWeek || null;
        if (fsDate) {
          setUserWeddingDate(fsDate);
          setUserDayOfWeek(dayOfWeek || null);
          try {
            localStorage.setItem("yumSelectedDate", fsDate);
            if (dayOfWeek) localStorage.setItem("yumSelectedDayOfWeek", dayOfWeek);
          } catch {}
        }

        // Resume logic (linear)
        const hasCatering =
          !!data?.bookings?.catering || localStorage.getItem("vvCateringBooked") === "true";
        const hasDessert =
          !!data?.bookings?.dessert || localStorage.getItem("vvDessertsBooked") === "true";

        let next: VicVerradoStep;

        if (hasCatering && hasDessert) {
          next = "vicVerradoBothDoneThankYou";
        } else if (hasCatering) {
          const fsStep = data?.progress?.yumYum?.step as VicVerradoStep | undefined;
          const lsStep = (localStorage.getItem(STORAGE.step) || "") as VicVerradoStep;

          if (fsStep && dessertStepsLinear.includes(fsStep)) next = fsStep;
          else if (lsStep && dessertStepsLinear.includes(lsStep)) next = lsStep;
          else next = "vicVerradoCateringThankYou";
        } else {
          const fsStep = data?.progress?.yumYum?.step as VicVerradoStep | undefined;
          const lsStep = (localStorage.getItem(STORAGE.step) || "") as VicVerradoStep;

          if (fsStep && allowedPreCatering.includes(fsStep)) next = fsStep;
          else if (lsStep && allowedPreCatering.includes(lsStep)) next = lsStep;
          else next = "intro";
        }

        setStep(next);
        try {
          localStorage.setItem(STORAGE.step, next);
        } catch {}
        requestAnimationFrame(() =>
          window.scrollTo({ top: 0, left: 0, behavior: "instant" as any })
        );
      } catch (e) {
        console.warn("[VicVerradoOverlay] hydrate failed:", e);
        setStep("intro");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [startAt]);

  // ---------------- Render ----------------
return (
  <div
    id="vv-overlay-root"
    className="pixie-overlay"
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      paddingTop: "max(12px, env(safe-area-inset-top))",
      paddingRight: "max(12px, env(safe-area-inset-right))",
      paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      paddingLeft: "max(12px, env(safe-area-inset-left))",
      boxSizing: "border-box",
      overflowY: "auto",
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.35)",
    }}
  >

    {/* Children render their own pixie-card; this stage just scrolls */}
    <div ref={cardRef} style={{ width: "100%" }}>
      {/* -------- Intro -------- */}
      {step === "intro" && (
        <VicVerradoIntro
          venueName={venueName}
          onContinue={() => setStep("tier")}
          onClose={onClose}
        />
      )}

      {/* -------- Tier picker -------- */}
      {step === "tier" && (
        <FlowerTierSelector
          venueName={venueName}
          onSelect={(sel) => {
            setTierSel(sel);
            setMenuSelections((prev) => ({ ...prev, tier: sel.id as VVSelections["tier"] }));
            try {
              localStorage.setItem(STORAGE.tierLabel, PRETTY_TIER[sel.id]);
              localStorage.setItem(STORAGE.perGuest, String(sel.pricePerGuest));
            } catch {}
          }}
          onContinue={() => setStep("menu")}
          defaultSelectedId={(menuSelections?.tier as FlowerTierId) || undefined}
        />
      )}

      {/* -------- Menu builder -------- */}
      {step === "menu" && (
        <VicVerradoMenuBuilderCatering
          selectedTier={(menuSelections?.tier as VVSelections["tier"]) || "sunflower"}
          menuSelections={menuSelections}
          setMenuSelections={(s) => {
            setMenuSelections(s);
            try { localStorage.setItem(STORAGE.step, "menu"); } catch {}
          }}
          onContinue={() => setStep("vicVerradoCart")}
          onBack={() => setStep("tier")}
          onClose={onClose}
        />
      )}

      {/* -------- Cart -------- */}
      {step === "vicVerradoCart" && (
        <VicVerradoCartCatering
          selectedTier={(menuSelections?.tier as VVSelections["tier"]) || "sunflower"}
          menuSelections={menuSelections}
          setTotal={setTotal}
          setLineItems={setLineItems}
          setPaymentSummaryText={setPaymentSummaryText}
          onContinueToCheckout={() => setStep("vicVerradoContract")}
          onBackToMenu={() => setStep("menu")}
          onClose={onClose}
        />
      )}

      {/* -------- Contract -------- */}
      {step === "vicVerradoContract" && (
        <VicVerradoContractCatering
          total={total}
          guestCount={guestCount}
          weddingDate={userWeddingDate}
          dayOfWeek={userDayOfWeek}
          lineItems={lineItems}
          selectedTier={(menuSelections.tier as FlowerTierId) || "sunflower"}
          menuSelections={{
            tier: (menuSelections.tier as FlowerTierId) || "sunflower",
            hors: menuSelections.hors,
            salads: menuSelections.salads,
            entrees: menuSelections.entrees,
            starch: menuSelections.starch,
            veg: menuSelections.veg,
          }}
          signatureImage={signatureImage}
          setSignatureImage={setSignatureImage}
          signatureSubmitted={signatureSubmitted}
          setSignatureSubmitted={setSignatureSubmitted}
          setStep={(next) => setStep(next as VicVerradoStep)}
          onClose={onClose}
          onComplete={() => setStep("vicVerradoCheckout")}
        />
      )}

      {/* -------- Checkout -------- */}
      {step === "vicVerradoCheckout" && (
        <VicVerradoCheckOutCatering
          total={total}
          guestCount={guestCount}
          lineItems={lineItems}
          flowerTier={PRETTY_TIER[(menuSelections.tier as FlowerTierId) || "sunflower"]}
          menuSelections={{
            hors: menuSelections.hors,
            salads: menuSelections.salads,
            starches: menuSelections.starch,
            vegetables: menuSelections.veg,
            entrees: menuSelections.entrees,
          }}
          onBack={() => setStep("vicVerradoContract")}
          onComplete={() => {
            try {
              localStorage.setItem("vvCateringBooked", "true");
              localStorage.setItem(STORAGE.step, "vicVerradoCateringThankYou");
            } catch {}
            setStep("vicVerradoCateringThankYou");
          }}
          onClose={onClose}
          isGenerating={false}
        />
      )}

      {/* -------- Catering Thank-you -------- */}
      {step === "vicVerradoCateringThankYou" && (
        <VicVerradoCateringThankYou
          onContinueDesserts={() => {
            try { localStorage.setItem(STORAGE.step, "dessertStyle"); } catch {}
            setStep("dessertStyle");
          }}
          onClose={() => {
            try { localStorage.setItem(STORAGE.step, "home"); } catch {}
            onClose();
          }}
        />
      )}

      {/* -------- Dessert Thank-you -------- */}
      {step === "vicVerradoDessertThankYou" && (
        <VicVerradoDessertThankYou
          onClose={() => {
            try {
              localStorage.setItem("vvDessertsBooked", "true");
              localStorage.setItem(STORAGE.step, "vicVerradoBothDoneThankYou");
            } catch {}
            onClose();
          }}
        />
      )}

      {/* -------- Both Done Thank-you -------- */}
      {step === "vicVerradoBothDoneThankYou" && (
        <VicVerradoBothDoneThankYou
          onClose={() => {
            try { localStorage.setItem(STORAGE.step, "home"); } catch {}
            onClose();
          }}
        />
      )}

      {/* 🍰 Local Dessert Flow (Vic/Verrado) */}
      {step === "dessertStyle" && (
        <VicVerradoDessertType
          onSelectType={(type) => {
            setDessertType(type);
            localStorage.setItem("yumDessertType", type);
          }}
          onContinue={() => {
            localStorage.setItem("yumStep", "dessertMenu");
            setStep("dessertMenu");
          }}
          onBack={() => {
            localStorage.setItem("yumStep", "vicVerradoCateringThankYou");
            setStep("vicVerradoCateringThankYou");
          }}
          onClose={onClose}
        />
      )}

      {step === "dessertMenu" && (
        <VicVerradoDessertMenu
          dessertType={dessertType}
          flavorFilling={flavorFilling}
          setFlavorFilling={setFlavorFilling}
          onContinue={(sel) => {
            setFlavorFilling(sel.flavorFilling || []);
            setCakeStyle(typeof sel.cakeStyle === "string" ? sel.cakeStyle : "");
            setTreatType(Array.isArray(sel.treatType) ? sel.treatType[0] : sel.treatType || "");
            setGoodies(sel.goodies || []);
            setCupcakes(sel.cupcakes || []);
            localStorage.setItem("yumDessertSelections", JSON.stringify(sel));
            localStorage.setItem("yumStep", "dessertCart");
            setStep("dessertCart");
          }}
          onBack={() => setStep("dessertStyle")}
          onClose={onClose}
        />
      )}

      {step === "dessertCart" && (
        <VicVerradoDessertCart
          guestCount={Number(localStorage.getItem("magicGuestCount") || 0)}
          onGuestCountChange={(n) => localStorage.setItem("magicGuestCount", String(n))}
          dessertStyle={dessertType}
          flavorFilling={flavorFilling}
          cakeStyle={cakeStyle}
          treatType={treatType}
          cupcakes={cupcakes}
          goodies={goodies}
          setTotal={setTotal}
          setLineItems={setLineItems}
          setPaymentSummaryText={setPaymentSummaryText}
          onContinueToCheckout={() => {
            localStorage.setItem("yumStep", "dessertContract");
            setStep("dessertContract");
          }}
          onStartOver={() => {
            localStorage.setItem("yumStep", "dessertStyle");
            setStep("dessertStyle");
          }}
          onClose={onClose}
          weddingDate={userWeddingDate}
        />
      )}

      {step === "dessertContract" && (
        <VicVerradoDessertContract
          total={total}
          guestCount={Number(localStorage.getItem("magicGuestCount") || 0)}
          weddingDate={userWeddingDate}
          dayOfWeek={userDayOfWeek}
          lineItems={lineItems}
          signatureImage={signatureImage}
          setSignatureImage={setSignatureImage}
          dessertStyle={dessertType || ""}
          flavorCombo={flavorFilling.join(" + ")}
          setStep={(next) => setStep(next as VicVerradoStep)}
          onClose={onClose}
          onComplete={(sig) => {
            setSignatureImage(sig);
            localStorage.setItem("yumStep", "dessertCheckout");
            setStep("dessertCheckout");
          }}
        />
      )}

      {step === "dessertCheckout" && (
        <VicVerradoDessertCheckout
          total={total}
          guestCount={Number(localStorage.getItem("magicGuestCount") || 0)}
          selectedStyle={dessertType || ""}
          selectedFlavorCombo={flavorFilling.join(" + ")}
          paymentSummaryText={paymentSummaryText}
          lineItems={lineItems}
          signatureImage={signatureImage || ""}
          setStep={(next) => setStep(next as VicVerradoStep)}
          onBack={() => {
            setStep("dessertContract");
            localStorage.setItem("yumStep", "dessertContract");
          }}
          onClose={onClose}
          isGenerating={false}
        />
      )}
    </div>
  </div>
);
};

export default VicVerradoOverlay;