// src/components/NewYumBuild/CustomVenues/Rubi/RubiOverlay.tsx
import React, { useEffect, useRef, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

// UX helpers
import { useOverlayOpen } from "../../../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../../../hooks/useScrollToTop";

// Catering Screens
import RubiIntro from "./RubiIntro";
import RubiCateringMenuChoice from "./RubiCateringMenuChoice";

import RubiBBQTierSelector, {
  type RubiTierSelectionBBQ,
} from "./RubiBBQTierSelector";
import RubiMexTierSelector, {
  type RubiTierSelection as RubiTierSelectionMex,
} from "./RubiMexTierSelector";

import RubiBBQMenuBuilder, {
  type RubiBBQSelections,
} from "./RubiBBQMenuBuilder";
import RubiMexMenuBuilder, {
  type RubiMexSelections,
} from "./RubiMexMenuBuilder";

import RubiCateringCart from "./RubiCateringCart";
import RubiCateringContract from "./RubiCateringContract";
import RubiCateringCheckOut from "./RubiCateringCheckOut";
import RubiCateringThankYou from "./RubiCateringThankYou";

// Dessert Screens (NEW)
import RubiDessertSelector from "./RubiDessertSelector";
import RubiDessertMenu from "./RubiDessertMenu";
import RubiDessertCart from "./RubiDessertCart";
import RubiDessertContract from "./RubiDessertContract";
import RubiDessertCheckout from "./RubiDessertCheckout2";
import RubiBothDoneThankYou from "./RubiBothDoneThankYou";

// ---------------- Types ----------------

// 1. ✅ Extend RubiStep with all dessert screens + final TY
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
  | "rubiCateringThankYou"
  | "rubiDessertSelector"
  | "rubiDessertMenu"
  | "rubiDessertCart"
  | "rubiDessertContract"
  | "rubiDessertCheckout"
  | "rubiBothDoneThankYou";

type RubiMenuChoice = "bbq" | "mexican";
type AnyTierSelection = RubiTierSelectionBBQ | RubiTierSelectionMex;

// Dessert local state types (mirrors Bates flow)
type DessertType = "tieredCake" | "smallCakeTreats" | "treatsOnly" | "";
type TreatType = "" | "cupcakes" | "goodies";

interface DessertSelectionsSnapshot {
  dessertType: DessertType;
  flavorFilling: string[]; // combo titles
  cakeStyle: string;
  treatType: TreatType;
  goodies: string[]; // "Group::Label" tokens
  cupcakes: string[]; // flavor titles
}

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

// Blank catering selections
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

// Blank dessert snapshot
const EMPTY_DESSERT: DessertSelectionsSnapshot = {
  dessertType: "",
  flavorFilling: [],
  cakeStyle: "",
  treatType: "",
  goodies: [],
  cupcakes: [],
};

const RubiOverlay: React.FC<Props> = ({ onClose, startAt = "intro" }) => {
  const [loading, setLoading] = useState(true);

  // master step
  const [step, setStep] = useState<RubiStep>(startAt);

  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([step], { targetRef: cardRef });

  // ---- Catering branch core state ----
  const [menuChoice, setMenuChoice] = useState<RubiMenuChoice>(() => {
    try {
      return (
        (localStorage.getItem("rubiMenuChoice") as RubiMenuChoice) ||
        "bbq"
      );
    } catch {
      return "bbq";
    }
  });

  const [tierSel, setTierSel] = useState<AnyTierSelection | null>(
    null
  );

  // split catering picks
  const [bbqSelections, setBBQSelections] =
    useState<RubiBBQSelections>(EMPTY_BBQ);
  const [mexSelections, setMexSelections] =
    useState<RubiMexSelections>(EMPTY_MEX);

  // ---- Dessert branch state (mirrors Bates) ----
  const [dessertSel, setDessertSel] = useState<DessertSelectionsSnapshot>(
    () => {
      // hydrate from LS if present
      try {
        const raw = localStorage.getItem(
          "yumDessertSelections"
        );
        if (!raw) return EMPTY_DESSERT;
        const parsed = JSON.parse(raw);
        return {
          dessertType: parsed.dessertType || "",
          flavorFilling: parsed.flavorFilling || [],
          cakeStyle: parsed.cakeStyle || "",
          treatType: parsed.treatType || "",
          goodies: parsed.goodies || [],
          cupcakes: parsed.cupcakes || [],
        };
      } catch {
        return EMPTY_DESSERT;
      }
    }
  );

  // Individual dessert pieces we pass down explicitly
  const [dessertType, setDessertType] = useState<DessertType>(
    dessertSel.dessertType
  );
  const [flavorFilling, setFlavorFilling] = useState<string[]>(
    dessertSel.flavorFilling
  );
  const [cakeStyle, setCakeStyle] = useState<string>(
    dessertSel.cakeStyle
  );
  const [treatType, setTreatType] = useState<TreatType>(
    dessertSel.treatType
  );
  const [goodies, setGoodies] = useState<string[]>(
    dessertSel.goodies
  );
  const [cupcakes, setCupcakes] = useState<string[]>(
    dessertSel.cupcakes
  );

  // ---- Totals / receipts ----
  const [total, setTotal] = useState<number>(0); // reused for catering & dessert cart totals
  const [lineItems, setLineItems] = useState<string[]>([]);
  const [paymentSummaryText, setPaymentSummaryText] =
    useState<string>("");

  // ---- For both contracts ----
  const [signatureImage, setSignatureImage] = useState<
    string | null
  >(null);
  const [signatureSubmitted, setSignatureSubmitted] =
    useState(false);

  // wedding date context (shown in contracts)
  const [userWeddingDate, setUserWeddingDate] = useState<
    string | null
  >(null);
  const [userDayOfWeek, setUserDayOfWeek] = useState<
    string | null
  >(null);

  // We'll use this for both catering & dessert, but lock
  // logic is handled in the cart components.
  const [guestCount] = useState<number>(() => {
    try {
      return Number(
        localStorage.getItem(STORAGE.guestCount) ||
          localStorage.getItem("magicGuestCount") ||
          localStorage.getItem("yumGuestCount") ||
          0
      );
    } catch {
      return 0;
    }
  });

  // ---- Are they already booked? ----
  const [hasCateringBooking, setHasCateringBooking] =
    useState(false);
  const [hasDessertBooking, setHasDessertBooking] =
    useState(false);

  // ---- Boot / resume from account ----
  useEffect(() => {
    const unsub = onAuthStateChanged(
      getAuth(),
      async (user) => {
        if (!user) {
          setStep("intro");
          setLoading(false);
          return;
        }
        try {
          const snap = await getDoc(
            doc(db, "users", user.uid)
          );
          const data = (snap.data() || {}) as any;

          // wedding date hydrate
          const fsDate =
            data?.weddingDate ||
            data?.profileData?.weddingDate ||
            null;
          if (fsDate) {
            setUserWeddingDate(fsDate);
            const d = new Date(`${fsDate}T12:00:00`);
            setUserDayOfWeek(
              d.toLocaleDateString("en-US", {
                weekday: "long",
              })
            );
            try {
              localStorage.setItem(
                "yumSelectedDate",
                fsDate
              );
              localStorage.setItem(
                "yumWeddingDate",
                fsDate
              );
            } catch {}
          }

          // booking flags from Firestore
          const bookedCatering = !!(
            data?.bookings?.catering ||
            data?.rubiCateringBooked ||
            data?.yumCateringBooked
          );
          const bookedDessert = !!(
            data?.bookings?.dessert ||
            data?.rubiDessertBooked ||
            data?.batesDessertsBooked ||
            data?.yumDessertBooked
          );

          setHasCateringBooking(bookedCatering);
          setHasDessertBooking(bookedDessert);

          // resume logic:
          // - both booked -> final TY
          // - catering booked only -> catering TY (with "Book Desserts" CTA)
          // - else start at intro
          if (bookedCatering && bookedDessert) {
            setStep("rubiBothDoneThankYou");
          } else if (bookedCatering) {
            setStep("rubiCateringThankYou");
          } else {
            setStep("intro");
          }
        } catch {
          setStep("intro");
        } finally {
          setLoading(false);
        }
      }
    );
    return () => unsub();
  }, []);

  if (loading) return null;

  // little helper to persist dessert snapshot to LS when we move between dessert steps
  const saveDessertSnapshot = (next?: Partial<DessertSelectionsSnapshot>) => {
    const snap: DessertSelectionsSnapshot = {
      dessertType,
      flavorFilling,
      cakeStyle,
      treatType,
      goodies,
      cupcakes,
      ...next,
    };
    try {
      localStorage.setItem(
        "yumDessertSelections",
        JSON.stringify(snap)
      );
    } catch {}
  };

  // ================== RENDER ==================
  return (
    <div
      id="rubi-overlay-root"
      className="pixie-overlay"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        paddingTop: "max(12px, env(safe-area-inset-top))",
        paddingRight:
          "max(12px, env(safe-area-inset-right))",
        paddingBottom:
          "max(12px, env(safe-area-inset-bottom))",
        paddingLeft:
          "max(12px, env(safe-area-inset-left))",
        boxSizing: "border-box",
        overflowY: "auto",
        width: "100%",
        minHeight: "100dvh",
      }}
    >
      <div ref={cardRef} style={{ width: "100%" }}>
        {/* -------- Intro -------- */}
        {step === "intro" && (
          <RubiIntro
            onContinue={() =>
              setStep("rubiMenuChoice")
            }
            onClose={onClose}
          />
        )}

        {/* -------- Catering Menu Choice (BBQ vs Mexican) -------- */}
        {step === "rubiMenuChoice" && (
          <RubiCateringMenuChoice
            menuOption={menuChoice}
            onSelect={(choice) => {
              setMenuChoice(choice);
              try {
                localStorage.setItem(
                  "rubiMenuChoice",
                  choice
                );
              } catch {}
            }}
            onContinue={() =>
              setStep(
                menuChoice === "bbq"
                  ? "bbqTier"
                  : "mexTier"
              )
            }
            onBack={() => setStep("intro")}
            onClose={onClose}
          />
        )}

        {/* -------- Tier selectors -------- */}
        {step === "bbqTier" && (
          <RubiBBQTierSelector
            onSelect={(sel) => {
              setTierSel(sel);
              setBBQSelections(
                EMPTY_BBQ
              );
              try {
                localStorage.setItem(
                  STORAGE.tierLabel,
                  sel.prettyName
                );
                localStorage.setItem(
                  STORAGE.perGuest,
                  String(sel.pricePerGuest)
                );
                localStorage.setItem(
                  "rubiTierId",
                  sel.id
                );
                localStorage.setItem(
                  "rubiMenuCtx",
                  `bbq|${sel.id}`
                );
                localStorage.removeItem(
                  "rubiBBQSelections"
                );
                localStorage.removeItem(
                  "rubiMexSelections"
                );
                localStorage.removeItem(
                  "rubiPerGuestExtrasCents"
                );
                localStorage.removeItem(
                  "rubiCartData"
                );
                localStorage.removeItem(
                  "rubiCartSnapshot"
                );
                window.dispatchEvent(
                  new CustomEvent(
                    "rubi:resetMenu"
                  )
                );
              } catch {}
            }}
            onContinue={() =>
              setStep("bbqMenu")
            }
            onBack={() =>
              setStep("rubiMenuChoice")
            }
            onClose={onClose}
          />
        )}

        {step === "mexTier" && (
          <RubiMexTierSelector
            onSelect={(sel) => {
              setTierSel(sel);
              setMexSelections(
                EMPTY_MEX
              );
              try {
                localStorage.setItem(
                  STORAGE.tierLabel,
                  sel.prettyName
                );
                localStorage.setItem(
                  STORAGE.perGuest,
                  String(sel.pricePerGuest)
                );
                localStorage.setItem(
                  "rubiTierId",
                  sel.id
                );
                localStorage.setItem(
                  "rubiMenuCtx",
                  `mexican|${sel.id}`
                );
                localStorage.removeItem(
                  "rubiMexSelections"
                );
                localStorage.removeItem(
                  "rubiBBQSelections"
                );
                localStorage.removeItem(
                  "rubiPerGuestExtrasCents"
                );
                localStorage.removeItem(
                  "rubiCartData"
                );
                localStorage.removeItem(
                  "rubiCartSnapshot"
                );
                window.dispatchEvent(
                  new CustomEvent(
                    "rubi:resetMenu"
                  )
                );
              } catch {}
            }}
            onContinue={() =>
              setStep("mexMenu")
            }
            onBack={() =>
              setStep("rubiMenuChoice")
            }
            onClose={onClose}
          />
        )}

        {/* -------- Catering Menu builders -------- */}
        {step === "bbqMenu" && tierSel && (
          <RubiBBQMenuBuilder
            tierSelection={
              tierSel as RubiTierSelectionBBQ
            }
            selections={bbqSelections}
            setSelections={setBBQSelections}
            onContinue={() =>
              setStep("rubiCart")
            }
            onBack={() =>
              setStep("bbqTier")
            }
            onClose={onClose}
          />
        )}

        {step === "mexMenu" && tierSel && (
          <RubiMexMenuBuilder
            tierSelection={
              tierSel as RubiTierSelectionMex
            }
            selections={mexSelections}
            setSelections={setMexSelections}
            onContinue={() =>
              setStep("rubiCart")
            }
            onBack={() =>
              setStep("mexTier")
            }
            onClose={onClose}
          />
        )}

        {/* -------- Catering Cart -------- */}
        {step === "rubiCart" && tierSel && (
          <RubiCateringCart
            menuChoice={menuChoice}
            tierSelection={tierSel}
            selections={
              menuChoice === "bbq"
                ? bbqSelections
                : mexSelections
            }
            setTotal={setTotal}
            setLineItems={setLineItems}
            setPaymentSummaryText={
              setPaymentSummaryText
            }
            onContinueToCheckout={() =>
              setStep("rubiContract")
            }
            onBackToMenu={() =>
              setStep(
                menuChoice === "bbq"
                  ? "bbqMenu"
                  : "mexMenu"
              )
            }
            onClose={onClose}
          />
        )}

        {/* -------- Catering Contract -------- */}
        {step === "rubiContract" &&
          tierSel &&
          menuChoice === "bbq" && (
            <RubiCateringContract
              menuChoice="bbq"
              tierSelection={
                tierSel as RubiTierSelectionBBQ
              }
              selections={bbqSelections}
              total={total}
              guestCount={guestCount}
              weddingDate={userWeddingDate}
              dayOfWeek={userDayOfWeek}
              lineItems={lineItems}
              signatureImage={
                signatureImage
              }
              setSignatureImage={
                setSignatureImage
              }
              signatureSubmitted={
                signatureSubmitted
              }
              setSignatureSubmitted={
                setSignatureSubmitted
              }
              onBack={() =>
                setStep("rubiCart")
              }
              onContinueToCheckout={() =>
                setStep("rubiCheckout")
              }
              onClose={onClose}
              onComplete={() =>
                setStep("rubiCheckout")
              }
            />
          )}

        {step === "rubiContract" &&
          tierSel &&
          menuChoice === "mexican" && (
            <RubiCateringContract
              menuChoice="mexican"
              tierSelection={
                tierSel as RubiTierSelectionMex
              }
              selections={mexSelections}
              total={total}
              guestCount={guestCount}
              weddingDate={userWeddingDate}
              dayOfWeek={userDayOfWeek}
              lineItems={lineItems}
              signatureImage={
                signatureImage
              }
              setSignatureImage={
                setSignatureImage
              }
              signatureSubmitted={
                signatureSubmitted
              }
              setSignatureSubmitted={
                setSignatureSubmitted
              }
              onBack={() =>
                setStep("rubiCart")
              }
              onContinueToCheckout={() =>
                setStep("rubiCheckout")
              }
              onClose={onClose}
              onComplete={() =>
                setStep("rubiCheckout")
              }
            />
          )}

        {/* -------- Catering Checkout -------- */}
        {step === "rubiCheckout" && tierSel && (
  <RubiCateringCheckOut
    total={total}
    guestCount={guestCount}
    lineItems={lineItems}
    menuChoice={menuChoice}
    tierSelection={tierSel}
    signatureImage={signatureImage || localStorage.getItem("yumSignature") || ""} // ✅ add
    weddingDate={userWeddingDate || localStorage.getItem("yumSelectedDate") || null} // ✅ add
    onBack={() => setStep("rubiContract")}
    onComplete={() =>
      setStep(
        hasDessertBooking
          ? "rubiBothDoneThankYou"
          : "rubiCateringThankYou"
      )
    }
    onClose={onClose}
    isGenerating={false}
  />
)}

        {/* -------- Catering Thank You -------- */}
        {step === "rubiCateringThankYou" && (
          <RubiCateringThankYou
            onContinueDesserts={() => {
              // user taps "Book Desserts"
              setStep("rubiDessertSelector");
            }}
            onClose={onClose}
          />
        )}

        {/* -------- Dessert Selector -------- */}
        {step === "rubiDessertSelector" && (
          <RubiDessertSelector
            onSelectType={(type) => {
              setDessertType(type);
              saveDessertSnapshot({
                dessertType: type,
                // wipe dessert picks when type changes
                flavorFilling: [],
                cakeStyle: "",
                treatType: "",
                goodies: [],
                cupcakes: [],
              });
            }}
            onBack={() =>
              // if they already booked catering we want them to land back on catering thank you
              setStep("rubiCateringThankYou")
            }
            onClose={onClose}
            onContinue={() => {
              setStep("rubiDessertMenu");
            }}
          />
        )}

        {/* -------- Dessert Menu Builder -------- */}
        {step === "rubiDessertMenu" && (
          <RubiDessertMenu
            dessertType={
              dessertType as Exclude<
                DessertType,
                ""
              >
            }
            flavorFilling={flavorFilling}
            setFlavorFilling={
              setFlavorFilling
            }
            onContinue={({
              flavorFilling: ff,
              cakeStyle: cs,
              treatType: tt,
              goodies: gd,
              cupcakes: cc,
            }) => {
              setFlavorFilling(ff);
              setCakeStyle(cs || "");
              setTreatType(
                (tt ||
                  "") as TreatType
              );
              setGoodies(gd || []);
              setCupcakes(cc || []);

              saveDessertSnapshot({
                flavorFilling: ff,
                cakeStyle: cs || "",
                treatType:
                  (tt ||
                    "") as TreatType,
                goodies: gd || [],
                cupcakes: cc || [],
              });

              setStep("rubiDessertCart");
            }}
            onBack={() =>
              setStep("rubiDessertSelector")
            }
            onClose={onClose}
          />
        )}

        {/* -------- Dessert Cart -------- */}
        {step === "rubiDessertCart" && (
          <RubiDessertCart
            guestCount={guestCount}
            dessertStyle={
              dessertType as Exclude<
                DessertType,
                ""
              >
            }
            flavorFilling={flavorFilling}
            cakeStyle={cakeStyle}
            treatType={treatType}
            cupcakes={cupcakes}
            goodies={goodies}
            setTotal={setTotal}
            setLineItems={setLineItems}
            setPaymentSummaryText={
              setPaymentSummaryText
            }
            onContinueToCheckout={() =>
              setStep("rubiDessertContract")
            }
            onStartOver={() =>
              setStep("rubiDessertMenu")
            }
            onClose={onClose}
            weddingDate={userWeddingDate}
          />
        )}

        {/* -------- Dessert Contract -------- */}
        {step === "rubiDessertContract" && (
          <RubiDessertContract
            total={total}
            guestCount={guestCount}
            weddingDate={userWeddingDate}
            dayOfWeek={userDayOfWeek}
            lineItems={lineItems}
            signatureImage={
              signatureImage
            }
            setSignatureImage={
              setSignatureImage
            }
            setStep={setStep}
            dessertStyle={
              dessertType ||
              ""
            }
            flavorCombo={
              flavorFilling.join(
                " + "
              )
            }
            onClose={onClose}
            onComplete={(sig) => {
              // signature captured, user will proceed
              setSignatureImage(sig);
            }}
          />
        )}

        {/* -------- Dessert Checkout -------- */}
        {step === "rubiDessertCheckout" && (
          <RubiDessertCheckout
            total={total}
            guestCount={guestCount}
            selectedStyle={
              dessertType ||
              ""
            }
            selectedFlavorCombo={flavorFilling.join(
              " + "
            )}
            paymentSummaryText={
              paymentSummaryText
            }
            lineItems={lineItems}
            signatureImage={
              signatureImage
            }
            onBack={() =>
              setStep("rubiDessertContract")
            }
            onClose={onClose}
            isGenerating={false}
            firstName={undefined}
            lastName={undefined}
          />
        )}

        {/* -------- Both Done Thank You -------- */}
        {step === "rubiBothDoneThankYou" && (
          <RubiBothDoneThankYou
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
};

export default RubiOverlay;