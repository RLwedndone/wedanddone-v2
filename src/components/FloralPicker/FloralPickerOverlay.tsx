import React, { useState, useEffect, useRef } from "react";
import FloralIntro from "./FloralIntro";
import FloralPalettePicker from "./FloralPalettePicker";
import TableArrangementPicker from "./TableArrangementPicker";
import FloralCart from "./FloralCart";
import WeddingDateScreen from "../common/WeddingDateScreen";
import FloralAccountModal from "./FloralAccountModal";
import WeddingDateConfirmScreen from "../common/WeddingDateConfirmScreen";
import FloralContract from "./FloralContract";
import FloralCheckOut from "./FloralCheckOut";
import FloralThankYouInitial from "./FloralThankYouInitial";
import FloralThankYouReturn  from "./FloralThankYouReturn";
import FloralThankYouAddOn   from "./FloralThankYouAddOn";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

import "../../styles/globals/boutique.master.css";

/* ✅ add these two imports */
import { useOverlayOpen } from "../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../hooks/useScrollToTop";

interface FloralPickerOverlayProps {
  onClose: () => void;
  onComplete?: () => void;
  mode?: "initial" | "addon";
  startAt?:
    | "intro"
    | "palette"
    | "arrangements"
    | "cart"
    | "calendar"
    | "editdate"
    | "contract"
    | "checkout"
    | "thankyou";
}

type FloralStep =
  | "intro"
  | "palette"
  | "arrangements"
  | "cart"
  | "calendar"
  | "editdate"
  | "contract"
  | "checkout"
  | "returnPrompt"
  | "thankyou";

