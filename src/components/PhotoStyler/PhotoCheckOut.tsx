// src/components/photo/PhotoCheckOut.tsx
import React, { useRef, useState } from "react";
import CheckoutForm from "../../CheckoutForm";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
  collection,
  addDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { generatePhotoAddOnReceiptPDF } from "../../utils/generatePhotoAddOnReceiptPDF";
import { generatePhotoAgreementPDF } from "../../utils/generatePhotoAgreementPDF";
import { uploadPdfBlob } from "../../helpers/firebaseUtils";
import emailjs from "@emailjs/browser";

// 🔗 Central Stripe API base (matches FloralCheckOut)
const API_BASE =
  "https://us-central1-wedndonev2.cloudfunctions.net/stripeapiV2";

// ───────── helpers (dates & math) ─────────
const MS_DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parseLocalYMD = (ymd?: string | null): Date | null => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00`); // noon guard
};

// first second of a local Date as UTC
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

// monthly count inclusive (partial months count as 1)
function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
}

// schedule first auto-charge ~ one month after booking, start of day UTC
function firstMonthlyChargeAtUTC(from = new Date()): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const dt = new Date(Date.UTC(y, m + 1, d, 0, 0, 1));
  return dt.toISOString();
}

// ───────── deposit/amount helpers ─────────

// Read cart-saved 50% deposit, fallback to 50% of total
function getPhotoDepositAmount(total: number): number {
  const ls = Number(localStorage.getItem("photoDepositAmount") || "");
  return Number.isFinite(ls) && ls > 0 ? round2(ls) : round2(total * 0.5);
}

interface PhotoCheckOutProps {
  onClose: () => void;
  isAddon?: boolean;
  total: number;
  depositAmount: number; // not trusted, we recompute
  payFull: boolean;
  paymentSummary: string;
  signatureImage: string;
  onSuccess: () => void;
  lineItems: string[];
  uid: string;
  onBack: () => void; // still accepted but no Back button in UI
  photoStyle?: string;
}

const PhotoCheckOut: React.FC<PhotoCheckOutProps> = ({
  onClose,
  isAddon = false,
  total,
  depositAmount,
  payFull,
  paymentSummary,
  signatureImage,
  onSuccess,
  lineItems,
  uid,
  onBack, // eslint can whine, but overlay still passes it
  photoStyle,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [completed, setCompleted] = useState(false);
  const finishedOnceRef = useRef(false);

  // 🔐 Payment mode + saved card summary (same pattern as Floral)
  const [mode, setMode] = useState<"saved" | "new">("new");
  const [savedCardSummary, setSavedCardSummary] =
    useState<{
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
    } | null>(null);

  const hasSavedCard = !!savedCardSummary;

  // Load saved card summary when auth is ready
  React.useEffect(() => {
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

        const data = await res.json();

        if (data?.card) {
          setSavedCardSummary(data.card);
          setMode("saved");
        }
      } catch (err) {
        console.warn("No saved card found (photo):", err);
      }
    });

    return () => unsubscribe();
  }, [uid]);

  // If this is a monthly plan (not addon + not payFull), card on file is REQUIRED.
  const requiresCardOnFile = !isAddon && !payFull;
  const [saveCardOnFile] = useState<boolean>(requiresCardOnFile);

  // ───────── amounts per policy ─────────
  // For add-ons: never use LS; full add-on amount is due now
  const totalFromLS = !isAddon
    ? Number(localStorage.getItem("photoTotal") || "")
    : NaN;

  const totalEffective =
    Number.isFinite(totalFromLS) && totalFromLS > 0
      ? round2(totalFromLS)
      : round2(total);

  const depositFromLS = !isAddon
    ? Number(localStorage.getItem("photoDepositAmount") || "")
    : NaN;

  const depositAmountEffective =
    Number.isFinite(depositFromLS) && depositFromLS > 0
      ? round2(depositFromLS)
      : getPhotoDepositAmount(totalEffective);

  // For add-ons we always charge the full amount now
  const amountDueToday = isAddon
    ? totalEffective
    : payFull
    ? totalEffective
    : Math.min(totalEffective, depositAmountEffective);

  const remainingBalance = isAddon
    ? 0
    : round2(Math.max(0, totalEffective - amountDueToday));

  // Normalize only for the contract flow (not add-ons)
  if (!isAddon) {
    try {
      localStorage.setItem("photoTotal", String(totalEffective));
      localStorage.setItem("photoDepositAmount", String(depositAmountEffective));
      localStorage.setItem("photoRemainingBalance", String(remainingBalance));
    } catch {}
  }

  console.log(
    "[PHOTO CHECKOUT] totalEffective:",
    totalEffective,
    "depositAmount:",
    depositAmountEffective,
    "amountDueToday:",
    amountDueToday
  );

  const handleSuccess = async ({
    customerId,
    paymentMethodId,
  }: {
    customerId?: string;
    paymentMethodId?: string;
  } = {}) => {
    if (finishedOnceRef.current) return;
    finishedOnceRef.current = true;

    const auth = getAuth();
    const user = auth.currentUser;

    setIsGenerating(true);

    try {
      const uidToUse = user?.uid || uid;
      const userRef = doc(db, "users", uidToUse);
      const snap = await getDoc(userRef);
      const userDoc = snap.exists() ? snap.data() : {};

      if (!snap.exists()) {
        await setDoc(
          userRef,
          {
            bookings: {},
            purchases: [],
            documents: [],
            createdAt: Timestamp.now(),
          },
          { merge: true }
        );
      }

      // Save Stripe customerId (and optionally paymentMethodId) if we got one
      try {
        const existingId = (userDoc as any)?.stripeCustomerId as
          | string
          | undefined;
        if (customerId && customerId !== existingId) {
          await updateDoc(userRef, {
            stripeCustomerId: customerId,
            "stripe.updatedAt": serverTimestamp(),
          });
          try {
            localStorage.setItem("stripeCustomerId", customerId);
          } catch {}
        }

        // If we ever want to store the specific PM for this plan, we can use this:
        if (!isAddon && !payFull && paymentMethodId) {
          try {
            await updateDoc(userRef, {
              "paymentPlan.paymentMethodId": paymentMethodId,
            });
            console.log(
              "✅ Stored paymentPlan.paymentMethodId (photo):",
              paymentMethodId
            );
          } catch (err) {
            console.error(
              "❌ Failed to store paymentMethodId on paymentPlan (photo):",
              err
            );
          }
        }

        // Decide whether to store card-on-file
        const shouldStoreCard = requiresCardOnFile || saveCardOnFile;

        if (shouldStoreCard) {
          try {
            await fetch(`${API_BASE}/ensure-default-payment-method`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId:
                  customerId || localStorage.getItem("stripeCustomerId"),
                firebaseUid: uidToUse,
              }),
            });
            console.log("✅ Ensured default payment method for photo customer");
          } catch (err) {
            console.error(
              "❌ Failed to ensure default payment method (photo):",
              err
            );
          }
        } else {
          console.log(
            "ℹ️ Skipping card-on-file setup for photo (no consent / pay-in-full without opt-in)."
          );
        }
      } catch (e) {
        console.warn("⚠️ Could not save stripeCustomerId (photo):", e);
      }

      const firstName = (userDoc as any)?.firstName || "Magic";
      const lastName = (userDoc as any)?.lastName || "User";
      const fullName = `${firstName} ${lastName}`;

      const userEmail = (userDoc as any)?.email || user?.email || "";
      const weddingYMD = (userDoc as any)?.weddingDate || null;

      // Dates for plan math: final due = wedding - 35 days
      const wedding = parseLocalYMD(weddingYMD || "");
      const finalDueDate = wedding
        ? new Date(wedding.getTime() - 35 * MS_DAY)
        : null;
      const finalDueISO = finalDueDate
        ? asStartOfDayUTC(finalDueDate).toISOString()
        : null;

      // monthly plan math
      let planMonths = 0;
      let perMonthCents = 0;
      let lastPaymentCents = 0;
      if (!isAddon && !payFull && finalDueDate && remainingBalance > 0) {
        const months = monthsBetweenInclusive(new Date(), finalDueDate);
        const remainingCents = Math.round(remainingBalance * 100);
        const base = Math.floor(remainingCents / months);
        const tail = remainingCents - base * Math.max(0, months - 1);
        planMonths = months;
        perMonthCents = base;
        lastPaymentCents = tail;
      }

      const months = payFull || isAddon ? 0 : planMonths;
      const monthlyAmount =
        payFull || isAddon ? 0 : +(perMonthCents / 100).toFixed(2);

      // 1) Record purchase & booking flags
      const updates: Record<string, any> = {
        "bookings.photography": true,
        weddingDateLocked: true,

        purchases: arrayUnion({
          label: isAddon ? "Photo Add-On" : "Photo Styler",
          category: "photo",
          amount: Number(amountDueToday.toFixed(2)),
          contractTotal: Number(totalEffective.toFixed(2)),
          payFull: Boolean(payFull),
          deposit:
            payFull || isAddon
              ? Number(totalEffective.toFixed(2))
              : Number(amountDueToday.toFixed(2)),
          monthlyAmount,
          months,
          method: payFull || isAddon ? "full" : "deposit",
          date: new Date().toISOString(),
          source: "PhotoCheckOut",
          module: "photography",
        }),

        spendTotal: increment(Number(amountDueToday.toFixed(2))),

        lastPurchaseAt: serverTimestamp(),
      };

      // Only maintain paymentPlan/paymentPlanAuto for the main booking,
      // not for add-ons.
      if (!isAddon) {
        updates.paymentPlan = payFull
          ? {
              product: "photo",
              type: "full",
              total: totalEffective,
              paidNow: totalEffective,
              remainingBalance: 0,
              finalDueDate: null,
              finalDueAt: null,
              depositPercent: 1,
              createdAt: new Date().toISOString(),
            }
          : {
              product: "photo",
              type: "deposit",
              total: totalEffective,
              depositPercent: +(amountDueToday / totalEffective).toFixed(2),
              paidNow: amountDueToday,
              remainingBalance,
              finalDueDate: finalDueDate
                ? finalDueDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "35 days before your wedding date",
              finalDueAt: finalDueISO,
              createdAt: new Date().toISOString(),
            };

        updates.paymentPlanAuto = payFull
          ? {
              version: 1,
              product: "photo",
              status: "complete",
              strategy: "paid_in_full",
              currency: "usd",
              totalCents: Math.round(totalEffective * 100),
              depositCents: Math.round(totalEffective * 100),
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
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : {
              version: 1,
              product: "photo",
              status: "active",
              strategy: "monthly_until_final",
              currency: "usd",
              totalCents: Math.round(totalEffective * 100),
              depositCents: Math.round(amountDueToday * 100),
              remainingCents: Math.round(remainingBalance * 100),
              planMonths,
              perMonthCents,
              lastPaymentCents,
              nextChargeAt: firstMonthlyChargeAtUTC(new Date()),
              finalDueAt: finalDueISO,
              stripeCustomerId:
                customerId ||
                localStorage.getItem("stripeCustomerId") ||
                null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
      }

      await updateDoc(userRef, updates);

      // 2) PDF + upload
      let pdfUrl = "";
      try {
        const pdfFileName = isAddon
          ? `PhotoReceipt_${Date.now()}.pdf`
          : `PhotoAgreement_${Date.now()}.pdf`;
        const pdfFilePath = `public_docs/${uidToUse}/${pdfFileName}`;

        let pdfBlob: Blob;
        if (isAddon) {
          const purchaseDate = new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          pdfBlob = await generatePhotoAddOnReceiptPDF({
            fullName,
            email: userEmail,
            lineItems,
            total: amountDueToday,
            purchaseDate,
            weddingDate: weddingYMD || undefined,
          });
        } else {
          const depositForPdf = payFull ? 0 : amountDueToday;

          pdfBlob = await generatePhotoAgreementPDF({
            firstName,
            lastName,
            total: totalEffective,
            deposit: depositForPdf,
            paymentSummary,
            weddingDate: (userDoc as any)?.weddingDate || "TBD",
            signatureImageUrl: signatureImage || "",
            lineItems,
            photoStyle:
              photoStyle && photoStyle.trim()
                ? photoStyle
                : "Not selected",
          });
        }

        pdfUrl = await uploadPdfBlob(pdfBlob, pdfFilePath);

        const docItem = {
          title: isAddon ? "Photo Add-On Receipt" : "Photo Agreement",
          url: pdfUrl,
          uploadedAt: new Date().toISOString(),
          kind: isAddon ? "receipt" : "agreement",
          module: "photo",
        };

        await updateDoc(userRef, {
          documents: arrayUnion(docItem),
          photoPdfUrl: pdfUrl,
        });

        await addDoc(collection(db, "users", uidToUse, "documents"), docItem);

        window.dispatchEvent(new Event("documentsUpdated"));
      } catch (pdfErr) {
        console.warn("⚠️ PDF generate/upload failed—continuing:", pdfErr);
      }

      // 3) Emails (user + admin)
      try {
        const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
        const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
        const ADMIN_EMAIL = import.meta.env.VITE_EMAILJS_ADMIN_EMAIL;

        // your EmailJS template IDs for photo:
        // PHOTO_BOOKED_USER: "template_z6xanln"
        // PHOTO_ADDON_USER:  "template_9fb76zd"
        // PHOTO_BOOKED_ADMIN:"template_mgm37ce"
        const USER_TEMPLATE_ID = isAddon
          ? "template_9fb76zd"
          : "template_z6xanln";
        const ADMIN_TEMPLATE_ID = "template_mgm37ce";

        if (SERVICE_ID && PUBLIC_KEY) {
          const userEmailFinal =
            (userDoc as any)?.email || user?.email || undefined;

          // buyer email
          if (USER_TEMPLATE_ID && userEmailFinal) {
            await emailjs.send(
              SERVICE_ID,
              USER_TEMPLATE_ID,
              {
                user_email: userEmailFinal,
                user_name: fullName,
                pdf_url: pdfUrl,
                pdf_title: isAddon
                  ? "Photo Add-On Receipt"
                  : "Photo Agreement",
                amount_today: amountDueToday.toFixed(2),
                total_contract: totalEffective.toFixed(2),
                is_addon: isAddon ? "Yes" : "No",
              },
              PUBLIC_KEY
            );
            console.log("📨 Photo buyer email sent");
          }

          // admin email
          if (ADMIN_TEMPLATE_ID && ADMIN_EMAIL) {
            await emailjs.send(
              SERVICE_ID,
              ADMIN_TEMPLATE_ID,
              {
                admin_email: ADMIN_EMAIL,
                user_email: userEmailFinal || "",
                user_name: fullName,
                pdf_url: pdfUrl,
                amount_today: amountDueToday.toFixed(2),
                total_contract: totalEffective.toFixed(2),
                is_addon: isAddon ? "Yes" : "No",
              },
              PUBLIC_KEY
            );
            console.log("📨 Photo admin email sent");
          }
        } else {
          console.warn(
            "⚠️ Photo EmailJS not fully configured (service/public/admin); skipping emails."
          );
        }
      } catch (emailErr) {
        console.warn("⚠️ Photo EmailJS send failed—continuing:", emailErr);
      }

      // 4) Fan-out events
      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("budgetUpdated"));
      window.dispatchEvent(new Event("weddingDateLocked"));
    } catch (error) {
      console.error("❌ Finalize error (continuing to thank-you):", error);
    } finally {
      setIsGenerating(false);
      setCompleted(true);
      try {
        onSuccess();
      } catch {}
    }
  };

  if (completed) return null;

  // Spinner state (unified "magic" card)
  if (isGenerating) {
    return (
      <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>

        <div className="pixie-card__body" style={{ textAlign: "center" }}>
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

          <h3 className="px-title" style={{ margin: 0 }}>
            Madge is working her magic…
          </h3>
        </div>
      </div>
    );
  }

  // Summary line (for UI before charge)
  const finalDuePretty =
    localStorage.getItem("photoFinalDuePretty") ||
    "35 days before your wedding date";

  const checkoutSummary =
    payFull || isAddon
      ? `You're paying $${Number(amountDueToday).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} today.`
      : `You're paying a $${amountDueToday.toFixed(
          2
        )} deposit today. Remaining $${remainingBalance.toFixed(
          2
        )} due ${finalDuePretty}.`;

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
      {/* 🩷 Pink X Close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      {/* Body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
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
          Photo Checkout
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
          {checkoutSummary}
        </p>

        {/* Payment Method Selection (saved vs new) */}
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
            textAlign: "left",
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
                  <strong>{savedCardSummary!.brand.toUpperCase()}</strong>{" "}
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
            isAddon={isAddon}
            customerEmail={getAuth().currentUser?.email || undefined}
            customerName={
              `${getAuth().currentUser?.displayName || ""}`.trim() || undefined
            }
            customerId={(() => {
              try {
                return localStorage.getItem("stripeCustomerId") || undefined;
              } catch {
                return undefined;
              }
            })()}
          />
        </div>

        {/* 🔙 No back button on checkout per latest flow */}
      </div>
    </div>
  );
};

export default PhotoCheckOut;