// src/components/FloralPicker/FloralCheckOut.tsx
import React, { useState, useRef } from "react";
import CheckoutForm from "../../CheckoutForm";
import { generateFloralAgreementPDF } from "../../utils/generateFloralAgreementPDF";
import { generateFloralAddOnReceiptPDF } from "../../utils/generateFloralAddOnReceiptPDF";
import { uploadPdfBlob } from "../../helpers/firebaseUtils";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

// ✅ centralized email helper (sends user + admin from template map)
import { notifyBooking } from "../../utils/email/email";

const API_BASE =
  "https://us-central1-wedndonev2.cloudfunctions.net/stripeapiV2";

const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

// Format YYYY-MM-DD or ISO into "Month D, YYYY" for emails
const formatWeddingDateForEmail = (raw?: string | null): string => {
  if (!raw || raw === "TBD") return "TBD";

  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  let dt: Date | null = null;

  if (ymd.test(raw)) {
    dt = new Date(`${raw}T12:00:00`);
  } else {
    const tmp = new Date(raw);
    if (!isNaN(tmp.getTime())) dt = tmp;
  }

  if (!dt) return raw;

  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

interface FloralCheckOutProps {
  onClose: () => void;
  isAddon?: boolean;
  total: number;
  depositAmount: number;
  payFull: boolean;
  paymentSummary: string;
  signatureImage: string;
  onSuccess: () => void;
  setStepSuccess?: () => void;
  firstName: string;
  lastName: string;
  weddingDate: string;
  lineItems: string[];
  uid: string;
}

const FloralCheckOut: React.FC<FloralCheckOutProps> = ({
  onClose,
  isAddon = false,
  total,
  depositAmount,
  payFull,
  paymentSummary,
  signatureImage,
  onSuccess,
  setStepSuccess,
  firstName,
  lastName,
  weddingDate,
  lineItems,
  uid,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 🔐 Payment mode + saved card summary
  const [mode, setMode] = useState<"saved" | "new">("new");
  const [savedCardSummary, setSavedCardSummary] =
    useState<{
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
    } | null>(null);

  const hasSavedCard = !!savedCardSummary;

  // 🔍 Load saved card summary once auth is ready
  React.useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        try {
          const effectiveUid = user?.uid || uid;
          if (!effectiveUid) return;

          const res = await fetch(
            `${API_BASE}/payments/get-default`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uid: effectiveUid }),
            }
          );

          const data = await res.json();

          if (data?.card) {
            setSavedCardSummary(data.card);
            setMode("saved");
          }
        } catch (err) {
          console.warn("No saved card found:", err);
        }
      }
    );

    return () => unsubscribe();
  }, [uid]);

  // If this is a monthly plan (not addon + not payFull), card on file is REQUIRED.
  const requiresCardOnFile = !isAddon && !payFull;

  const [saveCardOnFile, setSaveCardOnFile] =
    useState<boolean>(requiresCardOnFile);

  const DEPOSIT_PCT = 0.25;

  const parsedWedding = weddingDate
    ? new Date(`${weddingDate}T12:00:00`)
    : null;
  const finalDueDate = parsedWedding
    ? new Date(
        parsedWedding.getTime() -
          30 * 24 * 60 * 60 * 1000
      )
    : null;

  const computedDeposit = Math.min(
    total,
    Math.round(total * DEPOSIT_PCT * 100) / 100
  );

  const effectiveDeposit =
    Number.isFinite(depositAmount) && depositAmount > 0
      ? depositAmount
      : computedDeposit;

  const amountDueToday = payFull ? total : effectiveDeposit;
  const remainingBalance = Math.max(
    0,
    Math.round((total - amountDueToday) * 100) / 100
  );

  const finalDueDateStr = finalDueDate
    ? finalDueDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "30 days before your wedding date";

    const handleSuccess = async ({
      customerId,
      paymentMethodId,
    }: {
      customerId?: string;
      paymentMethodId?: string;
    } = {}) => {
    console.log("💳 Payment successful!");

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const userDoc = userSnap.data() || {};

    // ✅ Save stripeCustomerId (if new)
    try {
      const existingId =
        userDoc?.stripeCustomerId as string | undefined;
      if (customerId && customerId !== existingId) {
        await updateDoc(userRef, {
          stripeCustomerId: customerId,
          "stripe.updatedAt": serverTimestamp(),
        });
        try {
          localStorage.setItem(
            "stripeCustomerId",
            customerId
          );
        } catch {}
        console.log(
          "✅ Saved stripeCustomerId to Firestore."
        );
      }
    } catch (e) {
      console.warn(
        "⚠️ Could not save stripeCustomerId:",
        e
      );
    }

     // ✅ Store the specific card used for this floral payment plan
    // Only for main floral contract flow (not add-ons) and only if it's a monthly plan.
    if (!isAddon && !payFull && paymentMethodId) {
      try {
        await updateDoc(userRef, {
          "paymentPlan.paymentMethodId": paymentMethodId,
        });
        console.log(
          "✅ Stored paymentPlan.paymentMethodId:",
          paymentMethodId
        );
      } catch (err) {
        console.error(
          "❌ Failed to store paymentMethodId on paymentPlan:",
          err
        );
      }
    }

    // ✅ Decide whether to store card
    const shouldStoreCard =
      requiresCardOnFile || saveCardOnFile;

    if (shouldStoreCard) {
      try {
        await fetch(
          `${API_BASE}/ensure-default-payment-method`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              customerId:
                customerId ||
                localStorage.getItem("stripeCustomerId"),
              firebaseUid: user.uid,
            }),
          }
        );
        console.log(
          "✅ Ensured default payment method for floral customer"
        );
      } catch (err) {
        console.error(
          "❌ Failed to ensure default payment method:",
          err
        );
      }
    } else {
      console.log(
        "ℹ️ Skipping card-on-file setup (no consent / pay-in-full without opt-in)."
      );
    }

    const safeFirst =
      userDoc?.firstName || firstName || "Magic";
    const safeLast =
      userDoc?.lastName || lastName || "User";
    const fullName = `${safeFirst} ${safeLast}`;
    const purchaseDate =
      new Date().toLocaleDateString("en-US");

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

    function nextApproxMonthUTC(from: Date): string {
      const y = from.getUTCFullYear();
      const m = from.getUTCMonth();
      const d = from.getUTCDate();
      const target = new Date(
        Date.UTC(y, m + 1, 1, 0, 0, 1)
      );
      const lastDayNextMonth = new Date(
        Date.UTC(y, m + 2, 0)
      ).getUTCDate();
      target.setUTCDate(
        Math.min(d, lastDayNextMonth)
      );
      return target.toISOString();
    }

    function monthsBetweenInclusive(from: Date, to: Date) {
      const a = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)
      );
      const b = new Date(
        Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1)
      );
      let months =
        (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
        (b.getUTCMonth() - a.getUTCMonth());
      if (to.getUTCDate() >= from.getUTCDate()) months += 1;
      return Math.max(1, months);
    }

    // ---------- Add-on flow ----------
    if (isAddon) {
      console.log(
        "💐 Add-on mode — generating floral add-on receipt…"
      );
      setIsGenerating(true);

      const safeWeddingDateRaw =
        (userDoc as any)?.weddingDate ||
        (weddingDate && weddingDate.trim()) ||
        "TBD";

      const weddingDateDisplay =
        formatWeddingDateForEmail(safeWeddingDateRaw);

      const current = getAuth().currentUser;
      const safeEmail =
        current?.email ||
        (userDoc as any)?.email ||
        "unknown@wedndone.com";

      try {
        const blob =
          await generateFloralAddOnReceiptPDF({
            fullName,
            email: safeEmail,
            weddingDate: safeWeddingDateRaw,
            lineItems,
            total,
            purchaseDate,
          });

        const fileName = `FloralAddOnReceipt_${Date.now()}.pdf`;
        const filePath = `public_docs/${user.uid}/${fileName}`;
        const url = await uploadPdfBlob(
          blob,
          filePath
        );
        console.log(
          "✅ Add-on receipt uploaded:",
          url
        );

        await updateDoc(userRef, {
          documents: arrayUnion({
            title: "Floral Add-On Receipt",
            url,
            uploadedAt: new Date().toISOString(),
          }),
          purchases: arrayUnion({
            label: "floral_addon",
            amount: Number(total.toFixed(2)),
            date: new Date().toISOString(),
          }),
          spendTotal: increment(
            Number(total.toFixed(2))
          ),
          "bookings.floral": true,
          "bookings.updatedAt": new Date().toISOString(),
        });

        await notifyBooking("floral_addon", {
          user_email: safeEmail,
          user_full_name: fullName,
          firstName: safeFirst,
          wedding_date: weddingDateDisplay,
          pdf_url: url,
          pdf_title: "Floral Add-On Receipt",
          total: total.toFixed(2),
          line_items: (lineItems || []).join(", "),
          dashboardUrl: `${
            window.location.origin
          }${
            import.meta.env.BASE_URL
          }dashboard`,
          product_name: "Floral Add-On",
        });

        window.dispatchEvent(new Event("purchaseMade"));
        window.dispatchEvent(
          new Event("documentsUpdated")
        );
        window.dispatchEvent(
          new Event("floralCompletedNow")
        );

        setIsGenerating(false);
        onSuccess();
        return;
      } catch (err) {
        console.error(
          "❌ Error during floral add-on receipt:",
          err
        );
        setIsGenerating(false);
        return;
      }
    }

    // ---------- Full contract flow ----------
    console.log(
      "📝 Generating Floral Agreement PDF…"
    );
    setIsGenerating(true);

    try {
      const blob = await generateFloralAgreementPDF({
        firstName:
          userDoc?.firstName || firstName || "Magic",
        lastName:
          userDoc?.lastName || lastName || "User",
        total,
        deposit: payFull ? 0 : amountDueToday,
        payFull,
        monthlyAmount: payFull ? 0 : remainingBalance,
        paymentSummary: paymentSummary || "",
        weddingDate,
        signatureImageUrl: signatureImage || "",
        lineItems: lineItems || [],
      });

      const fileName = `FloralAgreement_${Date.now()}.pdf`;
      const filePath = `public_docs/${user.uid}/${fileName}`;
      const url = await uploadPdfBlob(
        blob,
        filePath
      );

      const purchaseTotalRow = {
        label: "floral",
        category: "floral",
        type: "contract_meta",
        fullContractAmount: Number(
          total.toFixed(2)
        ),
        contractTotal: Number(total.toFixed(2)),
        total: Number(total.toFixed(2)),
        payFull: !!payFull,
        deposit: payFull
          ? 0
          : Number(amountDueToday.toFixed(2)),
        monthlyAmount: payFull
          ? 0
          : Number(remainingBalance.toFixed(2)),
        months: payFull ? 0 : 1,
        date: new Date().toISOString(),
      };

      await updateDoc(userRef, {
        "bookings.floral": true,
        floralSigned: true,
        floralPdfUrl: url,
        weddingDateLocked: true,
        documents: arrayUnion({
          title: "Floral Agreement",
          url,
          uploadedAt: new Date().toISOString(),
        }),
        purchases: arrayUnion(purchaseTotalRow),
        spendTotal: increment(
          Number(amountDueToday.toFixed(2))
        ),
        paymentPlan: payFull
          ? {
              product: "floral",
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
              product: "floral",
              type: "deposit",
              total,
              depositPercent: DEPOSIT_PCT,
              paidNow: amountDueToday,
              remainingBalance,
              finalDueDate: finalDueDateStr,
              finalDueAt:
                finalDueDate?.toISOString() ?? null,
              createdAt: new Date().toISOString(),
            },
        paymentPlanAuto: payFull
          ? {
              version: 1,
              product: "floral",
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
                customerId ||
                localStorage.getItem(
                  "stripeCustomerId"
                ) ||
                null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : (() => {
              const nowUTC = new Date();
              const firstChargeAtISO =
                nextApproxMonthUTC(nowUTC);
              const firstChargeAt = new Date(
                firstChargeAtISO
              );
              const finalISO = finalDueDate
                ? asStartOfDayUTC(
                    finalDueDate
                  ).toISOString()
                : null;
              const planMonths = finalDueDate
                ? monthsBetweenInclusive(
                    firstChargeAt,
                    finalDueDate
                  )
                : 1;
              const remainingCentsTotal = Math.round(
                remainingBalance * 100
              );
              const perMonthCents = Math.floor(
                remainingCentsTotal / planMonths
              );
              const lastPaymentCents =
                remainingCentsTotal -
                perMonthCents *
                  Math.max(0, planMonths - 1);

              return {
                version: 1,
                product: "floral",
                status: "active",
                strategy: "monthly_until_final",
                currency: "usd",
                totalCents: Math.round(total * 100),
                depositCents: Math.round(
                  amountDueToday * 100
                ),
                remainingCents: remainingCentsTotal,
                planMonths,
                perMonthCents,
                lastPaymentCents,
                nextChargeAt: firstChargeAtISO,
                finalDueAt: finalISO,
                stripeCustomerId:
                  customerId ||
                  localStorage.getItem(
                    "stripeCustomerId"
                  ) ||
                  null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            })(),
      });

      {
        const current = getAuth().currentUser;

        await notifyBooking("floral", {
          user_email:
            current?.email ||
            (userDoc as any)?.email ||
            "unknown@wedndone.com",
          user_full_name: fullName,
          firstName: safeFirst,
          wedding_date: weddingDate || "TBD",
          pdf_url: url,
          pdf_title: "Floral Agreement",
          total: total.toFixed(2),
          line_items: (lineItems || []).join(", "),
          payment_now: amountDueToday.toFixed(2),
          remaining_balance:
            remainingBalance.toFixed(2),
          final_due: finalDueDateStr,
          dashboardUrl: `${
            window.location.origin
          }${
            import.meta.env.BASE_URL
          }dashboard`,
        });
      }

      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(
        new Event("floralCompletedNow")
      );

      setIsGenerating(false);
      onSuccess();
    } catch (error) {
      console.error(
        "❌ Error during floral contract upload:",
        error
      );
      setIsGenerating(false);
    }
  };

  return (
    <div className="pixie-card pixie-card--modal">
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img
          src={`${
            import.meta.env.BASE_URL
          }assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div className="pixie-card__body">
        {isGenerating ? (
          <div
            className="px-center"
            style={{ marginTop: "10px" }}
          >
            <video
              src={`${
                import.meta.env.BASE_URL
              }assets/videos/magic_clock.mp4`}
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
              style={{ margin: 0 }}
            >
              Madge is working her magic… hold tight!
            </h3>
          </div>
        ) : (
          <>
            <video
              src={`${
                import.meta.env.BASE_URL
              }assets/videos/lock.mp4`}
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
                marginBottom: "8px",
              }}
            >
              Floral Checkout
            </h2>

            <p
              className="px-prose-narrow"
              style={{ marginBottom: "16px" }}
            >
              {paymentSummary
                ? paymentSummary
                : payFull
                ? `You're paying $${Number(
                    total
                  ).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} today.`
                : `You're paying a $${amountDueToday.toFixed(
                    2
                  )} deposit today. Remaining $${remainingBalance.toFixed(
                    2
                  )} due ${finalDueDateStr}.`}
            </p>

            {/* Payment Method Selection */}
            <div
              style={{
                marginTop: "12px",
                marginBottom: "20px",
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
                      <strong>
                        {savedCardSummary!.brand.toUpperCase()}
                      </strong>{" "}
                      •••• {savedCardSummary!.last4} (exp{" "}
                      {
                        savedCardSummary!.exp_month
                      }
                      /
                      {
                        savedCardSummary!.exp_year
                      }
                      )
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
                  <input
                    type="radio"
                    checked
                    readOnly
                  />
                  <span>Enter your card details</span>
                </label>
              )}
            </div>

            <div className="px-elements">
              <CheckoutForm
                total={amountDueToday}
                useSavedCard={mode === "saved"}
                onSuccess={handleSuccess}
                setStepSuccess={onSuccess}
                isAddon={false}
                customerEmail={
                  getAuth().currentUser?.email ||
                  undefined
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
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FloralCheckOut;