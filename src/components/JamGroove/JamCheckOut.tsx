// src/components/jam/JamCheckOut.tsx
import React, { useEffect, useRef, useState } from "react";
import CheckoutForm from "../../CheckoutForm";
import { useUser } from "../../contexts/UserContext";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { generateJamAgreementPDF } from "../../utils/generateJamAgreementPDF";
import { generateJamAddOnReceiptPDF } from "../../utils/generateJamAddOnReceiptPDF";
import { uploadPdfBlob } from "../../helpers/firebaseUtils";
import {
  doc,
  updateDoc,
  getDoc,
  arrayUnion,
  collection,
  addDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import type { GrooveGuideData } from "../../utils/generateGrooveGuidePDF";
import { generateGrooveGuidePDF } from "../../utils/generateGrooveGuidePDF";
import { JamSelectionsType } from "./JamOverlay";
import { notifyBooking } from "../../utils/email/email";

import emailjs from "@emailjs/browser";
import {
  EMAILJS_SERVICE_ID,
  EMAILJS_PUBLIC_KEY,
} from "../../config/emailjsConfig";

// ------------ Stripe API base (same as Floral) ------------
const API_BASE =
  "https://us-central1-wedndonev2.cloudfunctions.net/stripeapiV2";

// ------------ helpers ------------
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const MS_DAY = 24 * 60 * 60 * 1000;

// 🔧 patch selections for Groove Guide
// NOTE: ceremony order now comes from `customProcessional` (your new screen).
const patchJamSelections = (
  original: JamSelectionsType
): GrooveGuideData["selections"] => {
  const safe = (val: any) =>
    val === undefined || val === null || val === "" ? "no user input" : val;

  // Prefer customProcessional (new screen); fall back to any legacy ceremonyOrder
  const srcOrder: any =
    (original as any)?.customProcessional ||
    (original as any)?.ceremonyOrder ||
    {};

  return {
    ceremonyOrder: {
      first: safe(srcOrder.first),
      second: safe(srcOrder.second),
      third: safe(srcOrder.third),
      fourth: safe(srcOrder.fourth),
      fifth: safe(srcOrder.fifth),
      sixth: safe(srcOrder.sixth),
      additional: safe(srcOrder.additional),
    },
    ceremonyMusic: {
      brideEntranceSong: {
        songTitle: safe(original?.ceremonyMusic?.bride),
        artist: safe(original?.ceremonyMusic?.brideArtist),
      },
      partyEntranceSong: {
        songTitle: safe(original?.ceremonyMusic?.party),
        artist: safe(original?.ceremonyMusic?.partyArtist),
      },
      otherCeremonySongs: {
        songTitle: safe(original?.ceremonyMusic?.otherSongs),
        artist: safe(original?.ceremonyMusic?.otherSongsArtist),
      },
      recessionalSong: {
        songTitle: safe(original?.ceremonyMusic?.recessionalSong),
        artist: safe(original?.ceremonyMusic?.recessionalArtist),
      },
    },
    cocktailMusic: safe(original?.cocktailMusic),
    dinnerMusic: safe(original?.dinnerMusic),
    familyDances: {
      skipFirstDance: original?.familyDances?.skipFirstDance ?? true,
      firstDanceSong: safe(original?.familyDances?.firstDanceSong),
      firstDanceArtist: safe(original?.familyDances?.firstDanceArtist),
      skipMotherSon: original?.familyDances?.skipMotherSon ?? true,
      motherSonSong: safe(original?.familyDances?.motherSonSong),
      motherSonArtist: safe(original?.familyDances?.motherSonArtist),
      skipFatherDaughter:
        original?.familyDances?.skipFatherDaughter ?? true,
      fatherDaughterSong: safe(original?.familyDances?.fatherDaughterSong),
      fatherDaughterArtist: safe(
        original?.familyDances?.fatherDaughterArtist
      ),
    },
    preDinnerWelcome: {
      hasWelcome: original?.preDinnerWelcome?.hasWelcome ?? false,
      speaker: safe(original?.preDinnerWelcome?.speaker),
    },
    grandEntrances: {
      selection: safe(original?.grandEntrances?.selection),
      coupleSong: safe(original?.grandEntrances?.coupleSong),
      coupleArtist: safe(original?.grandEntrances?.coupleArtist),
      bridesmaidsSong: safe(original?.grandEntrances?.bridesmaidsSong),
      bridesmaidsArtist: safe(
        original?.grandEntrances?.bridesmaidsArtist
      ),
      groomsmenSong: safe(original?.grandEntrances?.groomsmenSong),
      groomsmenArtist: safe(original?.grandEntrances?.groomsmenArtist),
    },
    cakeCutting: {
      doCakeCutting: original?.cakeCutting?.doCakeCutting ?? false,
      song: safe(original?.cakeCutting?.song),
      artist: safe(original?.cakeCutting?.artist),
    },
    musicalGenres: Object.fromEntries(
      Object.entries(original?.musicalGenres ?? {}).map(([k, v]) => [
        k,
        safe(v),
      ])
    ),
  };
};

interface JamCheckOutProps {
  onClose: () => void;
  isAddon?: boolean;
  /** true when they’re buying Groove Guide PDF only */
  isPdfOnly?: boolean;
  total: number;
  depositAmount: number; // flat deposit provided by cart (usually 750, capped by total)
  payFull: boolean;
  paymentSummary: string;
  signatureImage: string;
  onSuccess: () => void;
  onBack: () => void;
  firstName: string;
  lastName: string;
  weddingDate: string;
  lineItems: string[];
  uid: string;
  jamSelections: JamSelectionsType;
  skipGrooveGeneration?: boolean;
}

const JamCheckOut: React.FC<JamCheckOutProps> = ({
  onClose,
  isAddon = false,
  isPdfOnly = false,
  total,
  depositAmount,
  payFull,
  paymentSummary,
  signatureImage,
  onSuccess,
  onBack,
  firstName,
  lastName,
  weddingDate,
  lineItems,
  uid,
  jamSelections,
  skipGrooveGeneration = false,
}) => {
  const { userData } = useUser();
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 🔐 Payment mode + saved card summary (like Floral)
  const [mode, setMode] = useState<"saved" | "new">("new");
  const [savedCardSummary, setSavedCardSummary] =
    useState<{
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
    } | null>(null);

  const hasSavedCard = !!savedCardSummary;

  // Load saved card summary once auth is ready
  useEffect(() => {
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
        console.warn("[JamCheckOut] No saved card found:", err);
      }
    });

    return () => unsubscribe();
  }, [uid]);

  // On mount, read weddingDate/weddingDateLocked so cart/confirm step behaves correctly
  useEffect(() => {
    const u = getAuth().currentUser;
    if (!u) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const data = snap.data() || {};
        const ymd: string | null =
          (data as any)?.weddingDate ||
          (data as any)?.wedding?.date ||
          localStorage.getItem("weddingDate") ||
          null;

        const locked =
          (data as any)?.weddingDateLocked === true || Boolean(ymd);

        try {
          if (ymd) localStorage.setItem("weddingDate", ymd);
          localStorage.setItem("weddingDateLocked", String(locked));
        } catch {}
      } catch (e) {
        console.warn("[JamCheckOut] failed to read wedding date:", e);
      }
    })();
  }, []);

  if (!userData)
    return <p style={{ textAlign: "center" }}>Loading your info...</p>;

  // -------- Payment math (flat $750 deposit unless overridden) --------
  const totalEffective = round2(Number(total) || 0);
  const depositFromProp = Number(depositAmount);
  const depositFromLS = Number(localStorage.getItem("jamDepositAmount") || "");
  const deposit25 = round2(totalEffective * 0.25); // fallback only

  const depositNow =
    Number.isFinite(depositFromProp) && depositFromProp > 0
      ? round2(depositFromProp)
      : Number.isFinite(depositFromLS) && depositFromLS > 0
      ? round2(depositFromLS)
      : deposit25;

  const amountDueToday = payFull
    ? totalEffective
    : Math.min(totalEffective, depositNow);

  const remaining = round2(Math.max(0, totalEffective - amountDueToday));

  // 35 days before wedding date
  const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;
  const parsedWedding =
    weddingDate && ymdRegex.test(weddingDate)
      ? new Date(`${weddingDate}T12:00:00`)
      : null;

  const finalDueDate = parsedWedding
    ? new Date(parsedWedding.getTime() - 35 * MS_DAY)
    : null;

  const finalDuePretty = finalDueDate
    ? finalDueDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "35 days before your wedding date";

  // Prefer the exact text the contract screen showed
  let effectiveSummary = paymentSummary;
  try {
    const fromContract = localStorage.getItem("jamPaymentSummaryText");
    if (fromContract) {
      effectiveSummary = fromContract;
    }
  } catch {
    // ignore LS issues
  }

  // For pure PDF-only purchases, override with simpler copy
  if (isPdfOnly) {
    effectiveSummary = `You're paying $${amountDueToday.toFixed(
      2
    )} today for your Groove Guide PDF.`;
  }

  // If this is a monthly plan (full DJ, not addon/pdf-only, not payFull),
  // card on file is REQUIRED.
  const requiresCardOnFile = !isAddon && !isPdfOnly && !payFull;
const isMonthlyPlan = requiresCardOnFile;

  // ------ tiny helpers for auto-billing metadata (same pattern as Floral) ------
  const asStartOfDayUTC = (d: Date) =>
    new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 1)
    );

  function nextApproxMonthUTC(from: Date): string {
    const y = from.getUTCFullYear();
    const m = from.getUTCMonth();
    const d = from.getUTCDate();
    const target = new Date(Date.UTC(y, m + 1, 1, 0, 0, 1));
    const lastDayNextMonth = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
    target.setUTCDate(Math.min(d, lastDayNextMonth));
    return target.toISOString();
  }

  function monthsBetweenInclusive(from: Date, to: Date) {
    const a = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)
    );
    const b = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    let months =
      (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
      (b.getUTCMonth() - a.getUTCMonth());
    if (to.getUTCDate() >= from.getUTCDate()) months += 1;
    return Math.max(1, months);
  }

  // --------------- PDF-only success branch ---------------
  const handlePdfOnlySuccess = async (userDoc: any) => {
    const userRef = doc(db, "users", uid);

    const safeFirst = userDoc?.firstName || firstName || "Magic";
    const safeLast = userDoc?.lastName || lastName || "User";
    const fullName = `${safeFirst} ${safeLast}`.trim();

    // Build Groove Guide selections (with ceremony order from customProcessional)
    const selections = patchJamSelections(jamSelections);

    // Generate Groove Guide PDF
    const grooveBlob = await generateGrooveGuidePDF({
      fullName,
      weddingDate,
      selections,
    });

    const fileName = `GrooveGuide_${Date.now()}.pdf`;
    const filePath = `public_docs/${uid}/${fileName}`;
    const grooveUrl = await uploadPdfBlob(grooveBlob, filePath);

    const purchase = {
      label: "Groove Guide PDF",
      category: "jamGroovePdfOnly",
      amount: amountDueToday,
      contractTotal: amountDueToday,
      payFull: true,
      deposit: amountDueToday,
      monthlyAmount: 0,
      months: 0,
      method: "full",
      date: new Date().toISOString(),
      module: "jam",
    };

    const docItem = {
      title: "Groove Guide PDF",
      url: grooveUrl,
      uploadedAt: new Date().toISOString(),
      kind: "guide",
      module: "jam",
    };

    // ❌ No bookings.jam, no weddingDateLocked — this is NOT a DJ booking
    await updateDoc(userRef, {
      documents: arrayUnion(docItem),
      purchases: arrayUnion(purchase),
      spendTotal: increment(amountDueToday),
      lastPurchaseAt: serverTimestamp(),
    });

    await addDoc(collection(db, "users", uid, "documents"), docItem);

    // ✉️ User email ONLY – using Groove Guide template
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      "template_w498nvm",
      {
        firstName: safeFirst,
        user_name: fullName,
        wedding_date: weddingDate || "TBD",
        pdf_url: grooveUrl,
        pdf_title: "Groove Guide PDF",
        dashboardUrl: `${window.location.origin}${
          import.meta.env.BASE_URL
        }dashboard`,
      },
      EMAILJS_PUBLIC_KEY
    );

    window.dispatchEvent(new Event("purchaseMade"));
    // ❌ Do NOT dispatch jamCompletedNow here
    onSuccess();
  };

  // --------------- Full DJ / add-on success branch ---------------
  const handleFullJamSuccess = async (
    userDoc: any,
    customerId?: string | null
  ): Promise<void> => {
    const userRef = doc(db, "users", uid);

    const safeFirst = userDoc?.firstName || firstName || "Magic";
    const safeLast = userDoc?.lastName || lastName || "User";
    const fullName = `${safeFirst} ${safeLast}`.trim();

    const purchase = {
      label: isAddon ? "Jam & Groove Add-On" : "Jam & Groove Booking",
      category: "jam",
      amount: amountDueToday,
      contractTotal: totalEffective,
      payFull,
      deposit: amountDueToday,
      monthlyAmount: payFull ? 0 : round2(remaining / 3),
      months: payFull ? 0 : 3,
      method: payFull ? "full" : "deposit",
      date: new Date().toISOString(),
      module: "jam",
    };

    // PDFs (agreement vs add-on receipt)
    let pdfUrl = "";
    if (isAddon) {
      const purchaseDate = new Date().toLocaleDateString("en-US");
      const pdfBlob = await generateJamAddOnReceiptPDF({
        fullName,
        lineItems,
        total: amountDueToday,
        purchaseDate,
      });
      const fileName = `JamAddOnReceipt_${Date.now()}.pdf`;
      const filePath = `public_docs/${uid}/${fileName}`;
      pdfUrl = await uploadPdfBlob(pdfBlob, filePath);
    } else {
      const pdfBlob = await generateJamAgreementPDF({
        fullName,
        total: totalEffective,
        deposit: payFull ? 0 : amountDueToday,
        paymentSummary: effectiveSummary || "",
        weddingDate,
        signatureImageUrl: signatureImage || "",
        lineItems,
        signatureDate: new Date().toISOString(),
        finalDuePretty, // align with 35-day rule
      });
      const fileName = `JamAgreement_${Date.now()}.pdf`;
      const filePath = `public_docs/${uid}/${fileName}`;
      pdfUrl = await uploadPdfBlob(pdfBlob, filePath);
    }

    const docItem = {
      title: isAddon
        ? "Jam & Groove Add-On Receipt"
        : "Jam & Groove Agreement",
      url: pdfUrl,
      uploadedAt: new Date().toISOString(),
      kind: isAddon ? "receipt" : "agreement",
      module: "jam",
    };

    // paymentPlan + paymentPlanAuto for full DJ bookings (mirror Floral structure)
    const depositPercent = payFull
      ? 1
      : totalEffective > 0
      ? amountDueToday / totalEffective
      : 0;

    const paymentPlanField = isAddon
      ? undefined
      : payFull
      ? {
          product: "jam",
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
          product: "jam",
          type: "deposit",
          total: totalEffective,
          depositPercent,
          paidNow: amountDueToday,
          remainingBalance: remaining,
          finalDueDate: finalDuePretty,
          finalDueAt: finalDueDate
            ? asStartOfDayUTC(finalDueDate).toISOString()
            : null,
          createdAt: new Date().toISOString(),
        };

    const paymentPlanAutoField = isAddon
      ? undefined
      : payFull
      ? {
          version: 1,
          product: "jam",
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
      : (() => {
          const nowUTC = new Date();
          const firstChargeAtISO = nextApproxMonthUTC(nowUTC);
          const firstChargeAt = new Date(firstChargeAtISO);
          const finalISO = finalDueDate
            ? asStartOfDayUTC(finalDueDate).toISOString()
            : null;

          const planMonths =
            finalDueDate && finalISO
              ? monthsBetweenInclusive(firstChargeAt, finalDueDate)
              : 1;

          const remainingCentsTotal = Math.round(remaining * 100);
          const perMonthCents = Math.floor(
            remainingCentsTotal / planMonths
          );
          const lastPaymentCents =
            remainingCentsTotal - perMonthCents * Math.max(0, planMonths - 1);

          return {
            version: 1,
            product: "jam",
            status: "active",
            strategy: "monthly_until_final",
            currency: "usd",
            totalCents: Math.round(totalEffective * 100),
            depositCents: Math.round(amountDueToday * 100),
            remainingCents: remainingCentsTotal,
            planMonths,
            perMonthCents,
            lastPaymentCents,
            nextChargeAt: firstChargeAtISO,
            finalDueAt: finalISO,
            stripeCustomerId:
              customerId ||
              localStorage.getItem("stripeCustomerId") ||
              null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        })();

    await updateDoc(userRef, {
      documents: arrayUnion(docItem),
      purchases: arrayUnion(purchase),
      spendTotal: increment(amountDueToday),
      "bookings.jam": true, // ✅ full DJ booking
      "bookings.updatedAt": serverTimestamp(),
      weddingDateLocked: true,
      lastPurchaseAt: serverTimestamp(),
      ...(paymentPlanField && { paymentPlan: paymentPlanField }),
      ...(paymentPlanAutoField && { paymentPlanAuto: paymentPlanAutoField }),
    });

    await addDoc(collection(db, "users", uid, "documents"), docItem);

    // Cache wedding date lock locally and notify the UI
    try {
      if (weddingDate) localStorage.setItem("weddingDate", weddingDate);
      localStorage.setItem("weddingDateLocked", "true");
    } catch {}
    window.dispatchEvent(new Event("dateLockedNow"));

    // ✅ Send both user + admin emails for Jam booking
    {
      const auth = getAuth();
      const current = auth.currentUser;

      await notifyBooking("jam", {
        user_email:
          current?.email ||
          (userDoc as any)?.email ||
          "unknown@wedndone.com",
        user_full_name: fullName,
        firstName: safeFirst,
        wedding_date: weddingDate || "TBD",
        pdf_url: pdfUrl,
        pdf_title: isAddon
          ? "Jam & Groove Add-On Receipt"
          : "Jam & Groove Agreement",
        total: totalEffective.toFixed(2),
        line_items: (lineItems || []).join(", "),
        payment_now: amountDueToday.toFixed(2),
        remaining_balance: (remaining ?? 0).toFixed(2),
        final_due: finalDuePretty,
        dashboardUrl: `${window.location.origin}${
          import.meta.env.BASE_URL
        }dashboard`,
        product_name: "Jam & Groove (DJ)",
      });
    }

    // Groove Guide if applicable (DJ booked OR guide purchased as add-on)
    const boughtDJ = lineItems.some((i) =>
      i.startsWith("DJ Wed&Done Package")
    );
    const boughtGuide = lineItems.some((i) =>
      i.startsWith("Groove Guide PDF")
    );

    // ⛔ Only generate if we are NOT explicitly reusing an existing guide
    if (!skipGrooveGeneration && (boughtDJ || boughtGuide)) {
      const selections = patchJamSelections(jamSelections);
      const grooveBlob = await generateGrooveGuidePDF({
        fullName: `${firstName} ${lastName}`,
        weddingDate,
        selections,
      });
      const fileName = `GrooveGuide_${Date.now()}.pdf`;
      const filePath = `public_docs/${uid}/${fileName}`;
      const grooveUrl = await uploadPdfBlob(grooveBlob, filePath);

      await updateDoc(userRef, {
        documents: arrayUnion({
          title: "Groove Guide PDF",
          url: grooveUrl,
          uploadedAt: new Date().toISOString(),
          kind: "guide",
          module: "jam",
        }),
      });

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        "template_w498nvm",
        {
          firstName,
          user_name: `${firstName} ${lastName}`,
          wedding_date: weddingDate,
          pdf_url: grooveUrl,
          pdf_title: "Groove Guide PDF",
          dashboardUrl: `${window.location.origin}${
            import.meta.env.BASE_URL
          }dashboard`,
        },
        EMAILJS_PUBLIC_KEY
      );
    }

    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("jamCompletedNow"));
    onSuccess();
  };

  // --------------- Main success handler (Stripe + branches) ---------------
  const handleSuccess = async ({
    customerId,
    paymentMethodId,
  }: {
    customerId?: string;
    paymentMethodId?: string;
  } = {}): Promise<void> => {
    setIsGenerating(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const userDoc = snap.exists() ? snap.data() : {};

      // ✅ Save stripeCustomerId (if new)
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
          console.log("✅ Saved stripeCustomerId to Firestore (jam).");
        }
      } catch (e) {
        console.warn("⚠️ Could not save stripeCustomerId (jam):", e);
      }

      // ✅ Store the specific card used for this Jam payment plan
      // Only for main DJ contract flow (not add-ons, not PDF-only) and only if it's a monthly plan.
      if (!isAddon && !isPdfOnly && !payFull && paymentMethodId) {
        try {
          await updateDoc(userRef, {
            "paymentPlan.paymentMethodId": paymentMethodId,
          });
          console.log(
            "✅ Stored paymentPlan.paymentMethodId for Jam:",
            paymentMethodId
          );
        } catch (err) {
          console.error(
            "❌ Failed to store paymentMethodId on paymentPlan (Jam):",
            err
          );
        }
      }

      // ✅ Decide whether to store card
      const shouldStoreCard = requiresCardOnFile;

      if (shouldStoreCard) {
        try {
          await fetch(`${API_BASE}/ensure-default-payment-method`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              customerId:
                customerId || localStorage.getItem("stripeCustomerId"),
              firebaseUid: user.uid,
            }),
          });
          console.log(
            "✅ Ensured default payment method for Jam customer"
          );
        } catch (err) {
          console.error(
            "❌ Failed to ensure default payment method (Jam):",
            err
          );
        }
      } else {
        console.log(
          "ℹ️ Skipping card-on-file setup for Jam (no consent / pay-in-full without monthly plan)."
        );
      }

      // Now branch into PDF-only vs full DJ / add-on flows
      if (isPdfOnly) {
        await handlePdfOnlySuccess(userDoc);
      } else {
        await handleFullJamSuccess(userDoc, customerId);
      }
    } catch (err) {
      console.error("❌ Jam checkout error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="pixie-card pixie-card--modal" ref={scrollRef}>
      {/* Pink X */}
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
        {isGenerating ? (
          <div className="px-center" style={{ marginTop: 10 }}>
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
              Madge is working her magic… hold tight!
            </h3>
          </div>
        ) : (
          <>
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

            <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
              {effectiveSummary}
            </p>

            {/* Payment Method Selection – mirrors Floral */}
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
  {requiresCardOnFile ? (
    hasSavedCard ? (
      // ✅ Monthly DJ plan + card on file: locked to saved card
      <div style={{ fontSize: ".95rem", textAlign: "left" }}>
        <p style={{ marginBottom: 6 }}>
          Monthly payments for this DJ booking will be charged to your saved card on file:
        </p>
        <p style={{ marginBottom: 4 }}>
          <strong>
            {savedCardSummary!.brand.toUpperCase()} •••• {savedCardSummary!.last4} (exp{" "}
            {savedCardSummary!.exp_month}/{savedCardSummary!.exp_year})
          </strong>
        </p>
        <p style={{ marginTop: 6, fontSize: ".85rem", opacity: 0.8 }}>
          To use a different card for monthly payments, update your saved card in your
          Wed&Done account before your next charge.
        </p>
      </div>
    ) : (
      // ✅ Monthly DJ plan, no saved card yet
      <div style={{ fontSize: ".95rem", textAlign: "left" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "default",
          }}
        >
          <input type="radio" checked readOnly />
          <span>
            Enter your card details. This card will be saved on file for your Jam &amp; Groove
            monthly plan.
          </span>
        </label>
      </div>
    )
  ) : hasSavedCard ? (
    // ✅ Pay-in-full, add-on, or PDF-only with saved card: let them choose
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
          <strong>{savedCardSummary!.brand.toUpperCase()}</strong> ••••{" "}
          {savedCardSummary!.last4} (exp {savedCardSummary!.exp_month}/
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
          name="paymentMode"
          checked={mode === "new"}
          onChange={() => setMode("new")}
        />
        <span>Pay with a different card</span>
      </label>
    </>
  ) : (
    // ✅ No saved card, non-monthly: just enter card
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

            <div className="px-elements">
            <CheckoutForm
  total={amountDueToday}
  useSavedCard={requiresCardOnFile ? hasSavedCard : mode === "saved"}
  onSuccess={handleSuccess}
  setStepSuccess={onSuccess}
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
          </>
        )}
      </div>
    </div>
  );
};

export default JamCheckOut;