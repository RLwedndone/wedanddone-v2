import React, { useEffect, useRef, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

// Hooks
import { useOverlayOpen } from "../../../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../../../hooks/useScrollToTop";

// ── Catering screens (Ocotillo) ─────────────────────────
import OcotilloIntro from "./OcotilloIntro";
import OcotilloTierSelector, {
  type OcotilloTierId,
  type OcotilloTierSelection,
} from "./OcotilloTierSelector";
import OcotilloMenuBuilder from "./OcotilloMenuBuilder";
import OcotilloCateringCart from "./OcotilloCateringCart";
import OcotilloCateringContract from "./OcotilloCateringContract";
import OcotilloCateringCheckout from "./OcotilloCateringCheckout";

// Thank-you states
import OcotilloCateringThankYou from "./OcotilloCateringThankYou";
import OcotilloDessertThankYou from "./OcotilloDessertThankYou";
import OcotilloBothDoneThankYou from "./OcotilloBothDoneThankYou";

// ── Dessert screens (Ocotillo) ─────────────────────────
import OcotilloDessertSelector from "./OcotilloDessertSelector";
import OcotilloDessertMenu from "./OcotilloDessertMenu";
import OcotilloDessertCart from "./OcotilloDessertCart";
import OcotilloDessertContract from "./OcotilloDessertContract";
import OcotilloDessertCheckout from "./OcotilloDessertCheckout";

// ---------------- Types & constants ----------------
export type OcotilloStep =
  | "intro"
  | "tier"
  | "menu"
  | "cateringCart"
  | "cateringContract"
  | "cateringCheckout"
  | "ocotilloCateringThankYou"
  | "ocotilloDessertThankYou"
  | "ocotilloBothDoneThankYou"
  | "dessertStyle"
  | "dessertMenu"
  | "dessertCart"
  | "dessertContract"
  | "dessertCheckout";

const STORAGE = {
  step: "yumStep",
  tierLabel: "ocotilloTierLabel",
  perGuest: "ocotilloPerGuest",
  guestCount: "ocotilloGuestCount",
};

// ---------------- Component ----------------
interface Props {
  onClose: () => void;
  startAt?: OcotilloStep;
}

const OcotilloOverlay: React.FC<Props> = ({ onClose, startAt = "intro" }) => {
  // UI + scroll helpers
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<OcotilloStep>(startAt);
  useEffect(() => {
    console.log("[OcotilloOverlay] step ->", step);
  }, [step]);

  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([step], { targetRef: cardRef });

  // Catering selections / cart data
  const [tierSel, setTierSel] = useState<OcotilloTierSelection | null>(null);

  // ⬅ replace the current menuSelections state with this:
const [menuSelections, setMenuSelections] = useState<{
    tier: OcotilloTierId | "";
    appetizers: string[];
    salads: string[];
    entrees: string[];
    desserts: string[];
  }>({
    tier: "",
    appetizers: [],
    salads: [],
    entrees: [],
    desserts: [],
  });

  // Shared contract/checkout data
  const [total, setTotal] = useState<number>(0);
  const [lineItems, setLineItems] = useState<string[]>([]);
  const [paymentSummaryText, setPaymentSummaryText] = useState<string>("");

  // Signature (catering & dessert both use this pattern)
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);

  // Wedding/date info
  const [userWeddingDate, setUserWeddingDate] = useState<string | null>(null); // "YYYY-MM-DD"
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null); // Monday, etc.

  // Guest count (read once from storage)
  const [guestCount] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(STORAGE.guestCount) || 0);
    } catch {
      return 0;
    }
  });

  // Dessert builder state
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

  // ─────────────────────────────────────────────
  // Boot / resume logic
  // ─────────────────────────────────────────────
  useEffect(() => {
    const auth = getAuth();

    // allowed linear paths before catering is booked
    const allowedPreCatering: OcotilloStep[] = [
      "intro",
      "tier",
      "menu",
      "cateringCart",
      "cateringContract",
      "cateringCheckout",
    ];

    // dessert flow linear path
    const dessertStepsLinear: OcotilloStep[] = [
      "dessertStyle",
      "dessertMenu",
      "dessertCart",
      "dessertContract",
      "dessertCheckout",
      "ocotilloDessertThankYou",
    ];

    const unsub = onAuthStateChanged(auth, async (user) => {
      console.log("[OcotilloOverlay] onAuthStateChanged user:", !!user);

      if (!user) {
        // guest user path
        setStep("intro");
        setLoading(false);
        window.scrollTo(0, 0);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        const data = (snap.data() || {}) as any;

        // Pull wedding date for contract/checkout summaries
        const fsDate = data?.weddingDate || data?.profileData?.weddingDate || null;
        const dayOfWeek = data?.dayOfWeek || null;
        if (fsDate) {
          setUserWeddingDate(fsDate);
          setUserDayOfWeek(dayOfWeek || null);
          try {
            localStorage.setItem("yumSelectedDate", fsDate);
            if (dayOfWeek) {
              localStorage.setItem("yumSelectedDayOfWeek", dayOfWeek);
            }
          } catch {}
        }

        // detect whether user already booked catering and/or dessert
        const hasCatering =
          !!data?.bookings?.catering ||
          localStorage.getItem("ocotilloCateringBooked") === "true";

        const hasDessert =
          !!data?.bookings?.dessert ||
          localStorage.getItem("ocotilloDessertsBooked") === "true";

        let next: OcotilloStep;

        if (hasCatering && hasDessert) {
          next = "ocotilloBothDoneThankYou";
        } else if (hasCatering) {
          // they've done catering, maybe mid-dessert flow
          const fsStep = data?.progress?.yumYum?.step as OcotilloStep | undefined;
          const lsStep = (localStorage.getItem(STORAGE.step) ||
            "") as OcotilloStep;

          if (fsStep && dessertStepsLinear.includes(fsStep)) {
            next = fsStep;
          } else if (lsStep && dessertStepsLinear.includes(lsStep)) {
            next = lsStep;
          } else {
            next = "ocotilloCateringThankYou";
          }
        } else {
          // haven't booked catering yet → stick to catering path
          const fsStep = data?.progress?.yumYum?.step as OcotilloStep | undefined;
          const lsStep = (localStorage.getItem(STORAGE.step) ||
            "") as OcotilloStep;

          if (fsStep && allowedPreCatering.includes(fsStep)) {
            next = fsStep;
          } else if (lsStep && allowedPreCatering.includes(lsStep)) {
            next = lsStep;
          } else {
            next = "intro";
          }
        }

        setStep(next);
        try {
          localStorage.setItem(STORAGE.step, next);
        } catch {}

        requestAnimationFrame(() =>
          window.scrollTo({
            top: 0,
            left: 0,
            behavior: "instant" as any,
          })
        );
      } catch (e) {
        console.warn("[OcotilloOverlay] hydrate failed:", e);
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
      id="ocotillo-overlay-root"
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
      {/* children render their own pixie-card; this container just scrolls */}
      <div ref={cardRef} style={{ width: "100%" }}>
        {/* Intro */}
        {step === "intro" && (
          <OcotilloIntro
            onContinue={() => setStep("tier")}
            onClose={onClose}
          />
        )}

        {/* Tier */}
        {step === "tier" && (
          <OcotilloTierSelector
            defaultSelectedId={(menuSelections.tier as OcotilloTierId) || undefined}
            onSelect={(sel) => {
              setTierSel(sel);
              setMenuSelections((prev) => ({
                ...prev,
                tier: sel.id as OcotilloTierId,
              }));
              try {
                localStorage.setItem(STORAGE.tierLabel, sel.name);
                localStorage.setItem(
                  STORAGE.perGuest,
                  String(sel.pricePerGuest)
                );
              } catch {}
            }}
            onContinue={() => setStep("menu")}
            onBack={() => setStep("intro")}
            onClose={onClose}
          />
        )}

{step === "menu" && (
  <OcotilloMenuBuilder
    selectedTier={
      (menuSelections.tier as OcotilloTierId) || "tier1"
    }
    menuSelections={{
      ...menuSelections,
      tier:
        (menuSelections.tier as OcotilloTierId) || "tier1",
    }}
    setMenuSelections={(s) => {
      setMenuSelections(s);
      try {
        localStorage.setItem(STORAGE.step, "menu");
      } catch {}
    }}
    onContinue={() => setStep("cateringCart")}
    onBack={() => setStep("tier")}
    onClose={onClose}
  />
)}

        {/* Catering Cart */}
{step === "cateringCart" && (
  <OcotilloCateringCart
    selectedTier={(menuSelections.tier as OcotilloTierId) || "tier1"}
    menuSelections={{
      tier: (menuSelections.tier as OcotilloTierId) || "tier1",
      appetizers: menuSelections.appetizers || [],
      salads: menuSelections.salads || [],
      entrees: menuSelections.entrees || [],
      desserts: menuSelections.desserts || [],
    }}
    setTotal={setTotal}
    setLineItems={setLineItems}
    setPaymentSummaryText={setPaymentSummaryText}
    onContinueToCheckout={() => setStep("cateringContract")}
    onBackToMenu={() => setStep("menu")}
    onClose={onClose}
  />
)}

<OcotilloCateringContract
  total={total}
  guestCount={guestCount}
  weddingDate={userWeddingDate}
  dayOfWeek={userDayOfWeek}
  lineItems={lineItems}
  selectedTier={(menuSelections.tier as OcotilloTierId) || "tier1"}
  menuSelections={{
    tier: (menuSelections.tier as OcotilloTierId) || "tier1",
    appetizers: menuSelections.appetizers || [],
    salads: menuSelections.salads || [],
    entrees: menuSelections.entrees || [],
    desserts: menuSelections.desserts || [],
  }}
  signatureImage={signatureImage}
  setSignatureImage={setSignatureImage}
  signatureSubmitted={signatureSubmitted}
  setSignatureSubmitted={setSignatureSubmitted}
  setStep={(next) => setStep(next as OcotilloStep)}
  onClose={onClose}
  onComplete={() => setStep("cateringCheckout")}
/>

        {/* Catering Checkout */}
        {step === "cateringCheckout" && (
          <OcotilloCateringCheckout
            total={total}
            guestCount={guestCount}
            lineItems={lineItems}
            tierLabel={
              ((): string => {
                try {
                  return (
                    localStorage.getItem(STORAGE.tierLabel) ||
                    (tierSel?.name ?? "Tier 1")
                  );
                } catch {
                  return tierSel?.name ?? "Tier 1";
                }
              })()
            }
            menuSelections={{
              hors: menuSelections.hors,
              salads: menuSelections.salads,
              starches: menuSelections.starch,
              vegetables: menuSelections.veg,
              entrees: menuSelections.entrees,
            }}
            onBack={() => setStep("cateringContract")}
            onComplete={() => {
              try {
                localStorage.setItem("ocotilloCateringBooked", "true");
                localStorage.setItem(
                  STORAGE.step,
                  "ocotilloCateringThankYou"
                );
              } catch {}
              setStep("ocotilloCateringThankYou");
            }}
            onClose={onClose}
            isGenerating={false}
          />
        )}

        {/* Catering Thank You */}
        {step === "ocotilloCateringThankYou" && (
          <OcotilloCateringThankYou
            onContinueDesserts={() => {
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

        {/* Dessert Thank You */}
        {step === "ocotilloDessertThankYou" && (
          <OcotilloDessertThankYou
            onClose={() => {
              try {
                localStorage.setItem("ocotilloDessertsBooked", "true");
                localStorage.setItem(
                  STORAGE.step,
                  "ocotilloBothDoneThankYou"
                );
              } catch {}
              onClose();
            }}
          />
        )}

        {/* Both Done Thank You */}
        {step === "ocotilloBothDoneThankYou" && (
          <OcotilloBothDoneThankYou
            onClose={() => {
              try {
                localStorage.setItem(STORAGE.step, "home");
              } catch {}
              onClose();
            }}
          />
        )}

        {/* Dessert Style Selector */}
        {step === "dessertStyle" && (
          <OcotilloDessertSelector
            onSelectType={(type) => {
              setDessertType(type);
              localStorage.setItem("yumDessertType", type);
            }}
            onContinue={() => {
              localStorage.setItem("yumStep", "dessertMenu");
              setStep("dessertMenu");
            }}
            onBack={() => {
              localStorage.setItem("yumStep", "ocotilloCateringThankYou");
              setStep("ocotilloCateringThankYou");
            }}
            onClose={onClose}
          />
        )}

        {/* Dessert Menu Builder */}
        {step === "dessertMenu" && (
          <OcotilloDessertMenu
            dessertType={dessertType}
            flavorFilling={flavorFilling}
            setFlavorFilling={setFlavorFilling}
            onContinue={(sel) => {
              setFlavorFilling(sel.flavorFilling || []);
              setCakeStyle(
                typeof sel.cakeStyle === "string" ? sel.cakeStyle : ""
              );
              setTreatType(
                Array.isArray(sel.treatType)
                  ? sel.treatType[0]
                  : sel.treatType || ""
              );
              setGoodies(sel.goodies || []);
              setCupcakes(sel.cupcakes || []);
              localStorage.setItem(
                "yumDessertSelections",
                JSON.stringify(sel)
              );
              localStorage.setItem("yumStep", "dessertCart");
              setStep("dessertCart");
            }}
            onBack={() => setStep("dessertStyle")}
          />
        )}

        {/* Dessert Cart */}
        {step === "dessertCart" && (
          <OcotilloDessertCart
            guestCount={Number(
              localStorage.getItem("magicGuestCount") || 0
            )}
            onGuestCountChange={(n) =>
              localStorage.setItem("magicGuestCount", String(n))
            }
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

        {/* Dessert Contract */}
        {step === "dessertContract" && (
          <OcotilloDessertContract
            total={total}
            guestCount={Number(
              localStorage.getItem("magicGuestCount") || 0
            )}
            weddingDate={userWeddingDate}
            dayOfWeek={userDayOfWeek}
            lineItems={lineItems}
            signatureImage={signatureImage}
            setSignatureImage={setSignatureImage}
            dessertStyle={dessertType || ""}
            flavorCombo={flavorFilling.join(" + ")}
            setStep={(next) => setStep(next as OcotilloStep)}
            onClose={onClose}
            onComplete={(sig) => {
              setSignatureImage(sig);
              localStorage.setItem("yumStep", "dessertCheckout");
              setStep("dessertCheckout");
            }}
          />
        )}

        {/* Dessert Checkout */}
        {step === "dessertCheckout" && (
          <OcotilloDessertCheckout
            total={total}
            guestCount={Number(
              localStorage.getItem("magicGuestCount") || 0
            )}
            selectedStyle={dessertType || ""}
            selectedFlavorCombo={flavorFilling.join(" + ")}
            paymentSummaryText={paymentSummaryText}
            lineItems={lineItems}
            signatureImage={signatureImage || ""}
            setStep={(next) => setStep(next as OcotilloStep)}
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

export default OcotilloOverlay;