// src/components/NewYumBuild/CustomVenues/Tubac/TubacOverlay.tsx
import React, { useEffect, useState, useRef } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import "../../../../styles/globals/boutique.master.css";

// Split builders
import TubacMenuBuilderPlated from "./TubacMenuBuilderPlated";
import TubacMenuBuilderBuffet from "./TubacMenuBuilderBuffet";

// Catering screens (Tubac)
import TubacIntro from "./TubacIntro";
// screens
import TubacHorsSelector from "./TubacHorsSelector";
import TubacServiceSelector from "./TubacServiceSelector";
import TubacTierSelector, {
  type TubacTierId,
  type TubacTierSelection,
} from "./TubacTierSelector";

// Shared downstream screens
import TubacCartCatering from "./TubacCartCatering";
import TubacContractCatering from "./TubacContractCatering";
import TubacCheckOutCatering from "./TubacCheckOutCatering";
import TubacCateringThankYou from "./TubacCateringThankYou";

// Dessert screens
import TubacDessertSelector from "./TubacDessertSelector";
import TubacDessertMenu from "./TubacDessertMenu";
import TubacDessertCart from "./TubacDessertCart";
import TubacDessertContract from "./TubacDessertContract";
import TubacDessertCheckout from "./TubacDessertCheckout";
import TubacDessertThankYou from "./TubacDessertThankYou";
import TubacBothDoneThankYou from "./TubacBothDoneThankYou";

// UX helpers
import { useOverlayOpen } from "../../../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../../../hooks/useScrollToTop";

// Types
type DessertType = "tieredCake" | "smallCakeTreats" | "treatsOnly";
type ServiceOption = "plated" | "buffet";

type TBSelections = {
  service: ServiceOption;
  tier?: TubacTierId;
  appetizers: string[];
  salads: string[];
  entrees: string[];
  sides: string[];
  // NEW
  horsPassed: string[];
  horsDisplayed: string[];
};

export type TubacStep =
  | "intro"
  | "hors"            // NEW
  | "service"
  | "tier"
  | "cateringMenu"
  | "cateringCart"
  | "cateringContract"
  | "cateringCheckout"
  | "tubacCateringThankYou"
  | "dessertStyle"
  | "dessertMenu"
  | "dessertCart"
  | "dessertContract"
  | "dessertCheckout"
  | "tubacDessertThankYou"
  | "tubacBothDoneThankYou";

interface TubacOverlayProps {
  onClose: () => void;
  startAt?: TubacStep;
}

const platedTiers = ["silver", "gold", "platinum"] as const;
type PlatedTier = typeof platedTiers[number];

const buffetTiers = ["peridot", "emerald", "turquoise", "diamond"] as const;
type BuffetTier = typeof buffetTiers[number];

