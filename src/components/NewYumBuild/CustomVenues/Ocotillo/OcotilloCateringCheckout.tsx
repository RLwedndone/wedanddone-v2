// src/components/NewYumBuild/CustomVenues/Ocotillo/OcotilloCateringCheckout.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import generateOcotilloAgreementPDF from "../../../../utils/generateOcotilloAgreementPDF";

// helpers
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const toPretty = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

type OcotilloTier = "Tier 1" | "Tier 2" | "Tier 3";

interface OcotilloCheckoutProps {
  total: number; // grand total from Ocotillo cart
  guestCount: number;
  lineItems: string[];
  tier?: OcotilloTier; // optional, we also read from LS
  menuSelections: {
    appetizers?: string[];
    salads?: string[];
    entrees?: string[];
    desserts?: string[];
  };
  onBack: () => void;
  onComplete: () => void; // advance overlay to Thank You
  onClose: () => void;
  isGenerating: boolean;
}

const OcotilloCateringCheckout: React.FC<OcotilloCheckoutProps> = ({
  total,
  guestCount,
  lineItems,
  tier: tierProp,
  menuSelections,
  onBack,
  onComplete,
  onClose,
  isGenerating: isGeneratingFromOverlay,
}) => {
  const [localGenerating, setLocalGenerating] = useState(false);
  const isGenerating = localGenerating || isGeneratingFromOverlay;
  const didRunRef = useRef(false);

  // === 1) Read contract handoff keys (Ocotillo-first, fallback to generic yum) ===
  const payFull = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("ocotilloPayFull") ??
          localStorage.getItem("yumCateringPayFull") ??
          "true"
      );
    } catch {
      return true;
    }
  }, []);

  const totalCents = Number(
    localStorage.getItem("ocotilloTotalCents") ??
      localStorage.getItem("yumCateringTotalCents") ??
      0
  );
  const depositCents = Number(
    localStorage.getItem("ocotilloDepositAmountCents") ??
      localStorage.getItem("yumCateringDepositAmount") ??
      0
  );
  const planMonthsLS = Number(
    localStorage.getItem("ocotilloPlanMonths") ??
      localStorage.getItem("yumCateringPlanMonths") ??
      0
  );
  const perMonthCentsLS = Number(
    localStorage.getItem("ocotilloPerMonthCents") ??
      localStorage.getItem("yumCateringPerMonthCents") ??
      0
  );
  const lastPaymentCentsLS = Number(
    localStorage.getItem("ocotilloLastPaymentCents") ??
      localStorage.getItem("yumCateringLastPaymentCents") ??
      0
  );

  const paymentSummaryText =
    localStorage.getItem("ocotilloPaymentSummaryText") ??
    localStorage.getItem("vvPaymentSummaryText") ??
    "";

  const weddingDateISO =
    localStorage.getItem("ocotilloWeddingDate") ??
    localStorage.getItem("vvWeddingDate") ??
    "";
  const dayOfWeek =
    localStorage.getItem("ocotilloDayOfWeek") ??
    localStorage.getItem("vvDayOfWeek") ??
    "";

  const ocSelections = (() => {
    try {
      return JSON.parse(localStorage.getItem("ocotilloSelections") || "{}");
    } catch {
      return {};
    }
  })();
  const ocLineItems = (() => {
    try {
      return JSON.parse(localStorage.getItem("ocotilloLineItems") || "[]");
    } catch {
      return [];
    }
  })();

  const tierIdLS = localStorage.getItem("ocotilloTierLabel") || "";
  const ocotilloTier: OcotilloTier =
    tierProp ||
    ((tierIdLS as OcotilloTier) || ("Tier 1" as OcotilloTier)); // safe default

  const perGuestPrice =
    Number(localStorage.getItem("ocotilloPerGuest")) ||
    Number(localStorage.getItem("vicVerradoPerGuest")) || // extra fallback, just in case
    0;

  // === 2) Decide what we charge today ===
  const amountDueTodayCents = payFull ? totalCents : depositCents;
  const amountDueToday = round2(amountDueTodayCents / 100);
  const remainingBalance = round2(Math.max(0, total - amountDueToday));

  // final due pretty label
  const finalDueDateStr = (() => {
    if (!weddingDateISO) return "35 days before your wedding date";
    const base = new Date(weddingDateISO);
    base.setDate(base.getDate() - 35);
    return toPretty(base);
  })();

  const signatureImageUrl =
    localStorage.getItem("ocotilloSignatureImage") ||
    localStorage.getItem("vvSignatureImage") ||
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

  // === 4) On successful payment ===
  const handleSuccess = async ({ customerId }: { customerId?: string } = {}) => {
    if (didRunRef.current) {
      console.warn("[OcotilloCateringCheckout] handleSuccess already ran — ignoring re-entry");
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

      // Store Stripe customer id if new
      if (customerId && customerId !== userDoc?.stripeCustomerId) {
        await updateDoc(userRef, {
          stripeCustomerId: customerId,
          "stripe.updatedAt": serverTimestamp(),
        });
        try {
          localStorage.setItem("stripeCustomerId", customerId);
        } catch {}
      }

      // ---------- Resolve the REAL guest count ----------
      let guestCountFinal = 0;
      try {
        const st = await getGuestState();
        guestCountFinal = Number((st as any)?.value || 0);
      } catch {}
      if (!guestCountFinal) {
        guestCountFinal =
          Number(
            localStorage.getItem("ocotilloGuestCount") ||
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

      // ---------- Route FIRST + fire Budget Wand ----------
      try {
        localStorage.setItem("ocotilloJustBookedCatering", "true");
        localStorage.setItem("ocotilloCateringBooked", "true");
        localStorage.setItem("ocotilloYumStep", "ocotilloCateringThankYou");
        localStorage.setItem("yumStep", "ocotilloCateringThankYou");
      } catch {}
      window.dispatchEvent(new Event("purchaseMade"));
      onComplete(); // overlay advances to Catering TY immediately

      // ---------- Generate agreement PDF ----------
      const pdfBlob = await generateOcotilloAgreementPDF({
        fullName,
        total, // grand total (includes tax/fees per your cart)
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
        tierLabel: ocotilloTier,
        selections: {
          appetizers:
            menuSelections.appetizers || ocSelections.appetizers || [],
          salads: menuSelections.salads || ocSelections.salads || [],
          entrees: menuSelections.entrees || ocSelections.entrees || [],
          desserts: menuSelections.desserts || ocSelections.desserts || [],
        },
        lineItems: lineItems?.length ? lineItems : ocLineItems,
      });

      // ---------- Upload PDF ----------
      const storage = getStorage(app, "gs://wedndonev2.firebasestorage.app");
      const filename = `OcotilloCateringAgreement_${Date.now()}.pdf`;
      const fileRef = ref(storage, `public_docs/${user.uid}/${filename}`);
      await uploadBytes(fileRef, pdfBlob);
      const publicUrl = await getDownloadURL(fileRef);

      // ---------- Pricing snapshot ----------
      await setDoc(
        doc(userRef, "pricingSnapshots", "catering"),
        {
          booked: true,
          guestCountAtBooking: guestCountFinal,
          perGuest: perGuestPrice,
          venueCaterer: "ocotillo",
          tier: ocotilloTier,
          lineItems: lineItems?.length ? lineItems : ocLineItems,
          totalBooked: total,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // ---------- Robot billing snapshot & user doc updates ----------
      const planMonths = planMonthsLS || 0;
      const perMonthCents = perMonthCentsLS || 0;
      const lastPaymentCents = lastPaymentCentsLS || 0;
      const finalDueAtISO =
        localStorage.getItem("ocotilloDueByISO") ||
        localStorage.getItem("vvDueByISO") ||
        null;
      const nextChargeAt =
        !payFull && planMonths > 0
          ? new Date(Date.now() + 60 * 1000).toISOString()
          : null;

      await updateDoc(userRef, {
        documents: arrayUnion({
          title: "Ocotillo Catering Agreement",
          url: publicUrl,
          uploadedAt: new Date().toISOString(),
        }),

        "bookings.catering": true,
        weddingDateLocked: true,

        purchases: arrayUnion({
          label: "yum",
          amount: Number((amountDueTodayCents / 100).toFixed(2)),
          date: purchaseDate,
          method: payFull ? "full" : "deposit",
        }),

        spendTotal: increment(Number((amountDueTodayCents / 100).toFixed(2))),

        paymentPlan: payFull
          ? {
              product: "yum",
              type: "full",
              total,
              paidNow: amountDueToday,
              remainingBalance: 0,
              finalDueDate: null,
              finalDueAt: null,
              depositPercent: 1,
              createdAt: new Date().toISOString(),
            }
          : {
              product: "yum",
              type: "deposit",
              total,
              depositPercent: 0.25,
              paidNow: amountDueToday,
              remainingBalance,
              finalDueDate: finalDueDateStr,
              finalDueAt: finalDueAtISO,
              createdAt: new Date().toISOString(),
            },

        paymentPlanAuto: payFull
          ? {
              version: 1,
              product: "yum",
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
                customerId || localStorage.getItem("stripeCustomerId") || null,
              venueCaterer: "ocotillo",
              tier: ocotilloTier,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : {
              version: 1,
              product: "yum",
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
                customerId || localStorage.getItem("stripeCustomerId") || null,
              venueCaterer: "ocotillo",
              tier: ocotilloTier,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },

        "progress.yumYum.step": "ocotilloCateringThankYou",
      });

      // Nudge any doc viewers to refresh
      window.dispatchEvent(new Event("documentsUpdated"));
    } catch (err) {
      console.error("❌ Error in Ocotillo Catering checkout:", err);
      alert("Something went wrong saving your receipt. Please contact support.");
    } finally {
      setLocalGenerating(false);
    }
  };

  // ========== Spinner card ==========
  if (isGenerating) {
    return (
      <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
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
          <h3 className="px-title" style={{ margin: 0, color: "#2c62ba" }}>
            Madge is working her magic…
          </h3>

          <div style={{ marginTop: 12 }}>
            <button className="boutique-back-btn" style={{ width: 250 }} onClick={onBack} disabled>
              ← Back to Cart
            </button>
          </div>
        </div>
      </div>
    );
  }

  // UI copy for above the form
  const summaryText = payFull
    ? `Total due today: $${(amountDueTodayCents / 100).toFixed(2)}.`
    : `Deposit due today: $${(amountDueTodayCents / 100).toFixed(
        2
      )} (25%). Remaining $${remainingBalance.toFixed(2)} due by ${finalDueDateStr}.`;

  // ========== Main checkout card ==========
  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/lock.mp4`}
          autoPlay
          muted
          playsInline
          loop
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
            color: "#2c62ba",
          }}
        >
          Checkout
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 16, textAlign: "center" }}>
          {summaryText}
        </p>

        {/* Stripe form */}
        <div className="px-elements">
          <CheckoutForm
            total={amountDueToday} // dollars (not cents)
            onSuccess={handleSuccess}
            setStepSuccess={onComplete}
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

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button className="boutique-back-btn" style={{ width: 250 }} onClick={onBack}>
            ← Back to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default OcotilloCateringCheckout;