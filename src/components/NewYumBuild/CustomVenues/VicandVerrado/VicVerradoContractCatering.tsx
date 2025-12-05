import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { arrayUnion, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db, app } from "../../../../firebase/firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import emailjs from "@emailjs/browser";
import {
  EMAILJS_SERVICE_ID,
  EMAILJS_PUBLIC_KEY,
} from "../../../../config/emailjsConfig";
import { getGuestState } from "../../../../utils/guestCountStore";

// ⬇️ Create this util beside your other PDF gens (see notes below)
import generateVicVerradoAgreementPDF from "../../../../utils/generateVicVerradoAgreementPDF";

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

/* -------------------- types -------------------- */
type Tier = "sunflower" | "rose" | "lily" | "dahlia";
const TIER_LABEL: Record<Tier, string> = {
  sunflower: "Sunflower",
  rose: "Rose",
  lily: "Lily",
  dahlia: "Dahlia",
};

export interface VicVerradoMenuSelections {
  tier: Tier;
  hors: string[];     // (optional for Sunflower – can be empty)
  salads: string[];   // 1
  entrees: string[];  // 1/2/3 by tier
  starch: string[];   // 1
  veg: string[];      // 1
}

interface Props {
  total: number;
  guestCount: number;
  weddingDate: string | null; // "YYYY-MM-DD"
  dayOfWeek: string | null;
  lineItems: string[];

  selectedTier: Tier;
  menuSelections: VicVerradoMenuSelections;

  /* signature is owned by parent overlay */
  signatureImage: string | null;
  setSignatureImage: (v: string) => void;
  signatureSubmitted: boolean;
  setSignatureSubmitted: (v: boolean) => void;

  setStep: (step: string) => void; // use "vicVerradoCheckout" next
  onClose: () => void;
  onComplete: () => void; // after success + FS writes
}

