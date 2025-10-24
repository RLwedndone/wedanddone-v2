// src/components/NewYumBuild/CustomVenues/Schnepf/SchnepfOverlay.tsx
import React, { useEffect, useRef, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

// UX helpers
import { useOverlayOpen } from "../../../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../../../hooks/useScrollToTop";

// ── Schnepf Catering flow ─────────────────────────────────────
import SchnepfIntro from "./SchnepfIntro";
import SchnepfApps from "./SchnepfApps";
import SchnepfCuisineSelector, { type CuisineId, type CuisineSelection } from "./SchnepfCuisineSelector";
import SchnepfMenuBuilderCatering, { type SchnepfMenuSelections } from "./SchnepfMenuBuilderCatering";
import SchnepfCartCatering from "./SchnepfCartCatering";
import SchnepfContractCatering from "./SchnepfContractCatering";
import SchnepfCheckOutCatering from "./SchnepfCheckOutCatering";

// Thank-you screens
import SchnepfCateringThankYou from "./SchnepfCateringThankYou";
import SchnepfDessertThankYou from "./SchnepfDessertThankYou";
import SchnepfBothDoneThankYou from "./SchnepfBothDoneThankYou";

// ── Schnepf Dessert flow ──────────────────────────────────────
import SchnepfDessertSelector from "./SchnepfDessertSelector";
import SchnepfDessertMenu from "./SchnepfDessertMenu";
import SchnepfDessertCart from "./SchnepfDessertCart";
import SchnepfDessertContract from "./SchnepfDessertContract";
import SchnepfDessertCheckout from "./SchnepfDessertCheckout";

// ---------------- Types & constants ----------------
export type SchnepfStep =
  | "schnepfIntro"
  | "schnepfApps"
  | "schnepfCuisine"
  | "schnepfMenu"
  | "schnepfCart"
  | "schnepfContract"
  | "schnepfCheckout"
  | "schnepfCateringThankYou"
  | "schnepfDessertThankYou"
  | "schnepfBothDoneThankYou"
  // dessert (local)
  | "dessertStyle"
  | "dessertMenu"
  | "dessertCart"
  | "dessertContract"
  | "dessertCheckout";

const STORAGE = {
  step: "yumStep",
  guestCount: "yumGuestCount",
};

// Narrow venue name for SchnepfIntro
type SchnepfVenueName = "The Meadow" | "The Farmhouse" | "The Big Red Barn";

function normalizeSchnepfVenue(raw?: string | null): SchnepfVenueName {
  const s = String(raw || "").toLowerCase();
  if (s.includes("meadow")) return "The Meadow";
  if (s.includes("farm house") || s.includes("farmhouse")) return "The Farmhouse";
  return "The Big Red Barn";
}

interface Props {
  onClose: () => void;
  startAt?: SchnepfStep;
}

const SchnepfOverlay: React.FC<Props> = ({ onClose, startAt = "schnepfIntro" }) => {
  // Frame / UX
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<SchnepfStep>(startAt);
  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([step], { targetRef: cardRef });

  // Venue label for copy
  const [venueName, setVenueName] = useState<SchnepfVenueName>("The Meadow");

  // Catering selections
  const [cuisineName, setCuisineName] = useState<string>(() => {
    try {
      return localStorage.getItem("schnepfCuisineName") || "";
    } catch {
      return "";
    }
  });

  // CONTRACT-shaped selections
  const [menuSelections, setMenuSelections] = useState<{ appetizers: string[]; mains: string[]; sides: string[] }>({
    appetizers: [],
    mains: [],
    sides: [],
  });

  // Builder state
  const [cuisineId, setCuisineId] = useState<CuisineId>(() => {
    try {
      return (localStorage.getItem("schnepfCuisineId") as CuisineId) || "bbq";
    } catch {
      return "bbq";
    }
  });

  const [schSelections, setSchSelections] = useState<SchnepfMenuSelections>({
    salads: [],
    entrees: [],
    sides: [],
  });

  const EMPTY_SEL: SchnepfMenuSelections = { salads: [], entrees: [], sides: [] };
  const EMPTY_CONTRACT_SEL = { appetizers: [], mains: [], sides: [] };

  const resetMenuForCuisine = (id: CuisineId) => {
    setSchSelections(EMPTY_SEL);
    setMenuSelections(EMPTY_CONTRACT_SEL);
    setTotal(0);
    setLineItems([]);
    setPaymentSummaryText("");
    try {
      localStorage.removeItem(`schnepfMenuSelections:${id}`);
    } catch {}
    setBuilderKey(`builder:${id}:${Date.now()}`);
    try {
      localStorage.setItem(STORAGE.step, "schnepfCuisine");
    } catch {}
  };

  // Totals / contract snapshot
  const [total, setTotal] = useState<number>(0);
  const [lineItems, setLineItems] = useState<string[]>([]);
  const [paymentSummaryText, setPaymentSummaryText] = useState<string>("");

  // Signature state
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);

  // Date labels
  const [userWeddingDate, setUserWeddingDate] = useState<string | null>(null);
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null);

  // Guest count (display/compat; builder writes to shared store)
  const [guestCount] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(STORAGE.guestCount) || 0);
    } catch {
      return 0;
    }
  });

  // Force a fresh Menu Builder mount whenever cuisine changes
  const [builderKey, setBuilderKey] = useState<string>("builder:init");

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

    const allowed: SchnepfStep[] = [
      "schnepfIntro",
      "schnepfApps",
      "schnepfCuisine",
      "schnepfMenu",
      "schnepfCart",
      "schnepfContract",
      "schnepfCheckout",
      "schnepfCateringThankYou",
      "dessertStyle",
      "dessertMenu",
      "dessertCart",
      "dessertContract",
      "dessertCheckout",
      "schnepfDessertThankYou",
      "schnepfBothDoneThankYou",
    ];
    const isAllowed = (s: any): s is SchnepfStep => allowed.includes(s as SchnepfStep);

    const dessertSteps: SchnepfStep[] = [
      "dessertStyle",
      "dessertMenu",
      "dessertCart",
      "dessertContract",
      "dessertCheckout",
      "schnepfDessertThankYou",
    ];

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStep("schnepfIntro");
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
        setVenueName(normalizeSchnepfVenue(vName));

        // Date labels
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
        const hasCatering = !!data?.bookings?.catering || localStorage.getItem("schnepfCateringBooked") === "true";
        const hasDessert = !!data?.bookings?.dessert || localStorage.getItem("schnepfDessertsBooked") === "true";

        const fsStepRaw = data?.progress?.yumYum?.step;
        const fsStep = isAllowed(fsStepRaw) ? (fsStepRaw as SchnepfStep) : undefined;
        const lsRaw = localStorage.getItem(STORAGE.step) || "";
        const lsStep = isAllowed(lsRaw) ? (lsRaw as SchnepfStep) : undefined;

        let next: SchnepfStep;
        if (hasCatering && hasDessert) {
          next = "schnepfBothDoneThankYou";
        } else if (hasCatering) {
          if (fsStep && dessertSteps.includes(fsStep)) next = fsStep;
          else if (lsStep && dessertSteps.includes(lsStep)) next = lsStep;
          else next = "schnepfCateringThankYou";
        } else {
          const preCatering: SchnepfStep[] = [
            "schnepfIntro",
            "schnepfApps",
            "schnepfCuisine",
            "schnepfMenu",
            "schnepfCart",
            "schnepfContract",
            "schnepfCheckout",
          ];
          if (fsStep && preCatering.includes(fsStep)) next = fsStep;
          else if (lsStep && preCatering.includes(lsStep)) next = lsStep;
          else next = "schnepfIntro";
        }

        setStep(next);
        try {
          localStorage.setItem(STORAGE.step, next);
        } catch {}
        requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" as any }));
      } catch (e) {
        console.warn("[SchnepfOverlay] hydrate failed:", e);
        setStep("schnepfIntro");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [startAt]);

  if (loading) return null;

  // ---------------- Render ----------------
  // Single overlay; children own their own pixie-card & close button
  return (
    <div
  id="schnepf-overlay-root"
  className="pixie-overlay"
  style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",                 // ✅ center vertically for all screens
    minHeight: "100svh",                  // ✅ real viewport height (iOS safe)
    paddingTop: "clamp(20px, 6vh, 56px)", // ✅ comfy top padding everywhere
    paddingRight: "max(12px, env(safe-area-inset-right))",
    paddingBottom: "clamp(20px, 6vh, 56px)", // ✅ bottom breathing room
    paddingLeft: "max(12px, env(safe-area-inset-left))",
    boxSizing: "border-box",
    overflowY: "auto",
    width: "100%",
  }}
