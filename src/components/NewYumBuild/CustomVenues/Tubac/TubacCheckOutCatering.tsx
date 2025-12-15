// src/components/NewYumBuild/CustomVenues/Tubac/TubacCheckOutCatering.tsx
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
import { db, app } from "../../../../firebase/firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import generateYumAgreementPDF from "../../../../utils/generateYumAgreementPDF";
import { notifyBooking } from "../../../../utils/email/email";

// helpers
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pretty = (d: Date) =>
  d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

interface TubacCheckOutProps {
  total: number; // grand total from cart (for snapshots/PDF)
  guestCount: number;
  lineItems: string[]; // from cart summary
  serviceOption: "plated" | "buffet";
  selectedTier: string; // silver | gold | platinum | peridot | emerald | turquoise | diamond
  menuSelections: {
    hors?: string[]; // legacy fallbacks
    horsPassed?: string[];
    horsDisplayed?: string[];
    salads?: string[];
    sides?: string[];
    entrees?: string[];
  };
  onBack: () => void;
  onComplete: () => void; // overlay advances to Tubac TY
  onClose: () => void;
  isGenerating?: boolean;
}

const TubacCheckOutCatering: React.FC<TubacCheckOutProps> = ({
  total,
  guestCount,
  lineItems,
  serviceOption,
  selectedTier,
  menuSelections,
  onBack,
  onComplete,
  onClose,
  isGenerating: isGeneratingFromOverlay,
}) => {
  const [localGenerating, setLocalGenerating] = useState(false);
  const isGenerating = localGenerating || isGeneratingFromOverlay;
  const didRunRef = useRef(false);

  // Minimal user info for CheckoutForm display
  const [firstName, setFirstName] = useState("Magic");
  const [lastName, setLastName] = useState("User");
  useEffect(() => {
    (async () => {
      const user = getAuth().currentUser;
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data() || {};
        setFirstName(data.firstName || "Magic");
        setLastName(data.lastName || "User");
      } catch {
        /* noop */
      }
    })();
  }, []);

  // === 1) Read handoff keys saved by the Tubac contract screen ===
  const payFull = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("yumCateringPayFull") ?? "true");
    } catch {
      return true;
    }
  }, []);

  const totalCents =
    Number(localStorage.getItem("yumCateringTotalCents")) ||
    Math.round(total * 100);

  const depositCentsFromLs = Number(
    localStorage.getItem("yumCateringDepositAmount") || 0
  );

  const planMonths =
    Number(localStorage.getItem("yumCateringPlanMonths")) || 0;
  const perMonthCents =
    Number(localStorage.getItem("yumCateringPerMonthCents")) || 0;
  const lastPaymentCents =
    Number(localStorage.getItem("yumCateringLastPaymentCents")) || 0;
  const dueByISO = localStorage.getItem("yumCateringDueBy") || "";

  // Normalize what we actually charge right now
  const amountDueTodayCents = payFull
    ? totalCents
    : depositCentsFromLs || Math.round(total * 0.25 * 100);

  const amountDueToday = round2(amountDueTodayCents / 100);
  const remainingBalance = round2(Math.max(0, total - amountDueToday));

  const finalDueDateStr = dueByISO
    ? pretty(new Date(dueByISO))
    : "35 days before your wedding";

  // 🔹 explainer text above card box
  const summaryText = payFull
    ? `Total due today: $${Number(
        amountDueTodayCents / 100
      ).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}.`
    : `Deposit due today: $${(amountDueTodayCents / 100).toFixed(
        2
      )} (25%). Remaining $${remainingBalance.toFixed(
        2
      )} due by ${finalDueDateStr}.`;

  const signatureImageUrl =
    localStorage.getItem("yumSignature") ||
    localStorage.getItem("encSignatureImage") || // legacy fallback
    "";

  const tierLabel =
    localStorage.getItem("tubacTierLabel") ||
    selectedTier ||
    (menuSelections as any)?.tier ||
    "";

  const perGuestPrice =
    Number(localStorage.getItem("tubacPerGuest")) ||
    Number(localStorage.getItem("encanterraPerGuest")) || // harmless fallback
    0;

  // === 2) Success path (Stripe -> PDF -> Firestore snapshots) ===
  const handleSuccess = async ({
    customerId,
  }: {
    customerId?: string;
  } = {}) => {
    if (didRunRef.current) {
      console.warn(
        "[TubacCheckOutCatering] handleSuccess already ran — ignoring re-entry"
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

      // Store/refresh Stripe customer id
      try {
        if (customerId && customerId !== (userDoc as any)?.stripeCustomerId) {
          await updateDoc(userRef, {
            stripeCustomerId: customerId,
            "stripe.updatedAt": serverTimestamp(),
          });
          try {
            localStorage.setItem("stripeCustomerId", customerId);
          } catch {
            /* ignore */
          }
        }
      } catch (idErr) {
        console.warn("⚠️ Could not update stripeCustomerId for Tubac:", idErr);
      }

      // Build hors list: prefer split arrays; fallback to combined
      const horsList = [
        ...(menuSelections.horsPassed || []),
        ...(menuSelections.horsDisplayed || []),
      ];
      const appetizers = horsList.length
        ? horsList
        : menuSelections.hors || [];

      // Cuisine label for agreement
      const cuisineLabel = `Tubac Catering — ${
        serviceOption === "plated" ? "Plated" : "Buffet"
      } (${tierLabel})`;

      const fullName = `${
        (userDoc as any)?.firstName || firstName || "Magic"
      } ${(userDoc as any)?.lastName || lastName || "User"}`;

      const weddingDateStr =
        (userDoc as any)?.weddingDate || "Your wedding date";

      // Generate Tubac agreement PDF (use actual charged deposit)
      const pdfBlob = await generateYumAgreementPDF({
        fullName,
        total,
        deposit: payFull ? 0 : amountDueToday,
        guestCount,
        charcuterieCount: 0,
        weddingDate: weddingDateStr,
        signatureImageUrl: signatureImageUrl || "",
        paymentSummary: payFull
          ? `Paid in full today: $${Number(amountDueToday).toLocaleString(
              undefined,
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}.`
          : `Deposit today: $${amountDueToday.toFixed(
              2
            )}. Remaining $${remainingBalance.toFixed(
              2
            )} due by ${finalDueDateStr}.`,
        lineItems: lineItems || [],
        cuisineType: cuisineLabel,
        menuSelections: {
          appetizers,
          mains: menuSelections.entrees || [],
          sides: menuSelections.sides || [],
        },
      });

      // Upload PDF
      const storage = getStorage(
        app,
        "gs://wedndonev2.firebasestorage.app"
      );
      const filename = `TubacCateringAgreement_${Date.now()}.pdf`;
      const fileRef = ref(
        storage,
        `public_docs/${user.uid}/${filename}`
      );
      await uploadBytes(fileRef, pdfBlob);
      const publicUrl = await getDownloadURL(fileRef);

      // Pricing snapshot (for admin/robot sanity)
      await setDoc(
        doc(userRef, "pricingSnapshots", "catering"),
        {
          booked: true,
          guestCountAtBooking: guestCount,
          perGuest: perGuestPrice,
          venueCaterer: "tubac",
          service: serviceOption,
          tier: tierLabel,
          lineItems,
          totalBooked: Number(total.toFixed(2)),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Normalized purchase + plan snapshots
      const purchaseDate = new Date().toISOString();
      const amountNow = Number(amountDueToday.toFixed(2));
      const contractTotalRounded = Number(total.toFixed(2));

      const monthlyAmount = payFull ? 0 : round2(perMonthCents / 100);
      const normalizedDepositCents = payFull
        ? totalCents
        : depositCentsFromLs || amountDueTodayCents;
      const remainingCents = Math.max(0, totalCents - normalizedDepositCents);
      const depositPercent =
        totalCents > 0 ? normalizedDepositCents / totalCents : payFull ? 1 : 0.25;

      await updateDoc(userRef, {
        documents: arrayUnion({
          title: "Tubac Catering Agreement",
          url: publicUrl,
          uploadedAt: new Date().toISOString(),
        }),

        "bookings.catering": true,
        weddingDateLocked: true,
        lastPurchaseAt: serverTimestamp(),

        purchases: arrayUnion({
          label: "Tubac Catering",
          category: "catering",
          boutique: "catering",
          source: "W&D",
          amount: amountNow,
          amountChargedToday: amountNow,
          contractTotal: contractTotalRounded,
          payFull,
          deposit: payFull ? 0 : amountNow,
          monthlyAmount,
          months: payFull ? 0 : planMonths,
          method: payFull ? "paid_in_full" : "deposit",
          items: lineItems,
          date: purchaseDate,
        }),

        spendTotal: increment(amountNow),

        paymentPlan: payFull
          ? {
              product: "catering_tubac",
              type: "paid_in_full",
              total,
              depositPercent: 1,
              paidNow: amountNow,
              remainingBalance: 0,
              finalDueDate: null,
              finalDueAt: null,
              createdAt: purchaseDate,
            }
          : {
              product: "catering_tubac",
              type: "deposit",
              total,
              depositPercent,
              paidNow: amountNow,
              remainingBalance,
              finalDueDate: finalDueDateStr,
              finalDueAt: dueByISO || null,
              createdAt: purchaseDate,
            },

        paymentPlanAuto: payFull
          ? {
              version: 1,
              product: "catering_tubac",
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
              venueCaterer: "tubac",
              service: serviceOption,
              tier: tierLabel,
              createdAt: purchaseDate,
              updatedAt: purchaseDate,
            }
          : {
              version: 1,
              product: "catering_tubac",
              status: remainingCents > 0 ? "active" : "complete",
              strategy: "monthly_until_final",
              currency: "usd",
              totalCents,
              depositCents: normalizedDepositCents,
              remainingCents,
              planMonths,
              perMonthCents,
              lastPaymentCents,
              nextChargeAt: new Date(
                Date.now() + 60 * 1000
              ).toISOString(),
              finalDueAt: dueByISO || null,
              stripeCustomerId:
                customerId ||
                localStorage.getItem("stripeCustomerId") ||
                null,
              venueCaterer: "tubac",
              service: serviceOption,
              tier: tierLabel,
              createdAt: purchaseDate,
              updatedAt: purchaseDate,
            },

        "progress.yumYum.step": "tubacCateringThankYou",
      });

      // 📧 Centralized booking email — Yum Catering @ Tubac
      try {
        const authUser = getAuth().currentUser;

        const user_full_name = fullName;
        const payment_now = amountNow.toFixed(2);
        const remaining_balance = Math.max(0, total - amountNow).toFixed(2);

        await notifyBooking("yum_catering", {
          // who
          user_email:
            authUser?.email ||
            (userDoc as any)?.email ||
            "unknown@wedndone.com",
          user_full_name,

          // details
          wedding_date: (userDoc as any)?.weddingDate || "TBD",
          total: total.toFixed(2),
          line_items: (lineItems || []).join(", "),

          // pdf info
          pdf_url: publicUrl || "",
          pdf_title: "Tubac Catering Agreement",

          // payment breakdown
          payment_now,
          remaining_balance,
          final_due: finalDueDateStr,

          // UX link + label
          dashboardUrl: `${window.location.origin}${
            import.meta.env.BASE_URL
          }dashboard`,
          product_name: "Tubac Catering",
        });
      } catch (mailErr) {
        console.error("❌ notifyBooking(yum_catering) failed:", mailErr);
      }

      try {
        localStorage.setItem("yumStep", "tubacCateringThankYou");
        localStorage.setItem("tubacCateringBooked", "true");
        localStorage.setItem("tubacJustBookedCatering", "true");
      } catch {
        /* ignore */
      }

      // Global fan-out
      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("cateringCompletedNow"));
      window.dispatchEvent(
        new CustomEvent("bookingsChanged", { detail: { catering: true } })
      );
      window.dispatchEvent(new Event("documentsUpdated"));

      onComplete();
    } catch (err) {
      console.error("❌ Error in Tubac Catering checkout:", err);
      alert(
        "Something went wrong saving your receipt. Please contact support."
      );
    } finally {
      setLocalGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div
  className="pixie-card pixie-card--modal is-generating"
  style={{ maxWidth: 720 }}
>
        <div
          className="pixie-card__body"
          style={{ textAlign: "center" }}
        >
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/magic_clock.mp4`}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: 280,
              margin: "0 auto 12px",
              borderRadius: 12,
            }}
          />
          <p
            className="px-prose-narrow"
            style={{
              color: "#2c62ba",
              fontStyle: "italic",
            }}
          >
            Madge is working her magic…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
  className={`pixie-card pixie-card--modal ${
    isGenerating ? "is-generating" : ""
  }`}
>
      {/* 🩷 Pink X */}
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

      <div className="pixie-card__body">
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/lock.mp4`}
          autoPlay
          loop
          muted
          playsInline
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

        <p
          className="px-prose-narrow"
          style={{
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          {summaryText}
        </p>

        {/* ✅ Stripe Card Entry */}
        <div className="px-elements">
          <CheckoutForm
            total={amountDueToday}
            onSuccess={handleSuccess}
            setStepSuccess={() => {
              /* nav handled in handleSuccess → onComplete */
            }}
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

        {/* Back button */}
        <div
          style={{
            marginTop: "1rem",
            textAlign: "center",
          }}
        >
          <button
            className="boutique-back-btn"
            style={{ width: 250 }}
            onClick={onBack}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default TubacCheckOutCatering;