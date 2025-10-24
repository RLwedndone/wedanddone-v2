// src/components/NewYumBuild/CustomVenues/Rubi/RubiOverlay.tsx
import React, { useEffect, useRef, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

// UX helpers
import { useOverlayOpen } from "../../../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../../../hooks/useScrollToTop";

// Screens
import RubiIntro from "./RubiIntro";
import RubiCateringMenuChoice from "./RubiCateringMenuChoice";

// 🔹 Split tier selectors
import RubiBBQTierSelector, { type RubiTierSelectionBBQ } from "./RubiBBQTierSelector";
import RubiMexTierSelector, { type RubiTierSelection as RubiTierSelectionMex } from "./RubiMexTierSelector";

// 🔹 Split builders
import RubiBBQMenuBuilder, { type RubiBBQSelections } from "./RubiBBQMenuBuilder";
import RubiMexMenuBuilder, { type RubiMexSelections } from "./RubiMexMenuBuilder";

// Shared downstream
import RubiCateringCart from "./RubiCateringCart";
import RubiCateringContract from "./RubiCateringContract";
import RubiCateringCheckOut from "./RubiCateringCheckOut";
import RubiCateringThankYou from "./RubiCateringThankYou";

// ---------------- Types ----------------
export type RubiStep =
  | "intro"
  | "rubiMenuChoice"
  | "bbqTier"
  | "mexTier"
  | "bbqMenu"
  | "mexMenu"
  | "rubiCart"
  | "rubiContract"
  | "rubiCheckout"
  | "rubiCateringThankYou";

type RubiMenuChoice = "bbq" | "mexican";
type AnyTierSelection = RubiTierSelectionBBQ | RubiTierSelectionMex;

interface Props {
  onClose: () => void;
  startAt?: RubiStep;
}

const STORAGE = {
  step: "yumStep",
  tierLabel: "rubiTierLabel",
  perGuest: "rubiPerGuest",
  guestCount: "rubiGuestCount",
};

// Blank selections (per branch)
const EMPTY_BBQ: RubiBBQSelections = {
  bbqStarters: [],
  bbqMeats: [],
  bbqSides: [],
  bbqDesserts: [],
  notes: "",
};

const EMPTY_MEX: RubiMexSelections = {
  mexPassedApps: [],
  mexStartersOrSoup: [],
  mexEntrees: [],
  mexSides: [],
  mexDesserts: [],
  notes: "",
};

const RubiOverlay: React.FC<Props> = ({ onClose, startAt = "intro" }) => {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<RubiStep>(startAt);

  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([step], { targetRef: cardRef });

  // ---- Core flow state ----
  const [menuChoice, setMenuChoice] = useState<RubiMenuChoice>(() => {
    try {
      return (localStorage.getItem("rubiMenuChoice") as RubiMenuChoice) || "bbq";
    } catch {
      return "bbq";
    }
  });

  const [tierSel, setTierSel] = useState<AnyTierSelection | null>(null);

  // Split selection state
  const [bbqSelections, setBBQSelections] = useState<RubiBBQSelections>(EMPTY_BBQ);
  const [mexSelections, setMexSelections] = useState<RubiMexSelections>(EMPTY_MEX);

  // Totals / receipts
  const [total, setTotal] = useState<number>(0);
  const [lineItems, setLineItems] = useState<string[]>([]);
  const [paymentSummaryText, setPaymentSummaryText] = useState<string>("");

  // Signature + date (for contract)
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);
  const [userWeddingDate, setUserWeddingDate] = useState<string | null>(null);
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null);

  const [guestCount] = useState<number>(() => {
    try {
      return Number(
        localStorage.getItem(STORAGE.guestCount) ||
          localStorage.getItem("magicGuestCount") ||
          0
      );
    } catch {
      return 0;
    }
  });

  // ---- Boot / resume ----
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) {
        setStep("intro");
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = (snap.data() || {}) as any;

        const fsDate = data?.weddingDate || data?.profileData?.weddingDate || null;
        if (fsDate) {
          setUserWeddingDate(fsDate);
          const d = new Date(`${fsDate}T12:00:00`);
          setUserDayOfWeek(d.toLocaleDateString("en-US", { weekday: "long" }));
          try {
            localStorage.setItem("yumSelectedDate", fsDate);
          } catch {}
        }

        const hasCatering = !!data?.bookings?.catering;
        setStep(hasCatering ? "rubiCateringThankYou" : "intro");
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
      id="rubi-overlay-root"
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
      <div ref={cardRef} style={{ width: "100%" }}>
        {/* -------- Intro -------- */}
        {step === "intro" && (
          <RubiIntro onContinue={() => setStep("rubiMenuChoice")} onClose={onClose} />
        )}

        {/* -------- Menu Choice (BBQ vs Mexican) -------- */}
        {step === "rubiMenuChoice" && (
          <RubiCateringMenuChoice
            menuOption={menuChoice}
            onSelect={(choice) => {
              setMenuChoice(choice);
              try { localStorage.setItem("rubiMenuChoice", choice); } catch {}
            }}
            onContinue={() => setStep(menuChoice === "bbq" ? "bbqTier" : "mexTier")}
            onBack={() => setStep("intro")}
            onClose={onClose}
          />
        )}

        {/* -------- Tier selectors -------- */}
        {step === "bbqTier" && (
          <RubiBBQTierSelector
            onSelect={(sel) => {
              setTierSel(sel);
              // Hard reset BBQ branch state + LS keys
              setBBQSelections(EMPTY_BBQ);
              try {
                localStorage.setItem(STORAGE.tierLabel, sel.prettyName);
                localStorage.setItem(STORAGE.perGuest, String(sel.pricePerGuest));
                localStorage.setItem("rubiTierId", sel.id);
                localStorage.setItem("rubiMenuCtx", `bbq|${sel.id}`);
                localStorage.removeItem("rubiBBQSelections");
                localStorage.removeItem("rubiMexSelections");
                localStorage.removeItem("rubiPerGuestExtrasCents");
                localStorage.removeItem("rubiCartData");
                localStorage.removeItem("rubiCartSnapshot");
                window.dispatchEvent(new CustomEvent("rubi:resetMenu"));
              } catch {}
            }}
            onContinue={() => setStep("bbqMenu")}
            onBack={() => setStep("rubiMenuChoice")}
            onClose={onClose}
          />
        )}

        {step === "mexTier" && (
          <RubiMexTierSelector
            onSelect={(sel) => {
              setTierSel(sel);
              // Hard reset Mexican branch state + LS keys
              setMexSelections(EMPTY_MEX);
              try {
                localStorage.setItem(STORAGE.tierLabel, sel.prettyName);
                localStorage.setItem(STORAGE.perGuest, String(sel.pricePerGuest));
                localStorage.setItem("rubiTierId", sel.id);
                localStorage.setItem("rubiMenuCtx", `mexican|${sel.id}`);
                localStorage.removeItem("rubiMexSelections");
                localStorage.removeItem("rubiBBQSelections");
                localStorage.removeItem("rubiPerGuestExtrasCents");
                localStorage.removeItem("rubiCartData");
                localStorage.removeItem("rubiCartSnapshot");
                window.dispatchEvent(new CustomEvent("rubi:resetMenu"));
              } catch {}
            }}
            onContinue={() => setStep("mexMenu")}
            onBack={() => setStep("rubiMenuChoice")}
            onClose={onClose}
          />
        )}

        {/* -------- Menu builders -------- */}
        {step === "bbqMenu" && tierSel && (
          <RubiBBQMenuBuilder
            tierSelection={tierSel as RubiTierSelectionBBQ}
            selections={bbqSelections}
            setSelections={setBBQSelections}
            onContinue={() => setStep("rubiCart")}
            onBack={() => setStep("bbqTier")}
            onClose={onClose}
          />
        )}

        {step === "mexMenu" && tierSel && (
          <RubiMexMenuBuilder
            tierSelection={tierSel as RubiTierSelectionMex}
            selections={mexSelections}
            setSelections={setMexSelections}
            onContinue={() => setStep("rubiCart")}
            onBack={() => setStep("mexTier")}
            onClose={onClose}
          />
        )}

        {/* -------- Cart -------- */}
        {step === "rubiCart" && tierSel && (
          <RubiCateringCart
            menuChoice={menuChoice}
            tierSelection={tierSel}
            selections={menuChoice === "bbq" ? bbqSelections : mexSelections}
            setTotal={setTotal}
            setLineItems={setLineItems}
            setPaymentSummaryText={setPaymentSummaryText}
            onContinueToCheckout={() => setStep("rubiContract")}
            onBackToMenu={() => setStep(menuChoice === "bbq" ? "bbqMenu" : "mexMenu")}
            onClose={onClose}
          />
        )}

        {/* -------- Contract (discriminated rendering) -------- */}
        {step === "rubiContract" && tierSel && menuChoice === "bbq" && (
          <RubiCateringContract
            menuChoice="bbq"
            tierSelection={tierSel as RubiTierSelectionBBQ}
            selections={bbqSelections}
            total={total}
            guestCount={guestCount}
            weddingDate={userWeddingDate}
            dayOfWeek={userDayOfWeek}
            lineItems={lineItems}
            signatureImage={signatureImage}
            setSignatureImage={setSignatureImage}
            signatureSubmitted={signatureSubmitted}
            setSignatureSubmitted={setSignatureSubmitted}
            onBack={() => setStep("rubiCart")}
            onContinueToCheckout={() => setStep("rubiCheckout")}
            onClose={onClose}
            onComplete={() => setStep("rubiCheckout")}
          />
        )}

        {step === "rubiContract" && tierSel && menuChoice === "mexican" && (
          <RubiCateringContract
            menuChoice="mexican"
            tierSelection={tierSel as RubiTierSelectionMex}
            selections={mexSelections}
            total={total}
            guestCount={guestCount}
            weddingDate={userWeddingDate}
            dayOfWeek={userDayOfWeek}
            lineItems={lineItems}
            signatureImage={signatureImage}
            setSignatureImage={setSignatureImage}
            signatureSubmitted={signatureSubmitted}
            setSignatureSubmitted={setSignatureSubmitted}
            onBack={() => setStep("rubiCart")}
            onContinueToCheckout={() => setStep("rubiCheckout")}
            onClose={onClose}
            onComplete={() => setStep("rubiCheckout")}
          />
        )}

        {/* -------- Checkout -------- */}
        {step === "rubiCheckout" && tierSel && (
          <RubiCateringCheckOut
            total={total}
            guestCount={guestCount}
            lineItems={lineItems}
            menuChoice={menuChoice}
            tierSelection={tierSel}
            onBack={() => setStep("rubiContract")}
            onComplete={() => setStep("rubiCateringThankYou")}
            onClose={onClose}
            isGenerating={false}
          />
        )}

        {/* -------- Thank You -------- */}
        {step === "rubiCateringThankYou" && (
          <RubiCateringThankYou
            onContinueDesserts={() => {
              // Dessert flow TBD for Rubi
              console.log("Dessert flow TBD");
            }}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
};

export default RubiOverlay;