const FloralPickerOverlay: React.FC<FloralPickerOverlayProps> = ({
  onClose,
  onComplete,
  mode = "initial",
  startAt,
}) => {
  const defaultStep: FloralStep =
    (startAt as FloralStep) ?? (mode === "addon" ? "cart" : "intro");
  const [step, setStepRaw] = useState<FloralStep>(defaultStep);

  /* ✅ create a ref to the scrollable white card */
  const cardRef = useRef<HTMLDivElement>(null);

  /* ✅ lock body scroll + snap to top on mount */
  useOverlayOpen(cardRef);

  /* ✅ re-snap scroll to top whenever the step changes */
  useScrollToTopOnChange([step], { targetRef: cardRef });

  // thank-you message selector
  const [thankYouMode, setThankYouMode] =
    useState<"initial" | "upgrade" | "return">("initial");

  // Save guest progress
  const setStep = (newStep: FloralStep) => {
    setStepRaw(newStep);
    const user = getAuth().currentUser;
    if (!user) localStorage.setItem("floralSavedStep", newStep);
  };

  const [selectedPalette, setSelectedPalette] = useState<string | null>(null);
  const [selectedArrangement, setSelectedArrangement] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [lineItems, setLineItems] = useState<string[]>([]);
  const [total, setTotal] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userWeddingDate, setUserWeddingDate] = useState("");
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null);
  const [dateLocked, setDateLocked] = useState<boolean>(false);

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isReturningFloralUser, setIsReturningFloralUser] = useState(false);

  const [bookingData, setBookingData] = useState<{
    weddingDate?: string;
    dayOfWeek?: string;
    total?: number;
    paymentAmount?: number;
    paymentSummaryText?: string;
    lineItems?: string[];
  }>({});

  const [payFull, setPayFull] = useState(true);
  const [signatureImage, setSignatureImage] = useState("");
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);
  const userHasLockedDate = !!userWeddingDate && !!userDayOfWeek;

  // Restore guest step
  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) {
      const saved = localStorage.getItem("floralSavedStep");
      if (saved) setStepRaw(saved as FloralStep);
    }
  }, []);

  // Load profile/name/date
  useEffect(() => {
    const fetchUserData = async () => {
      const user = getAuth().currentUser;
      if (!user) return;

      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
          setUserWeddingDate(data.weddingDate || "");
          setUserDayOfWeek(data.dayOfWeek || null);
          setDateLocked(!!data.dateLocked);
        }
      } catch (err) {
        console.error("❌ Error fetching user data:", err);
      }
    };
    fetchUserData();
  }, []);

  // Refresh date on auth changes
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setUserWeddingDate(data.weddingDate || "");
          setUserDayOfWeek(data.dayOfWeek || null);
          setDateLocked(!!data.dateLocked);
        }
      } catch (e) {
        console.error("Error loading wedding date:", e);
      }
    });
    return () => unsub();
  }, []);

  // If explicit addon, skip calendar
  useEffect(() => {
    if (step === "calendar" && mode === "addon") setStep("contract");
  }, [step, mode]);

  // Pre-fill date for addon mode
  useEffect(() => {
    if (mode === "addon" && userWeddingDate) {
      setBookingData((p) => ({
        ...p,
        weddingDate: userWeddingDate || "",
        dayOfWeek: userDayOfWeek || "",
      }));
    }
  }, [mode, userWeddingDate, userDayOfWeek]);

  // Detect returning floral users
  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const checkFloralStatus = async () => {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const data = userDoc.data();
      if (data?.bookings?.floral === true) {
        setIsReturningFloralUser(true);
        setStep("returnPrompt");
        setThankYouMode("return");
      }
    };
    checkFloralStatus();
  }, []);

  // Unified add-on flag: returning OR explicit addon mode
  const isAddonFlow = isReturningFloralUser || mode === "addon";

  // After successful checkout
  const handleFloralSuccess = async () => {
    try {
      const uid = getAuth().currentUser?.uid;
      if (uid) {
        await updateDoc(doc(db, "users", uid), {
          "bookings.floral": true,
          "bookings.updatedAt": serverTimestamp(),
        });
      }
      setThankYouMode(isAddonFlow ? "upgrade" : "initial");
      window.dispatchEvent(new Event("purchaseMade"));
      setStep("thankyou");
    } catch (err) {
      console.error("❌ Floral success write failed:", err);
      alert(
        "Your floral booking went through, but we had trouble saving the status. The Pixies will double-check it!"
      );
    }
  };

  const handleThankYouClose = () => {
    if (onComplete && mode === "initial") onComplete();
    onClose();
  };

  return (
    <>
      {/* Main flow overlay — render ONLY when the account modal is NOT open */}
      {!showAccountModal && (
        <div className="pixie-overlay">
          {/* scrollable area (no pixie-card wrapper here anymore) */}
          <div ref={cardRef} style={{ width: "100%" }}>
            {/* ✅ ADDED: Intro screen uses the standard card */}
            {step === "intro" && (
              <FloralIntro
                onContinue={() => setStep("palette")}
                onClose={onClose}
              />
            )}
  
            {step === "palette" && (
              <FloralPalettePicker
                onContinue={(paletteName) => {
                  setSelectedPalette(paletteName);
                  setStep("arrangements");
                }}
                onClose={onClose}
              />
            )}
  
            {step === "arrangements" && (
              <TableArrangementPicker
                onContinue={(arrangementName) => {
                  setSelectedArrangement(arrangementName);
                  setStep("cart");
                }}
                onClose={onClose}
              />
            )}
  
            {/* Return-user friendly prompt — inside a pixie card */}
            {step === "returnPrompt" && (
  <FloralThankYouReturn
    onClose={onClose}
    onAddMore={() => setStep("cart")}
  />
)}
  
            {step === "cart" && (
              <FloralCart
                setTotal={(grandTotal) => {
                  setTotal(grandTotal);
                  setBookingData((prev) => ({ ...prev, total: grandTotal }));
                }}
                setLineItems={(items) => {
                  setLineItems(items);
                  setBookingData((prev) => ({ ...prev, lineItems: items }));
                }}
                buttonLabel="Confirm & Book"
                setQuantities={setQuantities}
                selectedPalette={selectedPalette}
                selectedArrangement={selectedArrangement}
                onStartOver={() => {
                  setSelectedPalette(null);
                  setSelectedArrangement(null);
                  setQuantities({});
                  if (isReturningFloralUser) setStep("returnPrompt");
                  else setStep("palette");
                }}
                onContinue={() => {
                  const user = getAuth().currentUser;
                  if (isAddonFlow) setStep("checkout");
                  else if (user) setStep("calendar");
                  else setShowAccountModal(true);
                }}
                onClose={onClose}
              />
            )}
  
            {step === "calendar" && userHasLockedDate && (
              <WeddingDateConfirmScreen
                formattedDate={userWeddingDate}
                dayOfWeek={userDayOfWeek}
                userHasDate={!!userWeddingDate}
                weddingDateLocked={dateLocked}
                onConfirm={() => {
                  setBookingData((prev) => ({
                    ...prev,
                    weddingDate: userWeddingDate || "",
                    dayOfWeek: userDayOfWeek || "",
                  }));
                  setStep("contract");
                }}
                onEditDate={() => setStep("editdate")}
                onClose={onClose}
              />
            )}
  
            {step === "calendar" && !userHasLockedDate && (
              <WeddingDateScreen
                onContinue={(data) => {
                  setBookingData((prev) => ({ ...prev, ...data }));
                  setStep("contract");
                }}
                onClose={onClose}
              />
            )}
  
            {step === "editdate" && (
              <WeddingDateScreen
                onContinue={(data) => {
                  setBookingData((prev) => ({ ...prev, ...data }));
                  setStep("contract");
                }}
                onClose={onClose}
              />
            )}
  
            {step === "contract" && (
              <FloralContract
                bookingData={{ ...bookingData, total }}
                onBack={() => setStep("cart")}
                onContinue={() => setStep("checkout")}
                payFull={payFull}
                setPayFull={setPayFull}
                setSignatureImage={setSignatureImage}
                signatureSubmitted={signatureSubmitted}
                setSignatureSubmitted={setSignatureSubmitted}
                onClose={onClose}
              />
            )}
  
  {step === "checkout" &&
  (() => {
    const totalForCheckout = Number(bookingData.total ?? 0);
    const depositForCheckout =
      Math.round((totalForCheckout * 0.25 + Number.EPSILON) * 100) / 100;

    const summary = payFull
      ? `You're paying $${totalForCheckout.toFixed(2)} today.`
      : `You're paying a $${depositForCheckout.toFixed(2)} deposit today.`;

    return (
      <FloralCheckOut
        onClose={onClose}
        isAddon={isAddonFlow}
        total={totalForCheckout}
        depositAmount={depositForCheckout}
        payFull={payFull}
        paymentSummary={summary}
        signatureImage={signatureImage}
        onSuccess={handleFloralSuccess}
        firstName={firstName}
        lastName={lastName}
        weddingDate={bookingData.weddingDate || "TBD"}
        lineItems={lineItems}
        uid={getAuth().currentUser?.uid || ""}
      />
    );
  })()}

{step === "thankyou" && (
  <>
    {thankYouMode === "initial" && (
      <FloralThankYouInitial onClose={handleThankYouClose} />
    )}

    {thankYouMode === "return" && (
      <FloralThankYouReturn
        onClose={handleThankYouClose}
        onAddMore={() => setStep("cart")}
      />
    )}

    {thankYouMode === "upgrade" && (
      <FloralThankYouAddOn onClose={handleThankYouClose} />
    )}
  </>
)}
</div>
</div>
)}

{/* Account modal overlay — rendered separately when open */}
{showAccountModal && (
  <FloralAccountModal
    onSuccess={() => {
      setShowAccountModal(false);
      setStep("calendar");
    }}
    onClose={() => setShowAccountModal(false)}
  />
)}
</>
);
};

export default FloralPickerOverlay;