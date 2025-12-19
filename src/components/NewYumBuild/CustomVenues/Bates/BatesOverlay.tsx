// src/components/NewYumBuild/CustomVenues/Bates/BatesOverlay.tsx
import React, { useEffect, useState, useRef } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

// Catering screens
import BatesIntro from "./BatesIntro";
import BatesMenuBuilderCatering from "./BatesMenuBuilderCatering";
import BatesCartCatering from "./BatesCartCatering";
import BatesContractCatering from "./BatesContractCatering";
import BatesCheckOutCatering from "./BatesCheckOutCatering";
import BatesCateringThankYou from "./BatesCateringThankYou";

// Dessert screens
import BatesDessertSelector from "./BatesDessertSelector";
import BatesDessertMenu from "./BatesDessertMenu";
import BatesDessertCart from "./BatesDessertCart";
import BatesDessertContract from "./BatesDessertContract";
import BatesDessertCheckout from "./BatesDessertCheckout";
import BatesDessertThankYou from "./BatesDessertThankYou";

// Final “both done”
import BatesBothDoneThankYou from "./BatesBothDoneThankYou";

// UX helpers
import { useOverlayOpen } from "../../../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../../../hooks/useScrollToTop";

// Types
type DessertType = "tieredCake" | "smallCakeTreats" | "treatsOnly";

export type BatesStep =
  | "intro"
  | "cateringMenu"
  | "cateringCart"
  | "cateringContract"
  | "cateringCheckout"
  | "batesCateringThankYou"
  | "dessertStyle"
  | "dessertMenu"
  | "dessertCart"
  | "dessertContract"
  | "dessertCheckout"
  | "batesDessertThankYou"
  | "batesBothDoneThankYou";

  const BATES_STEPS: BatesStep[] = [
    "intro",
    "cateringMenu",
    "cateringCart",
    "cateringContract",
    "cateringCheckout",
    "batesCateringThankYou",
    "dessertStyle",
    "dessertMenu",
    "dessertCart",
    "dessertContract",
    "dessertCheckout",
    "batesDessertThankYou",
    "batesBothDoneThankYou",
  ];
  
  const isBatesStep = (v: any): v is BatesStep =>
    typeof v === "string" && (BATES_STEPS as string[]).includes(v);

interface BatesOverlayProps {
  onClose: () => void;
  startAt?: BatesStep;
}

const BatesOverlay: React.FC<BatesOverlayProps> = ({ onClose, startAt }) => {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<BatesStep>(startAt ?? "intro");

  useEffect(() => {
    if (startAt && isBatesStep(startAt)) {
      setStep(startAt);
    }
  }, [startAt]);

  // User context
  const [userWeddingDate, setUserWeddingDate] = useState<string | null>(null);
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null);

  // Catering cart/contract state
  const [menuSelections, setMenuSelections] = useState<{
    hors: string[];
    salads: string[];
    entrees: string[];
  }>({
    hors: [],
    salads: [],
    entrees: [],
  });
  const [addonsTotal, setAddonsTotal] = useState(0);
  const [total, setTotal] = useState<number>(0);
  const [lineItems, setLineItems] = useState<string[]>([]);
  const [paymentSummaryText, setPaymentSummaryText] = useState<string>(
    "Included with your Bates venue booking"
  );

  // Pay mode for catering add-ons
  const [payFull, setPayFull] = useState<boolean>(true);

  // Contract signature
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);

  // Dessert state
  const [dessertType, setDessertType] = useState<DessertType>("tieredCake");
  const [flavorFilling, setFlavorFilling] = useState<string[]>([]);
  const [cakeStyle, setCakeStyle] = useState<string>("");
  const [treatType, setTreatType] = useState<"" | "cupcakes" | "goodies">("");
  const [goodies, setGoodies] = useState<string[]>([]);
  const [cupcakes, setCupcakes] = useState<string[]>([]);
  const [guestCount] = useState<number>(
    Number(localStorage.getItem("magicGuestCount") || 0)
  );

  // Frame helpers
  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([step], { targetRef: cardRef });

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = (snap.data() || {}) as any;
        // ✅ 1) Only honor startAt if it's NOT "intro"
