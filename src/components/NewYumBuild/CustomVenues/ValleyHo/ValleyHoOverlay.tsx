// src/components/NewYumBuild/CustomVenues/ValleyHo/ValleyHoOverlay.tsx
import React, { useEffect, useRef, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

// Screens
import ValleyHoIntro from "./ValleyHoIntro";
import ValleyHoServiceSelector from "./ValleyHoServiceSelector";
import ValleyHoMenuBuilder from "./ValleyHoMenuBuilder";
import ValleyHoCartCatering from "./ValleyHoCartCatering";
import ValleyHoContractCatering from "./ValleyHoContractCatering";
import ValleyHoCheckOutCatering from "./ValleyHoCheckOutCatering";
import ValleyHoCateringThankYou from "./ValleyHoCateringThankYou";

// Types shared with builder
import type { ValleyHoSelections, ValleyHoService } from "./ValleyHoMenuBuilder";

type Step =
  | "intro"
  | "service"
  | "menu"
  | "cart"
  | "contract"
  | "checkout"
  | "valleyHoCateringThankYou";

interface Props {
  onClose: () => void;
  startAt?: Step;
}

const ValleyHoOverlay: React.FC<Props> = ({ onClose, startAt = "intro" }) => {
  const [step, setStep] = useState<Step>(startAt);

  // ↓↓↓ add these just after `const [step, setStep] = useState<Step>(startAt);`
const hasHydratedReturnStep = useRef(false);

useEffect(() => {
  if (hasHydratedReturnStep.current) return;
  hasHydratedReturnStep.current = true;

  // 1) Local quick checks
  try {
    const lsStep = localStorage.getItem("yumStep") || "";
    const booked = localStorage.getItem("valleyHoCateringBooked") === "true";
    if (booked || lsStep === "valleyHoCateringThankYou") {
      setStep("valleyHoCateringThankYou");
      return;
    }
  } catch {}

  // 2) Firestore progress check (async)
  (async () => {
    const user = getAuth().currentUser;
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const d: any = snap.data() || {};
      const prog = d?.progress?.yumYum?.step;
      if (prog === "valleyHoCateringThankYou") {
        setStep("valleyHoCateringThankYou");
      }
    } catch {
      /* ignore */
    }
  })();
}, []);

  /* ──────────────────────────────────────────────────────────
     Auto-resume to Thank You if user already completed VH flow
     ────────────────────────────────────────────────────────── */
  useEffect(() => {
    // 1) Fast localStorage check
    try {
      const s = localStorage.getItem("yumStep");
      if (s === "valleyHoCateringThankYou") {
        setStep("valleyHoCateringThankYou");
        return; // no need to check Firestore
      }
    } catch {/* noop */}

    // 2) Firestore check on auth
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const fsStep = snap.data()?.progress?.yumYum?.step;
        if (fsStep === "valleyHoCateringThankYou") {
          setStep("valleyHoCateringThankYou");
        }
      } catch {/* noop */}
    });
    return () => unsub();
  }, []);

  // Frame helpers
  const cardRef = useRef<HTMLDivElement | null>(null);

  // ───────── User context (date + DOW) ─────────
  const [weddingDate, setWeddingDate] = useState<string | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const d: any = snap.data() || {};
        const w = d?.weddingDate || d?.profileData?.weddingDate || null;
        setWeddingDate(w || null);
        if (w) {
          const dt = new Date(`${w}T12:00:00`);
          setDayOfWeek(dt.toLocaleDateString(undefined, { weekday: "long" }));
        }
      } catch {/* noop */}
    });
    return () => unsub();
  }, []);

  // ───────── Flow state ─────────
  const [serviceOption, setServiceOption] = useState<ValleyHoService>("plated");

  const initialSelections: ValleyHoSelections = {
    hors: [] as string[],
    salad: [] as string[],
    platedEntrees: [] as string[],

    // stations
    stationA: undefined,
    stationB: undefined,

    pastaPicks: [] as string[],
    riceBases: [] as string[],
    riceProteins: [] as string[],
    sliderPicks: [] as string[],
    tacoPicks: [] as string[],

    // kids
    kids: { needed: false, count: 0, picks: [] as string[] },
  };

  const [menuSelections, setMenuSelections] =
    useState<ValleyHoSelections>(initialSelections);

  const [guestCount] = useState<number>(
    Number(localStorage.getItem("magicGuestCount") || 0)
  );

  // Cart/contract handoff values
  const [total, setTotal] = useState(0);
  const [lineItems, setLineItems] = useState<string[]>([]);
  const [paymentSummaryText, setPaymentSummaryText] = useState("");

  // Signature (contract)
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);

  // Persist simple progress breadcrumbs so the child pages can mirror the same key names
  useEffect(() => {
    try {
      const key =
        step === "cart"
          ? "valleyHoCart"
          : step === "contract"
          ? "valleyHoContract"
          : step === "checkout"
          ? "valleyHoCheckout"
          : step === "valleyHoCateringThankYou"
          ? "valleyHoCateringThankYou"
          : "valleyHoMenu";
      localStorage.setItem("yumStep", key);
    } catch {}
    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step":
          step === "valleyHoCateringThankYou" ? "valleyHoCateringThankYou" : step,
      }).catch(() => {});
    }
  }, [step]);

  return (
    <div
      className="pixie-overlay"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: "calc(max(12px, env(safe-area-inset-top)) + 16px)",
        paddingRight: "max(12px, env(safe-area-inset-right))",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        paddingLeft: "max(12px, env(safe-area-inset-left))",
        boxSizing: "border-box",
        overflowY: "auto",
        width: "100%",
        height: "100%",
      }}
    >
      <div ref={cardRef} style={{ width: "100%" }}>
        {/* Intro → Service choice */}
        {step === "intro" && (
          <ValleyHoIntro
            onContinue={() => setStep("service")}
            onClose={onClose}
          />
        )}

        {step === "service" && (
          <ValleyHoServiceSelector
            serviceOption={serviceOption}
            onSelect={(s) => setServiceOption(s)}
            onContinue={() => setStep("menu")}
            onBack={() => setStep("intro")}
            onClose={onClose}
          />
        )}

        {/* Menu builder */}
        {step === "menu" && (
          <ValleyHoMenuBuilder
            serviceOption={serviceOption}
            menuSelections={menuSelections}
            setMenuSelections={setMenuSelections}
            onBack={() => setStep("service")}
            onContinue={() => setStep("cart")}
            onClose={onClose}
          />
        )}

        {/* Cart */}
        {step === "cart" && (
          <ValleyHoCartCatering
            serviceOption={serviceOption}
            menuSelections={menuSelections}
            guestCount={guestCount}
            setTotal={setTotal}
            setLineItems={setLineItems}
            setPaymentSummaryText={setPaymentSummaryText}
            onContinueToCheckout={() => setStep("contract")}
            onBackToMenu={() => setStep("menu")}
            onClose={onClose}
          />
        )}

        {/* Contract */}
        {step === "contract" && (
          <ValleyHoContractCatering
            total={total}
            guestCount={guestCount}
            weddingDate={weddingDate}
            dayOfWeek={dayOfWeek}
            lineItems={lineItems}
            serviceOption={serviceOption}
            menuSelections={menuSelections}
            signatureImage={signatureImage}
            setSignatureImage={setSignatureImage}
            signatureSubmitted={signatureSubmitted}
            setSignatureSubmitted={setSignatureSubmitted}
            onBack={() => setStep("cart")}
            onContinueToCheckout={() => setStep("checkout")}
            onComplete={() => setStep("valleyHoCateringThankYou")}
            onClose={onClose}
          />
        )}

        {/* Checkout (Stripe) */}
        {step === "checkout" && (
          <ValleyHoCheckOutCatering
            total={total}
            guestCount={guestCount}
            lineItems={lineItems}
            serviceOption={serviceOption}
            menuSelections={menuSelections}
            onBack={() => setStep("contract")}
            onComplete={() => setStep("valleyHoCateringThankYou")}
            onClose={onClose}
            isGenerating={false}
          />
        )}

        {/* Thank you */}
        {step === "valleyHoCateringThankYou" && (
          <ValleyHoCateringThankYou onClose={onClose} />
        )}
      </div>
    </div>
  );
};

export default ValleyHoOverlay;