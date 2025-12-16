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
import JamIncludedCart from "./JamIncludedCart";

export type SongModalKey = "bride" | "party" | "recessional" | "other" | null;

export type JamStep =
  | "intro"
  | "ceremonyOrder"
  | "ceremonyMusic"
  | "cocktail"
  | "welcome"
  | "family"
  | "grandEntrance"
  | "dinner"
  | "cake"
  | "genres"
  | "cart"
  | "calendar"
  | "editdate"
  | "contract"
  | "checkout"
  | "thankyou"
  | "account";

export type JamSelectionsType = {
  ceremonyMusic?: {
    bride?: string;
    brideArtist?: string;
    brideVersion?: string;
    party?: string;
    partyArtist?: string;
    partyVersion?: string;
    recessionalSong?: string;
    recessionalArtist?: string;
    recessionalVersion?: string;
    otherSongs?: string;
    otherSongsArtist?: string;
    otherSongsVersion?: string;
  };
  [key: string]: any;
};

interface JamOverlayProps {
  onClose: () => void;
  onComplete?: () => void;
  mode?: "initial" | "addon";
  startAt?: JamStep;
}

const JamOverlay: React.FC<JamOverlayProps> = ({
  onClose,
  onComplete,
  mode = "initial",
  startAt,
}) => {
  const { userData } = useUser();
  const uid = userData?.uid || "";
  const isGuestUser = !getAuth().currentUser;
  const isAddon = mode === "addon";
  const [hasRubiIncludedDJ, setHasRubiIncludedDJ] = useState(false);
  const defaultStep: JamStep = startAt || (isAddon ? "cart" : "intro");
  const [step, setStepRaw] = useState<JamStep>(defaultStep);
  const [usedExistingGuide, setUsedExistingGuide] = useState(false);

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
  const [savedStepBeforeModal, setSavedStepBeforeModal] =
    useState<JamStep | null>(null);
  const [bookingData, setBookingData] = useState<any>({
    total: 0,
    depositAmount: 0,
    paymentSummary: "",
    lineItems: [],
  });
  const [userWeddingDate, setUserWeddingDate] = useState<string | null>(null);
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null);
  const [dateLocked, setDateLocked] = useState<boolean>(false);
  const hasWeddingDate = !!userWeddingDate;
const userHasLockedDate = hasWeddingDate; // controls: confirm vs entry
  const [jamAddOnQuantities, setJamAddOnQuantities] = useState<
    Record<string, number>
  >({});
  const [hasDJBase, setHasDJBase] = useState(false);
  const [isPdfOnly, setIsPdfOnly] = useState(false);
  const [nextStepAfterAccount, setNextStepAfterAccount] =
    useState<JamStep>("cart");
  const [hasPdfOnlyGuide, setHasPdfOnlyGuide] = useState(false);

  // Restore saved step for guests
  useEffect(() => {
    if (!getAuth().currentUser) {
      const saved = localStorage.getItem("jamSavedStep");
      if (saved) setStepRaw(saved as JamStep);
    }
  }, []);

  // Restore jamSelections from Firestore / localStorage
  useEffect(() => {
    const restore = async () => {
      const user = getAuth().currentUser;

      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data: any = snap.data() || {};

          if (data.jamSelections) {
            setJamSelections(data.jamSelections);
          }
        } catch (err) {
          console.error(
            "❌ Error restoring jamSelections from Firestore:",
            err
          );
        }
      } else {
        // guest path
        try {
          const raw = localStorage.getItem("jamGrooveProgress");
          if (!raw) return;
          const parsed = JSON.parse(raw);

          if (parsed.jamSelections) {
            setJamSelections(parsed.jamSelections);
          }
        } catch (err) {
          console.error(
            "❌ Error restoring jamSelections from localStorage:",
            err
          );
        }
      }
    };

    restore();
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

        // 🔹 figure out which venue they booked
        const bookedVenueSlug =
          data?.venueRankerData?.booking?.venueSlug || // Ranker booking object
          data?.bookings?.venueSlug || // fallback if you stored it here
          data?.venueSlug || // or legacy field
          localStorage.getItem("venueSlug"); // last resort

        setHasRubiIncludedDJ(bookedVenueSlug === "rubihouse");

        // date logic…
        const fsWeddingDate =
          data.weddingDate ||
          data.wedding?.date ||
          localStorage.getItem("weddingDate") ||
          null;

        const fsDayOfWeek =
          data.bookings?.dayOfWeek ||
          data.dayOfWeek ||
          (fsWeddingDate
            ? new Date(`${fsWeddingDate}T12:00:00`).toLocaleDateString(
                "en-US",
                {
                  weekday: "long",
                }
              )
            : null);

        const fsLocked =
          Boolean(data.weddingDateLocked || data.dateLocked) ||
          localStorage.getItem("weddingDateLocked") === "true";

        setUserWeddingDate(fsWeddingDate);
        setUserDayOfWeek(fsDayOfWeek);
        setDateLocked(fsLocked);
        setHasDJBase(Boolean(data.bookings?.jam));

        // 🔹 NEW: do they have a Groove Guide but no DJ booking?
        const docs = (data.documents || []) as any[];
        const hasGuideDoc = docs.some(
          (d) => d?.module === "jam" && d?.kind === "guide"
        );
        const hasJamBooking = Boolean(data?.bookings?.jam);
        const pdfOnly = hasGuideDoc && !hasJamBooking;

        setHasPdfOnlyGuide(pdfOnly);

        // restore saved step only if not in pdf-only mode
        if (data?.jamGrooveSavedStep && !pdfOnly) {
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
      "intro",
      "ceremonyOrder",
      "ceremonyMusic",
      "cocktail",
      "welcome",
      "family",
      "grandEntrance",
      "dinner",
      "cake",
      "genres",
      "cart",
      "calendar",
      "editdate",
      "contract",
      "checkout",
    ];
    if (allowedSteps.includes(step) && getAuth().currentUser) {
      updateDoc(doc(db, "users", getAuth().currentUser!.uid), {
        jamGrooveSavedStep: step,
      }).catch((err) =>
        console.error("❌ Error saving step:", err)
      );
    }
  }, [step]);

  // React to dateLockedNow (set by other flows) and LS cache
  useEffect(() => {
    const handler = () => {
      const d = localStorage.getItem("weddingDate");
      const locked = localStorage.getItem("weddingDateLocked") === "true";
      const dow = d
        ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
            weekday: "long",
          })
        : null;

      setUserWeddingDate(d);
      setUserDayOfWeek(dow);
      setDateLocked(locked);
    };

    window.addEventListener("dateLockedNow", handler);
    return () => window.removeEventListener("dateLockedNow", handler);
  }, []);

  const handleSuccess = () => {
    // For full DJ bookings, flip the Jam button to "completed"
    if (!isPdfOnly) {
      window.dispatchEvent(new Event("jamCompletedNow"));
    }

    // PDF-only still counts as a purchase for Budget Wand, etc.
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("userPurchaseMade"));

    setStep("thankyou");
  };

  const handleJamCartContinue = (grandTotal: number, items: string[]) => {
    setTotal(grandTotal);
    setLineItems(items);

    const DEPOSIT_AMOUNT = 750;

    const includesDJ = items.some((i) =>
      i.includes("DJ Wed&Done Package")
    );
    const includesGrooveGuide = items.some((i) =>
      i.includes("Groove Guide PDF")
    );

    // 🎯 PDF-only = Groove Guide selected, no DJ package
    const pdfOnly = includesGrooveGuide && !includesDJ;
    setIsPdfOnly(pdfOnly);

    // Deposit logic:
    // - DJ booking → flat 750 (capped by total)
    // - PDF-only → pay in full (no monthly plan)
    const depositForThis = pdfOnly
      ? grandTotal
      : Math.min(DEPOSIT_AMOUNT, grandTotal);
    const remaining = Math.max(0, grandTotal - depositForThis);
    const months = pdfOnly ? 0 : 3;
    const perMonth = months > 0 ? +(remaining / months).toFixed(2) : 0;

    const paymentSummary = pdfOnly
      ? `You're paying $${grandTotal.toFixed(
          2
        )} today for your Groove Guide PDF.`
      : `You'll pay $${Number(depositForThis).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} today${
          remaining > 0
            ? ` and $${Number(perMonth).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} for ${months} months (remaining $${remaining.toFixed(
                2
              )}).`
            : "."
        }`;

    const shouldDisableMonthly = pdfOnly; // always full pay for PDF-only

    setBookingData({
      total: grandTotal,
      depositAmount: depositForThis,
      lineItems: items,
      paymentSummary,
      weddingDate: userWeddingDate ?? undefined,
      dayOfWeek: userDayOfWeek ?? undefined,
    });

    if (shouldDisableMonthly) setPayFull(true);

    const user = getAuth().currentUser;

    // Decide which step we *want* next:
    // - DJ in cart → calendar
    // - PDF-only → checkout
    // - (future) add-on-only → contract
    const nextStep: JamStep = includesDJ
      ? "calendar"
      : pdfOnly
      ? "checkout"
      : "contract";

    if (!user) {
      // No account yet → open account modal, then resume at proper step
      setSavedStepBeforeModal("cart");
      setNextStepAfterAccount(nextStep);
      setShowAccountModal(true);
      return;
    }

    // Logged-in path: go directly where we decided
    setStep(nextStep);
  };

  if (alreadyBooked) {
    return (
      <div className="pixie-overlay">
        <div className="pixie-card pixie-card--modal">
          <button
            className="pixie-card__close"
            onClick={onClose}
            aria-label="Close"
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
              alt="Close"
            />
          </button>

          <div
            className="pixie-card__body"
            style={{ textAlign: "center" }}
          >
            <video
              src={`${import.meta.env.BASE_URL}assets/videos/frog_thanks.mp4`}
              autoPlay
              loop
              muted
              playsInline
              className="px-media"
              style={{
                maxWidth: 200,
                borderRadius: 16,
                marginBottom: "1rem",
              }}
            />

            <h2 className="px-title" style={{ marginBottom: 8 }}>
              Your musical magician is all booked and confirmed! 🎶
            </h2>

            <p
              className="px-prose-narrow"
              style={{ marginBottom: 16 }}
            >
              Check out the other Button Boutiques to cross off more
              wedding to-do list items!
            </p>

            <div className="px-cta-col">
              <button
                className="boutique-primary-btn"
                onClick={onClose}
              >
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
        <div
          className="pixie-overlay"
          // 🛡️ Shield all Jam inputs from global key handlers
          onKeyDownCapture={(e) => {
            const t = e.target as HTMLElement | null;
            if (
              t instanceof HTMLInputElement ||
              t instanceof HTMLTextAreaElement ||
              t instanceof HTMLSelectElement
            ) {
              e.stopPropagation();
            }
          }}
          onKeyUpCapture={(e) => {
            const t = e.target as HTMLElement | null;
            if (
              t instanceof HTMLInputElement ||
              t instanceof HTMLTextAreaElement ||
              t instanceof HTMLSelectElement
            ) {
              e.stopPropagation();
            }
          }}
        >
          {/* Scrollable area; individual screens render their own cards */}
          <div ref={cardRef} style={{ width: "100%" }}>
          {step === "intro" && (
  <JamIntro
    onClose={onClose}
    includedMode={hasRubiIncludedDJ}
    hasPdfOnlyGuide={hasPdfOnlyGuide}
    // "Update my Groove Guide" → walk Q&A again → allow new PDF later
    onContinue={() => {
      setUsedExistingGuide(false);
      setStep("ceremonyOrder");
    }}
    // "Use Groove Guide on file" → go straight to cart and SKIP regeneration
    onUseExistingGuide={
      hasPdfOnlyGuide
        ? () => {
            setUsedExistingGuide(true);
            setStep("cart");
          }
        : undefined
    }
  />
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
                openSongModal={(key) => setActiveSongModal(key)}
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

            {/* Cart step – normal paid Jam vs Rubi-included DJ */}
            {step === "cart" && !hasRubiIncludedDJ && (
              <PixiePurchaseScreenJam
                onBack={() => setStep("genres")}
                setTotal={setTotal}
                setLineItems={setLineItems}
                setQuantities={setJamAddOnQuantities}
                onContinue={handleJamCartContinue}
                onClose={onClose}
              />
            )}

            {step === "cart" && hasRubiIncludedDJ && (
              <JamIncludedCart
                onBack={() => setStep("genres")}
                onClose={onClose}
                jamSelections={jamSelections}
                fullName={
                  `${userData?.firstName || ""} ${
                    userData?.lastName || ""
                  }`.trim() ||
                  getAuth().currentUser?.displayName ||
                  ""
                }
                weddingDate={userWeddingDate}
              />
            )}

            {step === "calendar" && userHasLockedDate && (
              <WeddingDateConfirmScreen
                formattedDate={
                  userWeddingDate
                    ? new Date(
                        `${userWeddingDate}T12:00:00`
                      ).toLocaleDateString("en-US", {
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
                  setBookingData((prev: any) => ({
                    ...prev,
                    weddingDate,
                    dayOfWeek,
                  }));
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
                  setBookingData((prev: any) => ({
                    ...prev,
                    weddingDate,
                    dayOfWeek,
                  }));
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
    isPdfOnly={isPdfOnly}
    firstName={userData?.firstName || ""}
    lastName={userData?.lastName || ""}
    weddingDate={bookingData.weddingDate || "TBD"}
    uid={uid}
    jamSelections={jamSelections}
    onClose={onClose}
    // 👇 NEW: tells checkout NOT to regenerate Groove Guide
    skipGrooveGeneration={usedExistingGuide}
  />
)}

            {step === "thankyou" && (
              <JamThankYouInitial onClose={onClose} isPdfOnly={isPdfOnly} />
            )}

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
            setStep(nextStepAfterAccount);
          }}
          onClose={() => setShowAccountModal(false)}
          currentStep={savedStepBeforeModal || step}
        />
      )}
    </>
  );
};

export default JamOverlay;