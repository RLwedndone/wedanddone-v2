// src/components/NewYumBuild/CustomVenues/Schnepf/SchnepfCheckOutCatering.tsx
import React, { useEffect, useState, useRef } from "react";
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
import { notifyBooking } from "../../../../utils/email/email";

import type { CuisineId } from "./SchnepfCuisineSelector";
import type { SchnepfMenuSelections } from "./SchnepfMenuBuilderCatering";
import { calcPerGuestPrice, calcChefFee } from "./SchnepfCartCatering";
import generateSchnepfAgreementPDF from "../../../../utils/generateSchnepfAgreementPDF";

// 🔗 Stripe v2 base
const API_BASE = "https://us-central1-wedndonev2.cloudfunctions.net/stripeapiV2";

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) =>
    console.error(
      "[SCH][Global] window.onerror:",
      (e as any)?.error || (e as any)?.message || e
    )
  );
  window.addEventListener("unhandledrejection", (e: any) =>
    console.error("[SCH][Global] unhandledrejection:", e?.reason || e)
  );
}

const LS_CHECKOUT_KEY = "schnepf:checkout";

type CheckoutPayload = {
  amountCents: number;
  plan: "full" | "deposit";
  grandTotalCents?: number;
  lineItems?: string[];
  cuisineId?: string;
  guestCount?: number;
  updatedAt: number;
};