// (MenuController/Dashboard defaults to "intro" and that should not override resume)
if (startAt && isBatesStep(startAt) && startAt !== "intro") {
  setStep(startAt);
} else {
  // ✅ 2) Resume from saved progress first (Firestore → localStorage)
  const fsStep = data?.progress?.yumYum?.step;
  const lsStep = localStorage.getItem("yumStep");

  const resumeStep: BatesStep | null =
    (isBatesStep(fsStep) && fsStep) ||
    (isBatesStep(lsStep) && lsStep) ||
    null;

  if (resumeStep) {
    setStep(resumeStep);
  } else {
    // ✅ 3) Only if no resume exists, fall back to booking-based landing
    const catering = !!data?.bookings?.catering;
    const dessert = !!data?.bookings?.dessert;

    if (!catering && !dessert) setStep("intro");
    else if (catering && !dessert) setStep("batesCateringThankYou");
    else setStep("batesBothDoneThankYou");
  }
}

        // hydrate wedding date if present
        const ymd =
          data?.weddingDate ||
          data?.wedding?.date ||
          localStorage.getItem("yumWeddingDate") ||
          localStorage.getItem("weddingDate") ||
          null;
        if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
          setUserWeddingDate(ymd);
          const d = new Date(`${ymd}T12:00:00`);
          setUserDayOfWeek(
            d.toLocaleDateString("en-US", { weekday: "long" })
          );
        }
      } catch (e) {
        console.warn("[BatesOverlay] fetch user failed:", e);
        setStep("intro");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [startAt]);

  if (loading) return null;

  // ── RENDER — single overlay, children own their pink X ──────
  return (
    <div
      id="bates-overlay-root"
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
      }}
    >
      {/* Scrollable stage (children render their own pixie-card) */}
      <div ref={cardRef} style={{ width: "100%" }}>
        {/* ───────────── Intro → Catering builder ───────────── */}
        {step === "intro" && (
          <BatesIntro
            onContinue={() => setStep("cateringMenu")}
            onClose={onClose}
          />
        )}

        {step === "cateringMenu" && (
          <BatesMenuBuilderCatering
            menuSelections={menuSelections}
            setMenuSelections={setMenuSelections}
            onBack={() => setStep("intro")}
            onContinue={() => setStep("cateringCart")}
            onClose={onClose}
          />
        )}

        {step === "cateringCart" && (
          <BatesCartCatering
            guestCount={0}
            menuSelections={menuSelections}
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
          <BatesContractCatering
            total={total}
            addonsTotal={addonsTotal}
            guestCount={0}
            weddingDate={userWeddingDate}
            dayOfWeek={userDayOfWeek}
            lineItems={lineItems}
            menuSelections={menuSelections}
            signatureImage={signatureImage}
            setSignatureImage={setSignatureImage}
            signatureSubmitted={signatureSubmitted}
            setSignatureSubmitted={setSignatureSubmitted}
            onBack={() => setStep("cateringCart")}
            onComplete={() => {
              // Always go through checkout; handles 0 and >0 totals
              setStep("cateringCheckout");
            }}
            onClose={onClose}
            payFull={payFull}
            setPayFull={setPayFull}
          />
        )}

        {step === "cateringCheckout" && (
          <BatesCheckOutCatering
            onBack={() => setStep("cateringCart")}
            onClose={onClose}
            total={total}
            payFull={payFull}
            // let checkout compute its own summary so it reflects payFull
            signatureImage={
              signatureImage || localStorage.getItem("yumSignature") || ""
            }
            onSuccess={() => setStep("batesCateringThankYou")}
            firstName={""}
            lastName={""}
            weddingDate={userWeddingDate || ""}
            dayOfWeek={userDayOfWeek}
            lineItems={lineItems}
            uid={getAuth().currentUser?.uid || ""}
            guestCount={guestCount}
          />
        )}

        {step === "batesCateringThankYou" && (
          <BatesCateringThankYou
            onBookDessertNow={() => setStep("dessertStyle")}
            onClose={onClose}
          />
        )}

        {/* ───────────── Dessert flow ───────────── */}
        {step === "dessertStyle" && (
          <BatesDessertSelector
            onSelectType={(type) => setDessertType(type)}
            onContinue={() => setStep("dessertMenu")}
            onBack={() => setStep("batesCateringThankYou")}
            onClose={onClose}
          />
        )}

        {step === "dessertMenu" && (
          <BatesDessertMenu
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
          <BatesDessertCart
            guestCount={guestCount}
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
            onContinueToCheckout={() => setStep("dessertContract")}
            onStartOver={() => setStep("dessertStyle")}
            onClose={onClose}
            weddingDate={userWeddingDate}
          />
        )}

        {step === "dessertContract" && (
          <BatesDessertContract
            total={total}
            guestCount={guestCount}
            weddingDate={userWeddingDate}
            dayOfWeek={userDayOfWeek}
            lineItems={lineItems}
            signatureImage={signatureImage}
            setSignatureImage={setSignatureImage}
            dessertStyle={dessertType || ""}
            flavorCombo={flavorFilling.join(" + ")}
            setStep={(next) => setStep(next as BatesStep)}
            onClose={onClose}
            onComplete={(sig) => {
              setSignatureImage(sig);
              setStep("dessertCheckout");
            }}
          />
        )}

        {step === "dessertCheckout" && (
          <BatesDessertCheckout
            total={total}
            guestCount={guestCount}
            selectedStyle={dessertType || ""}
            selectedFlavorCombo={flavorFilling.join(" + ")}
            paymentSummaryText={paymentSummaryText}
            lineItems={lineItems}
            signatureImage={signatureImage || ""}
            setStep={(next) => setStep(next as BatesStep)}
            onBack={() => setStep("dessertContract")}
            onClose={onClose}
            isGenerating={false}
          />
        )}

        {step === "batesDessertThankYou" && (
          <BatesDessertThankYou
            onClose={() => setStep("batesBothDoneThankYou")}
          />
        )}

        {step === "batesBothDoneThankYou" && (
          <BatesBothDoneThankYou onClose={onClose} />
        )}
      </div>
    </div>
  );
};

export default BatesOverlay;