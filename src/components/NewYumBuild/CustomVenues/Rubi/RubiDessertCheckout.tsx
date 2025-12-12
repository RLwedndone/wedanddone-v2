// src/components/NewYumBuild/CustomVenues/Rubi/RubiDessertCheckout.tsx
import React, { useState, useEffect, useRef } from "react";
import CheckoutForm from "../../../../CheckoutForm";

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

import { notifyBooking } from "../../../../utils/email/email";

// 🔗 Stripe v2 base
const API_BASE =
  "https://us-central1-wedndonev2.cloudfunctions.net/stripeapiV2";

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
  const dt = new Date(Date.UTC(y, m + 1, d, 0, 0, 1));
  return dt.toISOString();
}

type CardSummary = {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

interface RubiDessertCheckoutProps {
  total: number;
  guestCount: number;
  selectedStyle: string;
  selectedFlavorCombo: string;
  paymentSummaryText: string;
  lineItems: string[];
  signatureImage: string | null;
  onBack: () => void;
  onClose: () => void;
  isGenerating: boolean;
  setStep: (step: any) => void;
  bookings?: { catering?: boolean; dessert?: boolean };
}

const RubiDessertCheckout: React.FC<RubiDessertCheckoutProps> = ({
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
  const [localGenerating, setLocalGenerating] = useState(false);
  const isGenerating = localGenerating || isGeneratingFromOverlay;
  const didRunRef = useRef(false);

  const [checkoutName, setCheckoutName] = useState("Magic User");

  useEffect(() => {
    (async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        const data = snap.exists() ? (snap.data() as any) : {};
        const safeFirst = data?.firstName || "Magic";
        const safeLast = data?.lastName || "User";
        setCheckoutName(`${safeFirst} ${safeLast}`);
      } catch {
        /* ignore name load errors */
      }
    })();
  }, []);

  const DEPOSIT_PCT = 0.25;

  const totalEffective = round2(
    Number(localStorage.getItem("yumTotal")) || Number(total) || 0
  );

  const planKey = (localStorage.getItem("yumPaymentPlan") ||
    localStorage.getItem("yumPayPlan") ||
    "full") as "full" | "monthly";

  const usingFull = planKey === "full";
  const requiresCardOnFile = !usingFull;

  const depositAmount = round2(
    Number(localStorage.getItem("yumDepositAmount")) ||
      totalEffective * DEPOSIT_PCT
  );

  const remainingBalance = round2(
    Number(localStorage.getItem("yumRemainingBalance")) ||
      Math.max(0, totalEffective - depositAmount)
  );

  const planMonths =
    Number(localStorage.getItem("yumPlanMonths")) || 0;
  const perMonth =
    (Number(localStorage.getItem("yumPerMonthCents")) || 0) / 100;

  const finalDuePretty =
    localStorage.getItem("yumFinalDuePretty") ||
    "35 days before your wedding date";

  const amountDueToday = usingFull ? totalEffective : depositAmount;

  const paymentMessage = usingFull
    ? `You're paying $${Number(amountDueToday).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} today.`
    : `You're paying $${amountDueToday.toFixed(
        2
      )} today, then ${planMonths} monthly payments of about $${perMonth.toFixed(
        2
      )} (final due ${finalDuePretty}).`;

  // Saved card state
  const [savedCardSummary, setSavedCardSummary] =
    useState<CardSummary | null>(null);
  const [mode, setMode] = useState<"saved" | "new">("new");
  const hasSavedCard = !!savedCardSummary;

  useEffect(() => {
    (async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      try {
        const res = await fetch(`${API_BASE}/payments/get-default`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: user.uid }),
        });

        if (!res.ok) {
          const text = await res.text();
          console.warn(
            "[RubiDessertCheckout] get-default failed:",
            res.status,
            text
          );
          setSavedCardSummary(null);
          setMode("new");
          return;
        }

        const data = await res.json();
        if (
          data?.card &&
          data.card.brand &&
          data.card.last4 &&
          data.card.exp_month &&
          data.card.exp_year
        ) {
          setSavedCardSummary({
            brand: data.card.brand,
            last4: data.card.last4,
            exp_month: data.card.exp_month,
            exp_year: data.card.exp_year,
          });
          setMode("saved");
        } else {
          setSavedCardSummary(null);
          setMode("new");
        }
      } catch (err) {
        console.warn(
          "[RubiDessertCheckout] No saved card found:",
          err
        );
        setSavedCardSummary(null);
        setMode("new");
      }
    })();
  }, []);

  const handleSuccess = async ({
    customerId,
  }: { customerId?: string } = {}) => {
    if (didRunRef.current) {
      console.warn(
        "[RubiDessertCheckout] handleSuccess already ran — ignoring re-entry"
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
      const userDoc = snap.exists() ? (snap.data() as any) : {};
      const safeFirst = userDoc?.firstName || "Magic";
      const safeLast = userDoc?.lastName || "User";
      const fullName = `${safeFirst} ${safeLast}`;
      const weddingYMD: string | null = userDoc?.weddingDate || null;

      // store stripeCustomerId for later auto-pay pulls
      try {
        if (customerId && customerId !== userDoc?.stripeCustomerId) {
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
      } catch (e) {
        console.warn("⚠️ Could not save stripeCustomerId:", e);
      }

      // Ensure default PM for off-session charges when on a dessert plan
      try {
        if (!usingFull) {
          await fetch(`${API_BASE}/ensure-default-payment-method`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerId:
                customerId || localStorage.getItem("stripeCustomerId"),
              firebaseUid: user.uid,
            }),
          });
          console.log(
            "✅ ensure-default-payment-method called for Rubi dessert"
          );
        } else {
          console.log(
            "ℹ️ Skipping ensure-default-payment-method (Rubi dessert paid in full)."
          );
        }
      } catch (err) {
        console.error(
          "❌ ensure-default-payment-method failed (Rubi dessert):",
          err
        );
      }

      const wedding = parseLocalYMD(weddingYMD || "");
      const finalDueDate = wedding
        ? new Date(wedding.getTime() - 35 * MS_DAY)
        : null;
      const finalDueISO = finalDueDate
        ? asStartOfDayUTC(finalDueDate).toISOString()
        : null;
      const finalDueDateStr = finalDueDate
        ? finalDueDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "35 days before your wedding date";

      let mths = 0;
      let perMonthCents = 0;
      let lastPaymentCents = 0;
      let nextChargeAtISO: string | null = null;

      if (!usingFull && finalDueDate && remainingBalance > 0) {
        mths = monthsBetweenInclusive(new Date(), finalDueDate);
        const remainingCents = Math.round(remainingBalance * 100);
        const base = Math.floor(remainingCents / Math.max(1, mths));
        const tail = remainingCents - base * Math.max(0, mths - 1);
        perMonthCents = base;
        lastPaymentCents = tail;
        nextChargeAtISO = firstMonthlyChargeAtUTC(new Date());
      }

      const amountDueTodayRounded = Number(
        amountDueToday.toFixed(2)
      );
      const contractTotalRounded = Number(
        totalEffective.toFixed(2)
      );
      const perMonthDollars = usingFull
        ? 0
        : round2(perMonthCents / 100);

      await setDoc(
        userRef,
        {
          bookings: {
            ...(userDoc?.bookings || {}),
            dessert: true,
          },
          rubiDessertsBooked: true,
          weddingDateLocked: true,
          yumDessertStyle: selectedStyle,
          yumDessertFlavorCombo: selectedFlavorCombo,
          yumDessertGuestCount: guestCount,
          lastPurchaseAt: serverTimestamp(),
        },
        { merge: true }
      );

      try {
        localStorage.setItem("rubiJustBookedDessert", "true");
        localStorage.setItem("rubiDessertsBooked", "true");
        localStorage.setItem("yumStep", "rubiDessertThankYou");
      } catch {
        /* ignore */
      }

      const purchaseEntry = {
        label: "Yum Yum Desserts",
        category: "dessert",
        boutique: "dessert",
        source: "W&D",
        amount: amountDueTodayRounded,
        amountChargedToday: amountDueTodayRounded,
        contractTotal: contractTotalRounded,
        payFull: usingFull,
        deposit: usingFull ? 0 : amountDueTodayRounded,
        monthlyAmount: usingFull ? 0 : perMonthDollars,
        months: usingFull ? 0 : mths,
        method: usingFull ? "paid_in_full" : "deposit",
        items: lineItems,
        date: new Date().toISOString(),
      };

      const totalCents = Math.round(totalEffective * 100);
      const depositCents = Math.round(
        (usingFull ? 0 : amountDueToday) * 100
      );
      const remainingCents = Math.round(
        (usingFull ? 0 : remainingBalance) * 100
      );

      await updateDoc(userRef, {
        purchases: arrayUnion(purchaseEntry),
        spendTotal: increment(amountDueTodayRounded),

        // 🔹 normalized dessert totals for guest scroll / Budget Wand
        "totals.dessert.contractTotal": contractTotalRounded,
        "totals.dessert.amountPaid": increment(
          amountDueTodayRounded
        ),
        "totals.dessert.guestCountAtBooking": guestCount,
        "totals.dessert.perGuest":
          guestCount > 0
            ? round2(contractTotalRounded / guestCount)
            : 0,
        "totals.dessert.venueSlug": "rubi",
        "totals.dessert.style": selectedStyle || null,
        "totals.dessert.flavorCombo":
          selectedFlavorCombo || null,
        "totals.dessert.lastUpdatedAt":
          new Date().toISOString(),

        // 🔹 human-readable dessert plan snapshot
        paymentPlanDessert: usingFull
          ? {
              product: "dessert_rubi",
              type: "paid_in_full",
              total: contractTotalRounded,
              depositPercent: 1,
              paidNow: contractTotalRounded,
              remainingBalance: 0,
              finalDueDate: null,
              finalDueAt: null,
              createdAt: new Date().toISOString(),
            }
          : {
              product: "dessert_rubi",
              type: "deposit",
              total: contractTotalRounded,
              depositPercent: 0.25,
              paidNow: amountDueTodayRounded,
              remainingBalance: round2(
                contractTotalRounded - amountDueTodayRounded
              ),
              finalDueDate: finalDueDateStr,
              finalDueAt: finalDueISO,
              createdAt: new Date().toISOString(),
            },

        // 🔹 robot-friendly dessert auto-pay snapshot
        paymentPlanDessertAuto: {
          version: 1,
          product: "dessert_rubi",
          status: usingFull
            ? "complete"
            : remainingBalance > 0
            ? "active"
            : "complete",
          strategy: usingFull
            ? "paid_in_full"
            : "monthly_until_final",
          currency: "usd",

          totalCents,
          depositCents,
          remainingCents,

          planMonths: usingFull ? 0 : mths,
          perMonthCents: usingFull ? 0 : perMonthCents,
          lastPaymentCents: usingFull ? 0 : lastPaymentCents,

          nextChargeAt: usingFull ? null : nextChargeAtISO,
          finalDueAt: finalDueISO,

          stripeCustomerId:
            customerId ||
            localStorage.getItem("stripeCustomerId") ||
            null,

          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },

        "progress.yumYum.step": "rubiDessertThankYou",
      });

      // 🔹 Dessert pricing snapshot for guest-count delta math
      await setDoc(
        doc(userRef, "pricingSnapshots", "dessert"),
        {
          booked: true,
          guestCountAtBooking: guestCount,
          totalBooked: Number(totalEffective.toFixed(2)),
          perGuest:
            guestCount > 0
              ? Number(
                  (totalEffective / guestCount).toFixed(2)
                )
              : 0,
          venueId: "rubi",
          style: selectedStyle || null,
          flavorCombo: selectedFlavorCombo || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const signatureImageUrl =
        signatureImage ||
        localStorage.getItem("rubiDessertSignature") ||
        localStorage.getItem("yumSignature") ||
        "";

      const pdfBlob = await generateDessertAgreementPDF({
        fullName,
        total: totalEffective,
        deposit: amountDueToday,
        guestCount,
        weddingDate: weddingYMD || "TBD",
        signatureImageUrl,
        paymentSummary:
          paymentSummaryText ||
          (usingFull
            ? `You're paying $${Number(
                amountDueToday
              ).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} today.`
            : `You're paying $${amountDueToday.toFixed(
                2
              )} today, then ${mths} monthly payments of about $${(
                perMonthCents / 100
              ).toFixed(2)} (final due ${finalDueDateStr}).`),
        selectedStyle,
        selectedFlavorCombo,
        lineItems,
      });

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
      const publicUrl = await getDownloadURL(fileRef);

      await updateDoc(userRef, {
        documents: arrayUnion({
          title: "Yum Yum Dessert Agreement",
          url: publicUrl,
          uploadedAt: new Date().toISOString(),
        }),
      });

      // 📧 Centralized booking email — Yum Dessert @ Rubi
      try {
        const current = getAuth().currentUser;

        const user_full_name =
          checkoutName || fullName || "Magic User";
        const payment_now = amountDueToday.toFixed(2);
        const remaining_balance = (
          usingFull ? 0 : Math.max(0, totalEffective - amountDueToday)
        ).toFixed(2);

        await notifyBooking("yum_dessert", {
          // who
          user_email:
            current?.email ||
            (userDoc?.email as string) ||
            "unknown@wedndone.com",
          user_full_name,

          // details
          wedding_date:
            typeof weddingYMD === "string" && weddingYMD
              ? weddingYMD
              : "TBD",
          total: totalEffective.toFixed(2),
          line_items: (lineItems || []).join(", "),

          // pdf info
          pdf_url: publicUrl || "",
          pdf_title: "Yum Yum Dessert Agreement",

          // payment breakdown
          payment_now,
          remaining_balance,
          final_due: finalDueDateStr,

          // UX link + label
          dashboardUrl: `${window.location.origin}${
            import.meta.env.BASE_URL
          }dashboard`,
          product_name: "Rubi Dessert",
        });
      } catch (mailErr) {
        console.error(
          "❌ notifyBooking(yum_dessert) failed:",
          mailErr
        );
      }

      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("dessertCompletedNow"));
      window.dispatchEvent(
        new CustomEvent("bookingsChanged", {
          detail: { dessert: true },
        })
      );
      window.dispatchEvent(new Event("documentsUpdated"));

      setStep("rubiDessertThankYou");
    } catch (err) {
      console.error(
        "❌ [Rubi][DessertCheckout] finalize error:",
        err
      );
    } finally {
      setLocalGenerating(false);
    }
  };

  // ========== Spinner mode ==========
  if (isGenerating) {
    return (
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
            src={`${import.meta.env.BASE_URL}assets/videos/magic_clock.mp4`}
            autoPlay
            loop
            muted
            playsInline
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
            style={{ margin: 0, color: "#2c62ba" }}
          >
            Madge is icing your cake... one sec!
          </h3>
        </div>
      </div>
    );
  }

  // ========== Main checkout card ==========
  return (
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
            textAlign: "center",
          }}
        >
          Dessert Checkout
        </h2>

        <p
          className="px-prose-narrow"
          style={{ marginBottom: 16, textAlign: "center" }}
        >
          {paymentMessage}
        </p>

        {/* Saved card toggle + Stripe form */}
        <div className="px-elements">
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #e2e6f0",
              background: "#f7f8ff",
            }}
          >
            {requiresCardOnFile ? (
              hasSavedCard ? (
                <p
                  style={{
                    fontSize: ".95rem",
                    margin: 0,
                    textAlign: "left",
                  }}
                >
                  We&apos;ll use your saved card on file for this
                  Rubi dessert plan —{" "}
                  <strong>
                    {savedCardSummary!.brand.toUpperCase()}
                  </strong>{" "}
                  •••• {savedCardSummary!.last4} (exp{" "}
                  {savedCardSummary!.exp_month}/
                  {savedCardSummary!.exp_year}). If you need to
                  change cards later, you can update your saved
                  card in your Wed&amp;Done account before the
                  next payment.
                </p>
              ) : (
                <p
                  style={{
                    fontSize: ".95rem",
                    margin: 0,
                    textAlign: "left",
                  }}
                >
                  Enter your card details to start your Rubi
                  dessert plan. This card will be saved on file
                  and used for your monthly payments and final
                  balance.
                </p>
              )
            ) : hasSavedCard ? (
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
                    name="rubiDessertPaymentMode"
                    checked={mode === "saved"}
                    onChange={() => setMode("saved")}
                  />
                  <span>
                    Saved card on file —{" "}
                    <strong>
                      {savedCardSummary!.brand.toUpperCase()}
                    </strong>{" "}
                    •••• {savedCardSummary!.last4} (exp{" "}
                    {savedCardSummary!.exp_month}/
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
                    name="rubiDessertPaymentMode"
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
                  cursor: "default",
                }}
              >
                <input type="radio" checked readOnly />
                <span>Enter your card details</span>
              </label>
            )}
          </div>

          <CheckoutForm
            total={amountDueToday}
            onSuccess={handleSuccess}
            setStepSuccess={() => {
              /* we advance to TY in handleSuccess */
            }}
            isAddon={false}
            customerEmail={getAuth().currentUser?.email || undefined}
            customerName={checkoutName}
            customerId={(() => {
              try {
                return (
                  localStorage.getItem("stripeCustomerId") ||
                  undefined
                );
              } catch {
                return undefined;
              }
            })()}
            useSavedCard={
              requiresCardOnFile
                ? hasSavedCard
                : hasSavedCard && mode === "saved"
            }
          />
        </div>

        <div
          style={{ marginTop: "1rem", textAlign: "center" }}
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

export default RubiDessertCheckout;