const TubacOverlay: React.FC<TubacOverlayProps> = ({ onClose, startAt = "intro" }) => {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<TubacStep>(startAt);

  // User context
  const [userWeddingDate, setUserWeddingDate] = useState<string | null>(null);
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null);

  // Service + tiers
  const [serviceOption, setServiceOption] = useState<ServiceOption>(
    (localStorage.getItem("tubacServiceOption") as ServiceOption) || "plated"
  );
  const [tierSel, setTierSel] = useState<TubacTierSelection | null>(null);

  // Catering selections / totals
  const [menuSelections, setMenuSelections] = useState<TBSelections>({
    service: serviceOption,
    tier: undefined,
    appetizers: [],
    salads: [],
    entrees: [],
    sides: [],
    horsPassed: [],       // NEW
    horsDisplayed: [],    // NEW
  });
  const [addonsTotal, setAddonsTotal] = useState(0);
  const [total, setTotal] = useState<number>(0);
  const [lineItems, setLineItems] = useState<string[]>([]);
  const [paymentSummaryText, setPaymentSummaryText] = useState<string>("");

  // Signature
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);

  // Dessert state
  const [dessertType, setDessertType] = useState<DessertType>("tieredCake");
  const [flavorFilling, setFlavorFilling] = useState<string[]>([]);
  const [cakeStyle, setCakeStyle] = useState<string>("");
  const [treatType, setTreatType] = useState<"" | "cupcakes" | "goodies">("");
  const [goodies, setGoodies] = useState<string[]>([]);
  const [cupcakes, setCupcakes] = useState<string[]>([]);
  const [guestCount] = useState<number>(Number(localStorage.getItem("magicGuestCount") || 0));

  // Frame helpers
  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([step], { targetRef: cardRef });

  // Boot/resume
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) {
        setLoading(false);
        setStep("intro");
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = (snap.data() || {}) as any;

        const fsDate = data?.weddingDate || data?.profileData?.weddingDate || null;
        const dow = data?.dayOfWeek || null;
        if (fsDate) setUserWeddingDate(fsDate);
        if (dow) setUserDayOfWeek(dow);

        const catering = !!data?.bookings?.catering;
        const dessert = !!data?.bookings?.dessert;

        if (!catering && !dessert) setStep("intro");
        else if (catering && !dessert) setStep("tubacCateringThankYou");
        else setStep("tubacBothDoneThankYou");
      } catch (e) {
        console.warn("[TubacOverlay] fetch user failed:", e);
        setStep("intro");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  if (loading) return null;

  // ---- Safe tier derivation per service (prevents mis-typed props) ----
  const selectedPlatedTier: PlatedTier =
    platedTiers.includes(menuSelections?.tier as any)
      ? (menuSelections!.tier as PlatedTier)
      : "silver";

  const selectedBuffetTier: BuffetTier =
    buffetTiers.includes((tierSel?.id ?? menuSelections?.tier) as any)
      ? ((tierSel?.id ?? menuSelections!.tier) as BuffetTier)
      : "peridot";
  
      

  // ── RENDER — single overlay; child screens own their pixie-card & pink X ──
  return (
    <div id="tubac-overlay-root" className="pixie-overlay">
      <div ref={cardRef} style={{ width: "100%" }}>
    
        {/* Intro → Service → Tier → Catering Menu */}
        {step === "intro" && (
  <TubacIntro onContinue={() => setStep("hors")} onClose={onClose} />
)}

{step === "hors" && (
  <TubacHorsSelector
    menuSelections={{
      horsPassed: menuSelections.horsPassed,
      horsDisplayed: menuSelections.horsDisplayed,
    }}
    setMenuSelections={(m) =>
      setMenuSelections((prev) => ({
        ...prev,
        horsPassed: m.horsPassed.slice(0, 2),
        horsDisplayed: m.horsDisplayed.slice(0, 1),
      }))
    }
    onBack={() => setStep("intro")}
    onContinue={() => setStep("service")}
    onClose={onClose}
  />
)}
        {step === "service" && (
          <TubacServiceSelector
            serviceOption={serviceOption}
            // SERVICE step → onSelect
onSelect={(svc) => {
  setServiceOption(svc);
  setMenuSelections((prev) => ({
    ...prev,
    service: svc,
    tier: undefined,         // clear tier
    appetizers: [],
    salads: [],
    entrees: [],
    sides: [],               // keep hors selections
  }));
  try {
    localStorage.setItem("tubacServiceOption", svc);
    localStorage.removeItem("tubacTierLabel");
    localStorage.removeItem("tubacPerGuest");
    localStorage.removeItem("tubacBuffetSelections");
    localStorage.removeItem("yumMenuSelections");
  } catch {}
  try { window.dispatchEvent(new CustomEvent("tubac:resetMenu")); } catch {}
}}
            onBack={() => setStep("intro")}
            onContinue={() => setStep("tier")}
            onClose={onClose}
          />
        )}

        {step === "tier" && (
          <TubacTierSelector
            serviceOption={serviceOption}
            // TIER step → onSelect
onSelect={(sel) => {
  setTierSel(sel);
  setMenuSelections((prev) => ({
    ...prev,
    tier: sel.id,
    appetizers: [],
    salads: [],
    entrees: [],
    sides: [],               // keep hors selections
  }));
  try {
    localStorage.setItem("tubacTierLabel", sel.prettyName || sel.id);
    localStorage.setItem("tubacPerGuest", String(sel.pricePerGuest ?? ""));
  } catch {}
  try { window.dispatchEvent(new CustomEvent("tubac:resetMenu")); } catch {}
}}
            onBack={() => setStep("service")}
            onContinue={() => setStep("cateringMenu")}
            defaultSelectedId={menuSelections?.tier as TubacTierId | undefined}
            onClose={onClose}
          />
        )}
{step === "cateringMenu" && (
  serviceOption === "plated" ? (
    <TubacMenuBuilderPlated
    selectedTier={selectedPlatedTier}   // ← use the narrowed plated tier
      menuSelections={menuSelections}
      setMenuSelections={(m) =>
        setMenuSelections(prev => ({
          ...prev,
          appetizers: m.appetizers,
          salads: m.salads,
          entrees: m.entrees,
          sides: m.sides ?? [],
        }))
      }
      onBack={() => setStep("tier")}
      onContinue={() => setStep("cateringCart")}
      onClose={onClose}
    />
  ) : (
    <TubacMenuBuilderBuffet
    selectedTier={selectedBuffetTier}   // ← use the narrowed buffet tier
      menuSelections={menuSelections}
      setMenuSelections={(m) =>
        setMenuSelections(prev => ({
          ...prev,
          appetizers: m.appetizers,
          salads: m.salads,
          entrees: m.entrees,
          sides: m.sides ?? [],
        }))
      }
      onBack={() => setStep("tier")}
      onContinue={() => setStep("cateringCart")}
      onClose={onClose}
    />
  )
)}

{step === "cateringCart" && (
  <TubacCartCatering
    guestCount={guestCount}
    serviceOption={serviceOption}
    selectedTier={(menuSelections?.tier as TubacTierId) || "silver"}
    menuSelections={{
      ...menuSelections,
      // merge to what Cart expects:
      hors: [
        ...(menuSelections.horsPassed || []),
        ...(menuSelections.horsDisplayed || []),
      ],
    } as any}
    setTotal={setTotal}
    setLineItems={setLineItems}
    setPaymentSummaryText={setPaymentSummaryText}
    setAddonsTotal={setAddonsTotal}
    onBackToMenu={() => setStep("cateringMenu")}
    onContinueToCheckout={() => setStep("cateringContract")}
    onClose={onClose}
  />
)}

{step === "cateringContract" && (
  <TubacContractCatering
    total={total}
    guestCount={guestCount}
    weddingDate={userWeddingDate}
    dayOfWeek={userDayOfWeek}
    lineItems={lineItems}
    serviceOption={serviceOption}
    selectedTier={(menuSelections.tier as TubacTierId) || "silver"}
    menuSelections={menuSelections}
    signatureImage={signatureImage}
    setSignatureImage={setSignatureImage}
    signatureSubmitted={signatureSubmitted}
    setSignatureSubmitted={setSignatureSubmitted}

    // 🔄 these replace setStep:
    onBack={() => setStep("cateringCart")}
    onContinueToCheckout={() => setStep("cateringCheckout")}

    onClose={onClose}
    onComplete={() => setStep("tubacCateringThankYou")}
  />
)}

{step === "cateringCheckout" && (
    <TubacCheckOutCatering
      total={total}
      guestCount={guestCount}
      lineItems={lineItems}
      serviceOption={serviceOption}
      selectedTier={(menuSelections.tier as TubacTierId) || "silver"}
      menuSelections={{
        horsPassed: (menuSelections as any).horsPassed,
        horsDisplayed: (menuSelections as any).horsDisplayed,
        salads: menuSelections.salads,
        sides: menuSelections.sides,
        entrees: menuSelections.entrees,
      }}
      onBack={() => setStep("cateringContract")}
      onComplete={() => setStep("tubacCateringThankYou")}
      onClose={onClose}
      isGenerating={false}   // or your own isGenerating flag if you have one
    />
)}

        {step === "tubacCateringThankYou" && (
          <TubacCateringThankYou
            onBookDessertNow={() => setStep("dessertStyle")}
            onClose={onClose}
          />
        )}

        {/* ───────────── Dessert flow ───────────── */}
        {step === "dessertStyle" && (
          <TubacDessertSelector
            onSelectType={(type) => setDessertType(type)}
            onContinue={() => setStep("dessertMenu")}
            onBack={() => setStep("tubacCateringThankYou")}
            onClose={onClose}
          />
        )}

        {step === "dessertMenu" && (
          <TubacDessertMenu
            dessertType={dessertType}
            flavorFilling={flavorFilling}
            setFlavorFilling={setFlavorFilling}
            onContinue={(sel) => {
              setFlavorFilling(sel.flavorFilling || []);
              setCakeStyle(typeof sel.cakeStyle === "string" ? sel.cakeStyle : "");
              setTreatType(sel.treatType || "");
              setGoodies(sel.goodies || []);
              setCupcakes(sel.cupcakes || []);
              setStep("dessertCart");
            }}
            onBack={() => setStep("dessertStyle")}
            onClose={onClose}
          />
        )}

        {step === "dessertCart" && (
          <TubacDessertCart
            guestCount={guestCount}
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
            onContinueToCheckout={() => setStep("dessertContract")}
            onStartOver={() => setStep("dessertStyle")}
            onClose={onClose}
            weddingDate={userWeddingDate}
          />
        )}

        {step === "dessertContract" && (
          <TubacDessertContract
            total={total}
            guestCount={guestCount}
            weddingDate={userWeddingDate}
            dayOfWeek={userDayOfWeek}
            lineItems={lineItems}
            signatureImage={signatureImage}
            setSignatureImage={setSignatureImage}
            dessertStyle={dessertType || ""}
            flavorCombo={flavorFilling.join(" + ")}
            setStep={(next) => setStep(next as TubacStep)}
            onClose={onClose}
            onComplete={(sig) => {
              setSignatureImage(sig);
              setStep("dessertCheckout");
            }}
          />
        )}

        {step === "dessertCheckout" && (
          <TubacDessertCheckout
            total={total}
            guestCount={guestCount}
            selectedStyle={dessertType || ""}
            selectedFlavorCombo={flavorFilling.join(" + ")}
            paymentSummaryText={paymentSummaryText}
            lineItems={lineItems}
            signatureImage={signatureImage || ""}
            setStep={(next) => setStep(next as TubacStep)}
            onBack={() => setStep("dessertContract")}
            onClose={onClose}
            isGenerating={false}
          />
        )}

        {step === "tubacDessertThankYou" && (
          <TubacDessertThankYou onClose={() => setStep("tubacBothDoneThankYou")} />
        )}
        {step === "tubacBothDoneThankYou" && <TubacBothDoneThankYou onClose={onClose} />}
      </div>
    </div>
  );
};

export default TubacOverlay;