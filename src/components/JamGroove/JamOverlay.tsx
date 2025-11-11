// src/components/jam/JamOverlay.tsx
import React, { useEffect, useRef, useState } from "react";
import { useOverlayOpen } from "../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../hooks/useScrollToTop"; // 👈 add
import JamIntro from "./JamIntro";
import CeremonyOrder from "./CeremonyOrder";
import CeremonyMusic from "./CeremonyMusic";
import CocktailMusic from "./CocktailMusic";
import PreDinnerWelcomeScreen from "./PreDinnerWelcomeScreen";
import FamilyDances from "./FamilyDances";
import GrandEntrances from "./GrandEntrances";
import DinnerMusic from "./DinnerMusic";
import CakeCutting from "./CakeCutting";
import MusicalGenres from "./MusicalGenres";
import PixiePurchaseScreenJam from "./PixiePurchaseScreenJam";
import JamCheckOut from "./JamCheckOut";
import JamThankYouInitial from "./JamThankYouInitial";
import JamAccountModal from "./JamAccountModal";
import WeddingDateScreen from "../common/WeddingDateScreen";
import WeddingDateConfirmScreen from "../common/WeddingDateConfirmScreen";
import JamContractScreen from "./JamContract";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useUser } from "../../contexts/UserContext";
import PartyEntranceSong from "./PartyEntranceSong";
import BrideEntranceSong from "./BrideEntranceSong";
import OtherCeremonySongs from "./OtherCeremonySongs";
import RecessionalSong from "./RecessionalSong";

type SongModalKey = "bride" | "party" | "recessional" | "other" | null;

export type JamStep =
  | "intro" | "ceremonyOrder" | "ceremonyMusic" | "cocktail" | "welcome" | "family" | "grandEntrance"
  | "dinner" | "cake" | "genres" | "cart" | "calendar" | "editdate" | "contract" | "checkout" | "thankyou" | "account";

export type JamSelectionsType = {
  ceremonyMusic?: {
    bride?: string; brideArtist?: string; brideVersion?: string;
    party?: string; partyArtist?: string; partyVersion?: string;
    recessionalSong?: string; recessionalArtist?: string; recessionalVersion?: string;
    otherSongs?: string; otherSongsArtist?: string; otherSongsVersion?: string;
  };
  [key: string]: any;
};

interface JamOverlayProps {
  onClose: () => void;
  onComplete?: () => void;
  mode?: "initial" | "addon";
  startAt?: JamStep;
}

const JamOverlay: React.FC<JamOverlayProps> = ({ onClose, onComplete, mode = "initial", startAt }) => {
  const { userData } = useUser();
  const uid = userData?.uid || "";
  const isGuestUser = !getAuth().currentUser;
  const isAddon = mode === "addon";

  const defaultStep: JamStep = startAt || (isAddon ? "cart" : "intro");
  const [step, setStepRaw] = useState<JamStep>(defaultStep);

  // ✅ unified setter that stores guest progress
  const setStep = (newStep: JamStep) => {
    setStepRaw(newStep);
    if (!getAuth().currentUser) localStorage.setItem("jamSavedStep", newStep);
  };

  // 🔒 lock body scroll + provide a scroll container ref
  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([step], { targetRef: cardRef }); // snap to top on step change

  const [jamSelections, setJamSelections] = useState<any>({ ceremonyMusic: {} });
  const [activeSongModal, setActiveSongModal] = useState<SongModalKey>(null);
  const [lineItems, setLineItems] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [payFull, setPayFull] = useState(true);
  const [signatureImage, setSignatureImage] = useState("");
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [savedStepBeforeModal, setSavedStepBeforeModal] = useState<JamStep | null>(null);
  const [bookingData, setBookingData] = useState<any>({ total: 0, depositAmount: 0, paymentSummary: "", lineItems: [] });
  const [userWeddingDate, setUserWeddingDate] = useState<string | null>(null);
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null);
  const [dateLocked, setDateLocked] = useState<boolean>(false);
  const userHasLockedDate = dateLocked || (!!userWeddingDate && !!userDayOfWeek);
  const [jamAddOnQuantities, setJamAddOnQuantities] = useState<Record<string, number>>({});
  const [hasDJBase, setHasDJBase] = useState(false);

  // Restore saved step for guests
  useEffect(() => {
    if (!getAuth().currentUser) {
      const saved = localStorage.getItem("jamSavedStep");
      if (saved) setStepRaw(saved as JamStep);
    }
  }, []);

  // Load user data
