// src/components/NewYumBuild/CustomVenues/VicandVerrado/VicVerradoDessertCheckout.tsx
import React, { useRef, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "../../../../CheckoutForm";
import { stripePromise } from "../../../../utils/stripePromise";

import { getAuth } from "firebase/auth";
import {
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  setDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db, app } from "../../../../firebase/firebaseConfig";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import generateDessertAgreementPDF from "../../../../utils/generateDessertAgreementPDF";
import type { VicVerradoStep } from "./VicVerradoOverlay";

// Helpers
const MS_DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

const parseLocalYMD = (ymd?: string | null): Date | null =>
  !ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)
    ? null
    : new Date(`${ymd}T12:00:00`);

const asStartOfDayUTC = (d: Date) =>
  new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      0,
      0,
      1
    )
  );

function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
}

function firstMonthlyChargeAtUTC(from = new Date()): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const dt = new Date(
    Date.UTC(y, m + 1, d, 0, 0, 1)
  );
  return dt.toISOString();
}

// Props
interface VicVerradoDessertCheckoutProps {
  total: number; // contract total (backup if LS is missing)
  guestCount: number;
  selectedStyle: string;
  selectedFlavorCombo: string;
  paymentSummaryText: string;
  lineItems: string[];
  signatureImage: string | null;
  onBack: () => void;
  onClose: () => void;
  isGenerating: boolean;
  setStep: (step: VicVerradoStep) => void;
  bookings?: { catering?: boolean; dessert?: boolean };
}

const VicVerradoDessertCheckout: React.FC<
  VicVerradoDessertCheckoutProps
> = ({
  total,
  guestCount,
  selectedStyle,
  selectedFlavorCombo,
  paymentSummaryText,
  lineItems,
  signatureImage,
  onBack,
  onClose,
  isGenerating: isGeneratingFromOverlay,
  setStep,
}) => {
  const [localGenerating, setLocalGenerating] =
    useState(false);
  const isGenerating =
    localGenerating || isGeneratingFromOverlay;
  const didRunRef = useRef(false);

  // Plan selections saved on the contract screen
  const DEPOSIT_PCT = 0.25;

  const totalEffective = round2(
    Number(localStorage.getItem("yumTotal")) ||
      Number(localStorage.getItem("vvTotal")) ||
      Number(total) ||
      0
  );

  const planKey = (localStorage.getItem(
    "yumPaymentPlan"
  ) ||
    localStorage.getItem("yumPayPlan") ||
    localStorage.getItem("vvPaymentPlan") ||
    "full") as "full" | "monthly";

  const usingFull = planKey === "full";

  const depositAmount = round2(
    Number(localStorage.getItem("yumDepositAmount")) ||
      Number(
        localStorage.getItem(
          "vvDepositAmount"
        )
      ) ||
      totalEffective * DEPOSIT_PCT
  );

  const remainingBalance = round2(
    Number(
      localStorage.getItem(
        "yumRemainingBalance"
      )
    ) ||
      Number(
        localStorage.getItem(
          "vvRemainingBalance"
        )
      ) ||
      Math.max(
        0,
        totalEffective - depositAmount
      )
  );

  const planMonths =
    Number(
      localStorage.getItem(
        "yumPlanMonths"
      )
    ) ||
    Number(
      localStorage.getItem(
        "vvPlanMonths"
      )
    ) ||
    0;

  const perMonth =
    (Number(
      localStorage.getItem(
        "yumPerMonthCents"
      )
    ) ||
      Number(
        localStorage.getItem(
          "vvPerMonthCents"
        )
      ) ||
      0) / 100;

  const finalDuePretty =
    localStorage.getItem(
      "yumFinalDuePretty"
    ) ||
    localStorage.getItem(
      "vvFinalDuePretty"
    ) ||
    "35 days before your wedding date";

  // What we actually charge right now
  const amountDueToday = usingFull
    ? totalEffective
    : depositAmount;

  // ===================== SUCCESS FLOW =====================
  // finalize purchase, upload PDF, drive UI to Dessert TY
  const handleSuccess = async (): Promise<void> => {
    if (didRunRef.current) {
      console.warn(
        "[VicVerradoDessertCheckout] handleSuccess already ran — ignoring re-entry"
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
      const userDoc = snap.exists()
        ? (snap.data() as any)
        : {};
      const fullName = `${userDoc?.firstName || "Magic"} ${
        userDoc?.lastName || "User"
      }`;
      const weddingYMD: string | null =
        userDoc?.weddingDate || null;

      // Final due date = wedding - 35 days
      const wedding = parseLocalYMD(
        weddingYMD || ""
      );
      const finalDueDate = wedding
        ? new Date(
            wedding.getTime() - 35 * MS_DAY
          )
        : null;

      const finalDueISO = finalDueDate
        ? asStartOfDayUTC(
            finalDueDate
          ).toISOString()
        : null;

      const finalDueDateStr = finalDueDate
        ? finalDueDate.toLocaleDateString(
            "en-US",
            {
              year: "numeric",
              month: "long",
              day: "numeric",
            }
          )
        : "35 days before your wedding date";

      // Build monthly plan (even split; tail gets remainder)
      let mths = 0;
      let perMonthCents = 0;
      let lastPaymentCents = 0;
      let nextChargeAtISO: string | null =
        null;

      if (
        !usingFull &&
        finalDueDate &&
        remainingBalance > 0
      ) {
        mths = monthsBetweenInclusive(
          new Date(),
          finalDueDate
        );
        const remainingCents = Math.round(
          remainingBalance * 100
        );
        const base = Math.floor(
          remainingCents /
            Math.max(1, mths)
        );
        const tail =
          remainingCents -
          base * Math.max(0, mths - 1);
        perMonthCents = base;
        lastPaymentCents = tail;
        nextChargeAtISO =
          firstMonthlyChargeAtUTC(
            new Date()
          );
      }

      // Firestore: mark dessert booked and persist plan snapshot
      await setDoc(
        userRef,
        {
          bookings: {
            ...(userDoc?.bookings ||
              {}),
            dessert: true,
          },
          vvDessertsBooked: true,
          weddingDateLocked: true,
          yumDessertStyle:
            selectedStyle,
          yumDessertFlavorCombo:
            selectedFlavorCombo,
          yumDessertGuestCount:
            guestCount,
          lastPurchaseAt:
            serverTimestamp(),
        },
        { merge: true }
      );

      try {
        localStorage.setItem(
          "vvJustBookedDessert",
          "true"
        );
        localStorage.setItem(
          "vvDessertsBooked",
          "true"
        );
        localStorage.setItem(
          "vvYumStep",
          "vicVerradoDessertThankYou"
        );
        localStorage.setItem(
          "yumStep",
          "vicVerradoDessertThankYou"
        );
      } catch {}

      // Purchases entry
      const purchaseEntry = {
        label: "Yum Yum Desserts",
        category: "dessert",
        boutique: "dessert",
        source: "W&D",
        amount: Number(
          amountDueToday.toFixed(2)
        ),
        amountChargedToday: Number(
          amountDueToday.toFixed(2)
        ),
        contractTotal: Number(
          totalEffective.toFixed(2)
        ),
        payFull: usingFull,
        deposit: usingFull
          ? 0
          : Number(
              amountDueToday.toFixed(
                2
              )
            ),
        monthlyAmount: usingFull
          ? 0
          : +perMonth.toFixed(2),
        months: usingFull ? 0 : mths,
        method: usingFull
          ? "paid_in_full"
          : "deposit",
        items: lineItems,
        date: new Date().toISOString(),
      };

      await updateDoc(userRef, {
        purchases:
          arrayUnion(
            purchaseEntry
          ),
        spendTotal: increment(
          Number(
            amountDueToday.toFixed(
              2
            )
          )
        ),
        paymentPlan: {
          product: "dessert",
          type: usingFull
            ? "paid_in_full"
            : "deposit",
          total: totalEffective,
          depositPercent: usingFull
            ? 1
            : 0.25,
          paidNow: amountDueToday,
          remainingBalance:
            usingFull
              ? 0
              : remainingBalance,
          finalDueDate:
            finalDueDateStr,
          finalDueAt:
            finalDueISO,
          createdAt:
            new Date().toISOString(),
        },
        paymentPlanAuto: {
          version: 1,
          product: "dessert",
          status: usingFull
            ? "complete"
            : remainingBalance > 0
            ? "active"
            : "complete",
          strategy: usingFull
            ? "paid_in_full"
            : "monthly_until_final",
          currency: "usd",
          totalCents: Math.round(
            totalEffective * 100
          ),
          depositCents: Math.round(
            (usingFull
              ? 0
              : amountDueToday) * 100
          ),
          remainingCents: Math.round(
            (usingFull
              ? 0
              : remainingBalance) * 100
          ),
          planMonths: usingFull
            ? 0
            : mths,
          perMonthCents: usingFull
            ? 0
            : Math.round(
                perMonth * 100
              ),
          lastPaymentCents: usingFull
            ? 0
            : lastPaymentCents,
          nextChargeAt: usingFull
            ? null
            : nextChargeAtISO,
          finalDueAt:
            finalDueISO,
          stripeCustomerId:
            localStorage.getItem(
              "stripeCustomerId"
            ) || null,
          createdAt:
            new Date().toISOString(),
          updatedAt:
            new Date().toISOString(),
        },
        // 👇 pin linear TY step
        "progress.yumYum.step":
          "vicVerradoDessertThankYou",
      });

      // Build PDF
      const signatureImageUrl =
        signatureImage ||
        localStorage.getItem(
          "vvDessertSignature"
        ) ||
        localStorage.getItem(
          "yumSignature"
        ) ||
        "";

      const pdfBlob =
        await generateDessertAgreementPDF({
          fullName,
          total:
            totalEffective,
          deposit:
            amountDueToday,
          guestCount,
          weddingDate:
            weddingYMD ||
            "TBD",
          signatureImageUrl,
          paymentSummary:
            paymentSummaryText ||
            (usingFull
              ? `You're paying $${amountDueToday.toFixed(
                  2
                )} today.`
              : `You're paying $${amountDueToday.toFixed(
                  2
                )} today, then ${mths} monthly payments of about $${(
                  perMonthCents / 100
                ).toFixed(
                  2
                )} (final due ${finalDueDateStr}).`),
          selectedStyle,
          selectedFlavorCombo,
          lineItems,
        });

      // Upload PDF
      const storage = getStorage(
        app,
        "gs://wedndonev2.firebasestorage.app"
      );
      const filename = `YumDessertAgreement_${Date.now()}.pdf`;
      const fileRef = ref(
        storage,
        `public_docs/${user.uid}/${filename}`
      );
      await uploadBytes(fileRef, pdfBlob);
      const publicUrl = await getDownloadURL(
        fileRef
      );

      await updateDoc(userRef, {
        documents: arrayUnion({
          title:
            "Yum Yum Dessert Agreement",
          url: publicUrl,
          uploadedAt:
            new Date().toISOString(),
        }),
      });

      // Update local steps + UI wizard
      const nextStep: VicVerradoStep =
        "vicVerradoDessertThankYou";
      try {
        localStorage.setItem(
          "vvYumStep",
          nextStep
        );
        localStorage.setItem(
          "yumStep",
          nextStep
        );
      } catch {}

      // clear spinner, push overlay to TY
      setLocalGenerating(false);
      setStep(nextStep);

      // Fan-out events (Budget Wand, docs, etc.)
      window.dispatchEvent(
        new Event("purchaseMade")
      );
      window.dispatchEvent(
        new Event("dessertCompletedNow")
      );
      window.dispatchEvent(
        new CustomEvent(
          "bookingsChanged",
          {
            detail: {
              dessert: true,
            },
          }
        )
      );
      window.dispatchEvent(
        new Event("documentsUpdated")
      );
    } catch (err) {
      console.error(
        "❌ [VV][DessertCheckout] finalize error:",
        err
      );
      setLocalGenerating(false);
    }
  };

  // ===================== RENDER =====================

  // Spinner state
  if (isGenerating) {
    return (
      <div
        className="pixie-card pixie-card--modal"
        style={{ maxWidth: 700 }}
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
          style={{ textAlign: "center" }}
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
          <h3
            className="px-title"
            style={{
              margin: 0,
              color: "#2c62ba",
            }}
          >
            Madge is icing your cake... one
            sec!
          </h3>

          <div style={{ marginTop: 12 }}>
            <button
              className="boutique-back-btn"
              style={{
                width: 250,
              }}
              onClick={onBack}
              disabled
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal checkout card
  return (
    <div
      className="pixie-card pixie-card--modal"
      style={{ maxWidth: 700 }}
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
        style={{ textAlign: "center" }}
      >
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
            fontFamily:
              "'Jenna Sue', cursive",
            fontSize: "1.9rem",
            marginBottom: 8,
            textAlign: "center",
            color: "#2c62ba",
          }}
        >
          Dessert Checkout
        </h2>

        <div
          className="px-prose-narrow"
          style={{
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0 }}>
            {usingFull ? (
              <>
                You're paying{" "}
                <strong>
                  $
                  {amountDueToday.toFixed(
                    2
                  )}
                </strong>{" "}
                today.
              </>
            ) : (
              <>
                You're paying{" "}
                <strong>
                  $
                  {amountDueToday.toFixed(
                    2
                  )}
                </strong>{" "}
                today, then{" "}
                {planMonths} monthly
                payments of about{" "}
                <strong>
                  $
                  {perMonth.toFixed(
                    2
                  )}
                </strong>{" "}
                (final due{" "}
                {finalDuePretty}
                ).
              </>
            )}
          </p>
        </div>

        {/* Stripe Elements — nice wide form container */}
        <div className="px-elements">
          <Elements stripe={stripePromise}>
            <CheckoutForm
              total={amountDueToday}
              onSuccess={handleSuccess}
              setStepSuccess={() => {
                /* Step advanced in handleSuccess */
              }}
            />
          </Elements>
        </div>

        {/* Back */}
        <div
          style={{
            marginTop: 16,
            textAlign: "center",
          }}
        >
          <button
            className="boutique-back-btn"
            style={{ width: 250 }}
            onClick={onBack}
          >
            ⬅ Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default VicVerradoDessertCheckout;