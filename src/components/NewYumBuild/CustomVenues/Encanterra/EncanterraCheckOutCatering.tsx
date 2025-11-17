// src/components/NewYumBuild/CustomVenues/Encanterra/EncanterraCheckOutCatering.tsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import CheckoutForm from "../../../../CheckoutForm";


import { getAuth } from "firebase/auth";
import {
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getGuestState } from "../../../../utils/guestCountStore";
import { db, app } from "../../../../firebase/firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import generateEncanterraAgreementPDF from "../../../../utils/generateEncanterraAgreementPDF";
import { notifyBooking } from "../../../../utils/email/email";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const toPretty = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

// ✅ Carat labels
type DiamondTier = "1 Carat" | "2 Carat" | "3 Carat";

interface EncanterraCheckOutProps {
  total: number; // grand total from cart (for PDF/snapshots)
  guestCount: number;
  lineItems: string[];
  diamondTier?: DiamondTier;
  menuSelections: {
    hors?: string[];
    salads?: string[];
    sides?: string[];
    entrees?: string[];
  };
  onBack: () => void;
  onComplete: () => void; // advance to Encanterra TY
  onClose: () => void;
  isGenerating: boolean;
}

// Mirror of cart pricing
const TIER_PRICE: Record<DiamondTier, number> = {
  "1 Carat": 60,
  "2 Carat": 70,
  "3 Carat": 85,
};

