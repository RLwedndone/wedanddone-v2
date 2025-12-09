// src/components/NewYumBuild/CustomVenues/Bates/BatesContractCatering.tsx
import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

import { db } from "../../../../firebase/firebaseConfig";

type BatesMenuSelections = {
  hors: string[];
  salads: string[];
  entrees: string[];
  isPairedEntree?: boolean;
};

interface BatesContractCateringProps {
  total: number; // add-ons grand total (taxes + fees included)
  addonsTotal: number; // raw add-ons subtotal (pre tax+fees)
  guestCount: number; // locked guest count
  weddingDate: string | null;
  dayOfWeek: string | null;
  lineItems: string[]; // cart line items (includes “Bates included” line)
  menuSelections: BatesMenuSelections;

  signatureImage: string | null;
  setSignatureImage: (dataUrl: string) => void;
  signatureSubmitted: boolean;
  setSignatureSubmitted: (v: boolean) => void;

  onBack: () => void; // back to cart
  onComplete: () => void; // parent decides checkout vs thank-you
  onClose: () => void;

  // 🔹 Payment mode is owned by the overlay
  payFull: boolean;
  setPayFull: (value: boolean) => void;
}

const DEPOSIT_PCT = 0.25;
/** 👉 final due date for monthly plan (payments) **/
const FINAL_DUE_DAYS = 35; // days before wedding for last auto-bill

