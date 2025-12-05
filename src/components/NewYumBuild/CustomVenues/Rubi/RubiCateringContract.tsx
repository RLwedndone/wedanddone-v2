// src/components/NewYumBuild/CustomVenues/Rubi/RubiCateringContract.tsx
import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth } from "firebase/auth";
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import { notifyBooking } from "../../../../utils/email/email";

import type { RubiBBQSelections } from "./RubiBBQMenuBuilder";
import type { RubiMexSelections } from "./RubiMexMenuBuilder";

/* -------------------- helpers -------------------- */
const parseLocalYMD = (ymd?: string | null): Date | null =>
  !ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? null : new Date(`${ymd}T12:00:00`);

const formatPretty = (d: Date) =>
  d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

/* -------------------- types -------------------- */
export type RubiMenuChoice = "bbq" | "mexican";

type Props = {
  menuChoice: RubiMenuChoice;
  selections: RubiBBQSelections | RubiMexSelections;

  total: number; // will be 0 (included)
  guestCount: number;
  weddingDate: string | null;
  dayOfWeek: string | null;
  lineItems: string[];
  cateringSummary?: any;

  signatureImage: string | null;
  setSignatureImage: (v: string) => void;
  signatureSubmitted: boolean;
  setSignatureSubmitted: (v: boolean) => void;

  onBack: () => void; // back to cart
  onContinueToCheckout: () => void; // in this flow, goes straight to TY
  onClose: () => void;
  onComplete?: () => void;
};

const RubiCateringContract: React.FC<Props> = ({
  menuChoice,
  selections,
  total,
  guestCount,
  weddingDate,
  dayOfWeek,
  lineItems,
  signatureImage,
  setSignatureImage,
  signatureSubmitted,
  setSignatureSubmitted,
  onBack,
  onContinueToCheckout,
  onClose,
}) => {
  const auth = getAuth();

  // ui
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const [isGenerating] = useState(false); // kept for button disable pattern
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  // locked guest count (fallback to LS)
  const [lockedGuestCount, setLockedGuestCount] = useState<number>(
    guestCount || 0
  );
  useEffect(() => {
    if (guestCount > 0) {
      setLockedGuestCount(guestCount);
      return;
    }
    const v =
      Number(localStorage.getItem("rubiLockedGuestCount") || 0) ||
      Number(localStorage.getItem("magicGuestCount") || 0) ||
      0;
    setLockedGuestCount(v);
  }, [guestCount]);

  // date pretty-print
  const wedding = parseLocalYMD(weddingDate || "");
  const prettyWedding = wedding ? formatPretty(wedding) : "your wedding date";

  // Short explainer text for this included menu
  const paymentSummaryText =
    "Your Rubi House catering menu is fully included in your venue package. No payment is due through Wed&Done for this booking — you’re just confirming your menu selections.";

  // boot/persist progress (save menu choice + selections)
  useEffect(() => {
    try {
      localStorage.setItem("yumStep", "rubiContract");
      localStorage.setItem("rubiMenuChoice", menuChoice);
    } catch {}
    const u = auth.currentUser;
    if (!u) return;

    (async () => {
      try {
        await updateDoc(doc(db, "users", u.uid), {
          "progress.yumYum.step": "rubiContract",
        });
        await setDoc(
          doc(db, "users", u.uid, "yumYumData", "rubiSelections"),
          { menuChoice, selections },
          { merge: true }
        );
        await setDoc(
          doc(db, "users", u.uid, "yumYumData", "lineItems"),
          { lineItems },
          { merge: true }
        );
      } catch (e) {
        console.error("🔥 Error initializing Rubi contract state:", e);
      }
    })();
  }, [auth, lineItems, menuChoice, selections]);

  /* -------------------- signature helpers -------------------- */
  const drawToDataUrl = () => {
    try {
      const c =
        sigCanvasRef.current?.getCanvas?.() ||
        (sigCanvasRef.current as unknown as { _canvas?: HTMLCanvasElement })
          ?._canvas;
      // @ts-ignore
      return c?.toDataURL("image/png") || "";
    } catch {
      return "";
    }
  };

  const generateImageFromText = (text: string): string => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 600;
    canvas.height = 150;
    if (!ctx) return "";
    ctx.fillStyle = "#000";
    ctx.font = "48px 'Jenna Sue', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL("image/png");
  };

  const handleSignatureSubmit = async () => {
    const finalSignature = useTextSignature
      ? generateImageFromText(typedSignature.trim())
      : drawToDataUrl();

    if (!finalSignature) {
      alert("Please enter or draw a signature.");
      return;
    }
    setSignatureImage(finalSignature);
    setSignatureSubmitted(true);
    setShowSignatureModal(false);

    const u = auth.currentUser;
    if (u) {
      try {
        await setDoc(
          doc(db, "users", u.uid),
          { yumSignatureImageUrl: finalSignature, yumSigned: true },
          { merge: true }
        );
      } catch (e) {
        console.error("❌ Failed to save signature:", e);
      }
    }
  };

  const handleFinish = async () => {
    if (!signatureSubmitted) return;
  
    const u = auth.currentUser;
    if (!u) {
      // No logged-in user – just advance like before
      try {
        localStorage.setItem("yumStep", "rubiCateringThankYou");
        localStorage.setItem("rubiMenuChoice", menuChoice);
      } catch {}
      onContinueToCheckout();
      return;
    }
  
    try {
      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef);
      const userDoc = snap.exists() ? (snap.data() as any) : {};
  
      const safeFirst = userDoc?.firstName || "Magic";
      const safeLast = userDoc?.lastName || "User";
      const fullName = `${safeFirst} ${safeLast}`;
      const email =
        userDoc?.email || u.email || "unknown@wedndone.com";
  
      // Wedding date for email – prefer prop, fall back to user doc
      const weddingYMD: string | null =
        weddingDate || userDoc?.weddingDate || null;
  
      // Mark in Firestore that Rubi catering is booked/included
      await updateDoc(userRef, {
        bookings: {
          ...(userDoc?.bookings || {}),
          catering: true,
        },
        rubiCateringIncluded: true,
        "progress.yumYum.step": "rubiCateringThankYou",
        lastPurchaseAt: serverTimestamp(),
      });
  
      // Build line items for the email – we already have them
      const lineItemsForEmail = (lineItems && lineItems.length
        ? lineItems
        : []
      ).join(", ");
  
      // Send centralized booking email (user + admin)
      try {
        await notifyBooking("yum_catering", {
          // who + basics
          user_email: email,
          user_full_name: fullName,
          firstName: safeFirst,
  
          // details
          wedding_date: weddingYMD || "TBD",
          total: total.toFixed(2), // will be 0.00, but keeps schema happy
          line_items: lineItemsForEmail,
  
          // pdf info – none yet for Rubi included menus
          pdf_url: "",
          pdf_title: "",
  
          // payment breakdown – fully included
          payment_now: "0.00",
          remaining_balance: "0.00",
          final_due: "Included in your Rubi House venue package",
  
          // UX link + label
          dashboardUrl: `${window.location.origin}${import.meta.env.BASE_URL}dashboard`,
          product_name:
            menuChoice === "bbq"
              ? "Rubi House Catering – Brother John’s BBQ (Included)"
              : "Rubi House Catering – Brother John’s Mexican (Included)",
        });
      } catch (mailErr) {
        console.error("❌ notifyBooking(yum_catering) failed for Rubi:", mailErr);
      }
  
      // Local progress flags like before
      try {
        localStorage.setItem("yumStep", "rubiCateringThankYou");
        localStorage.setItem("rubiMenuChoice", menuChoice);
      } catch {}
  
      // Advance overlay to RubiCateringThankYou
      onContinueToCheckout();
    } catch (err) {
      console.error("❌ Rubi catering finish failed:", err);
      // If something goes wrong, still let them through so they’re not stuck
      try {
        localStorage.setItem("yumStep", "rubiCateringThankYou");
        localStorage.setItem("rubiMenuChoice", menuChoice);
      } catch {}
      onContinueToCheckout();
    }
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 720 }}>
      {/* 🩷 Pink X Close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/yum_yum_button.png`}
          alt="Catering Seal"
          className="px-media"
          style={{ width: 110, margin: "0 auto 12px" }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Rubi House Catering Agreement — Brother John’s{" "}
          {menuChoice === "bbq" ? "BBQ" : "Mexican"} (Included Menu)
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 6 }}>
          You’re booking catering for <strong>{prettyWedding}</strong>{" "}
          ({dayOfWeek || "TBD"}).
        </p>

        <p className="px-prose-narrow" style={{ marginBottom: 6 }}>
          Total catering cost today:{" "}
          <strong>${Number(total).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong> for {lockedGuestCount} guest
          {lockedGuestCount === 1 ? "" : "s"}.
        </p>

        <p className="px-prose-narrow" style={{ marginBottom: 12 }}>
          {paymentSummaryText}
        </p>

        {/* Booking Terms */}
        <div
          className="px-section"
          style={{ maxWidth: 640, margin: "0 auto 12px", textAlign: "left" }}
        >
          <h3
            className="px-title"
            style={{ textAlign: "center", marginBottom: 6 }}
          >
            Booking Terms
          </h3>
          <ul
            className="px-prose-narrow"
            style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.6 }}
          >
            <li>
              Your selected menu is{" "}
              <strong>included with your Rubi House venue package</strong>.
              Any additional food &amp; beverage minimums, bar packages, or
              upgrades are handled directly with The Rubi House.
            </li>
            <li>
              Final guest count is due <strong>30 days</strong> before your
              wedding. You may increase your count starting 45 days out, but it
              cannot be lowered after booking.
            </li>
            <li>
              <strong>Bar Packages:</strong> Alcohol is booked directly with the
              venue in accordance with Arizona liquor laws. Wed&amp;Done does
              not provide bar service or alcohol.
            </li>
            <li>
              <strong>Cancellation &amp; Refunds:</strong> Any changes to your
              catering package or minimums are governed by The Rubi House’s
              policies. Wed&amp;Done will assist with documentation but does not
              control venue refunds.
            </li>
          </ul>
        </div>

        {/* Agree */}
