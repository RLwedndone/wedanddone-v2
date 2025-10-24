// src/components/NewYumBuild/CustomVenues/Bates/BatesOverlay.tsx
import React, { useEffect, useState, useRef } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db, app } from "../../../../firebase/firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Generators
import generateYumAgreementPDF from "../../../../utils/generateYumAgreementPDF";

// Catering screens
import BatesIntro from "./BatesIntro";
import BatesMenuBuilderCatering from "./BatesMenuBuilderCatering";
import BatesCartCatering from "./BatesCartCatering";
import BatesContractCatering from "./BatesContractCatering";
import BatesCheckOutCatering from "./BatesCheckOutCatering";
import BatesCateringThankYou from "./BatesCateringThankYou";

// Dessert screens
import BatesDessertSelector from "./BatesDessertSelector";
import BatesDessertMenu from "./BatesDessertMenu";
import BatesDessertCart from "./BatesDessertCart";
import BatesDessertContract from "./BatesDessertContract";
import BatesDessertCheckout from "./BatesDessertCheckout";
import BatesDessertThankYou from "./BatesDessertThankYou";

// Final “both done”
import BatesBothDoneThankYou from "./BatesBothDoneThankYou";

// UX helpers
import { useOverlayOpen } from "../../../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../../../hooks/useScrollToTop";

// Types
type DessertType = "tieredCake" | "smallCakeTreats" | "treatsOnly";

export type BatesStep =
  | "intro"
  | "cateringMenu"
  | "cateringCart"
  | "cateringContract"
  | "cateringCheckout"
  | "batesCateringThankYou"
  | "dessertStyle"
  | "dessertMenu"
  | "dessertCart"
  | "dessertContract"
  | "dessertCheckout"
  | "batesDessertThankYou"
  | "batesBothDoneThankYou";

interface BatesOverlayProps {
  onClose: () => void;
  startAt?: BatesStep;
}

const BatesOverlay: React.FC<BatesOverlayProps> = ({ onClose, startAt = "intro" }) => {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<BatesStep>(startAt);

  // User context
  const [userWeddingDate, setUserWeddingDate] = useState<string | null>(null);
  const [userDayOfWeek, setUserDayOfWeek] = useState<string | null>(null);

  // Catering cart/contract state
  const [menuSelections, setMenuSelections] = useState<{ hors: string[]; salads: string[]; entrees: string[] }>({
    hors: [],
    salads: [],
    entrees: [],
  });
  const [addonsTotal, setAddonsTotal] = useState(0);
  const [total, setTotal] = useState<number>(0);
  const [lineItems, setLineItems] = useState<string[]>([]);
  const [paymentSummaryText, setPaymentSummaryText] = useState<string>("Included with your Bates venue booking");

  // Contract signature
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);

  // Dessert state
  const [dessertType, setDessertType] = useState<DessertType>("tieredCake");
  const [flavorFilling, setFlavorFilling] = useState<string[]>([]);
  const [cakeStyle, setCakeStyle] = useState<string>("");
  const [treatType, setTreatType] = useState<"" | "cupcakes" | "goodies">("");
  const [goodies, setGoodies] = useState<string[]>([]);
  const [cupcakes, setCupcakes] = useState<string[]>([]);
  const [guestCount] = useState<number>(Number(localStorage.getItem("magicGuestCount") || 0));

  // Frame helpers
  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([step], { targetRef: cardRef });

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = (snap.data() || {}) as any;
        const catering = !!data?.bookings?.catering;
        const dessert = !!data?.bookings?.dessert;

        if (!catering && !dessert) setStep("intro");
        else if (catering && !dessert) setStep("batesCateringThankYou");
        else setStep("batesBothDoneThankYou");
      } catch (e) {
        console.warn("[BatesOverlay] fetch user failed:", e);
        setStep("intro");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Build + upload catering PDF, then mark catering booked
  const finalizeBatesCatering = async ({
    total,
    guestCount,
    weddingDate,
    lineItems,
    menuSelections,
    signatureImage,
    paymentSummaryText,
  }: {
    total: number;
    guestCount: number;
    weddingDate: string | null;
    lineItems: string[];
    menuSelections: { hors: string[]; salads: string[]; entrees: string[] };
    signatureImage: string;
    paymentSummaryText: string;
  }) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    // Name on the PDF
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const u = userSnap.data() || {};
    const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();

    // Generate (reuse existing generator – we just remap to its expected keys)
    const pdfBlob = await generateYumAgreementPDF({
      fullName,
      total,
      deposit: 0,
      guestCount,
      charcuterieCount: 0,
      weddingDate: weddingDate || "",
      signatureImageUrl: signatureImage,
      paymentSummary: paymentSummaryText,
      lineItems,
      cuisineType: "Bates Catering",
      menuSelections: {
        appetizers: menuSelections.hors,
        mains: menuSelections.entrees,
        sides: menuSelections.salads,
      },
    });

    // Upload
    const storage = getStorage(app, "gs://wedndonev2.firebasestorage.app");
    const filename = `BatesCateringAgreement_${Date.now()}.pdf`;
    const fileRef = ref(storage, `public_docs/${user.uid}/${filename}`);
    await uploadBytes(fileRef, pdfBlob);
    const publicUrl = await getDownloadURL(fileRef);

    // Save + mark catering booked
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      documents: arrayUnion({
        title: "Bates Catering Agreement",
        url: publicUrl,
        uploadedAt: new Date().toISOString(),
      }),
      bookings: { catering: true, dessert: !!u?.bookings?.dessert },
      progress: { yumYum: { step: "cateringThankYou" } },
    });
  };

  if (loading) return null;

 // ── RENDER — single overlay, no inner card; children own their pink X ──────
