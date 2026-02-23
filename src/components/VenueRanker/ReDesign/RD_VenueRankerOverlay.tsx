// src/components/VenueRanker/RD/RD_VenueRankerOverlay.tsx
import React, { useEffect, useRef, useState } from "react";
import { useOverlayOpen } from "../../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../../hooks/useScrollToTop";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../../../firebase/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

import VenueRankerIntro from "../VenueRankerIntro";
import VenueInviteIntro from "../VenueInviteIntro";
import VenueInviteBanner from "../VenueInviteBanner";
import { venueDetails } from "../../../utils/venueDetails";

import RD_MadgeInterviewQ1_Budget from "./RD_MadgeInterviewQ1_Budget";
import RD_MadgeInterviewQ2_Flex from "./RD_MadgeInterviewQ2_Flex";
import RD_MadgeInterviewQ3_Guest from "./RD_MadgeInterviewQ3_Guest";
import RD_MadgeInterviewQ4_Vibe from "./RD_MadgeInterviewQ4_Vibe";
import RD_MedallionCastle from "./RD_MedallionCastle";

import VenueRankerContract from "../VenueRankerContract";
import VenueCheckOut from "../VenueCheckOut";
import VenueThankYou from "../VenueThankYou";
import VenueAccountModal from "../VenueAccountModal";

import type { RDInterviewState, VenueSlug } from "./rdVenueTypes";

import "../../../styles/globals/boutique.master.css";

// --------------------
// LocalStorage keys
// --------------------
const LS_INVITE_VENUE_KEY = "wd_inviteVenueSlug";
const LS_INVITE_CODE_KEY = "wd_inviteCode";
const LS_INVITE_EXPLORE_KEY = "wd_inviteExploreMode";
const LS_LOCKED_VENUE_KEY = "wd_lockedVenueSlug";
const LS_BONUS_500_KEY = "wd_bonus500";
const LS_RD_INTERVIEW_KEY = "rd_ranker_interview";
const LS_PENDING_BOOKING = "wd_pendingVenueBooking";

// Disable list stays (used by Medallion Castle)
const DISABLED_VENUES = new Set<string>(["fabric", "haciendadelsol"]);

type Screen =
  | "inviteIntro"
  | "intro"
  | "rdQ1Budget"
  | "rdQ2Flex"
  | "rdQ3Guest"
  | "rdQ4Vibe"
  | "rdMedallionCastle"
  | "venuecontract"
  | "checkout"
  | "thankyou";

type Props = {
  onClose: () => void;
  startAt?: string;
};

function safeNumber(n: any): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

const DEFAULT_INTERVIEW: RDInterviewState = {
  budgetTier: "notsure",
  collectionLean: "neutral",
  guestCount: null,
  includeCatering: null,
  vibes: [],
};

const RD_VenueRankerOverlay: React.FC<Props> = ({ onClose, startAt }) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([], { targetRef: cardRef });

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [invitedVenueSlug, setInvitedVenueSlug] = useState<VenueSlug | null>(() => {
    try {
      return (localStorage.getItem(LS_INVITE_VENUE_KEY) as VenueSlug) || null;
    } catch {
      return null;
    }
  });

  const [inviteCode, setInviteCode] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_INVITE_CODE_KEY);
    } catch {
      return null;
    }
  });

  const hasInvite = !!invitedVenueSlug;

  // Contract plumbing
  const [payFull, setPayFull] = useState(true);
  const [signatureImage, setSignatureImage] = useState<string>("");
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);

  // Optional setters your existing contract expects
  const [finalVenuePrice, setFinalVenuePrice] = useState(0);
  const [finalDeposit, setFinalDeposit] = useState(0);
  const [finalMonthlyPayment, setFinalMonthlyPayment] = useState(0);
  const [finalPaymentCount, setFinalPaymentCount] = useState(0);

  const [hasVenueBooked, setHasVenueBooked] = useState(false);
const [thankYouVariant, setThankYouVariant] = useState<"postPurchase" | "alreadyBooked">(
  "postPurchase"
);

  const [interview, setInterview] = useState<RDInterviewState>(() => {
    try {
      const raw = localStorage.getItem(LS_RD_INTERVIEW_KEY);
      if (!raw) return DEFAULT_INTERVIEW;

      const parsed = JSON.parse(raw) as Partial<RDInterviewState>;
      return {
        ...DEFAULT_INTERVIEW,
        ...parsed,
        vibes: Array.isArray(parsed.vibes) ? (parsed.vibes as any) : [],
      };
    } catch {
      return DEFAULT_INTERVIEW;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_RD_INTERVIEW_KEY, JSON.stringify(interview));
    } catch {}
  }, [interview]);

  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    // 1) Resume checkpoint first
    try {
      const checkpoint = localStorage.getItem("venueRankerCheckpoint");
      if (checkpoint === "medallion") return "rdMedallionCastle";
    } catch {}

    // 2) Dev override
    if (startAt) {
      switch (startAt) {
        case "inviteIntro":
        case "intro":
        case "rdQ1Budget":
        case "rdQ2Flex":
        case "rdQ3Guest":
        case "rdQ4Vibe":
        case "rdMedallionCastle":
          return startAt;
        default:
          return "intro";
      }
    }

    // 3) Invite fallback
    try {
      const invite = localStorage.getItem(LS_INVITE_VENUE_KEY);
      if (invite) return "inviteIntro";
    } catch {}

    return "intro";
  });

  // Mobile detector (used for envelope pin positioning)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 520);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Parse URL params once (invite + bonus)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);

      const bonus = params.get("bonus");
      const slug =
        params.get("venueInvite") ||
        params.get("inviteVenue") ||
        params.get("venue") ||
        "";

      const code =
        params.get("code") ||
        params.get("discount") ||
        params.get("promo") ||
        "";

      // Always clean URL
      try {
        const url = new URL(window.location.href);
        ["venueInvite", "inviteVenue", "venue", "code", "discount", "promo", "bonus"].forEach((k) =>
          url.searchParams.delete(k)
        );
        window.history.replaceState({}, "", url.toString());
      } catch {}

      // If we already hit medallion once, do not override screen
      try {
        const checkpoint = localStorage.getItem("venueRankerCheckpoint");
        if (checkpoint === "medallion") return;
      } catch {}

      if (!slug) return;

      if (bonus === "500") localStorage.setItem(LS_BONUS_500_KEY, "true");

      localStorage.setItem(LS_INVITE_VENUE_KEY, slug);
      if (code) localStorage.setItem(LS_INVITE_CODE_KEY, code);

      localStorage.setItem(LS_LOCKED_VENUE_KEY, slug);

      setInvitedVenueSlug(slug as VenueSlug);
      setInviteCode(code || null);
      setCurrentScreen("inviteIntro");
    } catch {}
  }, []);

  // ✅ Guaranteed resume: if auth becomes available and we have a pending booking, open contract
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      try {
        const raw = localStorage.getItem(LS_PENDING_BOOKING);
        if (!raw) return;

        const pending = JSON.parse(raw) as any;
        if (!pending?.venueSlug) return;

        // Restore canonical keys the contract/checkout expects
        localStorage.setItem("venueSlug", String(pending.venueSlug));
        localStorage.setItem("venueName", String(pending.venueName || ""));

        if (pending.weddingDate) {
          localStorage.setItem("venueWeddingDate", String(pending.weddingDate));
          localStorage.setItem("weddingDate", String(pending.weddingDate));
        }

        if (Number.isFinite(pending.guestCount) && Number(pending.guestCount) > 0) {
          localStorage.setItem("venueGuestCount", String(pending.guestCount));
          localStorage.setItem("guestCount", String(pending.guestCount));
          window.dispatchEvent(new Event("guestCountUpdated"));
        }

        if (Number.isFinite(pending.price) && Number(pending.price) > 0) {
          localStorage.setItem("venueTotal", String(pending.price));
          localStorage.setItem("venuePrice", String(pending.price));
        }

        localStorage.removeItem(LS_PENDING_BOOKING);

        setShowAccountModal(false);
        setCurrentScreen("venuecontract");
      } catch (e) {
        console.warn("⚠️ Could not resume pending booking on auth:", e);
      }
    });

    return () => unsub();
  }, []);

  const shouldShowInviteBanner = hasInvite && !showAccountModal && currentScreen !== "inviteIntro";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setHasVenueBooked(false);
        return;
      }
  
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) return;
  
        const data = snap.data() as any;
        const booked = !!data?.bookings?.venue;
  
        setHasVenueBooked(booked);
  
        // ✅ If already booked, show the already-booked thank you screen
        if (booked) {
          setThankYouVariant("alreadyBooked");
          setCurrentScreen("thankyou");
        }
      } catch (e) {
        console.warn("⚠️ Could not read venue booking state:", e);
      }
    });
  
    return () => unsub();
  }, []);

  // --------------------
  // Venue open handlers
  // --------------------
  const handleOpenVenue = (_slug: VenueSlug) => {
    // CastleModal / MedallionCastle should have already written context into localStorage.
    setCurrentScreen("venuecontract");
  };

  const handlePreviewVenue = (slug: VenueSlug) => {
    console.log("Preview venue (Swap mode):", slug);
  };

  const handleRequestSwap = (slug: VenueSlug) => {
    console.log("Swap into top5:", slug);
  };

  const handleStartOver = () => {
    try {
      localStorage.removeItem("venueRankerCheckpoint");
      localStorage.removeItem(LS_RD_INTERVIEW_KEY);
      localStorage.removeItem("rd_ranker_top5");
    } catch {}

    setInterview(DEFAULT_INTERVIEW);
    setCurrentScreen(hasInvite ? "inviteIntro" : "intro");
  };

  // ✅ Called by VenueAccountModal after success; also restores & routes immediately
  const handleAccountSuccess = () => {
    try {
      setShowAccountModal(false);

      const raw = localStorage.getItem(LS_PENDING_BOOKING);
if (!raw) {
  // ✅ Auth listener may have already resumed us to contract.
  // Don't override the current screen.
  return;
}

      const pending = JSON.parse(raw) as any;

      const intent = pending?.intent === "manual_confirm" ? "manual" : "venuecontract";

      if (intent === "manual") {
        localStorage.removeItem(LS_PENDING_BOOKING);
        setCurrentScreen("rdMedallionCastle");
        return;
      }

      if (pending?.venueSlug) localStorage.setItem("venueSlug", String(pending.venueSlug));
      if (pending?.venueName) localStorage.setItem("venueName", String(pending.venueName));

      if (pending?.weddingDate) {
        localStorage.setItem("venueWeddingDate", String(pending.weddingDate));
        localStorage.setItem("weddingDate", String(pending.weddingDate));
      }

      if (Number.isFinite(pending?.guestCount) && Number(pending.guestCount) > 0) {
        localStorage.setItem("venueGuestCount", String(pending.guestCount));
        localStorage.setItem("guestCount", String(pending.guestCount));
        window.dispatchEvent(new Event("guestCountUpdated"));
      }

      if (Number.isFinite(pending?.price) && Number(pending.price) > 0) {
        localStorage.setItem("venueTotal", String(pending.price));
        localStorage.setItem("venuePrice", String(pending.price));
      }

      localStorage.removeItem(LS_PENDING_BOOKING);
      setCurrentScreen("venuecontract");
    } catch (e) {
      console.warn("⚠️ Could not resume pending booking after auth:", e);
      setShowAccountModal(false);
      setCurrentScreen("rdMedallionCastle");
    }
  };

  const goToScreen = (step: Screen) => {
    if (step === "thankyou") {
      setThankYouVariant("postPurchase");
    }
    setCurrentScreen(step);
  };

  // --------------------