useEffect(() => {
  (async () => {
    const user = getAuth().currentUser;
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) return;

      const data: any = snap.data();

      // Wedding date from FS (with fallbacks to nested + LS)
      const fsWeddingDate =
        data.weddingDate ||
        data.wedding?.date ||
        localStorage.getItem("weddingDate") ||
        null;

      // Day of week can be under bookings.dayOfWeek, or top-level dayOfWeek; else compute from date
      const fsDayOfWeek =
        data.bookings?.dayOfWeek ||
        data.dayOfWeek ||
        (fsWeddingDate
          ? new Date(`${fsWeddingDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" })
          : null);

      // Lock flag from FS or LS
      const fsLocked =
        Boolean(data.weddingDateLocked || data.dateLocked) ||
        localStorage.getItem("weddingDateLocked") === "true";

      setUserWeddingDate(fsWeddingDate);
      setUserDayOfWeek(fsDayOfWeek);
      setDateLocked(fsLocked);
      setHasDJBase(Boolean(data.bookings?.jam));

      if (data?.jamGrooveSavedStep) {
        setStepRaw(data.jamGrooveSavedStep as JamStep);
      }
    } catch (e) {
      console.error("❌ Error fetching jam data:", e);
    }
  })();
}, []);

  // 🪩 Check if the user already booked Jam & Groove
const [alreadyBooked, setAlreadyBooked] = useState(false);

useEffect(() => {
  const checkBooking = async () => {
    try {
      const user = getAuth().currentUser;
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data();
        if (data?.bookings?.jam) {
          setAlreadyBooked(true);
        }
      }
    } catch (e) {
      console.error("Error checking Jam booking:", e);
    }
  };
  checkBooking();
}, []);

  // Persist step for logged-in users
  useEffect(() => {
    if (!step) return;
    const allowedSteps: JamStep[] = [
      "intro","ceremonyOrder","ceremonyMusic","cocktail","welcome","family",
      "grandEntrance","dinner","cake","genres","cart","calendar","editdate","contract","checkout"
    ];
    if (allowedSteps.includes(step) && getAuth().currentUser) {
      updateDoc(doc(db, "users", getAuth().currentUser!.uid), { jamGrooveSavedStep: step })
        .catch((err) => console.error("❌ Error saving step:", err));
    }
  }, [step]);

  // React to dateLockedNow (set by other flows) and LS cache
useEffect(() => {
  const handler = () => {
    const d = localStorage.getItem("weddingDate");
    const locked = localStorage.getItem("weddingDateLocked") === "true";
    const dow = d
      ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" })
      : null;

    setUserWeddingDate(d);
    setUserDayOfWeek(dow);
    setDateLocked(locked);
  };

  window.addEventListener("dateLockedNow", handler);
  return () => window.removeEventListener("dateLockedNow", handler);
}, []);

  const handleSuccess = () => {
    window.dispatchEvent(new Event("jamCompletedNow"));
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("userPurchaseMade"));
    setStep("thankyou");
  };

  const handleJamCartContinue = (grandTotal: number, items: string[]) => {
    setTotal(grandTotal);
    setLineItems(items);

    const DEPOSIT_AMOUNT = 750;
    const depositDue = Math.min(DEPOSIT_AMOUNT, grandTotal);
    const remaining = Math.max(0, grandTotal - depositDue);
    const months = 3;
    const perMonth = months > 0 ? +(remaining / months).toFixed(2) : 0;

    const includesDJ = items.some((i) => i.includes("DJ Wed&Done Package"));
    const includesGrooveGuide = items.some((i) => i.includes("Groove Guide PDF"));
    const shouldDisableMonthly = includesGrooveGuide && !includesDJ;

    setBookingData({
      total: grandTotal,
      depositAmount: depositDue,
      lineItems: items,
      paymentSummary:
        `You'll pay $${depositDue.toFixed(2)} today` +
        (remaining > 0 ? ` and $${perMonth.toFixed(2)} for ${months} months (remaining $${remaining.toFixed(2)}).` : "."),
      weddingDate: userWeddingDate ?? undefined,
      dayOfWeek: userDayOfWeek ?? undefined,
    });

    if (shouldDisableMonthly) setPayFull(true);

    const user = getAuth().currentUser;
    if (!user) {
      setSavedStepBeforeModal("cart");
      setShowAccountModal(true);
      return;
    }

    if (includesDJ) {
      // Always go to the calendar step; it will show Confirm or Edit as appropriate
      setStep("calendar");
    } else {
      setStep("contract");
    }
  };

  if (alreadyBooked) {
    return (
      <div className="pixie-overlay">
        <div className="pixie-card pixie-card--modal">
          <button className="pixie-card__close" onClick={onClose} aria-label="Close">
            <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
          </button>

          <div className="pixie-card__body" style={{ textAlign: "center" }}>
            <video
              src={`${import.meta.env.BASE_URL}assets/videos/frog_thanks.mp4`}
              autoPlay
              loop
              muted
              playsInline
              className="px-media"
              style={{ maxWidth: 200, borderRadius: 16, marginBottom: "1rem" }}
            />

            <h2 className="px-title" style={{ marginBottom: 8 }}>
              Your musical magician is all booked and confirmed! 🎶
            </h2>

            <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
              Check out the other Button Boutiques to cross off more wedding to-do list items!
            </p>

            <div className="px-cta-col">
              <button className="boutique-primary-btn" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <>
      {/* Render the main flow only when the account modal is NOT open */}
      {!showAccountModal && (
        <div className="pixie-overlay">
          {/* Scrollable area; individual screens render their own cards */}
          <div ref={cardRef} style={{ width: "100%" }}>
            {step === "intro" && (
              <JamIntro onContinue={() => setStep("ceremonyOrder")} onClose={onClose} />
            )}
  
            {step === "ceremonyOrder" && (
              <CeremonyOrder
                onBack={() => setStep("intro")}
                onContinue={() => setStep("ceremonyMusic")}
                jamSelections={jamSelections}
                setJamSelections={setJamSelections}
                isGuestUser={isGuestUser}
                onClose={onClose}
              />
            )}
  
            {step === "ceremonyMusic" && (
              <CeremonyMusic
                currentStep={step}
                onBack={() => setStep("ceremonyOrder")}
                onContinue={() => setStep("cocktail")}
                jamSelections={jamSelections}
                setJamSelections={setJamSelections}
                isGuestUser={isGuestUser}
                onClose={onClose}
              />
            )}
  
            {step === "cocktail" && (
              <CocktailMusic
                onBack={() => setStep("ceremonyMusic")}
                onContinue={() => setStep("welcome")}
                jamSelections={jamSelections}
                setJamSelections={setJamSelections}
                isGuestUser={isGuestUser}
                onClose={onClose}
              />
            )}
  
            {step === "welcome" && (
              <PreDinnerWelcomeScreen
                onBack={() => setStep("cocktail")}
                onContinue={() => setStep("family")}
                jamSelections={jamSelections}
                setJamSelections={setJamSelections}
                isGuestUser={isGuestUser}
                onClose={onClose}
              />
            )}
  
            {step === "family" && (
              <FamilyDances
                onBack={() => setStep("welcome")}
                onContinue={() => setStep("grandEntrance")}
                jamSelections={jamSelections}
                setJamSelections={setJamSelections}
                isGuestUser={isGuestUser}
                onClose={onClose}
              />
            )}
  
            {step === "grandEntrance" && (
              <GrandEntrances
                onBack={() => setStep("family")}
                onContinue={() => setStep("dinner")}
                jamSelections={jamSelections}
                setJamSelections={setJamSelections}
                isGuestUser={isGuestUser}
                onClose={onClose}
              />
            )}
  
            {step === "dinner" && (
              <DinnerMusic
                onBack={() => setStep("grandEntrance")}
                onContinue={() => setStep("cake")}
                jamSelections={jamSelections}
                setJamSelections={setJamSelections}
                isGuestUser={isGuestUser}
                onClose={onClose}
              />
            )}
  
            {step === "cake" && (
              <CakeCutting
                onBack={() => setStep("dinner")}
                onContinue={() => setStep("genres")}
                jamSelections={jamSelections}
                setJamSelections={setJamSelections}
                isGuestUser={isGuestUser}
                onClose={onClose}
              />
            )}
  
            {step === "genres" && (
              <MusicalGenres
                onBack={() => setStep("cake")}
                onContinue={() => setStep("cart")}
                jamSelections={jamSelections}
                setJamSelections={setJamSelections}
                isGuestUser={isGuestUser}
                onClose={onClose}
              />
            )}
  
            {step === "cart" && (
              <PixiePurchaseScreenJam
                onBack={() => setStep("genres")}
                setTotal={setTotal}
                setLineItems={setLineItems}
                setQuantities={setJamAddOnQuantities}
                onContinue={handleJamCartContinue}
                onClose={onClose}
              />
            )}
  
  {step === "calendar" && userHasLockedDate && (
  <WeddingDateConfirmScreen
    formattedDate={
      userWeddingDate
        ? new Date(`${userWeddingDate}T12:00:00`).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : ""
    }
    dayOfWeek={userDayOfWeek || ""}
    userHasDate={!!userWeddingDate}
    weddingDateLocked={!!dateLocked}
    onConfirm={() => setStep("contract")}
    onEditDate={() => setStep("editdate")}
    onClose={onClose}
  />
)}
  
            {step === "calendar" && !userHasLockedDate && (
              <WeddingDateScreen
                onContinue={({ weddingDate, dayOfWeek }) => {
                  setUserWeddingDate(weddingDate);
                  setUserDayOfWeek(dayOfWeek);
                  setBookingData((prev: any) => ({ ...prev, weddingDate, dayOfWeek }));
                  setStep("contract");
                }}
                onClose={onClose}
              />
            )}
  
            {step === "editdate" && (
              <WeddingDateScreen
                onContinue={({ weddingDate, dayOfWeek }) => {
                  setUserWeddingDate(weddingDate);
                  setUserDayOfWeek(dayOfWeek);
                  setBookingData((prev: any) => ({ ...prev, weddingDate, dayOfWeek }));
                  setStep("contract");
                }}
                onClose={onClose}
              />
            )}
  
            {step === "contract" && (
              <JamContractScreen
                bookingData={bookingData}
                payFull={payFull}
                setPayFull={setPayFull}
                setSignatureImage={setSignatureImage}
                signatureSubmitted={signatureSubmitted}
                setSignatureSubmitted={setSignatureSubmitted}
                onBack={() => setStep("cart")}
                onContinue={() => setStep("checkout")}
                onClose={onClose}
                onSuccess={handleSuccess}
              />
            )}
  
            {step === "checkout" && (
              <JamCheckOut
                total={bookingData.total!}
                depositAmount={bookingData.depositAmount!}
                payFull={payFull}
                paymentSummary={bookingData.paymentSummary}
                lineItems={bookingData.lineItems || []}
                signatureImage={signatureImage}
                onSuccess={handleSuccess}
                onBack={() => setStep("contract")}
                isAddon={isAddon}
                firstName={userData?.firstName || ""}
                lastName={userData?.lastName || ""}
                weddingDate={bookingData.weddingDate || "TBD"}
                uid={uid}
                jamSelections={jamSelections}
                onClose={onClose}
              />
            )}
  
  {step === "thankyou" && <JamThankYouInitial onClose={onClose} />}
  
            {/* Ceremony Song Scroll Modals (separate overlays) */}
            {activeSongModal === "bride" && (
              <BrideEntranceSong
                jamSelections={jamSelections}
                setJamSelections={setJamSelections}
                onClose={() => setActiveSongModal(null)}
                isGuestUser={isGuestUser}
              />
            )}
            {activeSongModal === "party" && (
              <PartyEntranceSong
                jamSelections={jamSelections}
                setJamSelections={setJamSelections}
                onClose={() => setActiveSongModal(null)}
                isGuestUser={isGuestUser}
              />
            )}
            {activeSongModal === "recessional" && (
              <RecessionalSong
                jamSelections={jamSelections}
                setJamSelections={setJamSelections}
                onClose={() => setActiveSongModal(null)}
                isGuestUser={isGuestUser}
              />
            )}
            {activeSongModal === "other" && (
              <OtherCeremonySongs
                jamSelections={jamSelections}
                setJamSelections={setJamSelections}
                onClose={() => setActiveSongModal(null)}
                isGuestUser={isGuestUser}
              />
            )}
          </div>
        </div>
      )}
  
      {/* Account modal renders alone when open */}
      {showAccountModal && (
        <JamAccountModal
          onSuccess={() => {
            setShowAccountModal(false);
            setStep("calendar");
          }}
          onClose={() => setShowAccountModal(false)}
          currentStep={savedStepBeforeModal || step}
        />
      )}
    </>
  );
};

export default JamOverlay;