const BatesContractCatering: React.FC<BatesContractCateringProps> = ({
  total,
  addonsTotal,
  guestCount,
  weddingDate,
  dayOfWeek,
  lineItems,
  menuSelections,
  signatureImage,
  setSignatureImage,
  signatureSubmitted,
  setSignatureSubmitted,
  onBack,
  onClose,
  onComplete,
  payFull,
  setPayFull,
}) => {
  const auth = getAuth();

  // Basic user data for the PDF/email
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // UI state
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  const [weddingYMD, setWeddingYMD] = useState<string | null>(
    weddingDate || null
  );
  const [weekdayPretty, setWeekdayPretty] = useState<string | null>(
    dayOfWeek || null
  );

  // Save step + light data on mount (local + Firestore)
  useEffect(() => {
    try {
      localStorage.setItem("yumStep", "cateringContract");
      localStorage.setItem("batesLineItems", JSON.stringify(lineItems || []));
      localStorage.setItem(
        "batesMenuSelections",
        JSON.stringify(menuSelections || {})
      );
    } catch {
      /* ignore */
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setUserId(user.uid);
      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        const data = snap.data() || {};

        setFirstName((data as any).firstName || "");
        setLastName((data as any).lastName || "");

        // Hydrate date from Firestore (and LS fallback), then weekday
        const ymdFromFS =
          (data as any)?.weddingDate ||
          (data as any)?.wedding?.date ||
          localStorage.getItem("yumWeddingDate") ||
          localStorage.getItem("weddingDate") ||
          null;

        if (ymdFromFS && /^\d{4}-\d{2}-\d{2}$/.test(ymdFromFS)) {
          setWeddingYMD(ymdFromFS);
          try {
            localStorage.setItem("yumWeddingDate", ymdFromFS);
          } catch {
            /* ignore */
          }
          const d = new Date(`${ymdFromFS}T12:00:00`);
          setWeekdayPretty(
            d.toLocaleDateString("en-US", { weekday: "long" })
          );
        }

        await updateDoc(userRef, {
          "progress.yumYum.step": "cateringContract",
        });
        await setDoc(
          doc(userRef, "yumYumData", "batesMenuSelections"),
          menuSelections,
          { merge: true }
        );
        await setDoc(
          doc(userRef, "yumYumData", "batesLineItems"),
          { lineItems },
          { merge: true }
        );
      } catch (e) {
        console.error("🔥 Error prepping Bates contract:", e);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formattedDate = weddingYMD
    ? new Date(`${weddingYMD}T12:00:00`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "your wedding date";

  const depositAmount = Math.round(total * DEPOSIT_PCT * 100) / 100;
  const remainingBalance = Math.max(
    0,
    Math.round((total - depositAmount) * 100) / 100
  );

  const paymentSummaryText =
    total <= 0
      ? "No add-ons selected. Your Bates catering is included."
      : payFull
      ? `You’re paying $${Number(total).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} today for Bates add-ons.`
      : `You’re paying a ${Math.round(
          DEPOSIT_PCT * 100
        )}% deposit of $${depositAmount.toFixed(
          2
        )} today. The remaining balance will be auto-billed monthly with the final payment due ${FINAL_DUE_DAYS} days before your wedding date.`;

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

  const handleSignClick = () => {
    if (agreeChecked) setShowSignatureModal(true);
  };

  const handleSignatureSubmit = async () => {
    let finalSignature = "";

    if (useTextSignature && typedSignature.trim()) {
      finalSignature = generateImageFromText(typedSignature.trim());
    } else if (!useTextSignature && sigCanvasRef.current) {
      try {
        finalSignature =
          sigCanvasRef.current.getCanvas().toDataURL("image/png");
      } catch (e) {
        console.error("❌ Error capturing signature:", e);
        alert(
          "Something went wrong when capturing your signature. Please try again."
        );
        return;
      }
    } else {
      alert("⚠️ Please enter or draw a signature before saving.");
      return;
    }

    setSignatureImage(finalSignature);
    setSignatureSubmitted(true);
    setShowSignatureModal(false);

    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            batesSignatureImageUrl: finalSignature,
            batesContractSigned: true,
          },
          { merge: true }
        );
      } catch (e) {
        console.error("❌ Failed to save signature meta:", e);
      }
    }
  };

  const handleFinalize = async () => {
    if (!userId) return;
    if (!signatureSubmitted || !signatureImage) return;

    try {
      setIsGenerating(true);

      // --- Stripe Billing Robot hints (no PDF here) ---
      const billingMode = payFull ? "full" : "monthly";
      const billingRobot = {
        provider: "stripe",
        mode: billingMode, // 'full' | 'monthly'
        total, // add-ons total (taxes & fees included)
        depositPct: DEPOSIT_PCT,
        depositAmount: payFull ? total : depositAmount,
        remainingBalance: payFull ? 0 : remainingBalance,
        finalDueDays: FINAL_DUE_DAYS, // 35 days before wedding
        weddingDateISO: weddingYMD || null,
        createdAt: new Date().toISOString(),
        source: "BatesContractCatering",
        category: "catering:addon",
      };

      // Firestore: only plan hints + progress to checkout
      await setDoc(
        doc(db, "users", userId),
        {
          progress: { yumYum: { step: "cateringCheckout" } },
          yumYumBillingPlan: billingRobot,
        },
        { merge: true }
      );

      // Also stash to localStorage for the checkout screen to read instantly
      try {
        localStorage.setItem("yumPaymentPlan", billingMode);
        localStorage.setItem(
          "yumFinalDueDays",
          String(FINAL_DUE_DAYS)
        );
        localStorage.setItem(
          "yumDepositAmount",
          String(payFull ? total : depositAmount)
        );
        localStorage.setItem("yumTotalDue", String(total));
        localStorage.setItem(
          "yumRemainingBalance",
          String(remainingBalance)
        );
        localStorage.setItem(
          "yumBillingRobot",
          JSON.stringify(billingRobot)
        );
        window.dispatchEvent(
          new CustomEvent("billingPlanSelected", {
            detail: billingRobot,
          })
        );
      } catch {
        /* ignore */
      }

      onComplete();
    } catch (e) {
      console.error("❌ Bates contract finalize error:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        boxSizing: "border-box",
      }}
    >
      <div
        className="pixie-card pixie-card--modal"
        style={{ maxWidth: 720, position: "relative" }}
      >
        {/* 🩷 Pink X Close */}
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

        {/* Body */}
        <div
          className="pixie-card__body"
          style={{
            textAlign: "center",
            padding: "2rem 2.5rem",
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/images/yum_yum_button.png`}
            alt="Catering Seal"
            className="px-media"
            style={{
              width: 110,
              margin: "0 auto 12px",
              display: "block",
            }}
          />

          <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
            Bates Catering Agreement
          </h2>

          <p
            className="px-prose-narrow"
            style={{ marginBottom: 6 }}
          >
            You’re confirming catering details for{" "}
            <strong>{formattedDate}</strong> (
            {weekdayPretty || "TBD"}).
          </p>

          <div
            className="px-prose-narrow"
            style={{
              margin: "8px auto 12px",
              maxWidth: 620,
            }}
          >
            <p>
              <strong>Good news!</strong> Your Bates venue booking
              already includes your catering.
            </p>
            <p style={{ marginTop: 6 }}>
              This agreement confirms your menu selections and any{" "}
              <em>optional add-ons</em> you chose below. Final guest
              counts are due <strong>30 days</strong> prior to the
              wedding.
            </p>
            <p style={{ marginTop: 6 }}>
              Guest count increases are handled via the{" "}
              <strong>Guest Count Scroll</strong> between{" "}
              <strong>45–30 days</strong> pre-wedding.
            </p>
          </div>

          <div
            className="px-prose-narrow"
            style={{ marginBottom: 8, fontWeight: 700 }}
          >
            Total due for add-ons:{" "}
            <span style={{ color: "#2c62ba" }}>
              $
              {Number(total).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          {/* Booking Terms */}
          <div
            className="px-section"
            style={{
              textAlign: "left",
              margin: "0 auto 14px",
              maxWidth: 640,
            }}
          >
            <h3
              className="px-title"
              style={{ textAlign: "center", marginBottom: 6 }}
            >
              Booking Terms
            </h3>
            <ol
              className="px-prose-narrow"
              style={{
                margin: 0,
                paddingLeft: "1.25rem",
                lineHeight: 1.6,
                textAlign: "left",
              }}
            >
              <li>
                <strong>Included Services.</strong> Catering included
                in your Bates venue package is covered by your venue
                booking. Only selected <em>add-ons</em> are billed
                through this agreement.
              </li>
              <li>
                <strong>Payment.</strong>{" "}
                {total > 0
                  ? "You agree to pay for the selected add-ons."
                  : "No add-ons selected; no payment is due."}{" "}
                If you choose <em>Deposit + Monthly</em>, you
                authorize Wed&Done to charge monthly; the final
                payment is due{" "}
                <strong>{FINAL_DUE_DAYS} days</strong> before your
                wedding.
              </li>
              <li>
                <strong>Non-Refundable Add-Ons.</strong> Add-on
                purchases are non-refundable once confirmed.
              </li>
              <li>
                <strong>Guest Count Policy.</strong> Final guest
                counts are due <strong>30 days</strong> prior. Guest
                count changes are only accepted via the Guest Count
                Scroll between 45–30 days before your wedding.
              </li>
              <li>
                <strong>Substitutions & Availability.</strong> Items
                may be substituted with comparable alternatives due
                to seasonality or supply.
              </li>
              <li>
                <strong>Allergies & Dietary Needs.</strong> Please
                communicate restrictions at least 30 days prior.
                Allergen-free outcomes aren’t guaranteed.
              </li>
              <li>
                <strong>Force Majeure.</strong> Neither party is
                liable for events beyond reasonable control; services
                may be rescheduled or modified in good faith.
              </li>
            </ol>
          </div>

          {/* Plan toggle */}
          {total > 0 && (
            <>
              <h4
                className="px-title"
                style={{ marginTop: 6, marginBottom: 6 }}
              >
                Choose how you’d like to pay:
              </h4>
              <div
                className="px-toggle"
                style={{ marginBottom: 8 }}
              >
                <button
                  type="button"
                  className={`px-toggle__btn ${
                    payFull
                      ? "px-toggle__btn--blue px-toggle__btn--active"
                      : ""
                  }`}
                  onClick={() => {
                    setPayFull(true);
                    setSignatureSubmitted(false);
                  }}
                  aria-pressed={payFull}
                >
                  Pay in Full
                </button>
                <button
                  type="button"
                  className={`px-toggle__btn ${
                    !payFull
                      ? "px-toggle__btn--pink px-toggle__btn--active"
                      : ""
                  }`}
                  onClick={() => {
                    setPayFull(false);
                    setSignatureSubmitted(false);
                  }}
                  aria-pressed={!payFull}
                >
                  Deposit + Monthly
                </button>
              </div>

              <p
                className="px-prose-narrow"
                style={{ marginBottom: 10 }}
              >
                {paymentSummaryText}
              </p>
            </>
          )}

          {/* Agree */}
          <div style={{ margin: "6px 0 8px" }}>
            <label
              className="px-prose-narrow"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input
                type="checkbox"
                checked={agreeChecked}
                onChange={(e) =>
                  setAgreeChecked(e.target.checked)
                }
              />
              I have read and agree to the terms above.
            </label>
          </div>

          {/* Sign / Continue */}
          {!signatureSubmitted ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 8,
              }}
            >
              <button
                className="boutique-primary-btn"
                onClick={handleSignClick}
                disabled={!agreeChecked}
                style={{
                  width: 260,
                  opacity: agreeChecked ? 1 : 0.5,
                  cursor: agreeChecked
                    ? "pointer"
                    : "not-allowed",
                }}
              >
                Sign Agreement
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 8,
              }}
            >
              <img
                src={`${import.meta.env.BASE_URL}assets/images/contract_signed.png`}
                alt="Agreement Signed"
                className="px-media"
                style={{ maxWidth: 140 }}
              />
            </div>
          )}

          <div className="px-cta-col" style={{ marginTop: 10 }}>
            <button
              className="boutique-primary-btn"
              onClick={handleFinalize}
              disabled={!signatureSubmitted || isGenerating}
              style={{
                width: 260,
                opacity: signatureSubmitted ? 1 : 0.5,
              }}
            >
              Continue
            </button>
            <button
              className="boutique-back-btn"
              onClick={onBack}
              style={{ width: 260 }}
              disabled={isGenerating}
            >
              ⬅ Back to Cart
            </button>
          </div>
        </div>

        {/* Signature modal — single overlay, blue X */}
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
              style={{
                maxWidth: 520,
                position: "relative",
                overflow: "hidden",
              }}
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

              <div
                className="pixie-card__body"
                style={{ textAlign: "center" }}
              >
                <h3
                  className="px-title-lg"
                  style={{
                    fontSize: "1.7rem",
                    marginBottom: 10,
                  }}
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
                    onChange={(e) =>
                      setTypedSignature(e.target.value)
                    }
                    className="px-input"
                    style={{
                      maxWidth: 420,
                      margin: "0 auto 12px",
                    }}
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
                  style={{
                    width: 260,
                    margin: "0 auto",
                  }}
                >
                  Save Signature
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatesContractCatering;