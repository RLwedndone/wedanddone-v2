// src/components/NewYumBuild/shared/NoVenueOverlay.tsx
import React, { useState, useEffect, useRef } from "react";
import YumIntro from "./YumIntro";
import YumCuisineSelector from "../catering/YumCuisineSelectorCatering";
import YumMenuBuilder from "../catering/YumMenuBuilderCatering";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import YumCart from "../catering/YumCartCatering";
import WeddingDateScreen from "../../common/WeddingDateScreen";
import WeddingDateConfirmScreen from "../../common/WeddingDateConfirmScreen";
import YumAccountModal from "./YumAccountModal";
import YumContract from "../catering/YumContractCatering";
import YumCheckOut from "../catering/YumCheckOutCatering";
import { YumStep } from "../yumTypes";
import YumDessertStyleSelector from "../dessert/YumDessertStyleSelector";
import YumMenuBuilderDessert from "../dessert/YumMenuBuilderDessert";
import YumCartDessert from "../dessert/YumCartDessert";
import YumContractDessert from "../dessert/YumContractDessert";
import YumCheckOutDessert from "../dessert/YumCheckOutDessert";
import YumThankYouCateringOnly from "../catering/YumThankYouCateringOnly";
import YumThankYouDessertOnly from "../dessert/YumThankYouDessertOnly";
import YumThankYouBothBooked from "./YumThankYouBothBooked";
import YumReturnNoCatering from "../dessert/YumReturnNoCatering";
import YumReturnNoDessert from "../catering/YumReturnNoDessert";
import YumReturnBothBooked from "./YumReturnBothBooked";
import GuestCountUpdateCart from "./GuestCountUpdateCart";
import SantisTierSelector from "../catering/SantisTierSelector";
import "../../../styles/globals/boutique.master.css";
import { SantiCuisineKey } from "../catering/santisMenuConfig";

// hooks
import { useOverlayOpen } from "../../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../../hooks/useScrollToTop";

interface NoVenueOverlayProps {
  onClose: () => void;
  startAt?: YumStep; // optional

  // optional props (passed in from MenuController if this user booked Desert Foothills / Windmill, etc.)
  isSharedFlowBookedVenue?: boolean;
  bookedVenueSlug?: string | null;
  bookedVenueName?: string;
}