const EncanterraCheckOutCatering: React.FC<EncanterraCheckOutProps> = ({
  total,
  guestCount,
  lineItems,
  diamondTier: tierProp,
  menuSelections,
  onBack,
  onComplete,
  onClose,
  isGenerating: isGeneratingFromOverlay,
}) => {
  const [localGenerating, setLocalGenerating] = useState(false);
  const isGenerating = localGenerating || isGeneratingFromOverlay;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didRunRef = useRef(false);

  // === 1) Read contract handoff keys ===
  const payFull = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("encPayFull") ??
          localStorage.getItem("yumCateringPayFull") ??
          "true"
      );
    } catch {
      return true;
    }
  }, []);

  const totalCents = Number(
    localStorage.getItem("encTotalCents") ??
      localStorage.getItem("yumCateringTotalCents") ??
      0
  );
  const depositCents = Number(
    localStorage.getItem("encDepositAmountCents") ??
      localStorage.getItem("yumCateringDepositAmount") ??
      0
  );
  const planMonthsLS = Number(
    localStorage.getItem("encPlanMonths") ??
      localStorage.getItem("yumCateringPlanMonths") ??
      0
  );
  const perMonthCentsLS = Number(
    localStorage.getItem("encPerMonthCents") ??
      localStorage.getItem("yumCateringPerMonthCents") ??
      0
  );
  const lastPaymentCentsLS = Number(
    localStorage.getItem("encLastPaymentCents") ??
      localStorage.getItem("yumCateringLastPaymentCents") ??
      0
  );
  const paymentSummaryText =
    localStorage.getItem("encPaymentSummaryText") ?? "";

  const venueName = localStorage.getItem("encVenueName") || "Encanterra";
  const weddingDateISO = localStorage.getItem("encWeddingDate") || "";
  const dayOfWeek = localStorage.getItem("encDayOfWeek") || "";

  const encSelections = (() => {
    try {
      return JSON.parse(localStorage.getItem("encSelections") || "{}");
    } catch {
      return {};
    }
  })();
  const encLineItems = (() => {
    try {
      return JSON.parse(localStorage.getItem("encLineItems") || "[]");
    } catch {
      return [];
    }
  })();

  const tierIdLS = localStorage.getItem("encTierId") || ""; // "1 Carat" style expected upstream; guard anyway
  const diamondTier: DiamondTier =
    tierProp ||
    (["1 Carat", "2 Carat", "3 Carat"].includes(tierIdLS)
      ? (tierIdLS as DiamondTier)
      : ("1 Carat" as DiamondTier));

  const perGuestPrice =
    Number(localStorage.getItem("encanterraPerGuest")) ||
    TIER_PRICE[diamondTier];

  // === 2) Amount due today ===
  const amountDueTodayCents = payFull ? totalCents : depositCents;
  const amountDueToday = round2(amountDueTodayCents / 100);
  const remainingBalance = round2(Math.max(0, total - amountDueToday));

  const finalDueDateStr = (() => {
    if (!weddingDateISO) return "35 days before your wedding date";
    const base = new Date(weddingDateISO);
    base.setDate(base.getDate() - 35);
    return toPretty(base);
  })();

  const signatureImageUrl =
    localStorage.getItem("encSignatureImage") ||
    localStorage.getItem("yumSignature") ||
    "";

  // === 3) Minimal user record for emails/PDF ===
  const [firstName, setFirstName] = useState<string>("Magic");
  const [lastName, setLastName] = useState<string>("User");
  useEffect(() => {
    (async () => {
      const user = getAuth().currentUser;
      if (!user) return;
      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        const data = snap.data() || {};
        setFirstName(data.firstName || "Magic");
        setLastName(data.lastName || "User");
      } catch {
        /* noop */
      }
    })();
  }, []);

  // === 5) On successful payment ===
  const handleSuccess = async ({ customerId }: { customerId?: string } = {}) => {
    if (didRunRef.current) {
      console.warn(
        "[EncanterraCheckOutCatering] handleSuccess already ran — ignoring re-entry"
      );
      return;
    }
    didRunRef.current = true;

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLocalGenerating(true);

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const userDoc = snap.data() || {};

      // Save Stripe customer id if new
      if (customerId && customerId !== userDoc?.stripeCustomerId) {
        await updateDoc(userRef, {
          stripeCustomerId: customerId,
          "stripe.updatedAt": serverTimestamp(),
        });
        try {
          localStorage.setItem("stripeCustomerId", customerId);
        } catch {}
      }

      // --- Resolve the real guest count ---
      let guestCountFinal = 0;
      try {
        const st = await getGuestState();
        guestCountFinal = Number((st as any)?.value || 0);
      } catch {}
      if (!guestCountFinal) {
        guestCountFinal =
          Number(
            localStorage.getItem("yumGuestCount") ||
              localStorage.getItem("magicGuestCount") ||
              0
          ) || 0;
      }
      if (!guestCountFinal) {
        const snap2 = await getDoc(userRef);
        const data2 = snap2.data() || {};
        guestCountFinal = Number(data2?.guestCount || 0);
      }

      const safeFirst = userDoc?.firstName || firstName || "Magic";
      const safeLast = userDoc?.lastName || lastName || "User";
      const fullName = `${safeFirst} ${safeLast}`;
      const wedding = weddingDateISO || userDoc?.weddingDate || "TBD";
      const purchaseDate = new Date().toISOString();

      // --- Route FIRST + fan-out (snappy UI) ---
      try {
        localStorage.setItem("encJustBookedCatering", "true");
        localStorage.setItem("encCateringBooked", "true");
        localStorage.setItem("encYumStep", "encanterraCateringThankYou");
        localStorage.setItem("yumStep", "encanterraCateringThankYou");
      } catch {}
      window.dispatchEvent(new Event("purchaseMade"));
      onComplete(); // advance overlay to TY immediately

      // --- Generate agreement PDF (Encanterra canon: sides) ---
      const pdfBlob = await generateEncanterraAgreementPDF({
        venueName: venueName as any, // "Encanterra"
        fullName,
        total, // grand total (cart)
        deposit: payFull ? 0 : round2(total * 0.25),
        guestCount: guestCountFinal,
        weddingDate: wedding,
        signatureImageUrl,
        paymentSummary:
          paymentSummaryText ||
          (payFull
            ? `Paid in full today: $${amountDueToday.toFixed(2)}.`
            : `Deposit today: $${amountDueToday.toFixed(
                2
              )}. Remaining $${remainingBalance.toFixed(
                2
              )} due by ${finalDueDateStr}.`),
        diamondTier,
        selections: {
          hors: menuSelections.hors || encSelections.hors || [],
          salads: menuSelections.salads || encSelections.salads || [],
          sides: menuSelections.sides || encSelections.sides || [],
          entrees: menuSelections.entrees || encSelections.entrees || [],
        },
        lineItems: lineItems?.length ? lineItems : encLineItems,
      });

      // --- Upload PDF to project bucket ---
      const storage = getStorage(app, "gs://wedndonev2.firebasestorage.app");
      const filename = `EncanterraCateringAgreement_${Date.now()}.pdf`;
      const fileRef = ref(storage, `public_docs/${user.uid}/${filename}`);
      await uploadBytes(fileRef, pdfBlob);
      const publicUrl = await getDownloadURL(fileRef);

      // --- Robot billing snapshot & user doc updates ---
      const planMonths = planMonthsLS || 0;
      const perMonthCents = perMonthCentsLS || 0;
      const lastPaymentCents = lastPaymentCentsLS || 0;
      const finalDueAtISO = localStorage.getItem("encDueByISO") || null;
      const nextChargeAt =
        !payFull && planMonths > 0
          ? new Date(Date.now() + 60 * 1000).toISOString()
          : null;

          const contractTotal = round2(totalCents / 100 || total);
          const amountChargedToday = round2(amountDueTodayCents / 100);
    
          const purchaseEntry = {
            label: "Yum Yum Catering",
            category: "catering",
            boutique: "catering",
            source: "W&D",
            amount: amountChargedToday,
            amountChargedToday,
            contractTotal,
            payFull,
            deposit: payFull ? amountChargedToday : amountChargedToday,
            monthlyAmount: payFull ? 0 : round2((perMonthCents || 0) / 100),
            months: payFull ? 0 : planMonths,
            method: payFull ? "paid_in_full" : "deposit",
            items: lineItems?.length ? lineItems : encLineItems,
            date: purchaseDate,
          };

          await updateDoc(userRef, {
            // Store the PDF
            documents: arrayUnion({
              title: "Encanterra Catering Agreement",
              url: publicUrl,
              uploadedAt: new Date().toISOString(),
            }),
    
            // Booking flags
            "bookings.catering": true,
            weddingDateLocked: true,
    
            // 🔹 Rich purchase entry
            purchases: arrayUnion(purchaseEntry),
    
            // spendTotal = what actually hit the card today
            spendTotal: increment(amountChargedToday),
    
            // 🔹 Normalized catering totals for Guest Scroll + admin
            "totals.catering.contractTotal": contractTotal,
            "totals.catering.amountPaid": increment(amountChargedToday),
            "totals.catering.guestCountAtBooking": guestCountFinal,
            "totals.catering.perGuest":
              guestCountFinal > 0
                ? round2(contractTotal / guestCountFinal)
                : perGuestPrice,
            "totals.catering.venueSlug": "encanterra",
            "totals.catering.diamondTier": diamondTier,
            "totals.catering.lastUpdatedAt": new Date().toISOString(),
    
            // Keep existing plan snapshot for Stripe auto-pay
            paymentPlan: payFull
              ? {
                  product: "catering_encanterra",
                  type: "paid_in_full",
                  total: contractTotal,
                  paidNow: amountChargedToday,
                  remainingBalance: 0,
                  finalDueDate: null,
                  finalDueAt: null,
                  depositPercent: 1,
                  createdAt: new Date().toISOString(),
                }
              : {
                  product: "catering_encanterra",
                  type: "deposit",
                  total: contractTotal,
                  depositPercent: 0.25,
                  paidNow: amountChargedToday,
                  remainingBalance,
                  finalDueDate: finalDueDateStr,
                  finalDueAt: finalDueAtISO,
                  createdAt: new Date().toISOString(),
                },
    
            paymentPlanAuto: payFull
              ? {
                  version: 1,
                  product: "catering_encanterra",
                  status: "complete",
                  strategy: "paid_in_full",
                  currency: "usd",
    
                  totalCents,
                  depositCents: totalCents,
                  remainingCents: 0,
    
                  planMonths: 0,
                  perMonthCents: 0,
                  lastPaymentCents: 0,
    
                  nextChargeAt: null,
                  finalDueAt: null,
    
                  stripeCustomerId:
                    customerId ||
                    localStorage.getItem("stripeCustomerId") ||
                    null,
                  venueCaterer: "encanterra",
                  tier: diamondTier,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : {
                  version: 1,
                  product: "catering_encanterra",
                  status: "active",
                  strategy: "monthly_until_final",
                  currency: "usd",
    
                  totalCents,
                  depositCents,
                  remainingCents: Math.max(0, totalCents - depositCents),
    
                  planMonths,
                  perMonthCents,
                  lastPaymentCents,
    
                  nextChargeAt,
                  finalDueAt: finalDueAtISO,
    
                  stripeCustomerId:
                    customerId ||
                    localStorage.getItem("stripeCustomerId") ||
                    null,
                  venueCaterer: "encanterra",
                  tier: diamondTier,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
    
            // Route back into overlay correctly
            "progress.yumYum.step": "encanterraCateringThankYou",
          });

      // 📧 Centralized user+admin booking email (Yum Catering @ Encanterra)
try {
  const current = getAuth().currentUser;
  await notifyBooking("yum_catering", {
    // who + basics
    user_email: current?.email || (userDoc as any)?.email || "unknown@wedndone.com",
    user_full_name: `${safeFirst} ${safeLast}`,
    firstName: safeFirst,

    // details
    wedding_date: wedding,
    total: total.toFixed(2),
    line_items: (lineItems?.length ? lineItems : encLineItems).join(", "),

    // pdf info
    pdf_url: publicUrl || "",
    pdf_title: "Encanterra Catering Agreement",

    // payment breakdown
    payment_now: amountDueToday.toFixed(2),
    remaining_balance: remainingBalance.toFixed(2),
    final_due: finalDueDateStr,

    // UX link + label
    dashboardUrl: `${window.location.origin}${import.meta.env.BASE_URL}dashboard`,
    product_name: "Encanterra Catering",
  });
} catch (mailErr) {
  console.error("❌ notifyBooking(yum_catering) failed:", mailErr);
}

      window.dispatchEvent(new Event("documentsUpdated"));
    } catch (err) {
      console.error("❌ Error in Encanterra Catering checkout:", err);
      alert("Something went wrong saving your receipt. Please contact support.");
    } finally {
      setLocalGenerating(false);
    }
  };

  // Spinner view (standardized)
  if (isGenerating) {
    return (
      <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
        {/* 🩷 Pink X */}
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>

        <div className="pixie-card__body" style={{ textAlign: "center" }}>
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
            Madge is working her magic…
          </h3>

          <div style={{ marginTop: 12 }}>
            <button
              className="boutique-back-btn"
              style={{ width: 250 }}
              onClick={onBack}
              disabled
            >
              ← Back to Cart
            </button>
          </div>
        </div>
      </div>
    );
  }

  const summaryText = payFull
    ? `Total due today: $${(amountDueTodayCents / 100).toFixed(2)}.`
    : `Deposit due today: $${(amountDueTodayCents / 100).toFixed(
        2
      )} (25%). Remaining $${remainingBalance.toFixed(
        2
      )} — final payment due ${finalDueDateStr}.`;

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div
        className="pixie-card__body"
        ref={scrollRef}
        style={{ textAlign: "center" }}
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
          {paymentSummaryText ? paymentSummaryText : summaryText}
        </p>

        {/* Stripe Card Entry */}
<div className="px-elements">
  <CheckoutForm
    total={amountDueToday}
    onSuccess={handleSuccess}
    setStepSuccess={onComplete} // still okay to forward this
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
        {/* Back (inside card) */}
        <div style={{ marginTop: 12 }}>
          <button
            className="boutique-back-btn"
            style={{ width: 250 }}
            onClick={onBack}
          >
            ← Back to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default EncanterraCheckOutCatering;