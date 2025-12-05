
import PlannerIntro from "./PlannerIntro";
import PlannerExplainer from "./PlannerExplainer";
import PlannerCart from "./PlannerCart";
import PlannerContract from "./PlannerContract";
import PlannerCheckOut from "./PlannerCheckOut";
import PlannerThankYou from "./PlannerThankYou";
import WeddingDateScreen from "../common/WeddingDateScreen";
import WeddingDateConfirmScreen from "../common/WeddingDateConfirmScreen";
import PlannerAccountModal from "./PlannerAccountModal";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import React, { useState, useEffect, useRef } from "react";
import { useOverlayOpen } from "../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../hooks/useScrollToTop";

type PlannerStep =
  | "intro"
  | "explainer"
  | "guestcount"
  | "calendar"
  | "contract"
  | "checkout"
  | "thankyou";

interface PixiePlannerOverlayProps {
  onClose: () => void;
  onComplete?: () => void;
  startAt?: PlannerStep;
}

const PixiePlannerOverlay: React.FC<PixiePlannerOverlayProps> = ({
  onClose,
  onComplete,
  startAt,
}) => {
  const defaultStep: PlannerStep = startAt || "intro";
  const [step, setStepRaw] = useState<PlannerStep>(defaultStep);

  // 🔝 Scroll-to-top helpers
const cardRef = useRef<HTMLDivElement | null>(null);
useOverlayOpen(cardRef); // lock body + snap to top on open
useScrollToTopOnChange([step], { targetRef: cardRef }); // snap to top when step changes

  const [guestCount, setGuestCount] = useState<number>(0);
  const [plannerTotal, setPlannerTotal] = useState<number>(0);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [userWeddingDate, setUserWeddingDate] = useState<string>("");
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null);
  const [dateLocked, setDateLocked] = useState<boolean>(false);

  const [showAccountModal, setShowAccountModal] = useState(false);

  const [payFull, setPayFull] = useState(true);
  const [signatureImage, setSignatureImage] = useState("");
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);

  // NEW: track full bookings map + derived lock flag
const [bookings, setBookings] = useState<Partial<{
  venue: boolean;
  planner: boolean;
  photography: boolean;
  floral: boolean;
  catering: boolean;
  dessert: boolean;
  jam: boolean;
}>>({});

const hasAnyBooking = Boolean(
  bookings.venue ||
  bookings.planner ||
  bookings.photography ||
  bookings.floral ||
  bookings.catering ||
  bookings.dessert ||
  bookings.jam ||
  localStorage.getItem("yumBookedCatering") === "true" ||
  localStorage.getItem("yumBookedDessert") === "true" ||
  localStorage.getItem("jamBooked") === "true"
);

  // NEW: track booking flags we care about
  const [hasVenue, setHasVenue] = useState<boolean>(false);
  const [hasPlanner, setHasPlanner] = useState<boolean>(false);

  const setStep = async (newStep: PlannerStep) => {
    setStepRaw(newStep);
    localStorage.setItem("plannerSavedStep", newStep);

    const user = getAuth().currentUser;
    if (user) {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          { progress: { planner: { step: newStep } } },
          { merge: true }
        );
      } catch (e) {
        console.error("❌ Failed to update planner step:", e);
      }
    }
  };

  const depositAmount = 200;
  const paymentSummary = payFull
    ? `Paid in full: $${plannerTotal}`
    : `Deposit: $${depositAmount}, Remaining balance: $${Math.max(
        plannerTotal - depositAmount,
        0
      )}`;

  // ---- helpers ----
  const getPlannerPriceFromCount = (count: number) => {
    if (count <= 50) return 1250;
    if (count <= 100) return 1550;
    if (count <= 150) return 1850;
    return 2150;
  };
  const hydrateTotalsFromCount = (count: number) => {
    const base = getPlannerPriceFromCount(count);
    const margin = base * 0.04;
    const tax = (base + margin) * 0.086;
    const stripeFee = (base + margin) * 0.029 + 0.3;
    return base + margin + tax + stripeFee;
  };

  // restore saved step for guests
  useEffect(() => {
    if (!getAuth().currentUser) {
      const saved = localStorage.getItem("plannerSavedStep") as PlannerStep | null;
      if (saved) setStepRaw(saved);
    }
  }, []);

  // hydrate user data (on mount)
  useEffect(() => {
    const fetchUser = async () => {
      const user = getAuth().currentUser;
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) return;

        const d = snap.data() as any;

        setBookings(d?.bookings || {});

        setFirstName(d.firstName || "");
        setLastName(d.lastName || "");

        setUserWeddingDate(d.weddingDate || "");
        setUserDayOfWeek(d.dayOfWeek || null);
        setDateLocked(!!d.dateLocked);

        const gc = Number(d.guestCount || 0);
        if (gc > 0) {
          setGuestCount(gc);
          setPlannerTotal(hydrateTotalsFromCount(gc));
        }

        // NEW: derive booking flags
        setHasVenue(!!d?.bookings?.venue);
        setHasPlanner(!!d?.bookings?.planner);
      } catch (e) {
        console.error("❌ fetch user failed:", e);
      }
    };
    fetchUser();
  }, []);

  // Also refresh when auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) return;
        const d = snap.data() as any;
        setBookings(d?.bookings || {});

        setUserWeddingDate(d.weddingDate || "");
        setUserDayOfWeek(d.dayOfWeek || null);
        setDateLocked(!!d.dateLocked);

        const gc = Number(d.guestCount || 0);
        if (gc > 0) {
          setGuestCount(gc);
          setPlannerTotal(hydrateTotalsFromCount(gc));
        }

        // NEW: keep booking flags in sync
        setHasVenue(!!d?.bookings?.venue);
        setHasPlanner(!!d?.bookings?.planner);
      } catch (e) {
        console.error("auth refresh failed:", e);
      }
    });
    return () => unsubscribe();
  }, []);

  // NEW: refresh when a purchase completes (e.g., venue booking just happened)
  useEffect(() => {
    const pull = async () => {
      const u = getAuth().currentUser;
      if (!u) return;
      const snap = await getDoc(doc(db, "users", u.uid));
      if (!snap.exists()) return;
      const d = snap.data() as any;
      setBookings(d?.bookings || {});
      setHasVenue(!!d?.bookings?.venue);
      setHasPlanner(!!d?.bookings?.planner);
    };
  
    const events = [
      "purchaseMade",
      "venueCompletedNow",
      "photoCompletedNow",
      "floralCompletedNow",
      "jamCompletedNow",
      "dessertCompletedNow",
      "plannerCompletedNow",
      "cateringCompletedNow",
    ];
  
    events.forEach((e) => window.addEventListener(e, pull));
    return () => events.forEach((e) => window.removeEventListener(e, pull));
  }, []);

  // success → thank you
  const handlePlannerSuccess = () => {
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("userPurchaseMade"));
    window.dispatchEvent(new Event("plannerCompletedNow"));
    setStep("thankyou");
  };

  const handleThankYouClose = () => {
    onComplete?.();
    onClose();
  };

  const userHasLockedDate = !!userWeddingDate && !!userDayOfWeek;
const weddingDateLocked = Boolean(dateLocked || hasAnyBooking);

return (
  <>
    {/* Main flow overlay — render ONLY when the account modal is NOT open */}
    {!showAccountModal && (
      <div className="pixie-overlay">
        {/* scrollable area (no pixie-card wrapper here) */}
        <div ref={cardRef} style={{ width: "100%" }}>
          {/* Intro → Explainer */}
          {step === "intro" && (
            <PlannerIntro
              hasVenue={hasVenue}
              onContinue={() => {
                // If venue already booked (planning included) OR planner already purchased,
                // do not allow starting the planner flow.
                if (hasVenue || hasPlanner) return;
                setStep("explainer");
              }}
              onClose={onClose}
            />
          )}

          {step === "explainer" && (
            <PlannerExplainer onContinue={() => setStep("guestcount")} 
            onClose={onClose}/>
          )}

          {/* Cart (guest count + live pricing) */}
          {step === "guestcount" && (
            <PlannerCart
              onContinue={(count, total) => {
                setGuestCount(count);
                setPlannerTotal(total);

                const user = getAuth().currentUser;
                if (user) {
                  // already logged in → next we confirm/set date
                  setStep("calendar");
                } else {
                  // guest → create account first (collects date as part of flow)
                  setShowAccountModal(true);
                }
              }}
              onClose={() => setStep("explainer")}
            />
          )}

          {/* Calendar (set or confirm date) */}
          {step === "calendar" && getAuth().currentUser && (
            userHasLockedDate ? (
              <WeddingDateConfirmScreen
                formattedDate={userWeddingDate}
                dayOfWeek={userDayOfWeek || ""}
                userHasDate={!!userWeddingDate}
                weddingDateLocked={weddingDateLocked}
                onConfirm={() => setStep("contract")}
                onEditDate={() => {
                  if (weddingDateLocked) return; // locked by any booking → do not allow edits
                  setUserWeddingDate("");
                  setUserDayOfWeek(null);
                  setDateLocked(false);
                }}
                onClose={onClose}
              />
            ) : (
              <WeddingDateScreen
                onContinue={(data) => {
                  const { weddingDate, dayOfWeek } = data;

                  // put in state so Contract sees it immediately
                  setUserWeddingDate(weddingDate);
                  setUserDayOfWeek(dayOfWeek);

                  // persist (user or guest)
                  const user = getAuth().currentUser;
                  if (user) {
                    setDoc(
                      doc(db, "users", user.uid),
                      { weddingDate, dayOfWeek, dateLocked: true },
                      { merge: true }
                    ).catch((err) => console.error("❌ Failed to save date:", err));
                  } else {
                    localStorage.setItem("weddingDate", weddingDate);
                    localStorage.setItem("dayOfWeek", dayOfWeek);
                  }

                  setStep("contract");
                }}
                onClose={onClose}
              />
            )
          )}

          {/* Contract (uses its own card) */}
          {step === "contract" && (
            <PlannerContract
              bookingData={{
                guestCount,
                weddingDate: userWeddingDate,
                dayOfWeek: userDayOfWeek ?? "",
                total: plannerTotal,
              }}
              payFull={payFull}
              setPayFull={setPayFull}
              setSignatureImage={setSignatureImage}
              signatureSubmitted={signatureSubmitted}
              setSignatureSubmitted={setSignatureSubmitted}
              onContinue={() => setStep("checkout")}
              onBack={() => setStep("guestcount")}
              onClose={onClose} 
              // If your PlannerContract accepts onClose, pass it:
              // onClose={onClose}
            />
          )}

          {/* Checkout */}
          {step === "checkout" && (
            <PlannerCheckOut
              total={plannerTotal}
              payFull={payFull}
              signatureImage={signatureImage}
              onSuccess={handlePlannerSuccess}
              firstName={firstName}
              lastName={lastName}
              weddingDate={userWeddingDate}
              guestCount={guestCount ?? 0}
              uid={getAuth().currentUser?.uid || ""}
              onClose={onClose}
              depositAmount={depositAmount}
              paymentSummary={paymentSummary}
              onBackToContract={() => setStep("contract")}
            />
          )}

          {/* Thank You */}
          {step === "thankyou" && <PlannerThankYou onClose={handleThankYouClose} />}
        </div>
      </div>
    )}

    {/* Account modal overlay — rendered separately when open */}
    {showAccountModal && (
      <PlannerAccountModal
        onSuccess={() => {
          setShowAccountModal(false);
          // After account creation, always go collect/confirm the date
          setStep("calendar");
        }}
        onClose={() => {
          setShowAccountModal(false);
          // Keep them on Cart if they back out
          setStep("guestcount");
        }}
      />
    )}
  </>
);
};

export default PixiePlannerOverlay;