// Render
// --------------------

// ✅ Only these screens should show the Medallion Castle background behind them
const isCastleFlowModal =
currentScreen === "venuecontract" || currentScreen === "checkout";

// ✅ Thank you is its own top overlay (no castle background)
const isThankYouModal = currentScreen === "thankyou";

return (
<div className="pixie-overlay" style={{ overflow: "hidden" }}>
  {(() => {
    const isCastleStage = currentScreen === "rdMedallionCastle";
    const shouldShowCastleStage = isCastleStage || isCastleFlowModal;

    return (
      <>
        {/* ✅ Castle stage (background) */}
        {shouldShowCastleStage && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 18,
              boxSizing: "border-box",
              overflow: "hidden",
              pointerEvents: isCastleFlowModal ? "none" : "auto",
            }}
          >
            <RD_MedallionCastle
              interview={interview}
              disabledVenues={DISABLED_VENUES}
              invitedVenueSlug={invitedVenueSlug}
              onOpenVenue={handleOpenVenue}
              onPreviewVenue={handlePreviewVenue}
              onRequestSwap={handleRequestSwap}
              onBack={() => setCurrentScreen("rdQ4Vibe")}
              onClose={onClose}
              onStartOver={handleStartOver}
              requireAuthForBooking={(intent) => {
                if (auth.currentUser) return true;

                // CastleModal should have already saved LS_PENDING_BOOKING
                // when it hit the auth gate.
                setShowAccountModal(true);
                return false;
              }}
            />
          </div>
        )}

        {/* ✅ Normal flow — unchanged for every other screen */}
        {!shouldShowCastleStage && (
          <div ref={cardRef} style={{ width: "100%" }}>
            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <div style={{ position: "relative", width: "100%", maxWidth: 680 }}>
                {/* Invite envelope pinned to card */}
                {shouldShowInviteBanner && (
                  <div
                    style={{
                      position: "absolute",
                      zIndex: 999,
                      left: 10,
                      top: 10,
                      ...(isMobile ? { top: -70, left: -6 } : {}),
                    }}
                  >
                    <VenueInviteBanner
                      invitedVenueSlug={invitedVenueSlug || undefined}
                      onClick={() => setCurrentScreen("inviteIntro")}
                    />
                  </div>
                )}

                {currentScreen === "inviteIntro" && (
                  <VenueInviteIntro
                    invitedVenueSlug={invitedVenueSlug || undefined}
                    invitedVenueName={
                      invitedVenueSlug
                        ? venueDetails?.[invitedVenueSlug]?.title || undefined
                        : undefined
                    }
                    discountLabel={
                      inviteCode
                        ? `Pixie Booking Bonus ($500 off — ${inviteCode})`
                        : "Pixie Booking Bonus ($500 off)"
                    }
                    onExplore={() => {
                      try {
                        localStorage.setItem(LS_INVITE_EXPLORE_KEY, "true");
                        localStorage.removeItem(LS_LOCKED_VENUE_KEY);
                      } catch {}
                      setCurrentScreen("intro");
                    }}
                    onDirectBook={(slug) => {
                      console.log("Direct book invited venue:", slug);
                    }}
                    venueOptions={[]}
                    onClose={onClose}
                  />
                )}

                {currentScreen === "intro" && (
                  <VenueRankerIntro
                    onExplore={() => setCurrentScreen("rdQ1Budget")}
                    onDirectBook={(slug) => console.log("Direct book:", slug)}
                    venueOptions={[]}
                    onClose={onClose}
                  />
                )}

                {currentScreen === "rdQ1Budget" && (
                  <RD_MadgeInterviewQ1_Budget
                    onBack={() => setCurrentScreen("intro")}
                    onNext={(data: Partial<RDInterviewState>) => {
                      setInterview((prev) => ({ ...prev, ...data }));
                      setCurrentScreen("rdQ2Flex");
                    }}
                    onClose={onClose}
                  />
                )}

                {currentScreen === "rdQ2Flex" && (
                  <RD_MadgeInterviewQ2_Flex
                    onBack={() => setCurrentScreen("rdQ1Budget")}
                    onNext={(data: Partial<RDInterviewState>) => {
                      setInterview((prev) => ({ ...prev, ...data }));
                      setCurrentScreen("rdQ3Guest");
                    }}
                    onClose={onClose}
                  />
                )}

                {currentScreen === "rdQ3Guest" && (
                  <RD_MadgeInterviewQ3_Guest
                    onBack={() => setCurrentScreen("rdQ2Flex")}
                    onNext={(data: Partial<RDInterviewState>) => {
                      setInterview((prev) => ({ ...prev, ...data }));
                      setCurrentScreen("rdQ4Vibe");
                    }}
                    onClose={onClose}
                  />
                )}

                {currentScreen === "rdQ4Vibe" && (
                  <RD_MadgeInterviewQ4_Vibe
                    onBack={() => setCurrentScreen("rdQ3Guest")}
                    onNext={(data: Partial<RDInterviewState>) => {
                      setInterview((prev) => ({ ...prev, ...data }));
                      setCurrentScreen("rdMedallionCastle");
                      try {
                        localStorage.setItem("venueRankerCheckpoint", "medallion");
                      } catch {}
                    }}
                    onClose={onClose}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ✅ Foreground modal layer (contract/checkout ONLY) */}
        {isCastleFlowModal && (
          <div
            className="pixie-overlay"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 5000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem",
              boxSizing: "border-box",
              overflowY: "auto",
            }}
          >
            <div style={{ width: "min(980px, 94vw)", pointerEvents: "auto" }}>
              {currentScreen === "venuecontract" && (
                <VenueRankerContract
                  venueSlug={localStorage.getItem("venueSlug") ?? ""}
                  venueName={localStorage.getItem("venueName") ?? ""}
                  venueWeddingDate={
                    localStorage.getItem("venueWeddingDate") ??
                    localStorage.getItem("weddingDate") ??
                    ""
                  }
                  venuePrice={safeNumber(localStorage.getItem("venueTotal") ?? 0)}
                  guestCount={safeNumber(
                    localStorage.getItem("venueGuestCount") ??
                      localStorage.getItem("guestCount") ??
                      0
                  )}
                  payFull={payFull}
                  setPayFull={setPayFull}
                  signatureImage={signatureImage}
                  setSignatureImage={setSignatureImage}
                  signatureSubmitted={signatureSubmitted}
                  setSignatureSubmitted={setSignatureSubmitted}
                  onBack={() => setCurrentScreen("rdMedallionCastle")}
                  onContinue={() => goToScreen("checkout")}
                  setCurrentScreen={(step: string) => goToScreen(step as Screen)}
                  setLineItems={() => {}}
                  setPaymentSummary={() => {}}
                  setFinalVenuePrice={setFinalVenuePrice}
                  setFinalDeposit={setFinalDeposit}
                  setFinalMonthlyPayment={setFinalMonthlyPayment}
                  setFinalPaymentCount={setFinalPaymentCount}
                />
              )}

              {currentScreen === "checkout" && (
                <VenueCheckOut
                  setCurrentScreen={(step: string) => goToScreen(step as Screen)}
                  onClose={() => setCurrentScreen("rdMedallionCastle")}
                />
              )}
            </div>
          </div>
        )}

        {/* ✅ Thank you modal layer (NO castle background) */}
        {isThankYouModal && (
          <div
            className="pixie-overlay"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 6000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem",
              boxSizing: "border-box",
              overflowY: "auto",
            }}
          >
            <div style={{ width: "min(980px, 94vw)", pointerEvents: "auto" }}>
              <VenueThankYou
                variant={thankYouVariant}
                ctaLabel={
                  thankYouVariant === "alreadyBooked" ? "Back to Dashboard" : "Close"
                }
                onClose={onClose}
              />
            </div>
          </div>
        )}
      </>
    );
  })()}

  {/* ✅ Account modal sits above everything */}
  {showAccountModal && (
    <VenueAccountModal
      onSuccess={handleAccountSuccess}
      onClose={() => setShowAccountModal(false)}
    />
  )}
</div>
);
};

export default RD_VenueRankerOverlay;