const NoVenueOverlay: React.FC<NoVenueOverlayProps> = ({
  onClose,
  startAt = "intro",
  isSharedFlowBookedVenue = false,
  bookedVenueSlug = null,
  bookedVenueName = "",
}) => {
  const [activeBookingType, setActiveBookingType] = useState<"catering" | "dessert" | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<YumStep>(startAt);

  // scroll helpers (mirror Floral overlay)
  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([step], { targetRef: cardRef });

  // ── Bookings model ─────────────────────────────────────────
  type Bookings = {
    venue?: boolean;
    planner?: boolean;
    catering?: boolean;
    dessert?: boolean;
    photography?: boolean;
    jam?: boolean;
    florals?: boolean;
    officiant?: boolean;
  };
  const [bookings, setBookings] = useState<Bookings>({});
  const [bookingsReady, setBookingsReady] = useState(false);

  // ── Menu + dessert state ───────────────────────────────────
  const [selectedCuisine, setSelectedCuisine] =
  useState<SantiCuisineKey | null>(null);
  const [menuSelections, setMenuSelections] = useState<{
    mains: string[];
    sides: string[];
    salads: string[];
  }>({
    mains: [],
    sides: [],
    salads: [],
  });

  // 🔄 Clear menu selections when backing up to cuisine / tier
  const clearMenuSelections = () => {
    const empty = { mains: [], sides: [], salads: [] };

    // React state
    setMenuSelections(empty);

    // LocalStorage
    try {
      localStorage.removeItem("yumMenuSelections");
    } catch {}

    // Firestore (best-effort)
    const user = getAuth().currentUser;
    if (user) {
      setDoc(
        doc(db, "users", user.uid, "yumYumData", "menuSelections"),
        empty,
        { merge: true }
      ).catch(() => {});
    }
  };

  const savedDessert = localStorage.getItem("yumDessertSelections");
  const parsed = savedDessert
    ? (() => {
        try {
          return JSON.parse(savedDessert);
        } catch {
          return null;
        }
      })()
    : null;

  const [dessertType, setDessertType] = useState<
    "tieredCake" | "smallCakeTreats" | "treatsOnly"
  >(parsed?.dessertType || "tieredCake");
  const [flavorFilling, setFlavorFilling] = useState<string[]>(parsed?.flavorFilling || []);
  const [cakeStyle, setCakeStyle] = useState<string>(parsed?.cakeStyle || "");
  const [treatType, setTreatType] = useState<"" | "cupcakes" | "goodies">(
    parsed?.treatType === "cupcakes" || parsed?.treatType === "goodies"
      ? parsed.treatType
      : ""
  );
  const [goodies, setGoodies] = useState<string[]>(parsed?.goodies || []);
  const [cupcakes, setCupcakes] = useState<string[]>(parsed?.cupcakes || []);

  // ── Cart & flow state ──────────────────────────────────────
  const [guestCount, setGuestCount] = useState(0);
  const [addCharcuterie, setAddCharcuterie] = useState(false);
  const [total, setTotal] = useState(0);
  const [lineItems, setLineItems] = useState<string[]>([]);
  const [paymentSummaryText, setPaymentSummaryText] = useState("");
  const [charcuterieCount, setCharcuterieCount] = useState(0);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const [userWeddingDate, setUserWeddingDate] = useState<string | null>(null);
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null);

  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [payFull, setPayFull] = useState(true);
  const [isEditingDate, setIsEditingDate] = useState(false);

  const [calendarNextStep, setCalendarNextStep] = useState<YumStep | null>(null);
  const resolveCalendarNext = (): YumStep => {
    if (calendarNextStep) return calendarNextStep as YumStep;
    if (activeBookingType === "dessert") return "dessertContract";
    if (activeBookingType === "catering") return "cateringContract";
    const lsType =
      localStorage.getItem("yumActiveBookingType") ||
      localStorage.getItem("yumBookingType");
    if (lsType === "dessert") return "dessertContract";
    if (lsType === "catering") return "cateringContract";
    return "cateringContract";
  };

  const isSantiCuisineKey = (value: any): value is SantiCuisineKey =>
    value === "italian" ||
    value === "mexican" ||
    value === "american" ||
    value === "taco";

  // derived flags
  const hasDate = Boolean(userWeddingDate);
  const hasAnyBooking =
    !!bookings.venue ||
    !!bookings.planner ||
    !!bookings.catering ||
    !!bookings.dessert ||
    !!bookings.photography ||
    !!bookings.jam ||
    !!bookings.florals ||
    !!bookings.officiant ||
    localStorage.getItem("yumBookedCatering") === "true" ||
    localStorage.getItem("yumBookedDessert") === "true" ||
    localStorage.getItem("jamBooked") === "true";

  const weddingDateLocked =
    hasAnyBooking || localStorage.getItem("weddingDateLocked") === "true";


    type CateringTier = "signature" | "chef";