return (
  <div
    id="bates-overlay-root"
    className="pixie-overlay"
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      paddingTop: "max(12px, env(safe-area-inset-top))",
      paddingRight: "max(12px, env(safe-area-inset-right))",
      paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      paddingLeft: "max(12px, env(safe-area-inset-left))",
      boxSizing: "border-box",
      overflowY: "auto",
      width: "100%",
      height: "100%",
    }}
  >
  

    {/* Scrollable stage (children render their own pixie-card) */}
    <div ref={cardRef} style={{ width: "100%" }}>
      {/* ───────────── Intro → Catering builder ───────────── */}
      {step === "intro" && (
        <BatesIntro onContinue={() => setStep("cateringMenu")} onClose={onClose} />
      )}

      {step === "cateringMenu" && (
        <BatesMenuBuilderCatering
          menuSelections={menuSelections}
          setMenuSelections={setMenuSelections}
          onBack={() => setStep("intro")}
          onContinue={() => setStep("cateringCart")}
          onClose={onClose}
        />
      )}

      {step === "cateringCart" && (
        <BatesCartCatering
          guestCount={0}
          menuSelections={menuSelections}
          setTotal={setTotal}
          setLineItems={setLineItems}
          setPaymentSummaryText={setPaymentSummaryText}
          setAddonsTotal={setAddonsTotal}
          onBackToMenu={() => setStep("cateringMenu")}
          onContinueToCheckout={() => setStep("cateringContract")}
          onClose={onClose}
        />
      )}

      {step === "cateringContract" && (
        <BatesContractCatering
          total={total}
          addonsTotal={addonsTotal}
          guestCount={0}
          weddingDate={userWeddingDate}
          dayOfWeek={userDayOfWeek}
          lineItems={lineItems}
          menuSelections={menuSelections}
          signatureImage={signatureImage}
          setSignatureImage={setSignatureImage}
          signatureSubmitted={signatureSubmitted}
          setSignatureSubmitted={setSignatureSubmitted}
          onBack={() => setStep("cateringCart")}
          onComplete={async () => {
            if (addonsTotal > 0) {
              setStep("cateringCheckout");
            } else {
              await finalizeBatesCatering({
                total: 0,
                guestCount: 0,
                weddingDate: userWeddingDate,
                lineItems,
                menuSelections,
                signatureImage: localStorage.getItem("yumSignature") || "",
                paymentSummaryText: "No add-ons selected; Bates catering included.",
              });
              setStep("batesCateringThankYou");
            }
          }}
          onClose={onClose}
        />
      )}

      {step === "cateringCheckout" && (
        <>
          <BatesCheckOutCatering
            onBack={() => setStep("cateringCart")}
            onClose={onClose}
            total={total}
            payFull={true}
            paymentSummary={paymentSummaryText}
            signatureImage={signatureImage || localStorage.getItem("yumSignature") || ""}
            onSuccess={() => setStep("batesCateringThankYou")}
            firstName={""}
            lastName={""}
            weddingDate={userWeddingDate || ""}
            dayOfWeek={userDayOfWeek}
            lineItems={lineItems}
            uid={getAuth().currentUser?.uid || ""}
            guestCount={guestCount}
          />
          <div className="px-cta-col" style={{ marginTop: 12 }}>
            <button
              className="boutique-back-btn"
              onClick={() => setStep("cateringContract")}
              style={{ width: 260 }}
            >
              ⬅ Back to Contract
            </button>
          </div>
        </>
      )}

      {step === "batesCateringThankYou" && (
        <BatesCateringThankYou
          onBookDessertNow={() => setStep("dessertStyle")}
          onClose={onClose}
        />
      )}

      {/* ───────────── Dessert flow ───────────── */}
      {step === "dessertStyle" && (
        <BatesDessertSelector
          onSelectType={(type) => setDessertType(type)}
          onContinue={() => setStep("dessertMenu")}
          onBack={() => setStep("batesCateringThankYou")}
          onClose={onClose}
        />
      )}

      {step === "dessertMenu" && (
        <BatesDessertMenu
          dessertType={dessertType}
          flavorFilling={flavorFilling}
          setFlavorFilling={setFlavorFilling}
          onContinue={(sel) => {
            setFlavorFilling(sel.flavorFilling || []);
            setCakeStyle(typeof sel.cakeStyle === "string" ? sel.cakeStyle : "");
            setTreatType(sel.treatType || "");
            setGoodies(sel.goodies || []);
            setCupcakes(sel.cupcakes || []);
            setStep("dessertCart");
          }}
          onBack={() => setStep("dessertStyle")}
          onClose={onClose}
        />
      )}

      {step === "dessertCart" && (
        <BatesDessertCart
          guestCount={guestCount}
          onGuestCountChange={(n) => localStorage.setItem("magicGuestCount", String(n))}
          dessertStyle={dessertType}
          flavorFilling={flavorFilling}
          cakeStyle={cakeStyle}
          treatType={treatType}
          cupcakes={cupcakes}
          goodies={goodies}
          setTotal={setTotal}
          setLineItems={setLineItems}
          setPaymentSummaryText={setPaymentSummaryText}
          onContinueToCheckout={() => setStep("dessertContract")}
          onStartOver={() => setStep("dessertStyle")}
          onClose={onClose}
          weddingDate={userWeddingDate}
        />
      )}

      {step === "dessertContract" && (
        <BatesDessertContract
          total={total}
          guestCount={guestCount}
          weddingDate={userWeddingDate}
          dayOfWeek={userDayOfWeek}
          lineItems={lineItems}
          signatureImage={signatureImage}
          setSignatureImage={setSignatureImage}
          dessertStyle={dessertType || ""}
          flavorCombo={flavorFilling.join(" + ")}
          setStep={(next) => setStep(next as BatesStep)}
          onClose={onClose}
          onComplete={(sig) => {
            setSignatureImage(sig);
            setStep("dessertCheckout");
          }}
        />
      )}

      {step === "dessertCheckout" && (
        <BatesDessertCheckout
          total={total}
          guestCount={guestCount}
          selectedStyle={dessertType || ""}
          selectedFlavorCombo={flavorFilling.join(" + ")}
          paymentSummaryText={paymentSummaryText}
          lineItems={lineItems}
          signatureImage={signatureImage || ""}
          setStep={(next) => setStep(next as BatesStep)}
          onBack={() => setStep("dessertContract")}
          onClose={onClose}
          isGenerating={false}
        />
      )}

      {step === "batesDessertThankYou" && (
        <BatesDessertThankYou onClose={() => setStep("batesBothDoneThankYou")} />
      )}

      {step === "batesBothDoneThankYou" && <BatesBothDoneThankYou onClose={onClose} />}
    </div>
  </div>
);
};

export default BatesOverlay;