>
      {/* Scrollable stage (children render their own cards) */}
      <div ref={cardRef} style={{ width: "100%" }}>
        {/* -------- Intro -------- */}
        {step === "schnepfIntro" && (
          <SchnepfIntro
            venueName={
              (["The Meadow", "The Farmhouse", "The Big Red Barn"].includes(venueName)
                ? (venueName as SchnepfVenueName)
                : "The Meadow")
            }
            onContinue={() => {
              setStep("schnepfApps");
              try {
                localStorage.setItem(STORAGE.step, "schnepfApps");
              } catch {}
            }}
            onClose={onClose}
          />
        )}

        {/* -------- Apps -------- */}
        {step === "schnepfApps" && (
          <SchnepfApps
            onContinue={() => {
              setStep("schnepfCuisine");
              try {
                localStorage.setItem(STORAGE.step, "schnepfCuisine");
              } catch {}
            }}
            onBack={() => {
              setStep("schnepfIntro");
              try {
                localStorage.setItem(STORAGE.step, "schnepfIntro");
              } catch {}
            }}
            onClose={onClose}
          />
        )}

        {/* -------- Cuisine selector -------- */}
{step === "schnepfCuisine" && (
  <SchnepfCuisineSelector
    defaultSelectedId={cuisineId ?? undefined}
    onSelect={(sel: CuisineSelection) => {
      // if cuisine changed, clear builder-specific selections and remount it
      const changed = sel.id !== cuisineId;
      if (changed) {
        // blow away the previous cuisine's selections in state + storage
        setSchSelections({ salads: [], entrees: [], sides: [] });
        try {
          localStorage.removeItem(`schnepfMenuSelections:${sel.id}`);
        } catch {}
        // force a fresh Menu Builder mount for new cuisine
        setBuilderKey(`builder:${sel.id}:${Date.now()}`);
      }

      // persist the chosen cuisine
      setCuisineId(sel.id);
      setCuisineName(sel.name);
      try {
        localStorage.setItem("schnepfCuisineId", sel.id);
        localStorage.setItem("schnepfCuisineName", sel.name);
      } catch {}

      // keep step bookmark consistent
      try {
        localStorage.setItem(STORAGE.step, "schnepfCuisine");
      } catch {}

      // (optional) debug
      console.log("[OVERLAY] cuisine selected →", sel.id, sel.name);
    }}
    onContinue={() => {
      setStep("schnepfMenu");
      try { localStorage.setItem(STORAGE.step, "schnepfMenu"); } catch {}
    }}
    onBack={() => {
      setStep("schnepfApps");
      try { localStorage.setItem(STORAGE.step, "schnepfApps"); } catch {}
    }}
  />
)}

       {/* -------- Menu builder -------- */}
{step === "schnepfMenu" && cuisineId && (
  <>
    {console.log("[OVERLAY] Rendering MenuBuilder with cuisineId:", cuisineId)}
    <SchnepfMenuBuilderCatering
      key={`${cuisineId}:${builderKey ?? ""}`}
      cuisineId={cuisineId}
      selections={schSelections}
      setSelections={(next) => {
        setSchSelections(next);
        try {
          localStorage.setItem(`schnepfMenuSelections:${cuisineId}`, JSON.stringify(next));
        } catch {}
      }}
      onContinue={() => {
        setMenuSelections({
          appetizers: schSelections.salads,
          mains: schSelections.entrees,
          sides: schSelections.sides,
        });
        setStep("schnepfCart");
        try { localStorage.setItem(STORAGE.step, "schnepfCart"); } catch {}
      }}
      onBack={() => {
        setStep("schnepfCuisine");
        try { localStorage.setItem(STORAGE.step, "schnepfCuisine"); } catch {}
      }}
      onClose={onClose}
    />
  </>
)}

        {/* -------- Cart -------- */}
        {step === "schnepfCart" && (
          <SchnepfCartCatering
            cuisineId={cuisineId}
            selections={schSelections}
            setTotal={setTotal}
            setLineItems={setLineItems}
            setPaymentSummaryText={setPaymentSummaryText}
            onContinueToCheckout={() => {
              setStep("schnepfContract");
              try {
                localStorage.setItem(STORAGE.step, "schnepfContract");
              } catch {}
            }}
            onBackToMenu={() => {
              setStep("schnepfMenu");
              try {
                localStorage.setItem(STORAGE.step, "schnepfMenu");
              } catch {}
            }}
            onClose={onClose}
          />
        )}

        {/* -------- Contract -------- */}
        {step === "schnepfContract" && (
          <SchnepfContractCatering
            total={total}
            guestCount={guestCount}
            weddingDate={userWeddingDate}
            dayOfWeek={userDayOfWeek}
            lineItems={lineItems}
            cuisineName={cuisineName}
            menuSelections={menuSelections}
            signatureImage={signatureImage}
            setSignatureImage={setSignatureImage}
            signatureSubmitted={signatureSubmitted}
            setSignatureSubmitted={setSignatureSubmitted}
            setStep={(next) => setStep(next as SchnepfStep)}
            onClose={onClose}
            onComplete={() => setStep("schnepfCheckout")}
          />
        )}

        {/* -------- Checkout -------- */}
        {step === "schnepfCheckout" && (
          <SchnepfCheckOutCatering
            cuisineId={cuisineId as any}
            selections={schSelections}
            guestCount={
              Number(localStorage.getItem("magicGuestCount")) ||
              Number(localStorage.getItem("yumGuestCount")) ||
              0
            }
            cartTotal={Number(localStorage.getItem("schnepfCart:grandTotal")) || total}
            lineItems={lineItems}
            onBack={() => setStep("schnepfContract")}
            onComplete={() => {
              try {
                localStorage.setItem(STORAGE.step, "schnepfCateringThankYou");
              } catch {}
              setStep("schnepfCateringThankYou");
            }}
            onClose={onClose}
          />
        )}

        {/* -------- Catering TY -------- */}
        {step === "schnepfCateringThankYou" && (
          <SchnepfCateringThankYou
            onBookDessertNow={() => {
              try {
                localStorage.setItem(STORAGE.step, "dessertStyle");
              } catch {}
              setStep("dessertStyle");
            }}
            onClose={() => {
              try {
                localStorage.setItem(STORAGE.step, "home");
              } catch {}
              onClose();
            }}
          />
        )}

        {/* -------- Dessert flow -------- */}
        {step === "dessertStyle" && (
          <SchnepfDessertSelector
            onSelectType={(type) => {
              setDessertType(type);
              try {
                localStorage.setItem("yumDessertType", type);
              } catch {}
            }}
            onContinue={() => {
              try {
                localStorage.setItem(STORAGE.step, "dessertMenu");
              } catch {}
              setStep("dessertMenu");
            }}
            onBack={() => {
              try {
                localStorage.setItem(STORAGE.step, "schnepfCateringThankYou");
              } catch {}
              setStep("schnepfCateringThankYou");
            }}
            onClose={onClose}
          />
        )}

        {step === "dessertMenu" && (
          <SchnepfDessertMenu
            dessertType={dessertType}
            flavorFilling={flavorFilling}
            setFlavorFilling={setFlavorFilling}
            onContinue={(sel) => {
              setFlavorFilling(sel.flavorFilling || []);
              setCakeStyle(typeof sel.cakeStyle === "string" ? sel.cakeStyle : "");
              setTreatType((sel.treatType as any) || "");
              setGoodies(sel.goodies || []);
              setCupcakes(sel.cupcakes || []);
              localStorage.setItem("yumDessertSelections", JSON.stringify(sel));
              localStorage.setItem(STORAGE.step, "dessertCart");
              setStep("dessertCart");
            }}
            onBack={() => setStep("dessertStyle")}
            onClose={onClose}
          />
        )}

        {step === "dessertCart" && (
          <SchnepfDessertCart
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
              localStorage.setItem(STORAGE.step, "dessertContract");
              setStep("dessertContract");
            }}
            onStartOver={() => {
              localStorage.setItem(STORAGE.step, "dessertStyle");
              setStep("dessertStyle");
            }}
            onClose={onClose}
            weddingDate={userWeddingDate}
          />
        )}

        {step === "dessertContract" && (
          <SchnepfDessertContract
            total={total}
            guestCount={Number(localStorage.getItem("magicGuestCount") || 0)}
            weddingDate={userWeddingDate}
            dayOfWeek={userDayOfWeek}
            lineItems={lineItems}
            signatureImage={signatureImage}
            setSignatureImage={setSignatureImage}
            dessertStyle={dessertType || "tieredCake"}
            flavorCombo={flavorFilling.join(" + ")}
            onBack={() => {
              try {
                localStorage.setItem(STORAGE.step, "dessertCart");
              } catch {}
              setStep("dessertCart");
            }}
            onContinueToCheckout={(sig: string) => {
              setSignatureImage(sig);
              try {
                localStorage.setItem(STORAGE.step, "dessertCheckout");
              } catch {}
              setStep("dessertCheckout");
            }}
            onClose={onClose}
          />
        )}

        {step === "dessertCheckout" && (
          <SchnepfDessertCheckout
            total={total}
            guestCount={Number(localStorage.getItem("magicGuestCount") || 0)}
            selectedStyle={dessertType || ""}
            selectedFlavorCombo={flavorFilling.join(" + ")}
            paymentSummaryText={paymentSummaryText}
            lineItems={lineItems}
            signatureImage={signatureImage || ""}
            onBack={() => {
              setStep("dessertContract");
              try {
                localStorage.setItem(STORAGE.step, "dessertContract");
              } catch {}
            }}
            onClose={onClose}
            isGenerating={false}
            onComplete={() => {
              try {
                localStorage.setItem(STORAGE.step, "schnepfDessertThankYou");
              } catch {}
              setStep("schnepfDessertThankYou");
            }}
          />
        )}

        {/* -------- Dessert TY -------- */}
        {step === "schnepfDessertThankYou" && (
          <SchnepfDessertThankYou
            onClose={() => {
              try {
                localStorage.setItem(STORAGE.step, "schnepfBothDoneThankYou");
              } catch {}
              onClose();
            }}
          />
        )}

        {/* -------- Both Done TY -------- */}
        {step === "schnepfBothDoneThankYou" && (
          <SchnepfBothDoneThankYou
            onClose={() => {
              try {
                localStorage.setItem(STORAGE.step, "home");
              } catch {}
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default SchnepfOverlay;