<div
  style={{
    margin: "6px 0 8px",
    width: "100%",
    display: "flex",
    justifyContent: "center",
  }}
>
  <label
    className="px-prose-narrow"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      whiteSpace: "nowrap",
    }}
  >
    <input
      type="checkbox"
      checked={agreeChecked}
      onChange={(e) => setAgreeChecked(e.target.checked)}
    />
    I have reviewed my menu selections and agree to the terms above.
  </label>
</div>
        {/* Sign / Signed state */}
        {!signatureSubmitted ? (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
            <button
              className="boutique-primary-btn"
              onClick={
                agreeChecked ? () => setShowSignatureModal(true) : undefined
              }
              disabled={!agreeChecked}
              style={{
                width: 260,
                opacity: agreeChecked ? 1 : 0.5,
                cursor: agreeChecked ? "pointer" : "not-allowed",
              }}
            >
              Sign Agreement
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: 8,
            }}
          >
           <img
  src={`${import.meta.env.BASE_URL}assets/images/agreement_signed.png`}
  alt="Agreement Signed"
  className="px-media"
  style={{ maxWidth: 140, marginBottom: 10 }}
/>
            
          </div>
        )}

        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 10 }}>
        <button
  className="boutique-primary-btn"
  onClick={handleFinish}
  disabled={!signatureSubmitted || isGenerating}
  style={{ width: 260, opacity: signatureSubmitted ? 1 : 0.5 }}
>
  Finish
</button>
          <button
            className="boutique-back-btn"
            onClick={onBack}
            style={{ width: 260 }}
          >
            ⬅ Back to Cart
          </button>
        </div>
      </div>

      {/* Signature modal */}
      {showSignatureModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 16,
          }}
        >
          <div
            className="pixie-card pixie-card--modal"
            style={{ maxWidth: 520, position: "relative", overflow: "hidden" }}
          >
            <button
              className="pixie-card__close"
              onClick={() => setShowSignatureModal(false)}
              aria-label="Close"
            >
              <img
                src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`}
                alt="Close"
              />
            </button>

            <div className="pixie-card__body" style={{ textAlign: "center" }}>
              <h3
                className="px-title-lg"
                style={{ fontSize: "1.7rem", marginBottom: 10 }}
              >
                Sign below or enter a text signature
              </h3>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <button
                  type="button"
                  className={`px-toggle__btn ${
                    !useTextSignature
                      ? "px-toggle__btn--blue px-toggle__btn--active"
                      : ""
                  }`}
                  onClick={() => setUseTextSignature(false)}
                  aria-pressed={!useTextSignature}
                >
                  Draw
                </button>
                <button
                  type="button"
                  className={`px-toggle__btn ${
                    useTextSignature
                      ? "px-toggle__btn--pink px-toggle__btn--active"
                      : ""
                  }`}
                  onClick={() => setUseTextSignature(true)}
                  aria-pressed={useTextSignature}
                >
                  Type
                </button>
              </div>

              {useTextSignature ? (
                <input
                  type="text"
                  placeholder="Type your name"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  className="px-input"
                  style={{ maxWidth: 420, margin: "0 auto 12px" }}
                />
              ) : (
                <SignatureCanvas
                  penColor="#2c62ba"
                  ref={sigCanvasRef}
                  backgroundColor="#ffffff"
                  canvasProps={{
                    width: 420,
                    height: 160,
                    style: {
                      border: "1px solid #e5e7f0",
                      borderRadius: 10,
                      width: "100%",
                      maxWidth: 420,
                      margin: "0 auto 12px",
                      display: "block",
                    },
                  }}
                />
              )}

              <button
                className="boutique-primary-btn"
                onClick={handleSignatureSubmit}
                style={{ width: 260, margin: "0 auto" }}
              >
                Save Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RubiCateringContract;