// src/components/NewYumBuild/CustomVenues/Encanterra/EncanterraOverlay.tsx
import React, { useEffect, useRef, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

// Hooks
import { useOverlayOpen } from "../../../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../../../hooks/useScrollToTop";

// ── Catering screens ─────────────────────────────────────────
import EncanterraIntro from "./EncanterraIntro";
import DiamondTierSelector, {
  type DiamondTierId,
  type DiamondTierSelection,
} from "./DiamondTierSelector";
import EncanterraMenuBuilderCatering, {
  type EncanterraMenuSelections as ENCSelections,
} from "./EncanterraMenuBuilder";
import EncanterraCartCatering from "./EncanterraCartCatering";
import EncanterraContractCatering from "./EncanterraContractCatering";
import EncanterraCheckOutCatering from "./EncanterraCheckOutCatering";

// Thank-you screens
import EncanterraCateringThankYou from "./EncanterraCateringThankYou";
import EncanterraDessertThankYou from "./EncanterraDessertThankYou";
import EncanterraBothDoneThankYou from "./EncanterraBothDoneThankYou";

// Dessert flow
import EncanterraDessertSelector from "./EncanterraDessertSelector";
import EncanterraDessertMenu from "./EncanterraDessertMenu";
import EncanterraDessertCart from "./EncanterraDessertCart";
import EncanterraDessertContract from "./EncanterraDessertContract";
import EncanterraDessertCheckout from "./EncanterraDessertCheckout";

// ---------------- Types & constants ----------------
export type EncanterraStep =
  | "intro"
  | "tier"
  | "menu"
  | "encanterraCart"
  | "encanterraContract"
  | "encanterraCheckout"
  | "encanterraCateringThankYou"
  | "encanterraDessertThankYou"
  | "encanterraBothDoneThankYou"
  | "dessertStyle"
  | "dessertMenu"
  | "dessertCart"
  | "dessertContract"
  | "dessertCheckout";

type VenueName = "Encanterra";

const STORAGE = {
  step: "yumStep",
  tierLabel: "encanterraTierLabel",
  perGuest: "encanterraPerGuest",
  guestCount: "encanterraGuestCount",
};

// Builder tier IDs
type BuilderTier = "oneCarat" | "twoCarat" | "threeCarat";
type Tier = ENCSelections["tier"]; // same string union

// carat1/2/3 ↔ oneCarat/twoCarat/threeCarat
const mapDiamondToBuilder: Record<"carat1" | "carat2" | "carat3", BuilderTier> = {
  carat1: "oneCarat",
  carat2: "twoCarat",
  carat3: "threeCarat",
};
const mapBuilderToDiamond: Record<BuilderTier, "carat1" | "carat2" | "carat3"> = {
  oneCarat: "carat1",
  twoCarat: "carat2",
  threeCarat: "carat3",
};
const PRETTY_TIER: Record<BuilderTier, "1 Carat" | "2 Carat" | "3 Carat"> = {
  oneCarat: "1 Carat",
  twoCarat: "2 Carat",
  threeCarat: "3 Carat",
};

// ---------------- Component ----------------
interface Props {
  onClose: () => void;
  startAt?: EncanterraStep;
}

const EncanterraOverlay: React.FC<Props> = ({ onClose, startAt = "intro" }) => {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<EncanterraStep>(startAt);

  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([step], { targetRef: cardRef });

  const [venueName] = useState<VenueName>("Encanterra");

  // Catering selections
  const [tierSel, setTierSel] = useState<DiamondTierSelection | null>(null);
  const [menuSelections, setMenuSelections] = useState<ENCSelections>({
    tier: "oneCarat",
    hors: [],
    salads: [],
    entrees: [],
    sides: [],
  });

  // Totals / contract
  const [total, setTotal] = useState<number>(0);
  const [lineItems, setLineItems] = useState<string[]>([]);
  const [paymentSummaryText, setPaymentSummaryText] = useState<string>("");

  // Signature / date
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);
  const [userWeddingDate, setUserWeddingDate] = useState<string | null>(null);
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null);

  // Guest count
  const [guestCount] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(STORAGE.guestCount) || 0);
    } catch {
      return 0;
    }
  });

  // Dessert state
  type DessertType = "tieredCake" | "smallCakeTreats" | "treatsOnly";
  const [dessertType, setDessertType] = useState<DessertType>(
    (localStorage.getItem("yumDessertType") as DessertType) || "tieredCake"
  );
  const [flavorFilling, setFlavorFilling] = useState<string[]>([]);
  const [cakeStyle, setCakeStyle] = useState<string>("");
  const [treatType, setTreatType] = useState<"" | "cupcakes" | "goodies">("");
  const [goodies, setGoodies] = useState<string[]>([]);
  const [cupcakes, setCupcakes] = useState<string[]>([]);

  // Hydrate progress + date
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStep("intro");
        setLoading(false);
        return;
      }
      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        const data = (snap.data() || {}) as any;

        const fsDate = data?.weddingDate || null;
        if (fsDate) {
          setUserWeddingDate(fsDate);
          const d = new Date(`${fsDate}T12:00:00`);
          setUserDayOfWeek(d.toLocaleDateString("en-US", { weekday: "long" }));
          try { localStorage.setItem("yumSelectedDate", fsDate); } catch {}
        }

        const hasCatering = !!data?.bookings?.catering;
        const hasDessert = !!data?.bookings?.dessert;

        let next: EncanterraStep;
        if (hasCatering && hasDessert) next = "encanterraBothDoneThankYou";
        else if (hasCatering) next = "encanterraCateringThankYou";
        else next = "intro";

        setStep(next);
      } catch {
        setStep("intro");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  if (loading) return null;

  // ---------------- Render ----------------
return (
  <div
    id="encanterra-overlay-root"
    className="pixie-overlay"
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      paddingTop: "max(12px, env(safe-area-inset-top))",
      paddingRight: "max(12px, env(safe-area-inset-right))",
      paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      paddingLeft: "max(12px, env(safe-area-inset-left))",
      boxSizing: "border-box",
      overflowY: "auto",
      width: "100%",
      minHeight: "100dvh",
    }}
  >

    {/* Children render their own pixie-card; this stage just scrolls */}
    <div ref={cardRef} style={{ width: "100%" }}>
      {/* -------- Intro -------- */}
      {step === "intro" && (
        <EncanterraIntro onContinue={() => setStep("tier")} onClose={onClose} />
      )}

      {/* -------- Tier picker -------- */}
      {step === "tier" && (
  <DiamondTierSelector
    onSelect={async (sel) => {
      const nextTier = mapDiamondToBuilder[sel.id as "carat1" | "carat2" | "carat3"];
      const changed = menuSelections.tier !== nextTier;

      setTierSel(sel);
      setMenuSelections((prev) =>
        changed
          ? { tier: nextTier, hors: [], salads: [], entrees: [], sides: [] }
          : { ...prev, tier: nextTier }
      );

      try {
        localStorage.setItem(STORAGE.tierLabel, PRETTY_TIER[nextTier]);
        localStorage.setItem(STORAGE.perGuest, String(sel.pricePerGuest));

        if (changed) {
          localStorage.removeItem("encanterraMenuSelections");
          const user = getAuth().currentUser;
          if (user) {
            await setDoc(
              doc(db, "users", user.uid, "yumYumData", "encanterraMenuSelections"),
              { tier: nextTier, hors: [], salads: [], entrees: [], sides: [] },
              { merge: true }
            );
          }
        }
      } catch {/* ignore */}
    }}
    onContinue={() => setStep("menu")}
    defaultSelectedId={mapBuilderToDiamond[menuSelections.tier as BuilderTier] || "carat1"}
    onClose={onClose}         
  />
)}

      {/* -------- Menu builder -------- */}
      {step === "menu" && (
        <EncanterraMenuBuilderCatering
          selectedTier={(menuSelections?.tier as Tier) || "oneCarat"}
          menuSelections={menuSelections}
          setMenuSelections={setMenuSelections}
          onContinue={() => setStep("encanterraCart")}
          onBack={() => setStep("tier")}
          onClose={onClose}
        />
      )}

      {/* -------- Cart -------- */}
      {step === "encanterraCart" && (
        <EncanterraCartCatering
          selectedTier={(menuSelections?.tier as Tier) || "oneCarat"}
          menuSelections={menuSelections}
          setTotal={setTotal}
          setLineItems={setLineItems}
          setPaymentSummaryText={setPaymentSummaryText}
          onContinueToCheckout={() => setStep("encanterraContract")}
          onBackToMenu={() => setStep("menu")}
          onClose={onClose}
        />
      )}

      {/* -------- Contract -------- */}
      {step === "encanterraContract" && (
        <EncanterraContractCatering
          total={total}
          guestCount={guestCount}
          weddingDate={userWeddingDate}
          dayOfWeek={userDayOfWeek}
          lineItems={lineItems}
          selectedTier={(menuSelections.tier as Tier) || "oneCarat"}
          menuSelections={menuSelections}
          signatureImage={signatureImage}
          setSignatureImage={setSignatureImage}
          signatureSubmitted={signatureSubmitted}
          setSignatureSubmitted={setSignatureSubmitted}
          setStep={(next) => setStep(next as EncanterraStep)}
          onClose={onClose}
          onComplete={() => setStep("encanterraCheckout")}
        />
      )}

      {/* -------- Checkout -------- */}
      {step === "encanterraCheckout" && (
        <>
          <EncanterraCheckOutCatering
            total={total}
            guestCount={guestCount}
            lineItems={lineItems}
            diamondTier={PRETTY_TIER[(menuSelections.tier as Tier) || "oneCarat"]}
            menuSelections={menuSelections}
            onBack={() => setStep("encanterraContract")}
            onComplete={() => setStep("encanterraCateringThankYou")}
            onClose={onClose}
            isGenerating={false}
          />
        </>
      )}

      {/* -------- Catering Thank-you -------- */}
      {step === "encanterraCateringThankYou" && (
        <EncanterraCateringThankYou
          onContinueDesserts={() => setStep("dessertStyle")}
          onClose={onClose}
        />
      )}

      {/* -------- Dessert Thank-you -------- */}
      {step === "encanterraDessertThankYou" && <EncanterraDessertThankYou onClose={onClose} />}

      {/* -------- Both Done Thank-you -------- */}
      {step === "encanterraBothDoneThankYou" && <EncanterraBothDoneThankYou onClose={onClose} />}

      {/* -------- Dessert flow -------- */}
      {step === "dessertStyle" && (
        <EncanterraDessertSelector
          onSelectType={(t) => {
            setDessertType(t);
            localStorage.setItem("yumDessertType", t);
          }}
          onContinue={() => setStep("dessertMenu")}
          onBack={() => setStep("encanterraCateringThankYou")}
          onClose={onClose}
        />
      )}

      {step === "dessertMenu" && (
        <EncanterraDessertMenu
          dessertType={dessertType}
          flavorFilling={flavorFilling}
          setFlavorFilling={setFlavorFilling}
          onContinue={(sel) => {
            setFlavorFilling(sel.flavorFilling || []);
            setCakeStyle(sel.cakeStyle || "");
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
        <EncanterraDessertCart
          guestCount={guestCount}
          onGuestCountChange={(n) => localStorage.setItem(STORAGE.guestCount, String(n))}
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
        <EncanterraDessertContract
          total={total}
          guestCount={guestCount}
          weddingDate={userWeddingDate}
          dayOfWeek={userDayOfWeek}
          lineItems={lineItems}
          signatureImage={signatureImage}
          setSignatureImage={setSignatureImage}
          dessertStyle={dessertType}
          flavorCombo={flavorFilling.join(" + ")}
          setStep={(next) => setStep(next as EncanterraStep)}
          onClose={onClose}
          onComplete={(sig) => {
            setSignatureImage(sig);
            setStep("dessertCheckout");
          }}
        />
      )}

      {step === "dessertCheckout" && (
        <EncanterraDessertCheckout
          total={total}
          guestCount={guestCount}
          selectedStyle={dessertType}
          selectedFlavorCombo={flavorFilling.join(" + ")}
          paymentSummaryText={paymentSummaryText}
          lineItems={lineItems}
          signatureImage={signatureImage}
          setStep={(next) => setStep(next as EncanterraStep)}
          onBack={() => setStep("dessertContract")}
          onClose={onClose}
          isGenerating={false}
        />
      )}
    </div>
  </div>
);
};

export default EncanterraOverlay;