const VicVerradoContractCatering: React.FC<Props> = ({
  total,
  guestCount,
  weddingDate,
  dayOfWeek,
  lineItems,
  selectedTier,
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
  const sigCanvasRef = useRef<any>(null);

  // Hydrated guest count (prop → store → localStorage)
const [lockedGuestCount, setLockedGuestCount] = useState<number>(guestCount || 0);

useEffect(() => {
  let alive = true;

  const hydrate = async () => {
    // If parent passed a valid number, prefer it
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
            Number(localStorage.getItem("vicVerradoGuestCount") || 0) ||
            Number(localStorage.getItem("magicGuestCount") || 0);
        } catch {}
      }

      if (alive) setLockedGuestCount(v);
    } catch {
      // last-resort LS
      try {
        const v =
          Number(localStorage.getItem("vicVerradoGuestCount") || 0) ||
          Number(localStorage.getItem("magicGuestCount") || 0);
        if (alive) setLockedGuestCount(v);
      } catch {}
    }
  };

  hydrate();
  return () => { alive = false; };
}, [guestCount]);

  // ---------- derive policy amounts + dates ----------
  const wedding = parseLocalYMD(weddingDate || "");
  const prettyWedding = wedding ? formatPretty(wedding) : "your wedding date";

  // Final balance due 35 days before wedding
  const dueByDate = wedding ? addDays(wedding, -35) : null;
  const prettyDueBy = dueByDate ? formatPretty(dueByDate) : "";

  // 25% deposit plan
  const depositAmount = Math.round(total * 0.25 * 100) / 100;
  const today = new Date();
  const planMonths = wedding && dueByDate ? monthsBetweenInclusive(today, dueByDate) : 1;

  const totalCents = Math.round(total * 100);
  const depositCents = Math.round(depositAmount * 100);
  const balanceCents = Math.max(0, totalCents - depositCents);
  const perMonthCents = planMonths > 0 ? Math.floor(balanceCents / planMonths) : balanceCents;
  const lastPaymentCents = balanceCents - perMonthCents * Math.max(0, planMonths - 1);

  const paymentSummaryText = payFull
  ? `You’re paying $${Number(total).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} today.`
  : `You’re paying $${Number(depositAmount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} today, then monthly through ${prettyDueBy}. Est. ${planMonths} payments of $${Number(
      perMonthCents / 100
    ).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}${
      planMonths > 1
        ? ` (last ≈ $${Number(lastPaymentCents / 100).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })})`
        : ""
    }`;

  // ---------- init + persist step ----------
  useEffect(() => {
    localStorage.setItem("yumStep", "vicVerradoContract");

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
        await updateDoc(userRef, { "progress.yumYum.step": "vicVerradoContract" });
        await setDoc(doc(userRef, "yumYumData", "vicVerradoSelections"), menuSelections, { merge: true });
        await setDoc(
          doc(userRef, "yumYumData", "vicVerradoCart"),
          {
            guestCount: lockedGuestCount,   // 👈 was guestCount
            tier: selectedTier,
          },
          { merge: true }
        );
        await setDoc(doc(userRef, "yumYumData", "lineItems"), { lineItems }, { merge: true });
      } catch (err) {
        console.error("🔥 Error initializing contract state:", err);
      }
    });

    return () => unsub();
  }, [auth, guestCount, lineItems, menuSelections, selectedTier]);

  /* -------------------- storage helpers -------------------- */
  const uploadPdfBlob = async (blob: Blob, uid: string, title: string): Promise<string> => {
    const storage = getStorage(app, "gs://wedndonev2.firebasestorage.app");
    const filename = `${title.replace(/\s+/g, "")}_${Date.now()}.pdf`;
    const fileRef = ref(storage, `public_docs/${uid}/${filename}`);
    await uploadBytes(fileRef, blob);
    const publicUrl = await getDownloadURL(fileRef);
    await updateDoc(doc(db, "users", uid), {
      documents: arrayUnion({ title, url: publicUrl, uploadedAt: new Date().toISOString() }),
    });
    return publicUrl;
  };

  /* -------------------- signature handlers -------------------- */
  const drawToDataUrl = (): string => {
    try {
      return sigCanvasRef.current?.getCanvas().toDataURL("image/png") || "";
    } catch {
      return "";
    }
  };
  const generateImageFromText = (text: string): string => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 600; canvas.height = 150;
    if (!ctx) return "";
    ctx.fillStyle = "#000";
    ctx.font = "48px 'Jenna Sue', cursive";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL("image/png");
  };

  const handleSignClick = () => {
    if (agreeChecked) setShowSignatureModal(true);
  };

  const handleSignatureSubmit = async () => {
    const finalSignature = useTextSignature
      ? generateImageFromText(typedSignature.trim())
      : drawToDataUrl();

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
        await setDoc(doc(db, "users", u.uid), { yumSignatureImageUrl: finalSignature, yumSigned: true }, { merge: true });
      } catch (e) {
        console.error("❌ Failed to save signature:", e);
      }
    }
  };

  /* -------------------- success → PDF + Firestore -------------------- */
  const handleSuccess = async () => {
    if (!userId) return;
    try {
      setIsGenerating(true);

      // ⬇️ Generate the Vic/Verrado agreement (no charcuterie)
      const pdfBlob = await generateVicVerradoAgreementPDF({
        fullName: `${firstName} ${lastName}`,
        total,
        guestCount: lockedGuestCount,   // 👈
        weddingDate: prettyWedding,
        paymentSummary: paymentSummaryText,
        signatureImageUrl: signatureImage || "",
        tierLabel: TIER_LABEL[selectedTier],
        selections: {
          hors: menuSelections.hors || [],
          salads: menuSelections.salads || [],
          entrees: menuSelections.entrees || [],
          starch: menuSelections.starch || [],
          veg: menuSelections.veg || [],
        },
        lineItems,
      });

      await uploadPdfBlob(pdfBlob, userId, "Vic/Verrado Catering Agreement");

      // Mark booking + purchase
      await updateDoc(doc(db, "users", userId), {
        "bookings.catering": true,
        dateLocked: true,
        yumGuestCount: lockedGuestCount,    // 👈
        vicVerradoTier: selectedTier,
        vicVerradoSelections: menuSelections,
        purchases: arrayUnion({
          label: `Catering (${TIER_LABEL[selectedTier]} tier)`,
          amount: total,
          date: new Date().toISOString(),
        }),
      });

            // lightweight email notice (adjust IDs if you use different service/template)
            await emailjs.send(
              EMAILJS_SERVICE_ID,
              "template_nvsea3z",
              {
                user_email: auth.currentUser?.email || "Unknown",
                user_full_name: `${firstName} ${lastName}`,
                wedding_date: prettyWedding || "Unknown",
                total: total.toFixed(2),
                line_items: `Catering (${TIER_LABEL[selectedTier]}) – ${menuSelections.entrees.join(", ")}`,
              },
              EMAILJS_PUBLIC_KEY
            );

      onComplete();
    } catch (err) {
      console.error("❌ Vic/Verrado contract error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="pixie-overlay">
      <div className="pixie-card" style={{ maxWidth: 700, textAlign: "center" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/yum_yum_button.png`}
          alt="Catering Seal"
          style={{ width: 100, margin: "0 auto 1rem", display: "block" }}
        />

        <h2 style={{ fontSize: "2.5rem", color: "#2c62ba", textAlign: "center", marginBottom: "0.5rem" }}>
          Catering Agreement — {TIER_LABEL[selectedTier]} Tier
        </h2>

        <p style={{ marginBottom: "1.25rem" }}>
          You’re booking catering for <strong>{prettyWedding}</strong> ({dayOfWeek || "TBD"}).
        </p>

        <p style={{ marginBottom: "0.5rem" }}>
          Total catering cost:{" "}
          <strong>
            $
            {Number(total).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>{" "}
          for {lockedGuestCount} guest(s).
        </p>

        {/* Booking Terms */}
        <h3
  style={{
    fontWeight: "bold",
    fontSize: "1.8rem",
    marginBottom: "0.75rem",
    color: "#2c62ba",
    fontFamily: "'Jenna Sue', cursive",
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
    margin: "0 auto",
    maxWidth: "540px",
  }}
>
  <li>
    You may pay in full today, or place a <strong>25% non-refundable deposit</strong>. Any
    remaining balance will be split into monthly installments and must be fully paid{" "}
    <strong>35 days before your wedding date</strong>.
  </li>
  <li>
    Final guest count is due <strong>30 days before</strong> your wedding. You may increase
    your guest count starting 45 days before your wedding, but the count cannot be lowered
    after booking.
  </li>
  <li>
    <strong>Bar Packages:</strong> All alcohol is booked directly with the venue per Arizona
    liquor laws. Wed&Done is not responsible for bar service or alcohol provision.
  </li>
  <li>
    <strong>Cancellation &amp; Refunds:</strong> If you cancel more than 35 days prior,
    amounts paid beyond the non-refundable portion will be refunded less any non-recoverable
    costs already incurred. Within 35 days, all payments are non-refundable.
  </li>
  <li>
    <strong>Missed Payments:</strong> We’ll automatically retry your card. After 7 days, a
    $25 late fee applies; after 14 days, services may be suspended and this agreement may be
    in default.
  </li>
  <li>
    <strong>Food Safety &amp; Venue Policies:</strong> We’ll follow standard food-safety
    guidelines and comply with venue rules, which may limit service or display options.
  </li>
  <li>
    <strong>Force Majeure:</strong> Neither party is liable for delays beyond reasonable
    control (e.g., natural disasters, government actions, labor disputes,
    epidemics/pandemics, utility outages). We’ll work in good faith to reschedule; if not
    possible, we’ll refund amounts paid beyond non-recoverable costs already incurred.
  </li>
  <li>
    In the unlikely event of our cancellation or issue, liability is limited to a refund of
    payments made.
  </li>
</ul>

        <h3 style={{ fontWeight: 800, marginBottom: "0.75rem", fontSize: "1.8rem" }}>
          Choose how you’d like to pay:
        </h3>

        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "1rem" }}>
          <button
            onClick={() => { setPayFull(true); setSignatureSubmitted(false); }}
            style={{
              padding: "1rem",
              borderRadius: 16,
              width: 240,
              background: payFull ? "#2c62ba" : "#ccc",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            Pay Full Amount
          </button>
          <button
            onClick={() => { setPayFull(false); setSignatureSubmitted(false); }}
            style={{
              padding: "1rem",
              borderRadius: 16,
              width: 240,
              background: !payFull ? "#e98fba" : "#ccc",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            25% Deposit + Monthly
          </button>
        </div>

        <p style={{ marginBottom: "0.75rem" }}>{paymentSummaryText}</p>

        <label style={{ display: "inline-block", marginBottom: "1rem" }}>
          <input
            type="checkbox"
            checked={agreeChecked}
            onChange={(e) => setAgreeChecked(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          I agree to the terms above
        </label>

        {/* Signature */}
        {!signatureSubmitted ? (
          <button className="boutique-primary-btn" onClick={handleSignClick} disabled={!agreeChecked}>
            Sign Contract
          </button>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
            <img src={`${import.meta.env.BASE_URL}assets/images/contract_signed.png`} alt="Contract Signed" style={{ width: 120 }} />
          </div>
        )}

        {/* Continue / Back */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", marginTop: "1.25rem" }}>
          <button
            className="boutique-primary-btn"
            onClick={() => {
              if (!signatureSubmitted) return;

              // handoff for checkout
              localStorage.setItem("yumStep", "vicVerradoCheckout");
              localStorage.setItem("yumCateringPayFull", JSON.stringify(payFull));
              localStorage.setItem("yumCateringDepositAmount", String(depositCents));
              localStorage.setItem("yumCateringTotalCents", String(totalCents));
              localStorage.setItem("yumCateringDueBy", dueByDate ? dueByDate.toISOString() : "");
              localStorage.setItem("yumCateringPlanMonths", String(planMonths));
              localStorage.setItem("yumCateringPerMonthCents", String(perMonthCents));
              localStorage.setItem("yumCateringLastPaymentCents", String(lastPaymentCents));

              setStep("vicVerradoCheckout");
            }}
            disabled={!signatureSubmitted}
            style={{ width: 260, opacity: signatureSubmitted ? 1 : 0.5 }}
          >
            Continue to Payment
          </button>

          <button className="boutique-back-btn" onClick={() => setStep("vicVerradoCart")} style={{ width: 260 }}>
            ⬅ Back to Cart
          </button>
        </div>

        {/* Signature Modal */}
        {showSignatureModal && (
          <div
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1200,
              display: "flex", justifyContent: "center", alignItems: "center",
            }}
          >
            <div
              style={{
                background: "#fff", padding: "2rem", borderRadius: 18, width: "90%", maxWidth: 500,
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)", textAlign: "center", position: "relative",
              }}
            >
              <h3 style={{ fontFamily: "'Jenna Sue', cursive", fontSize: "1.8rem", color: "#2c62ba", marginBottom: "1rem" }}>
                Sign below or enter your text signature
              </h3>

              <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <button
                  onClick={() => setUseTextSignature(false)}
                  style={{ padding: ".5rem 1rem", borderRadius: 8, background: !useTextSignature ? "#2c62ba" : "#ccc", color: "#fff", fontWeight: 800 }}
                >
                  Draw
                </button>
                <button
                  onClick={() => setUseTextSignature(true)}
                  style={{ padding: ".5rem 1rem", borderRadius: 8, background: useTextSignature ? "#2c62ba" : "#ccc", color: "#fff", fontWeight: 800 }}
                >
                  Type
                </button>
              </div>

              {!useTextSignature ? (
                <SignatureCanvas
                  penColor="#2c62ba"
                  ref={sigCanvasRef}
                  canvasProps={{
                    width: 400,
                    height: 150,
                    className: "sigCanvas",
                    style: { border: "1px solid #ccc", borderRadius: 10, width: "100%", maxWidth: 400 },
                  }}
                />
              ) : (
                <input
                  type="text"
                  placeholder="Type your name"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  style={{ padding: ".75rem", fontSize: "1rem", width: "100%", borderRadius: 10, border: "1px solid #ccc" }}
                />
              )}

              <button className="boutique-primary-btn" onClick={handleSignatureSubmit} style={{ width: "100%", marginTop: "1rem" }}>
                Save Signature
              </button>

              <button
                onClick={() => setShowSignatureModal(false)}
                style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}
              >
                ✖
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VicVerradoContractCatering;