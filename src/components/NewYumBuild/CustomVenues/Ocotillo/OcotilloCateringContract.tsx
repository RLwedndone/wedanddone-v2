// src/components/NewYumBuild/CustomVenues/Ocotillo/OcotilloCateringContract.tsx
import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  arrayUnion,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db, app } from "../../../../firebase/firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import emailjs from "@emailjs/browser";
import {
  EMAILJS_SERVICE_ID,
  EMAILJS_PUBLIC_KEY,
} from "../../../../config/emailjsConfig";
import { getGuestState } from "../../../../utils/guestCountStore";

import generateOcotilloAgreementPDF from "../../../../utils/generateOcotilloAgreementPDF";

/* -------------------- date + money helpers -------------------- */
const MS_DAY = 24 * 60 * 60 * 1000;

function parseLocalYMD(ymd?: string | null): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00`);
}
function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * MS_DAY);
}
function formatPretty(d: Date) {
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
}

/* -------------------- types -------------------- */
export type OcotilloTierId = "tier1" | "tier2" | "tier3";

const TIER_LABEL: Record<OcotilloTierId, string> = {
  tier1: "Tier 1",
  tier2: "Tier 2",
  tier3: "Tier 3",
};

export interface OcotilloMenuSelections {
  tier: OcotilloTierId;
  appetizers: string[];
  salads: string[];
  entrees: string[];
  desserts: string[];
}

interface Props {
  total: number;
  guestCount: number;
  weddingDate: string | null; // "YYYY-MM-DD"
  dayOfWeek: string | null;
  lineItems: string[];

  selectedTier: OcotilloTierId;
  menuSelections: OcotilloMenuSelections;

  signatureImage: string | null;
  setSignatureImage: (v: string) => void;
  signatureSubmitted: boolean;
  setSignatureSubmitted: (v: boolean) => void;

  setStep: (step: string) => void; // ex: "cateringCheckout"
  onClose: () => void;
  onComplete: () => void; // after success Firestore + PDF
}

const OcotilloCateringContract: React.FC<Props> = ({
  total,
  weddingDate,
  dayOfWeek,
  lineItems,
  selectedTier,
  menuSelections,
  guestCount,

  signatureImage,
  setSignatureImage,
  signatureSubmitted,
  setSignatureSubmitted,

  setStep,
  onClose,
  onComplete,
}) => {
  const auth = getAuth();

  // user bits for PDF + email
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // UI state
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [payFull, setPayFull] = useState(true); // full vs 25% deposit
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  // locked guest count that we'll actually persist
  const [lockedGuestCount, setLockedGuestCount] = useState<number>(guestCount || 0);

  // hydrate confirmed guest count
  useEffect(() => {
    let alive = true;
    const hydrate = async () => {
      // prefer prop if valid
      if (Number.isFinite(guestCount) && guestCount > 0) {
        if (alive) setLockedGuestCount(guestCount);
        return;
      }

      try {
        const st = await getGuestState();
        let v = Number(st.value || 0);

        if (!v) {
          // cart snapshot fallback(s)
          try {
            v =
              Number(localStorage.getItem("ocotilloGuestCount") || 0) ||
              Number(localStorage.getItem("magicGuestCount") || 0);
          } catch {}
        }

        if (alive) setLockedGuestCount(v);
      } catch {
        try {
          const v =
            Number(localStorage.getItem("ocotilloGuestCount") || 0) ||
            Number(localStorage.getItem("magicGuestCount") || 0);
          if (alive) setLockedGuestCount(v);
        } catch {}
      }
    };

    hydrate();
    return () => {
      alive = false;
    };
  }, [guestCount]);

  /* ---------- derive payment plan numbers ---------- */
  const wedding = parseLocalYMD(weddingDate || "");
  const prettyWedding = wedding ? formatPretty(wedding) : "your wedding date";

  // Final balance due 35 days before wedding
  const dueByDate = wedding ? addDays(wedding, -35) : null;
  const prettyDueBy = dueByDate ? formatPretty(dueByDate) : "";

  // deposit option
  const depositAmount = Math.round(total * 0.25 * 100) / 100;
  const today = new Date();
  const planMonths = wedding && dueByDate ? monthsBetweenInclusive(today, dueByDate) : 1;

  const totalCents = Math.round(total * 100);
  const depositCents = Math.round(depositAmount * 100);
  const balanceCents = Math.max(0, totalCents - depositCents);
  const perMonthCents =
    planMonths > 0 ? Math.floor(balanceCents / planMonths) : balanceCents;
  const lastPaymentCents = balanceCents - perMonthCents * Math.max(0, planMonths - 1);

  const paymentSummaryText = payFull
    ? `You’re paying $${Number(total).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} today.`
    : `You’re paying $${depositAmount.toFixed(
        2
      )} today, then monthly through ${prettyDueBy}. Est. ${planMonths} payments of $${(
        perMonthCents / 100
      ).toFixed(2)}${
        planMonths > 1 ? ` (last ≈ $${Number((lastPaymentCents / 100)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})})` : ""
      }`;

  /* ---------- init + persist step ---------- */
  useEffect(() => {
    try {
      localStorage.setItem("yumStep", "ocotilloContract");
    } catch {}

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUserId(u.uid);

      try {
        const userRef = doc(db, "users", u.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const d = userSnap.data() as any;
          setFirstName(d.firstName || "");
          setLastName(d.lastName || "");
        }

        // progress + snapshot
        await updateDoc(userRef, {
          "progress.yumYum.step": "ocotilloContract",
        });

        await setDoc(
          doc(userRef, "yumYumData", "ocotilloSelections"),
          menuSelections,
          { merge: true }
        );

        await setDoc(
          doc(userRef, "yumYumData", "ocotilloCart"),
          {
            guestCount: lockedGuestCount,
            tier: selectedTier,
          },
          { merge: true }
        );

        await setDoc(
          doc(userRef, "yumYumData", "lineItems"),
          { lineItems },
          { merge: true }
        );
      } catch (err) {
        console.error("🔥 [Ocotillo][Contract] init error:", err);
      }
    });

    return () => unsub();
  }, [auth, lockedGuestCount, menuSelections, selectedTier, lineItems]);

  /* ---------- storage helpers ---------- */
  const uploadPdfBlob = async (blob: Blob, uid: string, title: string): Promise<string> => {
    const storage = getStorage(app, "gs://wedndonev2.firebasestorage.app");
    const filename = `${title
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/gi, "")}_${Date.now()}.pdf`;
    const fileRef = ref(storage, `public_docs/${uid}/${filename}`);
    await uploadBytes(fileRef, blob);
    const publicUrl = await getDownloadURL(fileRef);

    await updateDoc(doc(db, "users", uid), {
      documents: arrayUnion({
        title,
        url: publicUrl,
        uploadedAt: new Date().toISOString(),
      }),
    });

    return publicUrl;
  };

  /* ---------- signature helpers ---------- */
  const sigToDataUrl = (): string => {
    try {
      const c =
        sigCanvasRef.current?.getCanvas?.() ||
        (sigCanvasRef.current as any)?._canvas;
      if (!c || typeof c.toDataURL !== "function") {
        return "";
      }
      return c.toDataURL("image/png");
    } catch {
      return "";
    }
  };

  const generateImageFromText = (text: string): string => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 600;
    canvas.height = 150;
    if (!ctx) return "";
    ctx.fillStyle = "#000";
    ctx.font = "48px 'Jenna Sue', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL("image/png");
  };

  const handleSignClick = () => {
    if (agreeChecked) setShowSignatureModal(true);
  };

  const handleSignatureSubmit = async () => {
    const finalSignature = useTextSignature
      ? generateImageFromText(typedSignature.trim())
      : sigToDataUrl();

    if (!finalSignature) {
      alert("Please enter or draw a signature.");
      return;
    }

    setSignatureImage(finalSignature);
    setSignatureSubmitted(true);
    setShowSignatureModal(false);

    const u = auth.currentUser;
    if (u) {
      try {
        await setDoc(
          doc(db, "users", u.uid),
          {
            yumSignatureImageUrl: finalSignature,
            yumSigned: true,
          },
          { merge: true }
        );
      } catch (e) {
        console.error("❌ Failed to save signature:", e);
      }
    }
  };

  /* ---------- finalize success → PDF + Firestore ---------- */
  const handleSuccess = async () => {
    if (!userId) return;
    try {
      setIsGenerating(true);

      // Build Ocotillo PDF
      const pdfBlob = await generateOcotilloAgreementPDF({
        fullName: `${firstName} ${lastName}`,
        total,
        guestCount: lockedGuestCount,
        weddingDate: prettyWedding,
        paymentSummary: paymentSummaryText,
        signatureImageUrl: signatureImage || "",
        tierLabel: TIER_LABEL[selectedTier],
        selections: {
          appetizers: menuSelections.appetizers || [],
          salads: menuSelections.salads || [],
          entrees: menuSelections.entrees || [],
          desserts: menuSelections.desserts || [],
        },
        lineItems,
      });

      // Upload PDF + attach to user docs
      await uploadPdfBlob(pdfBlob, userId, "Ocotillo Catering Agreement");

      // Mark booking
      await updateDoc(doc(db, "users", userId), {
        "bookings.catering": true,
        dateLocked: true,
        yumGuestCount: lockedGuestCount,
        ocotilloTier: selectedTier,
        ocotilloSelections: menuSelections,
        purchases: arrayUnion({
          label: `Ocotillo Catering (${TIER_LABEL[selectedTier]})`,
          amount: total,
          date: new Date().toISOString(),
        }),
      });

            // Heads-up email
            try {
              await emailjs.send(
                EMAILJS_SERVICE_ID,
                "template_nvsea3z",
                {
                  user_email: auth.currentUser?.email || "Unknown",
                  user_full_name: `${firstName} ${lastName}`,
                  wedding_date: prettyWedding || "Unknown",
                  total: total.toFixed(2),
                  line_items: `Ocotillo Catering (${TIER_LABEL[selectedTier]}) – ${menuSelections.entrees.join(
                    ", "
                  )}`,
                },
                EMAILJS_PUBLIC_KEY
              );
            } catch (err) {
              console.warn("⚠️ emailjs send failed:", err);
            }

      onComplete();
    } catch (err) {
      console.error("❌ [Ocotillo][Contract] finalize error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  /* ---------- RENDER ---------- */
  return (
    <>
      {/* Boutique white card wrapper */}
      <div
        className="pixie-card wd-page-turn"
        style={{
          maxWidth: 600,
          width: "100%",
          textAlign: "center",
          position: "relative",
          padding: "2.5rem 1.75rem 2rem",
          boxSizing: "border-box",
          background: "#fff",
          borderRadius: 24,
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        }}
      >
        {/* Pink X close */}
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
  
        {/* Top padding so seal isn’t clipped */}
        <div style={{ paddingTop: "1rem", textAlign: "center" }}>
          <img
            src={`${import.meta.env.BASE_URL}assets/images/yum_yum_button.png`}
            alt="Catering Seal"
            style={{
              width: 90,
              margin: "0 auto 1rem",
              display: "block",
            }}
          />

          <h2
            style={{
              fontSize: "2.5rem",
              color: "#2c62ba",
              textAlign: "center",
              marginBottom: "0.5rem",
              fontFamily: "'Jenna Sue', cursive",
            }}
          >
            Catering Agreement — {TIER_LABEL[selectedTier]}
          </h2>

          <p style={{ marginBottom: "1.25rem" }}>
            You’re booking catering for{" "}
            <strong>{prettyWedding}</strong>{" "}
            ({dayOfWeek || "TBD"}).
          </p>

          <p style={{ marginBottom: "0.5rem" }}>
            Total catering cost:{" "}
            <strong>${Number(total).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong>{" "}
            for {lockedGuestCount} guest
            {lockedGuestCount === 1 ? "" : "s"}.
          </p>
        </div>

        {/* Booking Terms */}
        <h3
          style={{
            fontWeight: "bold",
            fontSize: "1.8rem",
            marginBottom: "0.75rem",
            color: "#2c62ba",
            fontFamily: "'Jenna Sue', cursive",
            textAlign: "center",
          }}
        >
          Booking Terms
        </h3>

        <ul
  style={{
    fontSize: "0.95rem",
    lineHeight: 1.6,
    paddingLeft: "1.25rem",
    textAlign: "left",
    margin: "0 auto 1.5rem",
    maxWidth: "540px",
  }}
>
  <li>
    <strong>Payment Options.</strong> You may pay your Ocotillo catering total in full today, or
    place a <strong>25% non-refundable deposit</strong>. Any remaining balance will be split into
    monthly installments so that the full catering amount is paid{" "}
    <strong>35 days before your wedding date</strong>. Any unpaid balance on that date will be
    automatically charged.
  </li>

  <li>
    <strong>Card Authorization &amp; Saved Card.</strong> By completing this booking, you authorize
    Wed&amp;Done and our payment processor (Stripe) to securely store your card for: (a) Ocotillo
    catering installment payments and any remaining catering balance under this agreement, and (b)
    future Wed&amp;Done bookings you choose to make, for your convenience. Your card details are
    encrypted and handled by Stripe, and you may update your saved card at any time in your
    Wed&amp;Done account.
  </li>

  <li>
    Final guest count is due <strong>30 days before</strong> your wedding. You may increase your
    guest count starting 45 days before your wedding, but the count cannot be lowered after booking.
  </li>

  <li>
    <strong>Bar Packages:</strong> All alcohol is booked directly with the venue per Arizona liquor
    laws. Wed&amp;Done is not responsible for bar service or alcohol provision.
  </li>

  <li>
    <strong>Cancellation &amp; Refunds:</strong> If you cancel more than 35 days prior, amounts paid
    beyond the non-refundable portion will be refunded less any non-recoverable costs already
    incurred. Within 35 days, all payments are non-refundable.
  </li>

  <li>
    <strong>Missed Payments:</strong> We’ll automatically retry your card. After 7 days, a $25 late
    fee applies; after 14 days, services may be suspended and this agreement may be in default.
  </li>

  <li>
    <strong>Food Safety &amp; Venue Policies:</strong> We’ll follow standard food-safety guidelines
    and comply with venue rules, which may limit service or display options.
  </li>

  <li>
    <strong>Force Majeure:</strong> Neither party is liable for delays beyond reasonable control
    (e.g., natural disasters, government actions, labor disputes, epidemics/pandemics, utility
    outages). We’ll work in good faith to reschedule; if not possible, we’ll refund amounts paid
    beyond non-recoverable costs already incurred.
  </li>

  <li>
    In the unlikely event of our cancellation or issue, liability is limited to a refund of payments
    made.
  </li>
</ul>

        {/* Pay plan toggle */}
        <h3
  style={{
    fontWeight: 800,
    marginBottom: "0.75rem",
    fontSize: "1.8rem",
    fontFamily: "'Jenna Sue', cursive",
    color: "#2c62ba",
    textAlign: "center",
  }}
>
  Choose how you’d like to pay:
</h3>

<div
  style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "1rem",
  }}
>
  <button
    onClick={() => {
      setPayFull(true);
      setSignatureSubmitted(false);
    }}
    style={{
      padding: "1rem",
      borderRadius: 16,
      width: 240,
      background: payFull ? "#2c62ba" : "#ccc",
      color: "#fff",
      fontWeight: 800,
      transition: "all 0.3s ease",
    }}
  >
    Pay Full Amount
  </button>
  <button
    onClick={() => {
      setPayFull(false);
      setSignatureSubmitted(false);
    }}
    style={{
      padding: "1rem",
      borderRadius: 16,
      width: 240,
      background: !payFull ? "#e98fba" : "#ccc",
      color: "#fff",
      fontWeight: 800,
      transition: "all 0.3s ease",
    }}
  >
    25% Deposit + Monthly
  </button>
</div>

        <p
          style={{
            marginBottom: "0.75rem",
            textAlign: "center",
          }}
        >
          {paymentSummaryText}
        </p>

        {/* agree checkbox */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: ".5rem",
            marginBottom: "1rem",
            fontSize: "1rem",
          }}
        >
          <input
            type="checkbox"
            checked={agreeChecked}
            onChange={(e) => setAgreeChecked(e.target.checked)}
          />
          <span>I agree to the terms above</span>
        </label>

        {/* Signature button / status */}
        {!signatureSubmitted ? (
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            <button
              className="boutique-primary-btn"
              onClick={handleSignClick}
              disabled={!agreeChecked}
              style={{
                width: 260,
                opacity: agreeChecked ? 1 : 0.5,
                cursor: agreeChecked ? "pointer" : "not-allowed",
              }}
            >
              Sign Contract
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/images/contract_signed.png`}
              alt="Contract Signed"
              style={{ width: 120 }}
            />
          </div>
        )}

        {/* Continue / Back */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            marginTop: "1.25rem",
          }}
        >
          <button
  className="boutique-primary-btn"
  onClick={() => {
    if (!signatureSubmitted) return;

    try {
      // ---- Generic yum handoff (backwards compatible) ----
      localStorage.setItem("yumStep", "cateringCheckout");
      localStorage.setItem("yumCateringPayFull", JSON.stringify(payFull));
      localStorage.setItem("yumCateringDepositAmount", String(depositCents));
      localStorage.setItem("yumCateringTotalCents", String(totalCents));
      localStorage.setItem(
        "yumCateringDueBy",
        dueByDate ? dueByDate.toISOString() : ""
      );
      localStorage.setItem("yumCateringPlanMonths", String(planMonths));
      localStorage.setItem(
        "yumCateringPerMonthCents",
        String(perMonthCents)
      );
      localStorage.setItem(
        "yumCateringLastPaymentCents",
        String(lastPaymentCents)
      );

      // ---- Ocotillo-specific handoff (what checkout actually reads first) ----
      localStorage.setItem("ocotilloPayFull", JSON.stringify(payFull));
      localStorage.setItem("ocotilloDepositAmountCents", String(depositCents));
      localStorage.setItem("ocotilloTotalCents", String(totalCents));
      localStorage.setItem("ocotilloPlanMonths", String(planMonths));
      localStorage.setItem(
        "ocotilloPerMonthCents",
        String(perMonthCents)
      );
      localStorage.setItem(
        "ocotilloLastPaymentCents",
        String(lastPaymentCents)
      );

      if (dueByDate) {
        localStorage.setItem("ocotilloDueByISO", dueByDate.toISOString());
      }
      if (weddingDate) {
        localStorage.setItem("ocotilloWeddingDate", weddingDate);
      }
      if (dayOfWeek) {
        localStorage.setItem("ocotilloDayOfWeek", dayOfWeek);
      }

      localStorage.setItem(
        "ocotilloPaymentSummaryText",
        paymentSummaryText
      );
      localStorage.setItem(
        "ocotilloTierLabel",
        TIER_LABEL[selectedTier]
      );
      localStorage.setItem(
        "ocotilloSelections",
        JSON.stringify(menuSelections)
      );
      localStorage.setItem(
        "ocotilloLineItems",
        JSON.stringify(lineItems)
      );

      if (signatureImage) {
        localStorage.setItem("ocotilloSignatureImage", signatureImage);
      }
    } catch {
      // non-fatal, checkout has fallbacks
    }

    // Step name stays whatever your overlay expects
    setStep("cateringCheckout");
  }}
  disabled={!signatureSubmitted}
  style={{
    width: 260,
    opacity: signatureSubmitted ? 1 : 0.5,
    cursor: signatureSubmitted ? "pointer" : "not-allowed",
  }}
>
  Continue to Payment
</button>

          <button
            className="boutique-back-btn"
            onClick={() => setStep("cateringCart")}
            style={{ width: 260 }}
          >
            ⬅ Back to Cart
          </button>
        </div>

        {/* signature modal overlay */}
        {showSignatureModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 1200,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "1rem",
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "2rem",
                borderRadius: 18,
                width: "100%",
                maxWidth: 500,
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                textAlign: "center",
                position: "relative",
              }}
            >
              <h3
                style={{
                  fontFamily: "'Jenna Sue', cursive",
                  fontSize: "1.8rem",
                  color: "#2c62ba",
                  marginBottom: "1rem",
                }}
              >
                Sign below or enter your text signature
              </h3>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: ".75rem",
                  marginBottom: ".75rem",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => setUseTextSignature(false)}
                  style={{
                    padding: ".5rem 1rem",
                    borderRadius: 8,
                    background: !useTextSignature ? "#2c62ba" : "#ccc",
                    color: "#fff",
                    fontWeight: 800,
                  }}
                >
                  Draw
                </button>
                <button
                  onClick={() => setUseTextSignature(true)}
                  style={{
                    padding: ".5rem 1rem",
                    borderRadius: 8,
                    background: useTextSignature ? "#2c62ba" : "#ccc",
                    color: "#fff",
                    fontWeight: 800,
                  }}
                >
                  Type
                </button>
              </div>

              {!useTextSignature ? (
                <SignatureCanvas
                  penColor="#2c62ba"
                  ref={sigCanvasRef}
                  backgroundColor="#ffffff"
                  canvasProps={{
                    width: 400,
                    height: 150,
                    className: "sigCanvas",
                    style: {
                      border: "1px solid #ccc",
                      borderRadius: 10,
                      width: "100%",
                      maxWidth: 400,
                    },
                  }}
                />
              ) : (
                <input
                  type="text"
                  placeholder="Type your name"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  style={{
                    padding: ".75rem",
                    fontSize: "1rem",
                    width: "100%",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                  }}
                />
              )}

              <button
                className="boutique-primary-btn"
                onClick={handleSignatureSubmit}
                style={{
                  width: "100%",
                  marginTop: "1rem",
                }}
              >
                Save Signature
              </button>

              <button
                onClick={() => setShowSignatureModal(false)}
                style={{
                  position: "absolute",
                  top: "1rem",
                  right: "1rem",
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  lineHeight: 1,
                  color: "#2c62ba",
                  fontWeight: 800,
                }}
                aria-label="Close signature modal"
              >
                ✖
              </button>
            </div>
          </div>
        )}

        {/* hidden finalize trigger for post-Stripe */}
        {isGenerating && (
          <div
            style={{
              fontSize: ".9rem",
              marginTop: "0.5rem",
              opacity: 0.7,
              textAlign: "center",
            }}
          >
            Finalizing your agreement…
          </div>
        )}
        <button style={{ display: "none" }} onClick={handleSuccess} />
      </div>
    </>
  );
};

export default OcotilloCateringContract;