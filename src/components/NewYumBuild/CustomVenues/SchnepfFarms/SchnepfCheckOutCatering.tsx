// src/components/NewYumBuild/CustomVenues/Schnepf/SchnepfCheckOutCatering.tsx
import React, { useEffect, useState } from "react";
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
import emailjs from "emailjs-com";

import type { CuisineId } from "./SchnepfCuisineSelector";
import type { SchnepfMenuSelections } from "./SchnepfMenuBuilderCatering";
import { calcPerGuestPrice, calcChefFee } from "./SchnepfCartCatering";
import generateSchnepfAgreementPDF from "../../../../utils/generateSchnepfAgreementPDF";

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) =>
    console.error(
      "[SCH][Global] window.onerror:",
      (e as any)?.error || e?.message || e
    )
  );
  window.addEventListener("unhandledrejection", (e: any) =>
    console.error(
      "[SCH][Global] unhandledrejection:",
      e?.reason || e
    )
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
const TAXES_AND_FEES_RATE =
  SALES_TAX_RATE + SERVICE_FEE_RATE;

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
  const [localGenerating, setLocalGenerating] =
    useState(false);
  const isGenerating =
    localGenerating || isGeneratingFromOverlay;

  useEffect(() => {
    console.log("[SCH][Checkout] MOUNT", {
      cuisineId,
      selections,
      guestCount,
      cartTotal,
      lineItemsLen:
        lineItems?.length ?? 0,
      isGeneratingFromOverlay,
    });
  }, []);

  const rawPlan = (
    localStorage.getItem("yumPaymentPlan") ||
    "full"
  ).toLowerCase();
  const [checkoutPayload, setCheckoutPayload] =
    useState<CheckoutPayload | null>(null);
  const planFromPayload =
    checkoutPayload?.plan;
  const resolvedPlan =
    planFromPayload ||
    (rawPlan === "deposit"
      ? "deposit"
      : "full");
  const isDeposit = resolvedPlan === "deposit";

  const effectiveLineItems =
    lineItems && lineItems.length
      ? lineItems
      : checkoutPayload?.lineItems ?? [];

  const [weddingDate, setWeddingDate] =
    useState<string | null>(null);
  const [firstName, setFirstName] =
    useState<string>("Magic");
  const [lastName, setLastName] =
    useState<string>("User");

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(
          LS_CHECKOUT_KEY
        );
      if (raw) {
        const parsed =
          JSON.parse(
            raw
          ) as CheckoutPayload;
        if (
          parsed &&
          typeof parsed.amountCents ===
            "number"
        ) {
          setCheckoutPayload(parsed);
          console.log(
            "[SCH][Checkout] LS payload found:",
            parsed
          );
        }
      }
    } catch (e) {
      console.warn(
        "[SCH][Checkout] Failed to parse LS payload:",
        e
      );
    }

    (async () => {
      const auth = getAuth();
      const user = auth.currentUser;

      const local =
        localStorage.getItem(
          "yumSelectedDate"
        );
      if (local)
        setWeddingDate(local);

      if (user) {
        try {
          const userRef = doc(
            db,
            "users",
            user.uid
          );
          const snap = await getDoc(
            userRef
          );
          const data = snap.data() || {};
          const fsDate =
            data.weddingDate ||
            data.profileData
              ?.weddingDate ||
            null;
          if (fsDate) {
            setWeddingDate(fsDate);
            try {
              localStorage.setItem(
                "yumSelectedDate",
                fsDate
              );
            } catch {}
          }
          setFirstName(
            data.firstName ||
              "Magic"
          );
          setLastName(
            data.lastName ||
              "User"
          );
        } catch (e) {
          console.warn(
            "⚠️ Could not fetch user profile:",
            e
          );
        }

        try {
          const snapC = await getDoc(
            doc(
              db,
              "users",
              user.uid,
              "yumYumData",
              "checkout"
            )
          );
          if (snapC.exists()) {
            const p =
              snapC.data() as CheckoutPayload;
            if (
              p &&
              typeof p.amountCents ===
                "number"
            ) {
              setCheckoutPayload(
                (cur) => cur ?? p
              );
              console.log(
                "[SCH][Checkout] FS payload fallback:",
                p
              );
            }
          }
        } catch (e) {
          console.warn(
            "[SCH][Checkout] FS payload fetch error:",
            e
          );
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedGuestCount =
    guestCount && guestCount > 0
      ? guestCount
      : Number(
          localStorage.getItem(
            "magicGuestCount"
          )
        ) ||
        Number(
          localStorage.getItem(
            "yumGuestCount"
          )
        ) ||
        0;

  const perGuest =
    calcPerGuestPrice(
      cuisineId,
      selections
    );
  const chefFee = calcChefFee(
    cuisineId,
    normalizedGuestCount
  );
  const foodSubtotal = round2(
    perGuest * normalizedGuestCount
  );
  const preTax = round2(
    foodSubtotal + chefFee
  );
  const taxesAndFees = round2(
    preTax * TAXES_AND_FEES_RATE
  );
  const total = round2(
    preTax + taxesAndFees
  );

  const finalTotal =
    cartTotal > 0
      ? round2(cartTotal)
      : total;

  const DEPOSIT_PCT = 0.25;
  const depositFallback = round2(
    finalTotal * DEPOSIT_PCT
  );
  const fallbackAmountToday = isDeposit
    ? depositFallback
    : finalTotal;

  const payloadAmountToday =
    checkoutPayload &&
    typeof checkoutPayload.amountCents ===
      "number"
      ? round2(
          checkoutPayload.amountCents /
            100
        )
      : null;

  const amountDueToday =
    payloadAmountToday ??
    fallbackAmountToday;
  const remainingBalance = round2(
    Math.max(
      0,
      finalTotal - amountDueToday
    )
  );

  const finalDueDateStr = (() => {
    if (!weddingDate)
      return "35 days before your wedding date";
    const base = new Date(
      `${weddingDate}T12:00:00`
    );
    base.setDate(base.getDate() - 35);
    return toPretty(base);
  })();

  const signatureImageUrl =
    localStorage.getItem(
      "schnepfCateringSignature"
    ) ||
    localStorage.getItem(
      "yumSignature"
    ) ||
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
      payloadAmountToday:
        payloadAmountToday ?? "∅",
      fallbackAmountToday,
      amountDueToday,
      remainingBalance,
      weddingDate:
        weddingDate ?? "∅",
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
    console.group(
      "%c[SCH][Checkout] onSuccess",
      "color:#22c55e;font-weight:700"
    );
    console.log(
      "[SCH][Checkout] Stripe customerId =",
      customerId
    );
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.error(
        "[SCH][Checkout] No authed user"
      );
      console.groupEnd();
      return;
    }

    setLocalGenerating(true);
    console.time(
      "[SCH][Checkout] finalize-total"
    );
    const breaker = setTimeout(() => {
      console.warn(
        "[SCH][Checkout] breaker: clearing local spinner after 20s"
      );
      setLocalGenerating(false);
    }, 20000);

    try {
      const userRef = doc(
        db,
        "users",
        user.uid
      );
      const snap = await getDoc(
        userRef
      );
      const userDoc =
        snap.data() || {};
      console.log(
        "[SCH][Checkout] userDoc snapshot:",
        userDoc?.firstName,
        userDoc?.lastName
      );

      // (1) Save Stripe customer id
      if (
        customerId &&
        customerId !==
          userDoc?.stripeCustomerId
      ) {
        console.time(
          "[SCH][Checkout] update stripeCustomerId"
        );
        await updateDoc(
          userRef,
          {
            stripeCustomerId:
              customerId,
            "stripe.updatedAt":
              serverTimestamp(),
          }
        );
        console.timeEnd(
          "[SCH][Checkout] update stripeCustomerId"
        );
        try {
          localStorage.setItem(
            "stripeCustomerId",
            customerId
          );
        } catch {}
      }

      // (2) Route FIRST so the UI doesn't hang — use the NEW linear step
      try {
        localStorage.setItem(
          "yumStep",
          "schnepfCateringThankYou"
        );
        localStorage.setItem(
          "schnepfJustBookedCatering",
          "true"
        );
        localStorage.setItem(
          "schnepfCateringBooked",
          "true"
        );
      } catch {}
      console.log(
        "[SCH][Checkout] Routing to CateringThankYou now via onComplete()"
      );
      onComplete();

      // (3) Fan-out (don’t block)
      setTimeout(() => {
        try {
          window.dispatchEvent(
            new Event("purchaseMade")
          );
          window.dispatchEvent(
            new Event("documentsUpdated")
          );
          window.dispatchEvent(
            new Event("cateringCompletedNow")
          );
        } catch (e) {
          console.warn(
            "[SCH] dispatch events failed:",
            e
          );
        }
      }, 800);

      // (4) Resolve guest count
      let guestCountFinal = Number(
        normalizedGuestCount || 0
      );
      if (!guestCountFinal) {
        const ls = Number(
          localStorage.getItem(
            "yumGuestCount"
          ) || 0
        );
        guestCountFinal = ls;
      }
      if (!guestCountFinal) {
        try {
          const {
            getGuestState,
          } = await import(
            "../../../../utils/guestCountStore"
          );
          const st =
            await getGuestState();
          guestCountFinal = Number(
            (st as any)?.value ||
              0
          );
        } catch (e) {
          /* ignore */
        }
      }

      const prettyDue = finalDueDateStr;
      const remainingBal = round2(
        Math.max(
          0,
          finalTotal - amountDueToday
        )
      );

      // (5) PDF
      let publicUrl: string | null =
        null;
      try {
        const pdfBlob =
          await generateSchnepfAgreementPDF(
            {
              fullName: `${
                userDoc?.firstName ||
                firstName ||
                "Magic"
              } ${
                userDoc?.lastName ||
                lastName ||
                "User"
              }`,
              weddingDate:
                weddingDate ||
                userDoc?.weddingDate ||
                "TBD",
              signatureImageUrl,
              guestCount:
                guestCountFinal,
              perGuest,
              chefFee,
              taxesAndFees,
              total:
                finalTotal,
              deposit: isDeposit
                ? amountDueToday
                : 0,
              cuisineName:
                CUISINE_LABELS[
                  cuisineId
                ],
              menuSelections: {
                salads:
                  selections?.salads ??
                  [],
                mains:
                  selections?.entrees ??
                  [],
                sides:
                  selections?.sides ??
                  [],
              },
              paymentSummary: isDeposit
                ? `Deposit today: $${amountDueToday.toFixed(
                    2
                  )}. Remaining $${remainingBal.toFixed(
                    2
                  )} due by ${prettyDue}.`
                : `Paid in full today: $${amountDueToday.toFixed(
                    2
                  )}.`,
              lineItems:
                effectiveLineItems,
            }
          );

        const storage = getStorage(
          app,
          "gs://wedndonev2.firebasestorage.app"
        );
        const filename = `SchnepfCateringAgreement_${Date.now()}.pdf`;
        const fileRef = ref(
          storage,
          `public_docs/${user.uid}/${filename}`
        );
        await uploadBytes(
          fileRef,
          pdfBlob
        );
        publicUrl =
          await getDownloadURL(
            fileRef
          );
      } catch (pdfErr) {
        console.error(
          "[SCH][Checkout] PDF/Upload failed:",
          pdfErr
        );
      }

      // (7) Firestore snapshots
      try {
        await setDoc(
          doc(
            userRef,
            "pricingSnapshots",
            "catering"
          ),
          {
            booked: true,
            venueCaterer:
              "schnepf",
            cuisineId,
            guestCountAtBooking:
              guestCountFinal,
            perGuest,
            chefFee,
            taxesAndFees,
            totalBooked:
              finalTotal,
            selections,
            lineItems:
              effectiveLineItems,
            createdAt:
              new Date().toISOString(),
            updatedAt:
              new Date().toISOString(),
          },
          { merge: true }
        );

        const amountNow = Number(
          amountDueToday.toFixed(
            2
          )
        );
        await updateDoc(
          userRef,
          {
            ...(publicUrl
              ? {
                  documents:
                    arrayUnion(
                      {
                        title: "Schnepf Catering Agreement",
                        url: publicUrl,
                        uploadedAt:
                          new Date().toISOString(),
                      }
                    ),
                }
              : {}),
            "bookings.catering": true,
            weddingDateLocked: true,
            purchases:
              arrayUnion({
                label: "Schnepf Catering",
                category:
                  "catering",
                boutique:
                  "catering",
                source:
                  "W&D",
                amount:
                  amountNow,
                amountChargedToday:
                  amountNow,
                contractTotal:
                  Number(
                    finalTotal.toFixed(
                      2
                    )
                  ),
                payFull:
                  !isDeposit,
                deposit: isDeposit
                  ? amountNow
                  : Number(
                      finalTotal.toFixed(
                        2
                      )
                    ),
                method: isDeposit
                  ? "deposit"
                  : "full",
                items:
                  effectiveLineItems,
                date: new Date().toISOString(),
              }),
            spendTotal:
              increment(
                amountNow
              ),

            // 👇 NEW linear progress step
            "progress.yumYum.step":
              "schnepfCateringThankYou",
          }
        );
        console.log(
          "[SCH][Checkout] Firestore snapshots saved."
        );
      } catch (fsErr) {
        console.error(
          "[SCH][Checkout] Firestore snapshot/update failed:",
          fsErr
        );
      }
    } catch (err) {
      console.error(
        "❌ [SCH][Checkout] finalize error:",
        err
      );
    } finally {
      clearTimeout(breaker);
      console.timeEnd(
        "[SCH][Checkout] finalize-total"
      );
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
              maxWidth: 320,
              margin:
                "0 auto 12px",
              display:
                "block",
              borderRadius: 12,
            }}
          />
          <p
            style={{
              fontSize:
                "1.05rem",
              color: "#2c62ba",
              fontStyle:
                "italic",
              margin: 0,
            }}
          >
            Madge is
            working her
            magic...
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
    : `Total due today: $${amountDueToday.toFixed(
        2
      )}.`;

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
          style={{
            width: "100%",
            maxWidth: 150,
            margin:
              "0 auto 12px",
            display:
              "block",
            borderRadius: 12,
          }}
        />

        <h2
          style={{
            marginBottom:
              "0.75rem",
            color: "#2c62ba",
            fontFamily:
              "'Jenna Sue', cursive",
            fontSize:
              "2rem",
          }}
        >
          Checkout
        </h2>

        <div
          style={{
            marginBottom:
              "1rem",
          }}
        >
          <div
            style={{
              fontSize:
                "1rem",
            }}
          >
            {summaryText}
          </div>
        </div>

        {/* Stripe Elements — comfortably wide */}
<div className="px-elements" aria-busy={isGenerating}>
  <CheckoutForm
    total={amountDueToday}
    onSuccess={handleSuccess}
    setStepSuccess={handleSuccess} // this keeps TS happy; it's unused in most flows
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

        <div
          style={{
            marginTop:
              "1.25rem",
          }}
        >
          <button
            className="boutique-back-btn"
            style={{
              width: 250,
              padding:
                "0.75rem 1rem",
              fontSize:
                "1rem",
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