type CardSummary = {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

const CUISINE_LABELS: Record<CuisineId, string> = {
  bbq: "BBQ Dinner",
  taco_bar: "Taco Bar",
  rustic_italian: "Rustic Italian",
  classic_chicken: "Classic Chicken Dinner",
  live_pasta: "Live Action Pasta Bar",
  wood_fired_pizza: "Wood Fired Pizza Bar",
  prime_rib: "Prime Rib",
};

const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
const toPretty = (d: Date) =>
  d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const SALES_TAX_RATE = 0.086;
const SERVICE_FEE_RATE = 0.22;
const TAXES_AND_FEES_RATE = SALES_TAX_RATE + SERVICE_FEE_RATE;

interface Props {
  cuisineId: CuisineId;
  selections: SchnepfMenuSelections;
  guestCount: number;
  cartTotal: number;
  lineItems: string[];
  onBack: () => void;
  onComplete: () => void;
  onClose: () => void;
  isGenerating?: boolean;
}

const SchnepfCheckOutCatering: React.FC<Props> = ({
  cuisineId,
  selections,
  guestCount,
  cartTotal,
  lineItems,
  onBack,
  onComplete,
  onClose,
  isGenerating: isGeneratingFromOverlay = false,
}) => {
  const [localGenerating, setLocalGenerating] = useState(false);
  const isGenerating = localGenerating || isGeneratingFromOverlay;
  const didRunRef = useRef(false);

  useEffect(() => {
    console.log("[SCH][Checkout] MOUNT", {
      cuisineId,
      selections,
      guestCount,
      cartTotal,
      lineItemsLen: lineItems?.length ?? 0,
      isGeneratingFromOverlay,
    });
  }, []);

  // Plan + LS payload
  const rawPlan = (localStorage.getItem("yumPaymentPlan") || "full").toLowerCase();
  const [checkoutPayload, setCheckoutPayload] = useState<CheckoutPayload | null>(null);
  const planFromPayload = checkoutPayload?.plan;
  const resolvedPlan =
    planFromPayload || (rawPlan === "deposit" ? "deposit" : "full");
  const isDeposit = resolvedPlan === "deposit";
  const requiresCardOnFile = isDeposit;

  const effectiveLineItems =
    lineItems && lineItems.length ? lineItems : checkoutPayload?.lineItems ?? [];

  const [weddingDate, setWeddingDate] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("Magic");
  const [lastName, setLastName] = useState<string>("User");

  // Saved card state
  const [savedCardSummary, setSavedCardSummary] = useState<CardSummary | null>(
    null
  );
  const [mode, setMode] = useState<"saved" | "new">("new");
  const hasSavedCard = !!savedCardSummary;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_CHECKOUT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CheckoutPayload;
        if (parsed && typeof parsed.amountCents === "number") {
          setCheckoutPayload(parsed);
          console.log("[SCH][Checkout] LS payload found:", parsed);
        }
      }
    } catch (e) {
      console.warn("[SCH][Checkout] Failed to parse LS payload:", e);
    }

    (async () => {
      const auth = getAuth();
      const user = auth.currentUser;

      const local = localStorage.getItem("yumSelectedDate");
      if (local) setWeddingDate(local);

      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);
          const data = snap.data() || {};
          const fsDate =
            data.weddingDate || data.profileData?.weddingDate || null;
          if (fsDate) {
            setWeddingDate(fsDate);
            try {
              localStorage.setItem("yumSelectedDate", fsDate);
            } catch {}
          }
          setFirstName(data.firstName || "Magic");
          setLastName(data.lastName || "User");
        } catch (e) {
          console.warn("⚠️ Could not fetch user profile:", e);
        }

        try {
          const snapC = await getDoc(
            doc(db, "users", user.uid, "yumYumData", "checkout")
          );
          if (snapC.exists()) {
            const p = snapC.data() as CheckoutPayload;
            if (p && typeof p.amountCents === "number") {
              setCheckoutPayload((cur) => cur ?? p);
              console.log("[SCH][Checkout] FS payload fallback:", p);
            }
          }
        } catch (e) {
          console.warn("[SCH][Checkout] FS payload fetch error:", e);
        }

        // Saved card lookup (Stripe v2)
        try {
          const res = await fetch(`${API_BASE}/payments/get-default`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: user.uid }),
          });

          if (!res.ok) {
            const text = await res.text();
            console.warn(
              "[SCH][Checkout] get-default failed:",
              res.status,
              text
            );
            setSavedCardSummary(null);
            setMode("new");
          } else {
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
          }
        } catch (err) {
          console.warn("[SCH][Checkout] No saved card found:", err);
          setSavedCardSummary(null);
          setMode("new");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedGuestCount =
    guestCount && guestCount > 0
      ? guestCount
      : Number(localStorage.getItem("magicGuestCount")) ||
        Number(localStorage.getItem("yumGuestCount")) ||
        0;

  const perGuest = calcPerGuestPrice(cuisineId, selections);
  const chefFee = calcChefFee(cuisineId, normalizedGuestCount);
  const foodSubtotal = round2(perGuest * normalizedGuestCount);
  const preTax = round2(foodSubtotal + chefFee);
  const taxesAndFees = round2(preTax * TAXES_AND_FEES_RATE);
  const total = round2(preTax + taxesAndFees);

  const finalTotal = cartTotal > 0 ? round2(cartTotal) : total;

  const DEPOSIT_PCT = 0.25;
  const depositFallback = round2(finalTotal * DEPOSIT_PCT);
  const fallbackAmountToday = isDeposit ? depositFallback : finalTotal;

  const payloadAmountToday =
    checkoutPayload && typeof checkoutPayload.amountCents === "number"
      ? round2(checkoutPayload.amountCents / 100)
      : null;

  const amountDueToday = payloadAmountToday ?? fallbackAmountToday;
  const remainingBalance = round2(Math.max(0, finalTotal - amountDueToday));

  const finalDueDateStr = (() => {
    if (!weddingDate)
      return "35 days before your wedding date";
    const base = new Date(`${weddingDate}T12:00:00`);
    base.setDate(base.getDate() - 35);
    return toPretty(base);
  })();

  const signatureImageUrl =
    localStorage.getItem("schnepfCateringSignature") ||
    localStorage.getItem("yumSignature") ||
    "";

  useEffect(() => {
    console.table({
      perGuest,
      chefFee,
      foodSubtotal,
      preTax,
      taxesAndFees,
      finalTotal,
      isDeposit,
      payloadAmountToday: payloadAmountToday ?? "∅",
      fallbackAmountToday,
      amountDueToday,
      remainingBalance,
      weddingDate: weddingDate ?? "∅",
    });
  }, [
    perGuest,
    chefFee,
    foodSubtotal,
    preTax,
    taxesAndFees,
    finalTotal,
    isDeposit,
    payloadAmountToday,
    fallbackAmountToday,
    amountDueToday,
    remainingBalance,
    weddingDate,
  ]);

  const handleSuccess = async ({
    customerId,
  }: {
    customerId?: string;
  } = {}) => {
    if (didRunRef.current) {
      console.warn(
        "[SCH][Checkout] handleSuccess already ran — ignoring re-entry"
      );
      return;
    }
    didRunRef.current = true;

    console.group(
      "%c[SCH][Checkout] onSuccess",
      "color:#22c55e;font-weight:700"
    );
    console.log("[SCH][Checkout] Stripe customerId =", customerId);
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.error("[SCH][Checkout] No authed user");
      console.groupEnd();
      return;
    }

    setLocalGenerating(true);
    console.time("[SCH][Checkout] finalize-total");
    const breaker = setTimeout(() => {
      console.warn(
        "[SCH][Checkout] breaker: clearing local spinner after 20s"
      );
      setLocalGenerating(false);
    }, 20000);

    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const userDoc = snap.data() || {};
      console.log(
        "[SCH][Checkout] userDoc snapshot:",
        userDoc?.firstName,
        userDoc?.lastName
      );

      // (1) Save Stripe customer id
      if (customerId && customerId !== userDoc?.stripeCustomerId) {
        console.time("[SCH][Checkout] update stripeCustomerId");
        await updateDoc(userRef, {
          stripeCustomerId: customerId,
          "stripe.updatedAt": serverTimestamp(),
        });
        console.timeEnd("[SCH][Checkout] update stripeCustomerId");
        try {
          localStorage.setItem("stripeCustomerId", customerId);
        } catch {
          /* ignore */
        }
      }

      // (1b) Ensure default payment method for deposit plan (auto-pay)
      try {
        if (isDeposit) {
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
            "✅ ensure-default-payment-method called for Schnepf catering (deposit plan)"
          );
        } else {
          console.log(
            "ℹ️ Skipping ensure-default-payment-method (Schnepf catering paid in full)."
          );
        }
      } catch (err) {
        console.error(
          "❌ ensure-default-payment-method failed (Schnepf catering):",
          err
        );
      }

      // (2) Route FIRST so the UI doesn't hang — use the NEW linear step
      try {
        localStorage.setItem("yumStep", "schnepfCateringThankYou");
        localStorage.setItem("schnepfJustBookedCatering", "true");
        localStorage.setItem("schnepfCateringBooked", "true");
      } catch {}
      console.log(
        "[SCH][Checkout] Routing to CateringThankYou now via onComplete()"
      );
      onComplete();

      // (3) Fan-out (don’t block)
      setTimeout(() => {
        try {
          window.dispatchEvent(new Event("purchaseMade"));
          window.dispatchEvent(new Event("documentsUpdated"));
          window.dispatchEvent(new Event("cateringCompletedNow"));
        } catch (e) {
          console.warn("[SCH] dispatch events failed:", e);
        }
      }, 800);

      // (4) Resolve guest count
      let guestCountFinal = Number(normalizedGuestCount || 0);
      if (!guestCountFinal) {
        const ls = Number(localStorage.getItem("yumGuestCount") || 0);
        guestCountFinal = ls;
      }
      if (!guestCountFinal) {
        try {
          const { getGuestState } = await import(
            "../../../../utils/guestCountStore"
          );
          const st = await getGuestState();
          guestCountFinal = Number((st as any)?.value || 0);
        } catch {
          /* ignore */
        }
      }

      const prettyDue = finalDueDateStr;
      const remainingBal = round2(Math.max(0, finalTotal - amountDueToday));

      // (5) PDF
      let publicUrl: string | null = null;
      try {
        const pdfBlob = await generateSchnepfAgreementPDF({
          fullName: `${
            userDoc?.firstName || firstName || "Magic"
          } ${userDoc?.lastName || lastName || "User"}`,
          weddingDate: weddingDate || userDoc?.weddingDate || "TBD",
          signatureImageUrl,
          guestCount: guestCountFinal,
          perGuest,
          chefFee,
          taxesAndFees,
          total: finalTotal,
          deposit: isDeposit ? amountDueToday : 0,
          cuisineName: CUISINE_LABELS[cuisineId],
          menuSelections: {
            salads: selections?.salads ?? [],
            mains: selections?.entrees ?? [],
            sides: selections?.sides ?? [],
          },
          paymentSummary: isDeposit
            ? `Deposit today: $${amountDueToday.toFixed(
                2
              )}. Remaining $${remainingBal.toFixed(
                2
              )} due by ${prettyDue}.`
            : `Paid in full today: $${amountDueToday.toFixed(2)}.`,
          lineItems: effectiveLineItems,
        });

        const storage = getStorage(
          app,
          "gs://wedndonev2.firebasestorage.app"
        );
        const filename = `SchnepfCateringAgreement_${Date.now()}.pdf`;
        const fileRef = ref(storage, `public_docs/${user.uid}/${filename}`);
        await uploadBytes(fileRef, pdfBlob);
        publicUrl = await getDownloadURL(fileRef);
      } catch (pdfErr) {
        console.error("[SCH][Checkout] PDF/Upload failed:", pdfErr);
      }

      // (7) Firestore snapshots
      try {
        await setDoc(
          doc(userRef, "pricingSnapshots", "catering"),
          {
            booked: true,
            venueCaterer: "schnepf",
            cuisineId,
            guestCountAtBooking: guestCountFinal,
            perGuest,
            chefFee,
            taxesAndFees,
            totalBooked: finalTotal,
            selections,
            lineItems: effectiveLineItems,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        const amountNow = Number(amountDueToday.toFixed(2));
        const contractTotalRounded = Number(finalTotal.toFixed(2));

        await updateDoc(userRef, {
          ...(publicUrl
            ? {
                documents: arrayUnion({
                  title: "Schnepf Catering Agreement",
                  url: publicUrl,
                  uploadedAt: new Date().toISOString(),
                }),
              }
            : {}),
          "bookings.catering": true,
          weddingDateLocked: true,
          purchases: arrayUnion({
            label: "Schnepf Catering",
            category: "catering",
            boutique: "catering",
            source: "W&D",
            amount: amountNow,
            amountChargedToday: amountNow,
            contractTotal: contractTotalRounded,
            payFull: !isDeposit,
            deposit: amountNow, // amount charged today
            method: isDeposit ? "deposit" : "paid_in_full",
            items: effectiveLineItems,
            date: new Date().toISOString(),
          }),
          spendTotal: increment(amountNow),

          // basic catering totals for Guest Scroll / Budget Wand
          "totals.catering.totalPaid": increment(amountNow),
          "totals.catering.lastPurchaseAt": serverTimestamp(),
          "totals.catering.lastVenueId": "schnepf",
          "totals.catering.lastContractTotal": contractTotalRounded,
          "totals.catering.guestCount": guestCountFinal,

          // 👇 NEW linear progress step
          "progress.yumYum.step": "schnepfCateringThankYou",
        });
        console.log("[SCH][Checkout] Firestore snapshots saved.");

        // 📧 Centralized booking email — Yum Catering @ Schnepf
        try {
          const current = getAuth().currentUser;

          const user_full_name = `${
            userDoc?.firstName || firstName || "Magic"
          } ${userDoc?.lastName || lastName || "User"}`;
          const payment_now = amountDueToday.toFixed(2);
          const remaining_balance = Math.max(0, finalTotal - amountDueToday).toFixed(2);

          await notifyBooking("yum_catering", {
            // who
            user_email: current?.email || "unknown@wedndone.com",
            user_full_name,

            // details
            wedding_date: weddingDate || (userDoc as any)?.weddingDate || "TBD",
            total: finalTotal.toFixed(2),
            line_items: (effectiveLineItems || []).join(", "),

            // pdf info (may be "")
            pdf_url: publicUrl || "",
            pdf_title: "Schnepf Catering Agreement",

            // payment breakdown
            payment_now,
            remaining_balance,
            final_due: finalDueDateStr,

            // UX link + label
            dashboardUrl: `${window.location.origin}${
              import.meta.env.BASE_URL
            }dashboard`,
            product_name: "Schnepf Catering",
          });
        } catch (mailErr) {
          console.error("❌ notifyBooking(yum_catering) failed:", mailErr);
        }
      } catch (fsErr) {
        console.error("[SCH][Checkout] Firestore snapshot/update failed:", fsErr);
      }
    } catch (err) {
      console.error("❌ [SCH][Checkout] finalize error:", err);
    } finally {
      clearTimeout(breaker);
      console.timeEnd("[SCH][Checkout] finalize-total");
      setLocalGenerating(false);
      console.groupEnd();
    }
  };

  if (isGenerating) {
    // Single modal card (no extra overlay) to avoid double darkening
    return (
      <div
        className="pixie-card pixie-card--modal"
        style={{
          maxWidth: 420,
          position: "relative",
        }}
      >
        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/magic_clock.mp4`}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: "100%",
              maxWidth: 320,
              margin: "0 auto 12px",
              display: "block",
              borderRadius: 12,
            }}
          />
          <p
            style={{
              fontSize: "1.05rem",
              color: "#2c62ba",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            Madge is working her magic...
          </p>
        </div>
      </div>
    );
  }

  const summaryText = isDeposit
    ? `Deposit today: $${amountDueToday.toFixed(
        2
      )} (25%). Remaining $${remainingBalance.toFixed(
        2
      )} due by ${finalDueDateStr}.`
    : `Total due today: $${amountDueToday.toFixed(2)}.`;

  // ── Main checkout card (no overlay wrapper) ──
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
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/lock.mp4`}
          autoPlay
          muted
          playsInline
          loop
          style={{
            width: "100%",
            maxWidth: 150,
            margin: "0 auto 12px",
            display: "block",
            borderRadius: 12,
          }}
        />

        <h2
          style={{
            marginBottom: "0.75rem",
            color: "#2c62ba",
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "2rem",
          }}
        >
          Checkout
        </h2>

        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "1rem" }}>{summaryText}</div>
        </div>

        {/* Saved card explainer */}
        <div
          style={{
            margin: "0 auto 16px",
            maxWidth: 520,
            textAlign: "left",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e2e6f0",
            background: "#f7f8ff",
          }}
        >
          {requiresCardOnFile ? (
            hasSavedCard ? (
              <p style={{ margin: 0, fontSize: ".95rem" }}>
                We&apos;ll use your saved card on file for this Schnepf catering
                deposit and future auto-payments —{" "}
                <strong>{savedCardSummary!.brand.toUpperCase()}</strong> ••••{" "}
                {savedCardSummary!.last4} (exp {savedCardSummary!.exp_month}/
                {savedCardSummary!.exp_year}). If you need to change cards
                later, you can update your saved card in your Wed&amp;Done
                account before the next payment.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: ".95rem" }}>
                Enter your card details to start your Schnepf catering plan.
                This card will be saved on file and used for your remaining
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
                  marginBottom: 8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="schnepfCateringPaymentMode"
                  checked={mode === "saved"}
                  onChange={() => setMode("saved")}
                />
                <span>
                  Saved card on file —{" "}
                  <strong>
                    {savedCardSummary!.brand.toUpperCase()}
                  </strong>{" "}
                  •••• {savedCardSummary!.last4} (exp{" "}
                  {savedCardSummary!.exp_month}/{savedCardSummary!.exp_year})
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
                  name="schnepfCateringPaymentMode"
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

        {/* Stripe Elements — comfortably wide */}
        <div className="px-elements" aria-busy={isGenerating}>
          <CheckoutForm
            total={amountDueToday}
            onSuccess={handleSuccess}
            setStepSuccess={onComplete} // overlay nav only; heavy logic stays in handleSuccess
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
            useSavedCard={
              requiresCardOnFile
                ? hasSavedCard
                : hasSavedCard && mode === "saved"
            }
          />
        </div>

        <div
          style={{
            marginTop: "1.25rem",
          }}
        >
          <button
            className="boutique-back-btn"
            style={{
              width: 250,
              padding: "0.75rem 1rem",
              fontSize: "1rem",
            }}
            onClick={onBack}
          >
            ⬅ Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchnepfCheckOutCatering;