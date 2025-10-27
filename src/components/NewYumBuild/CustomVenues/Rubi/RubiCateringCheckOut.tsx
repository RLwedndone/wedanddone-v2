import React, { useEffect, useMemo, useRef, useState } from "react";
import CheckoutForm from "../../../../CheckoutForm";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "../../../../firebase/firebaseConfig";
import generateRubiAgreementPDF from "../../../../utils/generateRubiAgreementPDF";

import { getAuth } from "firebase/auth";
import {
  arrayUnion,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

import type { RubiTierSelectionBBQ } from "./RubiBBQTierSelector";
import type { RubiTierSelection as RubiTierSelectionMex } from "./RubiMexTierSelector";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const toPretty = (d: Date) =>
  d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export type RubiMenuChoice = "bbq" | "mexican";
type RubiTierSelection = RubiTierSelectionBBQ | RubiTierSelectionMex;

interface Props {
  total: number;
  guestCount: number;
  lineItems: string[];
  menuChoice: RubiMenuChoice;
  tierSelection: RubiTierSelection;
  signatureImage: string | null;     // ✅ passed in
  weddingDate?: string | null;
  onBack: () => void;
  onComplete: () => void;
  onClose: () => void;
  isGenerating: boolean;
}

const RubiCateringCheckOut: React.FC<Props> = ({
  total,
  guestCount,
  lineItems,
  menuChoice,
  tierSelection,
  signatureImage,
  weddingDate,
  onBack,
  onComplete,
  onClose,
  isGenerating: isGeneratingFromOverlay,
}) => {
  const [localGenerating, setLocalGenerating] = useState(false);
  const isGenerating = localGenerating || isGeneratingFromOverlay;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didRunRef = useRef(false);

  // --- Pull plan handoff data from LS ---
  const payFull = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("rubiPayFull") ??
          localStorage.getItem("yumCateringPayFull") ??
          "true"
      );
    } catch {
      return true;
    }
  }, []);

  const totalCents =
    Number(
      localStorage.getItem("rubiTotalCents") ??
        localStorage.getItem("yumCateringTotalCents") ??
        0
    ) || Math.round(total * 100);

  const depositCents =
    Number(
      localStorage.getItem("rubiDepositCents") ??
        localStorage.getItem("yumCateringDepositAmount") ??
        0
    ) || Math.round(total * 0.25 * 100);

  const planMonthsLS = Number(
    localStorage.getItem("rubiPlanMonths") ??
      localStorage.getItem("yumCateringPlanMonths") ??
      0
  );
  const perMonthCentsLS = Number(
    localStorage.getItem("rubiPerMonthCents") ??
      localStorage.getItem("yumCateringPerMonthCents") ??
      0
  );
  const lastPaymentCentsLS = Number(
    localStorage.getItem("rubiLastPaymentCents") ??
      localStorage.getItem("yumCateringLastPaymentCents") ??
      0
  );

  // final due date string (we showed it on contract)
  const weddingDateISO = localStorage.getItem("rubiDueBy") || "";
  const finalDueDateStr = (() => {
    if (!weddingDateISO) return "35 days before your wedding date";
    const base = new Date(weddingDateISO);
    return toPretty(base);
  })();

  // snapshot of per-guest pricing for receipts
  const perGuestPrice =
    Number(localStorage.getItem("rubiPerGuest") || 0) ||
    tierSelection?.pricePerGuest ||
    0;

  // how much we actually charge right now
  const amountDueTodayCents = payFull ? totalCents : depositCents;
  const amountDueToday = round2(amountDueTodayCents / 100);

  // leftover after deposit path
  const remainingBalance = round2(Math.max(0, total - amountDueToday));

  // name for PDF / CheckoutForm
  const [firstName, setFirstName] = useState<string>("Magic");
  const [lastName, setLastName] = useState<string>("User");
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
        /* ignore */
      }
    })();
  }, []);

  // summary line we show in UI AND store in PDF
  const summaryText = payFull
    ? `Total due today: $${(amountDueTodayCents / 100).toFixed(2)}.`
    : `Deposit due today: $${(amountDueTodayCents / 100).toFixed(
        2
      )} (25%). Remaining $${remainingBalance.toFixed(
        2
      )} — final payment due ${finalDueDateStr}.`;

  // --- success handler from Stripe ---
  const handleSuccess = async ({ customerId }: { customerId?: string } = {}) => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLocalGenerating(true);

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const userDoc = snap.data() || {};
      const purchaseDate = new Date().toISOString();

      // persist/remember stripe customer id
      if (customerId && customerId !== userDoc?.stripeCustomerId) {
        await updateDoc(userRef, {
          stripeCustomerId: customerId,
          "stripe.updatedAt": serverTimestamp(),
        });
        try {
          localStorage.setItem("stripeCustomerId", customerId);
        } catch {}
      }

      // optimistic UI: fire events + advance overlay
      try {
        localStorage.setItem("rubiJustBookedCatering", "true");
        localStorage.setItem("rubiCateringBooked", "true");
        localStorage.setItem("yumStep", "rubiCateringThankYou");
      } catch {}
      window.dispatchEvent(new Event("purchaseMade"));
      onComplete();

      // build payment plan snapshot
      const planMonths = planMonthsLS || 0;
      const perMonthCents = perMonthCentsLS || 0;
      const lastPaymentCents = lastPaymentCentsLS || 0;
      const nextChargeAt =
        !payFull && planMonths > 0
          ? new Date(Date.now() + 60 * 1000).toISOString()
          : null;

      const amountNow = Number((amountDueTodayCents / 100).toFixed(2));
      const tierLabel =
        tierSelection?.prettyName || tierSelection?.id || "";

      // pricingSnapshots (receipt-ish data)
      await setDoc(
        doc(userRef, "pricingSnapshots", "rubiCatering"),
        {
          booked: true,
          guestCountAtBooking: guestCount,
          perGuest: perGuestPrice,
          caterer: "Brother John's Catering",
          menuChoice,
          tier: tierLabel,
          selections: {}, // already captured during Contract step
          lineItems,
          totalBooked: total,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // main user doc: bookings + purchases + paymentPlan
      await updateDoc(userRef, {
        "progress.yumYum.step": "rubiCateringThankYou",
        bookings: {
          ...(userDoc as any)?.bookings,
          catering: true, // ✅ mark catering booked
        },
        purchases: arrayUnion({
          label: `Catering — Brother John’s ${menuChoice === "bbq" ? "BBQ" : "Mexican"} (${tierLabel})`,
          amount: amountNow,
          date: purchaseDate,
          method: payFull ? "full" : "deposit",
        }),
        spendTotal: increment(amountNow),
        paymentPlan: payFull
          ? {
              product: "rubi-catering",
              type: "full",
              total,
              paidNow: amountNow,
              remainingBalance: 0,
              finalDueDate: null,
              finalDueAt: null,
              depositPercent: 1,
              createdAt: new Date().toISOString(),
            }
          : {
              product: "rubi-catering",
              type: "deposit",
              total,
              depositPercent: 0.25,
              paidNow: amountNow,
              remainingBalance,
              finalDueDate: finalDueDateStr,
              finalDueAt: localStorage.getItem("rubiDueBy") || null,
              createdAt: new Date().toISOString(),
            },
        paymentPlanAuto: payFull
          ? {
              version: 1,
              product: "rubi-catering",
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
              menuChoice,
              tier: tierLabel,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : {
              version: 1,
              product: "rubi-catering",
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
              finalDueAt: localStorage.getItem("rubiDueBy") || null,
              stripeCustomerId:
                customerId ||
                localStorage.getItem("stripeCustomerId") ||
                null,
              menuChoice,
              tier: tierLabel,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
      });

      // ✅ build & upload PDF receipt/contract
      try {
        const fullName = `${firstName || "Magic"} ${lastName || "User"}`;

        // prefer prop weddingDate, fallback to LS (yumSelectedDate/rubiWeddingDate)
        const weddingYMD =
          weddingDate ||
          localStorage.getItem("yumSelectedDate") ||
          localStorage.getItem("rubiWeddingDate") ||
          "TBD";

        const pdfBlob = await generateRubiAgreementPDF({
          fullName,
          menuChoice,
          tierLabel,
          guestCount,
          weddingDate: weddingYMD || "TBD",
          total,
          depositPaidToday: amountNow,
          paymentSummary: summaryText,
          lineItems,
          signatureImageUrl:
            signatureImage ||
            localStorage.getItem("yumSignature") ||
            "",
        });

        const storage = getStorage(app, "gs://wedndonev2.firebasestorage.app");
        const filename = `RubiCateringAgreement_${Date.now()}.pdf`;
        const fileRef = ref(storage, `public_docs/${user.uid}/${filename}`);
        await uploadBytes(fileRef, pdfBlob);
        const publicUrl = await getDownloadURL(fileRef);

        await updateDoc(userRef, {
          documents: arrayUnion({
            title: "Rubi House Catering Agreement",
            url: publicUrl,
            uploadedAt: new Date().toISOString(),
          }),
        });
      } catch (pdfErr) {
        console.warn("[RubiCateringCheckout] PDF upload failed (continuing):", pdfErr);
      }
    } catch (err) {
      console.error("❌ Error in Rubi Catering checkout:", err);
      alert("Something went wrong saving your receipt. Please contact support.");
    } finally {
      setLocalGenerating(false);
    }
  };

  // spinner UI
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
          <h3 className="px-title" style={{ margin: 0 }}>
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

  // normal checkout UI
  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" ref={scrollRef} style={{ textAlign: "center" }}>
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
          {summaryText}
        </p>

        <div className="px-elements" aria-busy={isGenerating}>
          <CheckoutForm
            total={amountDueToday}
            onSuccess={handleSuccess}
            setStepSuccess={handleSuccess}
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

        <div style={{ marginTop: 12 }}>
          <button className="boutique-back-btn" style={{ width: 250 }} onClick={onBack}>
            ← Back to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default RubiCateringCheckOut;