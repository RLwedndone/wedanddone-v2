import React, { useState, useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import type SignatureCanvasType from "react-signature-canvas";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";
import { db, app } from "../../../firebase/firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import generateYumAgreementPDF from "../../../utils/generateYumAgreementPDF";
import emailjs from "emailjs-com";
import { YumStep } from "../yumTypes";

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
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}
function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
}

/* -------------------- props -------------------- */
interface YumContractCateringProps {
  total: number;
  guestCount: number;
  charcuterieCount: number;
  weddingDate: string | null;
  dayOfWeek: string | null;
  lineItems: string[];
  selectedCuisine: string | null;
  menuSelections: { appetizers: string[]; mains: string[]; sides: string[] };

  signatureImage: string | null;
  setSignatureImage: (value: string) => void;
  signatureSubmitted: boolean;
  setSignatureSubmitted: (value: boolean) => void;

  setStep: (step: YumStep) => void;
  onClose: () => void;
  onComplete: () => void;
}

const YumContractCatering: React.FC<YumContractCateringProps> = ({
  total,
  guestCount,
  charcuterieCount,
  weddingDate,
  dayOfWeek,
  lineItems,
  selectedCuisine,
  menuSelections,
  signatureImage,
  setSignatureImage,
  signatureSubmitted,
  setSignatureSubmitted,
  setStep,
  onClose,
  onComplete,
}) => {
  const auth = getAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [payFull, setPayFull] = useState(true);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [useTextSignature, setUseTextSignature] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const sigCanvasRef = useRef<SignatureCanvasType | null>(null);

  // ---------- derive policy amounts + dates ----------
  const wedding = parseLocalYMD(weddingDate || "");
  const prettyWedding = wedding ? formatPretty(wedding) : "your wedding date";

  const dueByDate = wedding ? addDays(wedding, -35) : null;
  const prettyDueBy = dueByDate ? formatPretty(dueByDate) : "";

  const depositAmount = Math.round(total * 0.25 * 100) / 100;
  const today = new Date();
  const planMonths = wedding && dueByDate ? monthsBetweenInclusive(today, dueByDate) : 1;

  const totalCents = Math.round(total * 100);
  const depositCents = Math.round(depositAmount * 100);
  const balanceCents = Math.max(0, totalCents - depositCents);
  const perMonthCents = planMonths > 0 ? Math.floor(balanceCents / planMonths) : balanceCents;
  const lastPaymentCents = balanceCents - perMonthCents * Math.max(0, planMonths - 1);

  const paymentSummaryText = payFull
    ? `You’re paying $${total.toFixed(2)} today.`
    : `You’re paying $${depositAmount.toFixed(
        2
      )} today, then monthly through ${prettyDueBy}. Est. ${planMonths} payments of $${(
        perMonthCents / 100
      ).toFixed(2)}${planMonths > 1 ? ` (last ≈ $${(lastPaymentCents / 100).toFixed(2)})` : ""}`;

  useEffect(() => {
    localStorage.setItem("yumStep", "contract");
    if (menuSelections) localStorage.setItem("yumMenuSelections", JSON.stringify(menuSelections));
    if (selectedCuisine) localStorage.setItem("yumSelectedCuisine", selectedCuisine);
    if (lineItems) localStorage.setItem("yumLineItems", JSON.stringify(lineItems));

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setUserId(user.uid);

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data() as any;
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
        }

        await updateDoc(userRef, { "progress.yumYum.step": "contract" });
        await setDoc(doc(userRef, "yumYumData", "menuSelections"), { menuSelections }, { merge: true });
        await setDoc(doc(userRef, "yumYumData", "cuisineSelection"), { selectedCuisine }, { merge: true });
        await setDoc(doc(userRef, "yumYumData", "lineItems"), { lineItems }, { merge: true });
      } catch (err) {
        console.error("🔥 Error fetching or saving user info:", err);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem("yumPaymentPlan", payFull ? "full" : "monthly");
    localStorage.setItem("yumCateringPayFull", JSON.stringify(payFull));
  }, [payFull]);

  /* -------------------- storage helpers -------------------- */
  const uploadPdfBlob = async (blob: Blob, uid: string, title: string): Promise<string> => {
    const storage = getStorage(app, "gs://wedndonev2.firebasestorage.app");
    const filename = `${title.replace(/\s+/g, "")}_${Date.now()}.pdf`;
    const filePath = `public_docs/${uid}/${filename}`;
    const fileRef = ref(storage, filePath);
    await uploadBytes(fileRef, blob);
    const publicUrl = await getDownloadURL(fileRef);
    await updateDoc(doc(db, "users", uid), {
      documents: arrayUnion({ title, url: publicUrl, uploadedAt: new Date().toISOString() }),
    });
    return publicUrl;
  };

  /* -------------------- signature helpers -------------------- */
  // Trim transparent margins off a canvas (no external deps)
  function trimTransparent(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const { width, height } = canvas;
    const { data } = ctx.getImageData(0, 0, width, height);

    let top = height,
      left = width,
      right = -1,
      bottom = -1,
      found = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = data[(y * width + x) * 4 + 3];
        if (a !== 0) {
          found = true;
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    if (!found) return canvas;

    const w = Math.max(1, right - left + 1);
    const h = Math.max(1, bottom - top + 1);
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const outCtx = out.getContext("2d");
    if (!outCtx) return canvas;
    outCtx.putImageData(ctx.getImageData(left, top, w, h), 0, 0);
    return out;
  }

  const generateImageFromText = (text: string): string => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 800;
    canvas.height = 200;
    if (!ctx) return "";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.font = "64px 'Jenna Sue', 'Pacifico', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((text || "").trim() || " ", canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL("image/png");
  };

  const handleSignClick = () => {
    if (agreeChecked) setShowSignatureModal(true);
  };

  const handleSignatureSubmit = async () => {
    let finalSignature = "";

    if (useTextSignature && typedSignature.trim()) {
      finalSignature = generateImageFromText(typedSignature.trim());
    } else if (!useTextSignature) {
      const sc = sigCanvasRef.current;
      if (!sc) {
        alert("Signature pad isn’t ready. Please try again.");
        return;
      }
      if (typeof sc.isEmpty === "function" && sc.isEmpty()) {
        alert("Please draw your signature before saving.");
        return;
      }

      try {
        // always use our own trimming (avoid trim-canvas path)
        const base = sc.getCanvas();
        const trimmed = trimTransparent(base);

        // paint onto opaque white canvas so PNG isn't transparent
        const out = document.createElement("canvas");
        out.width = trimmed.width;
        out.height = trimmed.height;
        const ctx = out.getContext("2d");
        if (!ctx) throw new Error("No 2D context");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(trimmed, 0, 0);

        finalSignature = out.toDataURL("image/png");
      } catch (error) {
        console.error("❌ Error capturing drawn signature:", error);
        alert("Something went wrong when capturing your drawn signature. Try again!");
        return;
      }
    } else {
      alert("⚠️ Please enter or draw a signature before saving.");
      return;
    }

    try {
      localStorage.setItem("yumSignature", finalSignature);
    } catch {}

    setSignatureImage(finalSignature);
    setSignatureSubmitted(true);
    setShowSignatureModal(false);

    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          { yumSignatureImageUrl: finalSignature, yumSigned: true },
          { merge: true }
        );
      } catch (error) {
        console.error("❌ Failed to save signature:", error);
      }
    }
  };

  /* -------------------- (optional) PDF gen after success) -------------------- */
  const handleSuccess = async () => {
    if (!userId) return;
    try {
      setIsGenerating(true);

      const pdfBlob = await generateYumAgreementPDF({
        fullName: `${firstName} ${lastName}`,
        total,
        deposit: depositAmount,
        guestCount,
        charcuterieCount,
        weddingDate: prettyWedding,
        signatureImageUrl: signatureImage || "",
        paymentSummary: paymentSummaryText,
        lineItems,
        cuisineType: selectedCuisine || undefined,
        menuSelections,
      });

      await uploadPdfBlob(pdfBlob, userId, "Yum Yum Catering Agreement");

      await updateDoc(doc(db, "users", userId), {
        "bookings.catering": true,
        dateLocked: true,
        yumGuestCount: guestCount,
        yumCharcuterie: charcuterieCount > 0,
        yumMenuSelections: menuSelections,
        purchases: arrayUnion({
          label: "Catering Booking",
          amount: total,
          date: new Date().toISOString(),
        }),
      });

      await emailjs.send(
        "service_xayel1i",
        "template_nvsea3z",
        {
          user_email: auth.currentUser?.email || "Unknown",
          user_full_name: `${firstName} ${lastName}`,
          wedding_date: prettyWedding || "Unknown",
          total: total.toFixed(2),
          line_items: "Catering Booking - " + (menuSelections?.mains?.join(", ") || "N/A"),
        },
        "5Lqtf5AMR9Uz5_5yF"
      );

      onComplete();
    } catch (err) {
      console.error("❌ Yum contract error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    // ⛔️ no pixie-overlay here — parent overlay handles backdrop
    <div className="pixie-card" style={{ maxWidth: 700 }}>
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>
  
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/yum_yum_button.png`}
          alt="Catering Seal"
          className="px-media"
          style={{ maxWidth: 120, marginBottom: 8 }}
        />
  
        <h2 className="px-title-lg" style={{ marginBottom: 6 }}>
          Catering Agreement
        </h2>
  
        <p className="px-prose-narrow" style={{ marginBottom: 8 }}>
          You’re booking catering for <strong>{prettyWedding}</strong>
          {dayOfWeek ? ` (${dayOfWeek})` : ""}.
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
          The total catering cost is <strong>${total.toFixed(2)}</strong>.
        </p>
  
        {/* Booking Terms — blue Jenna Sue */}
        <div className="px-section" style={{ maxWidth: 620, margin: "0 auto 16px" }}>
          <h3 className="px-title-lg" style={{ fontSize: "1.8rem", marginBottom: 8 }}>
            Booking Terms
          </h3>
          <ul
            className="px-prose-narrow"
            style={{ textAlign: "left", margin: "0 auto", maxWidth: 560, lineHeight: 1.6, paddingLeft: "1.25rem" }}
          >
            <li>By signing, you confirm either (a) your venue allows outside caterers, or (b) you’ll book a venue that does.</li>
            <li>You may pay in full today, or place a <strong>25% non-refundable deposit</strong>. Any remaining balance will be split into monthly installments and must be fully paid <strong>35 days before your wedding date</strong>.</li>
            <li>Final guest count is due <strong>30 days before</strong> your wedding. You may increase your guest count starting 45 days before your wedding, but the count cannot be lowered after booking.</li>
            <li><strong>Cancellation &amp; Refunds:</strong> If you cancel more than 35 days prior, amounts paid beyond the non-recoverable portion will be refunded less any non-recoverable costs already incurred. Within 35 days, all payments are non-refundable.</li>
            <li><strong>Missed Payments:</strong> We’ll automatically retry your card. After 7 days, a $25 late fee applies; after 14 days, services may be suspended and this agreement may be in default.</li>
            <li><strong>Food Safety &amp; Venue Policies:</strong> We’ll follow standard food-safety guidelines and comply with venue rules, which may limit service or display options.</li>
            <li><strong>Force Majeure:</strong> Neither party is liable for delays beyond reasonable control. We’ll work in good faith to reschedule; if not possible, we’ll refund amounts paid beyond non-recoverable costs already incurred.</li>
            <li>In the unlikely event of our cancellation or issue, liability is limited to a refund of payments made.</li>
          </ul>
        </div>
  
        {/* Pay plan toggle — same as floral */}
        <h4 className="px-title" style={{ fontSize: "1.8rem", marginBottom: 8 }}>
          Choose how you’d like to pay:
        </h4>
        <div className="px-toggle" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={`px-toggle__btn ${payFull ? "px-toggle__btn--blue px-toggle__btn--active" : ""}`}
            style={{ minWidth: 150, padding: "0.6rem 1rem", fontSize: ".9rem" }}
            onClick={() => {
              setPayFull(true);
              setSignatureSubmitted(false);
              try { localStorage.setItem("yumPayPlan", "full"); } catch {}
            }}
          >
            Pay Full Amount
          </button>
  
          <button
            type="button"
            className={`px-toggle__btn ${!payFull ? "px-toggle__btn--pink px-toggle__btn--active" : ""}`}
            style={{ minWidth: 150, padding: "0.6rem 1rem", fontSize: ".9rem" }}
            onClick={() => {
              setPayFull(false);
              setSignatureSubmitted(false);
              try { localStorage.setItem("yumPayPlan", "monthly"); } catch {}
            }}
          >
            25% Deposit + Monthly
          </button>
        </div>
  
        {/* Summary */}
        <p className="px-prose-narrow" style={{ marginTop: 4 }}>
          {payFull ? (
            <>You’re paying <strong>${total.toFixed(2)}</strong> today.</>
          ) : (
            <>
              You’re paying <strong>${depositAmount.toFixed(2)}</strong> today, then about{" "}
              <strong>${(perMonthCents / 100).toFixed(2)}</strong> monthly until <strong>{prettyDueBy}</strong>
              {planMonths > 1 ? <> (last ≈ <strong>${(lastPaymentCents / 100).toFixed(2)}</strong>)</> : null}.
            </>
          )}
        </p>
  
        {/* Agree & Sign */}
        <div style={{ margin: "10px 0 6px" }}>
          <label className="px-prose-narrow" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={agreeChecked}
              onChange={(e) => setAgreeChecked(e.target.checked)}
            />
            I agree to the terms above
          </label>
        </div>
  
        {!signatureSubmitted ? (
          <button
            className="boutique-primary-btn"
            onClick={handleSignClick}
            disabled={!agreeChecked}
            style={{ width: 250, marginTop: 8 }}
          >
            Sign Contract
          </button>
        ) : (
          <div className="px-cta-col" style={{ marginTop: 8 }}>
            <img
              src={`${import.meta.env.BASE_URL}assets/images/contract_signed.png`}
              alt="Contract Signed"
              className="px-media"
              style={{ maxWidth: 140 }}
            />
            <button
              className="boutique-primary-btn"
              style={{ width: 250 }}
              onClick={() => {
                if (!signatureSubmitted) return;
                const totalCents = Math.round(total * 100);
                const amountDueToday = payFull ? total : depositAmount;
                const amountDueTodayCents = Math.round(amountDueToday * 100);
                try {
                  localStorage.setItem("yumTotal", String(total));
                  localStorage.setItem("yumAmountDueToday", String(amountDueToday));
                  localStorage.setItem("yumPaymentPlan", payFull ? "full" : "monthly");
                  localStorage.setItem("yumCateringPayFull", JSON.stringify(payFull));
                  localStorage.setItem("yumCateringDepositAmount", String(depositCents));
                  localStorage.setItem("yumCateringTotalCents", String(totalCents));
                  localStorage.setItem("yumCateringAmountDueTodayCents", String(amountDueTodayCents));
                  localStorage.setItem("yumCateringDueBy", dueByDate ? dueByDate.toISOString() : "");
                  localStorage.setItem("yumCateringPlanMonths", String(planMonths));
                  localStorage.setItem("yumCateringPerMonthCents", String(perMonthCents));
                  localStorage.setItem("yumCateringLastPaymentCents", String(lastPaymentCents));
                } catch {}
                localStorage.setItem("yumStep", "cateringCheckout");
                setStep("cateringCheckout");
              }}
            >
              Continue to Payment
            </button>
            <button className="boutique-back-btn" onClick={() => setStep("cateringCart")} style={{ width: 250 }}>
              ← Back to Cart
            </button>
          </div>
        )}
      </div>
  
      {/* Signature Modal — single overlay */}
      {showSignatureModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 16,
          }}
        >
          <div
            className="pixie-card pixie-card--modal"
            style={{ maxWidth: 520, position: "relative", overflowY: "hidden" }}
          >
            {/* Blue X */}
            <button
              className="pixie-card__close"
              onClick={() => setShowSignatureModal(false)}
              aria-label="Close"
            >
              <img src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`} alt="Close" />
            </button>
  
            <div className="pixie-card__body" style={{ textAlign: "center" }}>
              <h3 className="px-title-lg" style={{ fontSize: "1.8rem", marginBottom: 12 }}>
                Sign below or enter your text signature
              </h3>
  
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 }}>
                <button
                  className={`px-toggle__btn ${!useTextSignature ? "px-toggle__btn--blue px-toggle__btn--active" : ""}`}
                  style={{ minWidth: 110, padding: ".5rem 1rem" }}
                  onClick={() => setUseTextSignature(false)}
                >
                  Draw
                </button>
                <button
                  className={`px-toggle__btn ${useTextSignature ? "px-toggle__btn--pink px-toggle__btn--active" : ""}`}
                  style={{ minWidth: 110, padding: ".5rem 1rem" }}
                  onClick={() => setUseTextSignature(true)}
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
                    width: 420,
                    height: 160,
                    style: {
                      border: "1px solid #e5e7f0",
                      borderRadius: 10,
                      width: "100%",
                      maxWidth: 420,
                      margin: "0 auto 16px",
                      display: "block",
                    },
                  }}
                />
              ) : (
                <input
                  type="text"
                  placeholder="Type your name"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  className="px-input"
                  style={{ maxWidth: 420, margin: "0 auto 16px" }}
                />
              )}
  
  <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
  <button
    className="boutique-primary-btn"
    onClick={handleSignatureSubmit}
    style={{ width: 260 }}
  >
    Save Signature
  </button>
</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YumContractCatering;