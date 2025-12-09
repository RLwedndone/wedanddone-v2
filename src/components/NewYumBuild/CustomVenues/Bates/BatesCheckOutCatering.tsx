// src/components/NewYumBuild/CustomVenues/Bates/BatesCheckOutCatering.tsx
import React, { useRef, useState, useEffect } from "react";
import CheckoutForm from "../../../../CheckoutForm";

import generateBatesCateringAgreementPDF from "../../../../utils/generateBatesCateringAgreementPDF";
import { uploadPdfBlob } from "../../../../helpers/firebaseUtils";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  arrayUnion,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import { notifyBooking } from "../../../../utils/email/email";

// 🔗 Same base as Floral & PaymentSettingsOverlay
const API_BASE =
  "https://us-central1-wedndonev2.cloudfunctions.net/stripeapiV2";

// Helpers (parity with Floral)
const asStartOfDayUTC = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 1));

function nextApproxMonthUTC(from: Date): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const target = new Date(Date.UTC(y, m + 1, 1, 0, 0, 1));
  const lastDayNextMonth = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDayNextMonth));
  return target.toISOString();
}

function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const b = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  let months =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (to.getUTCDate() >= from.getUTCDate()) months += 1;
  return Math.max(1, months);
}

interface BatesCheckOutProps {
  // 🔹 Overlay / navigation
  onClose: () => void; // allows user to exit overlay cleanly
  onSuccess: () => void; // advance to thank-you screen
  onBack: () => void;

  // 🔹 Payment + display
  total: number; // GRAND total (incl. taxes + fees)
  payFull: boolean; // Pay in full vs Deposit + Monthly
  depositAmount?: number; // optional override; defaults to 25%
  paymentSummary?: string; // optional summary message
  signatureImage: string; // captured in contract step

  // 🔹 User / booking details for PDF + Stripe metadata
  firstName: string;
  lastName: string;
  weddingDate: string; // YYYY-MM-DD
  dayOfWeek?: string | null;
  lineItems: string[];
  uid: string;

  // 🔹 Agreement + recordkeeping
  guestCount: number; // for "Locked Guest Count" in agreement
}

const BatesCheckOutCatering: React.FC<BatesCheckOutProps> = ({
  onClose,
  total,
  payFull,
  depositAmount,
  paymentSummary,
  signatureImage,
  onSuccess,
  firstName,
  lastName,
  weddingDate,
  dayOfWeek,
  lineItems,
  uid,
  guestCount,
  onBack,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didRunRef = useRef(false);

  const DEPOSIT_PCT = 0.25; // same policy
  const FINAL_DUE_DAYS = 35; // Bates requires 35 days

  const parsedWedding = weddingDate ? new Date(`${weddingDate}T12:00:00`) : null;
  const finalDueDate = parsedWedding
    ? new Date(parsedWedding.getTime() - FINAL_DUE_DAYS * 24 * 60 * 60 * 1000)
    : null;

  const computedDeposit = Math.min(total, Math.round(total * DEPOSIT_PCT * 100) / 100);

  const effectiveDeposit =
    Number.isFinite(depositAmount || NaN) && (depositAmount as number) > 0
      ? (depositAmount as number)
      : computedDeposit;

  const amountDueToday = payFull ? total : effectiveDeposit;
  const remainingBalance = Math.max(0, Math.round((total - amountDueToday) * 100) / 100);

  const finalDueDateStr = finalDueDate
    ? finalDueDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : `${FINAL_DUE_DAYS} days before your wedding date`;

  // 👉 Detect the “no payment” path (included catering, no add-ons)
  const isZeroTotal = amountDueToday <= 0;

  // 🔐 Payment mode + saved card summary (parity with Floral)
  const [mode, setMode] = useState<"saved" | "new">("new");
  const [savedCardSummary, setSavedCardSummary] = useState<{
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null>(null);

  const hasSavedCard = !!savedCardSummary;
  const requiresCardOnFile = !payFull; // if deposit/monthly → card on file required

  // Load saved card summary once auth is ready
  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        const effectiveUid = user?.uid || uid;
        if (!effectiveUid) return;

        const res = await fetch(`${API_BASE}/payments/get-default`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: effectiveUid }),
        });

        if (!res.ok) {
          const t = await res.text();
          console.warn(
            "[BatesCheckOutCatering] get-default failed:",
            res.status,
            t
          );
          return;
        }

        const data = await res.json();
        if (data?.card) {
          setSavedCardSummary(data.card);
          setMode("saved");
        }
      } catch (err) {
        console.warn("[BatesCheckOutCatering] No saved card found:", err);
      }
    });

    return () => unsubscribe();
  }, [uid]);

  // Stripe success → persist billing plan + docs (mirrors Floral)
  const handleSuccess = async ({
    customerId,
  }: {
    customerId?: string;
  } = {}) => {
    if (didRunRef.current) {
      console.warn("[BatesCheckOutCatering] handleSuccess already ran — ignoring re-entry");
      return;
    }
    didRunRef.current = true;
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    // ✅ Keep the "magic clock" up for the whole post-payment pipeline
    setIsGenerating(true);

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const userDoc = userSnap.data() || {};

    const safeFirst = (userDoc as any)?.firstName || firstName || "Magic";
    const safeLast = (userDoc as any)?.lastName || lastName || "User";
    const fullName = `${safeFirst} ${safeLast}`;

    // Save/refresh Stripe customer id (only relevant when customerId exists)
    try {
      const existing = userDoc?.stripeCustomerId as string | undefined;
      if (customerId && customerId !== existing) {
        await updateDoc(userRef, {
          stripeCustomerId: customerId,
          "stripe.updatedAt": serverTimestamp(),
        });
        try {
          localStorage.setItem("stripeCustomerId", customerId);
        } catch {}
      }
    } catch (e) {
      console.warn("⚠️ Could not save stripeCustomerId:", e);
    }

    async function loadBatesSelections(uid: string): Promise<{
      hors: string[];
      salads: string[];
      entrees: string[];
    }> {
      // 1) Try localStorage first
      try {
        const ls = localStorage.getItem("batesMenuSelections");
        if (ls) {
          const parsed = JSON.parse(ls);
          return {
            hors: parsed.hors || [],
            salads: parsed.salads || [],
            entrees: parsed.entrees || [],
          };
        }
      } catch {}

      // 2) Fallback: Firestore subdoc
      try {
        const ref = doc(db, "users", uid, "yumYumData", "batesMenuSelections");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as any;
          return {
            hors: Array.isArray(data.hors) ? data.hors : [],
            salads: Array.isArray(data.salads) ? data.salads : [],
            entrees: Array.isArray(data.entrees) ? data.entrees : [],
          };
        }
      } catch (e) {
        console.warn("⚠️ Could not load Bates selections from Firestore:", e);
      }

      // 3) Nothing found
      return { hors: [], salads: [], entrees: [] };
    }

    // Ensure default PM for off-session charges (only if we actually need a card on file)
    try {
      const shouldStoreCard = requiresCardOnFile;
      if (shouldStoreCard) {
        await fetch(`${API_BASE}/ensure-default-payment-method`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: customerId || localStorage.getItem("stripeCustomerId"),
            firebaseUid: user.uid,
          }),
        });
        console.log("✅ ensure-default-payment-method called for Bates catering");
      } else {
        console.log(
          "ℹ️ Skipping ensure-default-payment-method (pay-in-full, no plan needed)."
        );
      }
    } catch (err) {
      console.error("❌ ensure-default-payment-method failed:", err);
    }

    // --- FIX: Build safe values so PDF is always correct ---

    // wedding date (try props → Firestore → various LS keys)
    const storedWeddingDate =
      weddingDate ||
      (userDoc as any)?.weddingDate ||
      (userDoc as any)?.wedding?.date ||
      (userDoc as any)?.profileData?.weddingDate ||
      localStorage.getItem("batesWeddingDate") ||
      localStorage.getItem("yumWeddingDate") ||
      localStorage.getItem("magicWeddingDate") ||
      localStorage.getItem("weddingDate") ||
      "";

    // guest count (props → Firestore → LS)
    const storedGuestCount =
      (guestCount && guestCount > 0
        ? guestCount
        : Number(
            (userDoc as any)?.guestCount ||
              (userDoc as any)?.profileData?.guestCount ||
              (userDoc as any)?.venueRankerData?.booking?.guestCount ||
              localStorage.getItem("batesLockedGuestCount") ||
              localStorage.getItem("magicGuestCount") ||
              localStorage.getItem("yumGuestCount") ||
              localStorage.getItem("guestCount") ||
              "0"
          )) || 0;

    // signature (contract prop → Firestore → LS)
    const storedSignature =
      signatureImage ||
      (userDoc as any)?.yumSignature ||
      localStorage.getItem("batesCateringSignature") ||
      localStorage.getItem("yumSignature") ||
      "";

    console.log("[Bates][CateringCheckout] PDF fields", {
      weddingDateProp: weddingDate,
      storedWeddingDate,
      guestCountProp: guestCount,
      storedGuestCount,
      hasSignatureProp: !!signatureImage,
      hasStoredSignature: !!storedSignature,
    });

    // ── Generate + upload Bates Agreement PDF ────────────────────────────────
    let agreementUrl: string | null = null;
    try {
      // Load the user’s selections so they appear on the agreement
      const sel = await loadBatesSelections(user.uid);

      const pdfBlob = await generateBatesCateringAgreementPDF({
        fullName: fullName,
        total,
        deposit: payFull ? 0 : amountDueToday,
        guestCount: storedGuestCount,
        weddingDate: storedWeddingDate,
        signatureImageUrl: storedSignature,
        paymentSummary:
          paymentSummary ||
          (payFull
            ? `You’re paying $${Number(total).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} today for Bates catering.`
            : `You’re paying a 25% deposit of $${amountDueToday.toFixed(
                2
              )}. Remaining balance auto-billed monthly; final payment due ${finalDueDateStr}.`),
        lineItems: lineItems || [],
        menuSelections: {
          appetizers: sel.hors,
          mains: sel.entrees,
          sides: sel.salads,
        },
      });

      const fileName = `BatesCateringAgreement_${Date.now()}.pdf`;
      const filePath = `public_docs/${user.uid}/${fileName}`;
      agreementUrl = await uploadPdfBlob(pdfBlob, filePath);
    } catch (err) {
      console.error("❌ Error generating/uploading Bates Agreement:", err);
    }

    // ── Build robot plan snapshot (final due = 35 days) ─────────────────────
    const nowUTC = new Date();
    const firstChargeAtISO = payFull ? null : nextApproxMonthUTC(nowUTC);
    const firstChargeAt = firstChargeAtISO ? new Date(firstChargeAtISO) : null;
    const finalISO = finalDueDate ? asStartOfDayUTC(finalDueDate).toISOString() : null;

    const planMonths =
      !payFull && finalDueDate && firstChargeAt
        ? monthsBetweenInclusive(firstChargeAt, finalDueDate)
        : 0;

    const remainingCentsTotal = Math.round(remainingBalance * 100);
    const perMonthCents =
      planMonths > 1 ? Math.floor(remainingCentsTotal / planMonths) : remainingCentsTotal;
    const lastPaymentCents =
      planMonths > 1 ? remainingCentsTotal - perMonthCents * (planMonths - 1) : 0;

    // ── Persist Firestore updates ───────────────────────────────────────────
    try {
      const purchaseEntry = {
        label: "Bates Catering Add-ons",
        category: "catering",
        boutique: "catering",
        source: "W&D",

        amount: Number(amountDueToday.toFixed(2)),
        amountChargedToday: Number(amountDueToday.toFixed(2)),
        contractTotal: Number(total.toFixed(2)),

        payFull: payFull,
        deposit: payFull ? 0 : Number(amountDueToday.toFixed(2)),
        monthlyAmount: payFull ? 0 : perMonthCents / 100,
        months: payFull ? 0 : planMonths,
        method: payFull ? "paid_in_full" : "deposit",

        items: lineItems || [],
        date: new Date().toISOString(),
      };

      await updateDoc(userRef, {
        // mark catering as booked
        "bookings.catering": true,
        "bookings.updatedAt": new Date().toISOString(),

        // attach the agreement PDF
        ...(agreementUrl
          ? {
              documents: arrayUnion({
                title: "Bates Catering Agreement",
                url: agreementUrl,
                uploadedAt: new Date().toISOString(),
              }),
            }
          : {}),

        purchases: arrayUnion(purchaseEntry),

        spendTotal: increment(Number(amountDueToday.toFixed(2))),

        "totals.catering.contractTotal": Number(total.toFixed(2)),
        "totals.catering.amountPaid": increment(Number(amountDueToday.toFixed(2))),
        "totals.catering.guestCountAtBooking": storedGuestCount,
        "totals.catering.venueSlug": "batesmansion",
        "totals.catering.lastUpdatedAt": new Date().toISOString(),

        paymentPlan: payFull
          ? {
              product: "catering_bates",
              type: "full",
              total,
              paidNow: total,
              remainingBalance: 0,
              finalDueDate: null,
              finalDueAt: null,
              depositPercent: 1,
              createdAt: new Date().toISOString(),
            }
          : {
              product: "catering_bates",
              type: "deposit",
              total,
              depositPercent: 0.25,
              paidNow: amountDueToday,
              remainingBalance,
              finalDueDate: finalDueDateStr,
              finalDueAt: finalISO,
              createdAt: new Date().toISOString(),
            },

        paymentPlanAuto: payFull
          ? {
              version: 1,
              product: "catering_bates",
              status: "complete",
              strategy: "paid_in_full",
              currency: "usd",

              totalCents: Math.round(total * 100),
              depositCents: Math.round(total * 100),
              remainingCents: 0,

              planMonths: 0,
              perMonthCents: 0,
              lastPaymentCents: 0,

              nextChargeAt: null,
              finalDueAt: null,

              stripeCustomerId:
                customerId || localStorage.getItem("stripeCustomerId") || null,

              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : {
              version: 1,
              product: "catering_bates",
              status: "active",
              strategy: "monthly_until_final",
              currency: "usd",

              totalCents: Math.round(total * 100),
              depositCents: Math.round(amountDueToday * 100),
              remainingCents: remainingCentsTotal,

              planMonths,
              perMonthCents,
              lastPaymentCents,

              nextChargeAt: firstChargeAtISO,
              finalDueAt: finalISO,

              stripeCustomerId:
                customerId || localStorage.getItem("stripeCustomerId") || null,

              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
      });
    } catch (err) {
      console.error("❌ Firestore update failed:", err);
    }

    // ✅ Centralized user+admin email (same system as Floral/Yum core)
    try {
      const current = getAuth().currentUser;
      await notifyBooking("yum_catering", {
        user_email: current?.email || (userDoc as any)?.email || "unknown@wedndone.com",
        user_full_name: fullName,
        firstName: safeFirst,
        wedding_date: storedWeddingDate || weddingDate || "TBD",
        total: total.toFixed(2),
        line_items: (lineItems || []).join(", "),
        pdf_url: agreementUrl || "",
        pdf_title: "Bates Catering Agreement",
        payment_now: amountDueToday.toFixed(2),
        remaining_balance: remainingBalance.toFixed(2),
        final_due: finalDueDateStr,
        dashboardUrl: `${window.location.origin}${import.meta.env.BASE_URL}dashboard`,
        product_name: "Bates Catering",
      });
    } catch (mailErr) {
      console.error("❌ notifyBooking failed:", mailErr);
    }

    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("documentsUpdated"));

    try {
      localStorage.setItem("batesJustBookedCatering", "true");
      window.dispatchEvent(new Event("cateringCompletedNow"));
    } catch {}

    onSuccess();
  };

  // 🔁 Zero-payment path: auto-run handleSuccess, no Stripe UI
  useEffect(() => {
    if (!isZeroTotal) return;
    if (didRunRef.current) return;

    // No payment due → just finalize agreement + Firestore + emails
    handleSuccess();
  }, [isZeroTotal]);

  // ===================== RENDER =====================

  // For both "generating" and "no payment" paths, show the magic clock card.
  if (isGenerating || isZeroTotal) {
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
          style={{ maxWidth: 700, position: "relative" }}
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

          <div
            className="pixie-card__body"
            style={{
              textAlign: "center",
              padding: "2rem 2.5rem",
            }}
          >
            <video
              src={`${import.meta.env.BASE_URL}assets/videos/magic_clock.mp4`}
              autoPlay
              loop
              muted
              playsInline
              className="px-media"
              style={{
                width: "100%",
                maxWidth: 340,
                borderRadius: 12,
                margin: "0 auto 14px",
                display: "block",
              }}
            />

            <h3 className="px-title" style={{ margin: 0 }}>
              {isZeroTotal
                ? "Your Bates catering is included — Madge is saving your agreement now."
                : "Madge is working her magic… hold tight!"}
            </h3>

            {isZeroTotal && (
              <p className="px-prose-narrow" style={{ marginTop: 8 }}>
                No payment is due today.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Normal paid add-on flow → show Stripe checkout
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
        style={{ maxWidth: 700, position: "relative" }}
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

        <div
          className="pixie-card__body"
          ref={scrollRef}
          style={{ textAlign: "center", padding: "2rem 2.5rem" }}
        >
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/lock.mp4`}
            autoPlay
            loop
            muted
            playsInline
            className="px-media"
            style={{
              width: 160,
              maxWidth: "90%",
              borderRadius: 12,
              margin: "0 auto 16px",
              display: "block",
            }}
          />

          <h2
            className="px-title"
            style={{
              fontFamily: "'Jenna Sue', cursive",
              fontSize: "1.9rem",
              marginBottom: 8,
            }}
          >
            Checkout
          </h2>

          <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
            {paymentSummary
              ? paymentSummary
              : payFull
              ? `Total due today: $${Number(total).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}.`
              : `Deposit due today: $${amountDueToday.toFixed(
                  2
                )} (25%). Remaining $${remainingBalance.toFixed(
                  2
                )} — final payment due ${finalDueDateStr}.`}
          </p>

          {/* Payment Method Selection (mirrors Floral UI) */}
          <div
            style={{
              marginTop: 12,
              marginBottom: 20,
              padding: "14px 16px",
              borderRadius: 12,
              background: "#f7f8ff",
              border: "1px solid #d9ddff",
              maxWidth: 520,
              marginInline: "auto",
            }}
          >
            {hasSavedCard ? (
              <>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: ".95rem",
                    marginBottom: 10,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="paymentMode"
                    checked={mode === "saved"}
                    onChange={() => setMode("saved")}
                  />
                  <span>
                    Saved card on file —{" "}
                    <strong>{savedCardSummary!.brand.toUpperCase()}</strong> ••••{" "}
                    {savedCardSummary!.last4} (exp {savedCardSummary!.exp_month}/
                    {savedCardSummary!.exp_year})
                  </span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: ".95rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="paymentMode"
                    checked={mode === "new"}
                    onChange={() => setMode("new")}
                  />
                  <span>Pay with a different card</span>
                </label>
              </>
            ) : (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: ".95rem",
                  cursor: "pointer",
                }}
              >
                <input type="radio" checked readOnly />
                <span>Enter your card details</span>
              </label>
            )}
          </div>

          {/* Stripe form */}
          <div className="px-elements" aria-busy={isGenerating}>
            <CheckoutForm
              total={amountDueToday}
              useSavedCard={mode === "saved"}
              onSuccess={handleSuccess}
              setStepSuccess={onSuccess}
              isAddon={false}
              customerEmail={getAuth().currentUser?.email || undefined}
              customerName={`${firstName || "Magic"} ${lastName || "User"}`}
              customerId={(() => {
                try {
                  return localStorage.getItem("stripeCustomerId") || undefined;
                } catch {
                  return undefined;
                }
              })()}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatesCheckOutCatering;