// src/components/jam/JamCheckOut.tsx
import React, { useRef, useState } from "react";
import CheckoutForm from "../../CheckoutForm";
import { useUser } from "../../contexts/UserContext";
import { getAuth } from "firebase/auth";
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

// For Groove Guide PDF emails only
import emailjs from "@emailjs/browser";
emailjs.init(import.meta.env.VITE_EMAILJS_PUBLIC_KEY);

// helpers
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const MS_DAY = 24 * 60 * 60 * 1000;
const prettyDate = (ymd?: string | null) => {
  if (!ymd) return "35 days before your wedding date";
  const d = new Date(`${ymd}T12:00:00`);
  if (isNaN(d.getTime())) return "35 days before your wedding date";
  d.setTime(d.getTime() - 35 * MS_DAY);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

// patch selections for Groove Guide
const patchJamSelections = (original: JamSelectionsType): GrooveGuideData["selections"] => {
  const safe = (val: any) => (val === undefined || val === null || val === "" ? "no user input" : val);
  return {
    ceremonyOrder: {
      first: safe(original?.ceremonyOrder?.first),
      second: safe(original?.ceremonyOrder?.second),
      third: safe(original?.ceremonyOrder?.third),
      fourth: safe(original?.ceremonyOrder?.fourth),
      fifth: safe(original?.ceremonyOrder?.fifth),
      sixth: safe(original?.ceremonyOrder?.sixth),
      additional: safe(original?.ceremonyOrder?.additional),
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
      skipFatherDaughter: original?.familyDances?.skipFatherDaughter ?? true,
      fatherDaughterSong: safe(original?.familyDances?.fatherDaughterSong),
      fatherDaughterArtist: safe(original?.familyDances?.fatherDaughterArtist),
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
      bridesmaidsArtist: safe(original?.grandEntrances?.bridesmaidsArtist),
      groomsmenSong: safe(original?.grandEntrances?.groomsmenSong),
      groomsmenArtist: safe(original?.grandEntrances?.groomsmenArtist),
    },
    cakeCutting: {
      doCakeCutting: original?.cakeCutting?.doCakeCutting ?? false,
      song: safe(original?.cakeCutting?.song),
      artist: safe(original?.cakeCutting?.artist),
    },
    musicalGenres: Object.fromEntries(
      Object.entries(original?.musicalGenres ?? {}).map(([k, v]) => [k, safe(v)])
    ),
  };
};

interface JamCheckOutProps {
  onClose: () => void;
  isAddon?: boolean;
  total: number;
  depositAmount: number;   // flat deposit provided by cart (usually 750, capped by total)
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
}

const JamCheckOut: React.FC<JamCheckOutProps> = ({
  onClose,
  isAddon = false,
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
}) => {
  const { userData } = useUser();
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  if (!userData) return <p style={{ textAlign: "center" }}>Loading your info...</p>;

  // Payment math (prefer provided flat deposit, else LS, else 25%)
  const totalEffective = round2(Number(total) || 0);
  const depositFromProp = Number(depositAmount);
  const depositFromLS = Number(localStorage.getItem("jamDepositAmount") || "");
  const deposit25 = round2(totalEffective * 0.25);

  const depositNow =
    Number.isFinite(depositFromProp) && depositFromProp > 0
      ? round2(depositFromProp)
      : Number.isFinite(depositFromLS) && depositFromLS > 0
      ? round2(depositFromLS)
      : deposit25;

  const amountDueToday = payFull ? totalEffective : Math.min(totalEffective, depositNow);
  const remaining = round2(Math.max(0, totalEffective - amountDueToday));
  const finalDuePretty = prettyDate(weddingDate);

  // Success handler
  const handleSuccess = async (): Promise<void> => {
    setIsGenerating(true);
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      const userDoc = snap.exists() ? snap.data() : {};

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

      // PDFs
      let pdfUrl = "";
      if (isAddon) {
        const purchaseDate = new Date().toLocaleDateString("en-US");
        const pdfBlob = await generateJamAddOnReceiptPDF({
          fullName: `${firstName} ${lastName}`,
          lineItems,
          total: amountDueToday,
          purchaseDate,
        });
        const fileName = `JamAddOnReceipt_${Date.now()}.pdf`;
        const filePath = `public_docs/${uid}/${fileName}`;
        pdfUrl = await uploadPdfBlob(pdfBlob, filePath);
      } else {
        const pdfBlob = await generateJamAgreementPDF({
          fullName: `${firstName} ${lastName}`,
          total: totalEffective,
          deposit: payFull ? totalEffective : amountDueToday,
          paymentSummary,
          weddingDate,
          signatureImageUrl: signatureImage,
          lineItems,
        });
        const fileName = `JamAgreement_${Date.now()}.pdf`;
        const filePath = `public_docs/${uid}/${fileName}`;
        pdfUrl = await uploadPdfBlob(pdfBlob, filePath);
      }

      const docItem = {
        title: isAddon ? "Jam & Groove Add-On Receipt" : "Jam & Groove Agreement",
        url: pdfUrl,
        uploadedAt: new Date().toISOString(),
        kind: isAddon ? "receipt" : "agreement",
        module: "jam",
      };

      await updateDoc(userRef, {
        documents: arrayUnion(docItem),
        purchases: arrayUnion(purchase),
        spendTotal: increment(amountDueToday),
        bookings: { ...(userDoc as any)?.bookings, jam: true },
        weddingDateLocked: true,
        lastPurchaseAt: serverTimestamp(),
      });
      await addDoc(collection(db, "users", uid, "documents"), docItem);

      // ✅ Send both user + admin emails for Jam
{
  const auth = getAuth();
  const current = auth.currentUser;

  // Prefer Firestore names if present, then props, then friendly defaults
  const safeFirst =
    (userDoc as any)?.firstName || firstName || "Magic";
  const safeLast =
    (userDoc as any)?.lastName || lastName || "User";
  const fullName = `${safeFirst} ${safeLast}`;

  await notifyBooking("jam", {
    // EmailJS "To:" (user email); admin templates ignore this field
    user_email: current?.email || (userDoc as any)?.email || "unknown@wedndone.com",
    user_full_name: fullName,
    firstName: safeFirst,

    wedding_date: weddingDate || "TBD",

    // Link to the PDF we just uploaded
    pdf_url: pdfUrl,
    pdf_title: isAddon ? "Jam & Groove Add-On Receipt" : "Jam & Groove Agreement",

    // Common details
    total: totalEffective.toFixed(2),
    line_items: (lineItems || []).join(", "),

    // Optional finance details if you want them to appear in user templates
    payment_now: amountDueToday.toFixed(2),
    remaining_balance: (remaining ?? 0).toFixed(2),
    final_due: prettyDate(weddingDate),

    // Dashboard CTA
    dashboardUrl: `${window.location.origin}${import.meta.env.BASE_URL}dashboard`,

    // Ensure the admin headline/body shows the right product name
    product_name: "Jam & Groove (DJ)",
  });
}

      // Groove Guide if applicable
      const boughtDJ = lineItems.some((i) => i.startsWith("DJ Wed&Done Package"));
      const boughtGuide = lineItems.some((i) => i.startsWith("Groove Guide PDF"));
      if (boughtDJ || boughtGuide) {
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
        await emailjs.send("service_xayel1i", "template_w498nvm", {
          user_name: `${firstName} ${lastName}`,
          wedding_date: weddingDate,
          pdf_url: grooveUrl,
          pdf_title: "Groove Guide PDF",
        });
      }

      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("jamCompletedNow"));
      onSuccess();
    } catch (err) {
      console.error("❌ Jam checkout error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="pixie-card pixie-card--modal" ref={scrollRef}>
      {/* Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
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
              {paymentSummary
                ? paymentSummary
                : payFull
                ? `You're paying $${totalEffective.toFixed(2)} today.`
                : `You're paying a $${amountDueToday.toFixed(
                    2
                  )} deposit today. Remaining $${remaining.toFixed(
                    2
                  )} will be billed monthly, with the final payment due ${finalDuePretty}.`}
            </p>

            <div className="px-elements">
  <CheckoutForm
    total={amountDueToday}
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

            <div className="px-cta-col" style={{ marginTop: 12 }}>
              <button className="boutique-back-btn" onClick={onBack}>
                ⬅ Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default JamCheckOut;