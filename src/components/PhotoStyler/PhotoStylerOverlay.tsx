// src/components/photo/PhotoStylerOverlay.tsx
import React, { useState, useEffect } from "react";
import PhotoStylerIntro from "./PhotoStylerIntro";
import PhotoStylerChoices from "./PhotoStylerChoices";
import PhotoStyleResults from "./PhotoStyleResults";
import PixiePurchaseScreenPhoto from "./PixiePurchaseScreenPhoto";
import PixiePurchaseScreenPhotoAddOn from "./PixiePurchaseScreenPhotoAddOn";
import PhotoContract from "./PhotoContract";
import PhotoCheckOut from "./PhotoCheckOut";
import PhotoThankYouInitial from "./PhotoThankYouInitial";
import PhotoThankYouAddOn from "./PhotoThankYouAddOn";
import WeddingDateScreen from "../common/WeddingDateScreen";
import WeddingDateConfirmScreen from "../common/WeddingDateConfirmScreen";
import PhotoAccountModal from "./PhotoAccountModal";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore"; // 👈 added updateDoc
import { db } from "../../firebase/firebaseConfig";

interface PhotoStylerOverlayProps {
  onClose: () => void;
  onComplete?: () => void;
  mode?: "initial" | "addon";
  startAt?: string;
}

const PhotoStylerOverlay: React.FC<PhotoStylerOverlayProps> = ({
  onClose,
  startAt = "intro", // 👈 safe default
  onComplete,
  mode = "initial",
}) => {
  const [step, setStep] = useState<
    | "intro"
    | "styling"
    | "results"
    | "cart"
    | "calendar"
    | "editdate"
    | "contract"
    | "checkout"
    | "thankyou"
  >(mode === "addon" ? "cart" : "intro");

  const [lineItems, setLineItems] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [payFull, setPayFull] = useState(true);
  const [signatureImage, setSignatureImage] = useState("");
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);

  const [bookingData, setBookingData] = useState<{
    weddingDate?: string;
    dayOfWeek?: string;
    total?: number;
    styleChoice?: string;
    lineItems?: string[];
    paymentSummaryText?: string;
  }>({});

  const [userWeddingDate, setUserWeddingDate] = useState<string | null>(null);
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null);
  const [dateLocked, setDateLocked] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [airyScore, setAiryScore] = useState(0);
  const [trueToLifeScore, setTrueToLifeScore] = useState(0);

  const userHasLockedDate = !!userWeddingDate && !!userDayOfWeek;

  // 🔍 Check if user already booked photo
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const checkBookingStatus = async () => {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const data = userDoc.data();
      if (data?.bookings?.photo === true) {
        setIsReturningUser(true);
        setStep("cart");
      }
    };

    checkBookingStatus();
  }, []);

  // 🔁 Load user wedding date info
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          setUserWeddingDate(data.weddingDate || null);
          setUserDayOfWeek(data.dayOfWeek || null);
          setDateLocked(data.dateLocked || false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 🧾 Success handler
  const handlePhotoSuccess = () => {
    console.log("📸 Photo Styler booking successful!");
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("userPurchaseMade"));
    setStep("thankyou");
  };

  const handleThankYouClose = () => {
    if (mode === "initial" && onComplete) {
      onComplete();
    }
    onClose();
  };

  // ✅ NEW: when they click “Book My Photographer”, lock in the style
  const handleBookPhotographer = async (finalStyle: string) => {
    // store in overlay state for later screens if needed
    setBookingData((prev) => ({
      ...prev,
      styleChoice: finalStyle,
    }));

    // localStorage backup for the PDF generator
    try {
      localStorage.setItem("photoStyle", finalStyle);
    } catch {
      // ignore
    }

    // Firestore field on the user doc
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          photoStyle: finalStyle,
        });
      } catch (err) {
        console.warn("[PhotoStylerOverlay] Could not save photoStyle:", err);
      }
    }

    // continue flow to cart
    setStep("cart");
  };

  return (
    <>
      {/* Main flow overlay — render ONLY when the account modal is NOT open */}
      {!showAccountModal && (
        <div className="pixie-overlay">
          {/* scrollable area; each child renders its own .pixie-card */}
          <div style={{ width: "100%" }}>
            {step === "intro" && (
              <PhotoStylerIntro
                onContinue={() => setStep("styling")}
                onClose={onClose}
              />
            )}

            {step === "styling" && (
              <PhotoStylerChoices
                onContinue={(results) => {
                  const styleChoice =
                    results.airy > results.trueToLife
                      ? "Light & Airy"
                      : "True to Life";
                  setBookingData((prev) => ({
                    ...prev,
                    styleChoice,
                  }));
                  setAiryScore(results.airy);
                  setTrueToLifeScore(results.trueToLife);
                  setStep("results");
                }}
                onBack={() => setStep("intro")}
                onClose={onClose}
              />
            )}

            {step === "results" && (
              <PhotoStyleResults
                airyScore={airyScore}
                trueToLifeScore={trueToLifeScore}
                onSwipeAgain={() => setStep("styling")}
                onBookPhotographer={handleBookPhotographer} // 👈 uses finalStyle
                onClose={onClose}
              />
            )}

            {step === "cart" &&
              (mode === "addon" ? (
                <PixiePurchaseScreenPhotoAddOn
                  setTotal={(grandTotal: number) => {
                    setTotal(grandTotal);
                    setBookingData((prev) => ({ ...prev, total: grandTotal }));
                  }}
                  setLineItems={(items: string[]) => {
                    setLineItems(items);
                    setBookingData((prev) => ({ ...prev, lineItems: items }));
                  }}
                  buttonLabel="Confirm & Book"
                  onContinue={() => setStep("checkout")}
                  onBack={() => setStep("intro")}
                  onStartOver={() => setStep("intro")}
                  setQuantities={() => {}}
                  onClose={onClose}
                />
              ) : (
                <PixiePurchaseScreenPhoto
                  setTotal={(grandTotal) => {
                    setTotal(grandTotal);
                    setBookingData((prev) => ({ ...prev, total: grandTotal }));
                  }}
                  setLineItems={(items) => {
                    setLineItems(items);
                    setBookingData((prev) => ({ ...prev, lineItems: items }));
                  }}
                  setQuantities={() => {}}
                  buttonLabel="Confirm & Book"
                  onStartOver={() => setStep("intro")}
                  onContinue={() => {
                    if (userWeddingDate) setStep("calendar");
                    else setShowAccountModal(true);
                  }}
                  onClose={onClose}
                />
              ))}

            {step === "calendar" && userHasLockedDate && (
              <WeddingDateConfirmScreen
                formattedDate={userWeddingDate || ""}
                dayOfWeek={userDayOfWeek || ""}
                userHasDate={!!userWeddingDate}
                weddingDateLocked={!!userWeddingDate && !!userDayOfWeek}
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
                  setUserWeddingDate(data.weddingDate);
                  setUserDayOfWeek(data.dayOfWeek);
                  setDateLocked(true);
                  setStep("contract");
                }}
                onClose={onClose}
              />
            )}

            {step === "editdate" && (
              <WeddingDateScreen
                onContinue={(data) => {
                  setBookingData((prev) => ({ ...prev, ...data }));
                  setUserWeddingDate(data.weddingDate);
                  setUserDayOfWeek(data.dayOfWeek);
                  setDateLocked(true);
                  setStep("contract");
                }}
                onClose={onClose}
              />
            )}

            {step === "contract" && (
              <PhotoContract
                bookingData={{ ...bookingData, total }}
                onBack={() => setStep("editdate")}
                onContinue={() => setStep("checkout")}
                payFull={payFull}
                setPayFull={setPayFull}
                setSignatureImage={setSignatureImage}
                signatureSubmitted={signatureSubmitted}
                setSignatureSubmitted={setSignatureSubmitted}
                onClose={onClose}
              />
            )}

{step === "checkout" && (
  <PhotoCheckOut
    onClose={onClose}
    isAddon={mode === "addon" || isReturningUser}
    total={bookingData.total || 0}
    depositAmount={
      bookingData.total
        ? Math.round(
            (bookingData.total * 0.25 + Number.EPSILON) * 100
          ) / 100
        : 0
    }
    payFull={payFull}
    paymentSummary={
      payFull
        ? `You're paying $${(bookingData.total || 0).toFixed(2)} today.`
        : `You're paying a $${bookingData.total
            ? Math.round(
                (bookingData.total * 0.25 + Number.EPSILON) * 100
              ) / 100
            : "0.00"} deposit today.`
    }
    signatureImage={signatureImage}
    onSuccess={handlePhotoSuccess}
    lineItems={lineItems}
    uid={getAuth().currentUser?.uid || ""}
    onBack={() => setStep("cart")}
    photoStyle={bookingData.styleChoice}
  />
)}

            {step === "thankyou" &&
              (mode === "addon" ? (
                <PhotoThankYouAddOn onClose={handleThankYouClose} />
              ) : (
                <PhotoThankYouInitial onClose={handleThankYouClose} />
              ))}
          </div>
        </div>
      )}

      {/* Account modal overlay — rendered separately when open */}
      {showAccountModal && (
        <PhotoAccountModal
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

export default PhotoStylerOverlay;