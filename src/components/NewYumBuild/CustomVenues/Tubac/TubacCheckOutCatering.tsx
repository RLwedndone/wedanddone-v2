// src/components/NewYumBuild/CustomVenues/Tubac/TubacCheckOutCatering.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "../../../../CheckoutForm";
import { stripePromise } from "../../../../utils/stripePromise";

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

  const depositCents = Number(
    localStorage.getItem("yumCateringDepositAmount") || 0
  );

  const planMonths = Number(
    localStorage.getItem("yumCateringPlanMonths") || 0
  );
  const perMonthCents = Number(
    localStorage.getItem("yumCateringPerMonthCents") || 0
  );
  const lastPaymentCents = Number(
    localStorage.getItem("yumCateringLastPaymentCents") || 0
  );
  const dueByISO = localStorage.getItem("yumCateringDueBy") || "";

  const amountDueTodayCents = payFull ? totalCents : depositCents;
  const amountDueToday = round2(amountDueTodayCents / 100);
  const remainingBalance = round2(Math.max(0, total - amountDueToday));

  const finalDueDateStr = dueByISO
    ? pretty(new Date(dueByISO))
    : "35 days before your wedding";

  // 🔹 the missing piece — text shown above the card form
  const summaryText = payFull
    ? `Total due today: $${(amountDueTodayCents / 100).toFixed(2)}.`
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

  // === 2) Success path (Stripe -> PDF -> Firestore snapshots) ===
  const handleSuccess = async ({
    customerId,
  }: {
    customerId?: string;
  } = {}) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLocalGenerating(true);

      // Store/refresh Stripe customer id
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const userDoc = snap.data() || {};
      if (customerId && customerId !== userDoc?.stripeCustomerId) {
        await updateDoc(userRef, {
          stripeCustomerId: customerId,
          "stripe.updatedAt": serverTimestamp(),
        });
        try {
          localStorage.setItem("stripeCustomerId", customerId);
        } catch {}
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

      // Generate Tubac agreement PDF
      const pdfBlob = await generateYumAgreementPDF({
        fullName: `${userDoc?.firstName || firstName} ${
          userDoc?.lastName || lastName
        }`,
        total,
        deposit: payFull ? 0 : round2(total * 0.25),
        guestCount,
        charcuterieCount: 0,
        weddingDate: userDoc?.weddingDate || "Your wedding date",
        signatureImageUrl: signatureImageUrl || "",
        paymentSummary: payFull
          ? `Paid in full today: $${amountDueToday.toFixed(2)}.`
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
          totalBooked: total,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Robot payment plan snapshot + user doc updates
      const purchaseDate = new Date().toISOString();
      await updateDoc(userRef, {
        documents: arrayUnion({
          title: "Tubac Catering Agreement",
          url: publicUrl,
          uploadedAt: new Date().toISOString(),
        }),

        "bookings.catering": true,
        dateLocked: true,

        purchases: arrayUnion({
          label: "yum",
          amount: Number(
            (amountDueTodayCents / 100).toFixed(2)
          ),
          date: purchaseDate,
          method: payFull ? "full" : "deposit",
        }),

        spendTotal: increment(
          Number((amountDueTodayCents / 100).toFixed(2))
        ),

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
              createdAt: purchaseDate,
            }
          : {
              product: "yum",
              type: "deposit",
              total,
              depositPercent: 0.25,
              paidNow: amountDueToday,
              remainingBalance,
              finalDueDate: finalDueDateStr,
              finalDueAt: dueByISO || null,
              createdAt: purchaseDate,
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
              product: "yum",
              status: "active",
              strategy: "monthly_until_final",
              currency: "usd",
              totalCents,
              depositCents,
              remainingCents: Math.max(
                0,
                totalCents - depositCents
              ),
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

      try {
        localStorage.setItem(
          "yumStep",
          "tubacCateringThankYou"
        );
      } catch {}

      window.dispatchEvent(new Event("documentsUpdated"));
      onComplete();
    } catch (err) {
      console.error(
        "❌ Error in Tubac Catering checkout:",
        err
      );
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
        className="pixie-card pixie-card--modal"
        style={{ maxWidth: 720 }}
      >
        <button
          className="pixie-card__close"
          onClick={onClose}
          aria-label="Close"
        >
          <img src="/assets/icons/pink_ex.png" alt="Close" />
        </button>
        <div
          className="pixie-card__body"
          style={{ textAlign: "center" }}
        >
          <video
            src="/assets/videos/magic_clock.mp4"
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
    <div className="pixie-card pixie-card--modal">
      {/* 🩷 Pink X */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      <div className="pixie-card__body">
        <video
          src="/assets/videos/lock.mp4"
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

        {/* ✅ Use the same wrapper class as NoVenue so Stripe inputs aren't squished */}
        <div className="px-elements">
          <Elements stripe={stripePromise}>
            <CheckoutForm
              total={amountDueToday}
              onSuccess={handleSuccess}
              setStepSuccess={onComplete}
              isAddon={false}
              customerEmail={
                getAuth().currentUser?.email || undefined
              }
              customerName={`${firstName || "Magic"} ${
                lastName || "User"
              }`}
              customerId={(() => {
                try {
                  return (
                    localStorage.getItem(
                      "stripeCustomerId"
                    ) || undefined
                  );
                } catch {
                  return undefined;
                }
              })()}
            />
          </Elements>
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