const [cateringTier, setCateringTier] = useState<CateringTier>(() => {
  try {
    const stored = localStorage.getItem("yumCateringTier");
    return stored === "chef" ? "chef" : "signature";
  } catch {
    return "signature";
  }
});

  // seed type
  useEffect(() => {
    const storedType = localStorage.getItem("yumBookingType");
    if (storedType === "catering" || storedType === "dessert")
      setActiveBookingType(storedType);
  }, []);

  // preload cached date + watch auth
  useEffect(() => {
    const localDate = localStorage.getItem("yumSelectedDate");
    if (localDate) {
      setUserWeddingDate(localDate);
      const localStep = localStorage.getItem("yumStep");
      const allowed = [
        "cart",
        "contract",
        "calendar",
        "editdate",
        "confirm",
      ];
      if (allowed.includes(localStep || "")) setStep("calendar");
    }

    const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const data = userDoc.data();
        const firestoreDate =
          data?.weddingDate || data?.profileData?.weddingDate;
        if (firestoreDate && !isEditingDate) {
          setUserWeddingDate(firestoreDate);
          localStorage.setItem("yumSelectedDate", firestoreDate);
        }
      } catch (err) {
        console.warn("🔥 Could not fetch weddingDate from Firestore:", err);
      }
    });
    return () => unsubscribe();
  }, [isEditingDate]);

    // restore step + cuisine; background restore from Firestore
    useEffect(() => {
      const auth = getAuth();
  
      const localStep = localStorage.getItem("yumStep") as YumStep;
      const localCuisine = localStorage.getItem("yumSelectedCuisine");
  
      const tryLocalStorage = () => {
        if (localCuisine && isSantiCuisineKey(localCuisine)) {
          setSelectedCuisine(localCuisine);
        }
  
        const validSteps: YumStep[] = [
          "intro",
          "cateringTier",
          "cateringCuisine",
          "cateringMenu",
          "cateringCart",
          "cateringContract",
          "cateringCheckout",
          "dessertStyle",
          "dessertMenu",
          "dessertCart",
          "dessertContract",
          "dessertCheckout",
          "calendar",
          "confirm",
          "thankyouCateringOnly",
          "thankyouDessertOnly",
          "thankyouBoth",
          "returnNoCatering",
          "returnNoDessert",
          "returnBothBooked",
          "updateGuests",
        ];
        setStep(
          localStep && validSteps.includes(localStep) ? localStep : "intro"
        );
        setLoading(false);
      };

    if (
      !["returnNoDessert", "returnNoCatering", "returnBothBooked"].includes(
        startAt
      )
    ) {
      tryLocalStorage();
    }

    onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        const firestoreDate =
          userData?.weddingDate || userData?.profileData?.weddingDate;
        if (firestoreDate && !isEditingDate) {
          setUserWeddingDate(firestoreDate);
          localStorage.setItem("yumSelectedDate", firestoreDate);
        }
        setBookings((userData?.bookings || {}) as Bookings);

        const savedStep = userData?.progress?.yumYum?.step;
        const cuisineDoc = await getDoc(
          doc(db, "users", user.uid, "yumYumData", "cuisineSelection")
        );
        const savedCuisine = cuisineDoc.data()?.selectedCuisine as
        | string
        | undefined;

      let updated = false;
      if (!localCuisine && savedCuisine && isSantiCuisineKey(savedCuisine)) {
        localStorage.setItem("yumSelectedCuisine", savedCuisine);
        setSelectedCuisine(savedCuisine);
        updated = true;
      }
        if (!localStep && savedStep) {
          localStorage.setItem("yumStep", savedStep);
          setStep(savedStep);
          updated = true;
        }
        if (updated) setLoading(false);
      } catch (err) {
        console.warn("⚠️ Firestore restore failed:", err);
      }
    });
  }, [isEditingDate, startAt]);

  // live bookings/date listener
  useEffect(() => {
    let innerUnsub: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(getAuth(), (user) => {
      if (!user) {
        setBookingsReady(true);
        return;
      }
      const ref = doc(db, "users", user.uid);
      innerUnsub = onSnapshot(ref, (snap) => {
        const data = (snap.data() || {}) as any;
        setBookings((data.bookings || {}) as Bookings);
        setBookingsReady(true);
        if (data?.weddingDate && !isEditingDate) {
          setUserWeddingDate(data.weddingDate);
          localStorage.setItem("yumSelectedDate", data.weddingDate);
        }
        if (data?.weddingDateLocked) {
          try {
            localStorage.setItem("weddingDateLocked", "true");
          } catch {}
        }
      });
    });
    return () => {
      unsubAuth();
      if (innerUnsub) innerUnsub();
    };
  }, [isEditingDate]);

  // continue handlers (prefetch lock before calendar)
  const handleCartContinue = async () => {
    const user = getAuth().currentUser;
    if (!user) {
      setShowAccountModal(true);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const data = userDoc.data();
      const firestoreDate =
        data?.weddingDate || data?.profileData?.weddingDate;
      const dayOfWeek = data?.dayOfWeek || null;
      if (firestoreDate) {
        setUserWeddingDate(firestoreDate);
        setUserDayOfWeek(dayOfWeek);
      }
      setBookings((data?.bookings || {}) as Bookings);

      setActiveBookingType("catering");
      localStorage.setItem("yumBookingType", "catering");
      localStorage.setItem("yumActiveBookingType", "catering");
      setCalendarNextStep("cateringContract");

      setBookingsReady(true);
      setStep("calendar");
      localStorage.setItem("yumStep", "calendar");
    } catch (error) {
      console.error("⚠️ Error checking wedding date:", error);
      setActiveBookingType("catering");
      localStorage.setItem("yumBookingType", "catering");
      localStorage.setItem("yumActiveBookingType", "catering");
      setCalendarNextStep("cateringContract");

      setBookingsReady(true);
      setStep("calendar");
      localStorage.setItem("yumStep", "calendar");
    }
  };

  const handleDessertCartContinue = async () => {
    const user = getAuth().currentUser;
    if (!user) {
      setShowAccountModal(true);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const data = userDoc.data();
      const firestoreDate =
        data?.weddingDate || data?.profileData?.weddingDate;
      const dayOfWeek = data?.dayOfWeek || null;
      if (firestoreDate) {
        setUserWeddingDate(firestoreDate);
        setUserDayOfWeek(dayOfWeek);
      }
      setBookings((data?.bookings || {}) as Bookings);

      setActiveBookingType("dessert");
      localStorage.setItem("yumBookingType", "dessert");
      localStorage.setItem("yumActiveBookingType", "dessert");
      setCalendarNextStep("dessertContract");

      setBookingsReady(true);
      setStep("calendar");
      localStorage.setItem("yumStep", "calendar");
    } catch (error) {
      console.error("⚠️ Error checking wedding date for dessert:", error);
      setActiveBookingType("dessert");
      localStorage.setItem("yumBookingType", "dessert");
      localStorage.setItem("yumActiveBookingType", "dessert");
      setCalendarNextStep("dessertContract");

      setBookingsReady(true);
      setStep("calendar");
      localStorage.setItem("yumStep", "calendar");
    }
  };

  // react to bookings changes from other flows
  useEffect(() => {
    const onChanged = (e: any) => {
      const delta = (e?.detail || {}) as Partial<Bookings>;
      setBookings((prev) => ({ ...prev, ...delta }));
    };
    const onDessertDone = () => {
      setBookings((prev) => ({ ...prev, dessert: true }));
      localStorage.setItem("yumBookedDessert", "true");
    };
    window.addEventListener("bookingsChanged", onChanged);
    window.addEventListener("dessertCompletedNow", onDessertDone);
    return () => {
      window.removeEventListener("bookingsChanged", onChanged);
      window.removeEventListener("dessertCompletedNow", onDessertDone);
    };
  }, []);

  // initial “return” routing
  useEffect(() => {
    const auth = getAuth();
    const localStep = localStorage.getItem("yumStep");
    if (
      ["returnNoDessert", "returnNoCatering", "returnBothBooked"].includes(
        startAt
      )
    )
      return;
    if (localStep && localStep !== "intro") return;

    onAuthStateChanged(auth, async (user) => {
      let nextStep: YumStep | null = null;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();
        const hasCatering = userData?.bookings?.catering === true;
        const hasDessert = userData?.bookings?.dessert === true;
        if (hasCatering && !hasDessert) nextStep = "returnNoDessert";
        else if (!hasCatering && hasDessert) nextStep = "returnNoCatering";
        else if (hasCatering && hasDessert) nextStep = "returnBothBooked";
      } else {
        const localC =
          localStorage.getItem("yumBookedCatering") === "true";
        const localD =
          localStorage.getItem("yumBookedDessert") === "true";
        if (localC && !localD) nextStep = "returnNoDessert";
        else if (!localC && localD) nextStep = "returnNoCatering";
        else if (localC && localD) nextStep = "returnBothBooked";
      }
      if (nextStep) {
        setStep(nextStep);
        localStorage.setItem("yumStep", nextStep);
      }
    });
  }, [startAt]);

  const [cateringBooked, setCateringBooked] = useState(false);
  const [dessertBooked, setDessertBooked] = useState(false);

  // ── RENDER ────────────────────────────────────────────────
  return (
    <>
      {/* main flow overlay — render ONLY when account modal is NOT open */}
      {!showAccountModal && (
        <div className="pixie-overlay">
          {/* scrollable area (no pixie-card here) */}
          <div ref={cardRef} style={{ width: "100%" }}>
            {step === "intro" && (
              <YumIntro
                
  onCateringNext={() => {
    setActiveBookingType("catering");
    localStorage.setItem("yumBookingType", "catering");
    localStorage.setItem("yumStep", "cateringTier");   // was "cateringCuisine"
    setStep("cateringTier");                           // was "cateringCuisine"
  }}
                onDessertNext={() => {
                  setActiveBookingType("dessert");
                  localStorage.setItem("yumBookingType", "dessert");
                  localStorage.setItem("yumStep", "dessertStyle");
                  setStep("dessertStyle");
                }}
                onClose={onClose}
                // NEW: shared-venue awareness for wording
                isSharedFlowBookedVenue={isSharedFlowBookedVenue}
                bookedVenueName={bookedVenueName}
              />
            )}

{step === "cateringTier" && (
  <SantisTierSelector
    // whatever props you defined earlier:
    onSelect={(selection) => {
      // if your selector hands back just "signature" | "chef",
      // change this accordingly
      const tierId = selection.id ?? selection; // adjust to your type
      const normalized =
        tierId === "chef" || tierId === "signature" ? tierId : "signature";

      setCateringTier(normalized);
      try {
        localStorage.setItem("yumCateringTier", normalized);
      } catch {}
    }}
    onContinue={() => {
      if (!cateringTier) return;
      localStorage.setItem("yumStep", "cateringCuisine");
      setStep("cateringCuisine");
    }}
    onBack={() => {
      localStorage.setItem("yumStep", "intro");
      setStep("intro");
    }}
    onClose={onClose}
    // if your selector supports a default/current id:
    // defaultSelectedId={cateringTier ?? undefined}
  />
)}

{step === "cateringCuisine" && (
  <YumCuisineSelector
    tier={cateringTier || "signature"}
    selectedCuisine={selectedCuisine}
    setSelectedCuisine={(val) => setSelectedCuisine(val as SantiCuisineKey)}
    onNext={() => setStep("cateringMenu")}
    onBack={() => {
      clearMenuSelections();
      localStorage.setItem("yumStep", "cateringTier");
      setStep("cateringTier");
    }}
    onClose={onClose}
  />
)}

{step === "cateringMenu" && selectedCuisine && (
  <YumMenuBuilder
    tier={cateringTier || "signature"}
    selectedCuisine={selectedCuisine as SantiCuisineKey}
    menuSelections={menuSelections}
    setMenuSelections={setMenuSelections}
    onContinue={() => setStep("cateringCart")}
    onBack={() => {
      clearMenuSelections();
      localStorage.setItem("yumStep", "cateringCuisine");
      setStep("cateringCuisine");
    }}
    onClose={onClose}
  />
)}

{step === "cateringCart" && (
              <YumCart
                guestCount={guestCount}
                onGuestCountChange={setGuestCount}
                addCharcuterie={addCharcuterie}
                setAddCharcuterie={setAddCharcuterie}
                selectedCuisine={selectedCuisine}
                menuSelections={menuSelections} // { mains, sides, salads }
                setMenuSelections={setMenuSelections}
                weddingDate={userWeddingDate}
                setTotal={setTotal}
                setLineItems={setLineItems}
                setPaymentSummaryText={setPaymentSummaryText}
                onContinueToCheckout={handleCartContinue}
                onStartOver={() => setStep("cateringMenu")}
                onClose={onClose}
                tier={cateringTier}
              />
            )}

            {step === "calendar" && bookingsReady && (
              <>
                {isEditingDate || !hasDate ? (
                  <WeddingDateScreen
                    onContinue={(data) => {
                      setUserWeddingDate(data.weddingDate);
                      setUserDayOfWeek(data.dayOfWeek);
                      setIsEditingDate(false);
                      const next = resolveCalendarNext();
                      setStep(next);
                      localStorage.setItem("yumStep", next);
                      localStorage.setItem(
                        "yumSelectedDate",
                        data.weddingDate
                      );
                    }}
                    onClose={onClose}
                  />
                ) : (
                  <WeddingDateConfirmScreen
                    formattedDate={userWeddingDate || ""}
                    dayOfWeek={userDayOfWeek || ""}
                    userHasDate={hasDate}
                    weddingDateLocked={weddingDateLocked}
                    onConfirm={() => {
                      const next = resolveCalendarNext();
                      setStep(next);
                      localStorage.setItem("yumStep", next);
                    }}
                    onEditDate={() => {
                      setIsEditingDate(true);
                      setStep("calendar");
                      localStorage.setItem("yumStep", "calendar");
                    }}
                    onClose={onClose}
                  />
                )}
              </>
            )}

            {step === "cateringContract" && (
              <YumContract
                total={total}
                guestCount={guestCount}
                charcuterieCount={addCharcuterie ? 1 : 0}
                weddingDate={userWeddingDate}
                dayOfWeek={userDayOfWeek}
                lineItems={lineItems}
                selectedCuisine={selectedCuisine}
                menuSelections={menuSelections}
                signatureImage={signatureImage}
                setSignatureImage={setSignatureImage}
                signatureSubmitted={signatureSubmitted}
                setSignatureSubmitted={setSignatureSubmitted}
                setStep={(s: YumStep) => setStep(s)}
                onClose={onClose}
                onComplete={() => {
                  setStep("cateringCheckout");
                  localStorage.setItem("yumStep", "cateringCheckout");
                }}
                // NEW: pass venue context so contract copy can relax the “must allow outside catering” language
                isSharedFlowBookedVenue={isSharedFlowBookedVenue}
                bookedVenueName={bookedVenueName}
              />
            )}

            {step === "cateringCheckout" && (
              <YumCheckOut
                total={total}
                guestCount={guestCount}
                charcuterieCount={charcuterieCount}
                addCharcuterie={addCharcuterie}
                lineItems={lineItems}
                selectedCuisine={selectedCuisine}
                menuSelections={menuSelections}
                onBack={() => {
                  localStorage.setItem("yumStep", "cateringContract");
                  setStep("cateringContract");
                }}
                onComplete={() => {
                  localStorage.setItem("yumBookedCatering", "true");
                  const dessertAlready =
                    Boolean(bookings?.dessert) ||
                    localStorage.getItem("yumBookedDessert") === "true";
                  const next = dessertAlready
                    ? "thankyouBoth"
                    : "thankyouCateringOnly";
                  localStorage.setItem("yumStep", next);
                  setStep(next);
                }}
                onClose={onClose}
                isGenerating={isGenerating}
              />
            )}

            {step === "dessertStyle" && (
              <YumDessertStyleSelector
                onSelectType={(type) => {
                  setDessertType(type);
                  localStorage.setItem("yumDessertType", type);
                  localStorage.setItem("yumStep", "dessertMenu");
                  setStep("dessertMenu");
                }}
                onContinue={() => {
                  localStorage.setItem("yumStep", "dessertMenu");
                  setStep("dessertMenu");
                }}
                onBack={() => {
                  localStorage.setItem("yumStep", "intro");
                  setStep("intro");
                }}
                onClose={onClose}
              />
            )}

            {step === "dessertMenu" && (
              <YumMenuBuilderDessert
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
                  setStep("dessertCart");
                }}
                onBack={() => setStep("dessertStyle")}
                onClose={onClose}
              />
            )}

            {step === "dessertCart" && (
              <YumCartDessert
                guestCount={guestCount}
                onGuestCountChange={setGuestCount}
                dessertStyle={dessertType}
                flavorFilling={flavorFilling}
                cakeStyle={cakeStyle}
                treatType={treatType}
                cupcakes={cupcakes}
                goodies={goodies}
                setTotal={setTotal}
                setLineItems={setLineItems}
                setPaymentSummaryText={setPaymentSummaryText}
                onContinueToCheckout={handleDessertCartContinue}
                onStartOver={() => {
                  localStorage.setItem("yumStep", "dessertStyle");
                  setStep("dessertStyle");
                }}
                onClose={onClose}
                weddingDate={userWeddingDate}
              />
            )}

            {step === "dessertContract" && (
              <YumContractDessert
                total={total}
                guestCount={guestCount}
                weddingDate={userWeddingDate}
                dayOfWeek={userDayOfWeek}
                lineItems={lineItems}
                signatureImage={signatureImage}
                setSignatureImage={setSignatureImage}
                dessertStyle={dessertType}
                flavorCombo={flavorFilling.join(" + ")}
                setStep={(s: YumStep) => setStep(s)}
                onClose={onClose}
                onComplete={(sig) => {
                  setSignatureImage(sig);
                  localStorage.setItem("yumStep", "dessertCheckout");
                  localStorage.setItem("yumActiveBookingType", "dessert");
                  setActiveBookingType("dessert");
                  setStep("dessertCheckout");
                }}
                // NEW: pass venue context so dessert contract can say “We’re already approved at Desert Foothills…”
                isSharedFlowBookedVenue={isSharedFlowBookedVenue}
                bookedVenueName={bookedVenueName}
              />
            )}

            {step === "dessertCheckout" && (
              <YumCheckOutDessert
                total={total}
                amountDueToday={150}
                guestCount={guestCount}
                selectedStyle={dessertType}
                selectedFlavorCombo={flavorFilling.join(" + ")}
                paymentSummaryText={paymentSummaryText}
                lineItems={lineItems}
                bookings={bookings}
                signatureImage={signatureImage}
                setStep={(s: YumStep) => setStep(s)}
                onBack={() => {
                  setStep("dessertContract");
                  localStorage.setItem("yumStep", "dessertContract");
                }}
                onComplete={() => {
                  const next = bookings.catering
                    ? "thankyouBoth"
                    : "thankyouDessertOnly";
                  setStep(next);
                  localStorage.setItem("yumStep", next);
                }}
                onClose={onClose}
                isGenerating={isGenerating}
              />
            )}

            {step === "thankyouCateringOnly" && (
              <YumThankYouCateringOnly onClose={onClose} setStep={setStep} />
            )}
            {step === "thankyouDessertOnly" && (
              <YumThankYouDessertOnly onClose={onClose} setStep={setStep} />
            )}
            {step === "thankyouBoth" && (
              <YumThankYouBothBooked onClose={onClose} />
            )}

            {step === "returnNoDessert" && (
              <YumReturnNoDessert
                onBookDessert={() => {
                  localStorage.setItem("yumStep", "dessertStyle");
                  setStep("dessertStyle");
                }}
                onClose={onClose}
              />
            )}

{step === "returnNoCatering" && (
  <YumReturnNoCatering
    onBookCatering={() => {
      localStorage.setItem("yumStep", "cateringTier"); // was "cateringCuisine"
      setStep("cateringTier");
    }}
    onClose={onClose}
  />
)}

            {step === "returnBothBooked" && (
              <YumReturnBothBooked onClose={onClose} />
            )}
          </div>
        </div>
      )}

      {/* account modal overlay — rendered separately when open */}
      {showAccountModal && (
        <YumAccountModal
          onComplete={() => {
            setShowAccountModal(false);
            setStep("calendar");
          }}
          onClose={() => setShowAccountModal(false)}
        />
      )}
    </>
  );
};

export default NoVenueOverlay;