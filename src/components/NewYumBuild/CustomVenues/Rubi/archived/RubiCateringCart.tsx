// src/components/NewYumBuild/CustomVenues/Rubi/RubiCateringCart.tsx
import React, { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

// NEW: split-flow types
import type { RubiTierSelectionBBQ } from "./RubiBBQTierSelector";
import type { RubiTierSelection as RubiTierSelectionMex } from "./RubiMexTierSelector";
import type { RubiBBQSelections } from "./RubiBBQMenuBuilder";
import type { RubiMexSelections } from "./RubiMexMenuBuilder";

type RubiMenuChoice = "bbq" | "mexican";
type AnyTierSelection = RubiTierSelectionBBQ | RubiTierSelectionMex;
type AnySelections = RubiBBQSelections | RubiMexSelections;

/* ---------- TAX & FEES ---------- */
const SERVICE_CHARGE_RATE = 0.22;
const SALES_TAX_RATE = 0.086;
const STRIPE_RATE = 0.029;
const STRIPE_FLAT_FEE = 0.3;

/* ---------- Props ---------- */
interface Props {
  menuChoice: RubiMenuChoice;
  tierSelection: AnyTierSelection;
  selections: AnySelections;
  guestCount?: number;
  setTotal: (grandTotal: number) => void;
  setLineItems: (items: string[]) => void;
  setPaymentSummaryText: (text: string) => void;
  setAddonsTotal?: (amount: number) => void; // fees portion
  onContinueToCheckout: (summary: any) => void;
  onBackToMenu: () => void;
  onClose: () => void;
}

/* ---------- Helpers ---------- */
const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const RubiCateringCart: React.FC<Props> = ({
  menuChoice,
  tierSelection,
  selections,
  guestCount = 0,
  setTotal,
  setLineItems,
  setPaymentSummaryText,
  setAddonsTotal,
  onContinueToCheckout,
  onBackToMenu,
  onClose,
}) => {
  // 🔒 Lock guest count
  const [lockedGuestCount, setLockedGuestCount] = useState<number>(guestCount || 0);

  // Hydrate from LS/FS + guest count
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      try {
        const ls = JSON.parse(localStorage.getItem("rubiCartData") || "{}");
        if (!guestCount && typeof ls.lockedGuestCount === "number") {
          setLockedGuestCount(ls.lockedGuestCount);
        }
      } catch {}

      if (guestCount) {
        setLockedGuestCount(guestCount);
        try { localStorage.setItem("rubiLockedGuestCount", String(guestCount)); } catch {}
      }

      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data: any = snap.data() || {};
        const gc =
          guestCount ||
          Number(data?.guestCount) ||
          Number(data?.profileData?.guestCount) ||
          Number(localStorage.getItem("magicGuestCount") || 0) ||
          0;
        if (gc > 0) {
          setLockedGuestCount(gc);
          try { localStorage.setItem("rubiLockedGuestCount", String(gc)); } catch {}
        }
      } catch {}
    });
    return () => unsub();
  }, [guestCount]);

  // Persist cart bits (guest count only now)
  useEffect(() => {
    try {
      localStorage.setItem(
        "rubiCartData",
        JSON.stringify({ lockedGuestCount, savedAt: new Date().toISOString() })
      );
      localStorage.setItem("yumStep", "rubiCart");
    } catch {}

    const u = getAuth().currentUser;
    if (u) {
      setDoc(
        doc(db, "users", u.uid, "yumYumData", "rubiCartData"),
        { lockedGuestCount, savedAt: new Date().toISOString() },
        { merge: true }
      ).catch(() => {});
      setDoc(
        doc(db, "users", u.uid),
        { progress: { yumYum: { step: "rubiCart" } } },
        { merge: true }
      ).catch(() => {});
    }
  }, [lockedGuestCount]);

  /* ---------- Money ---------- */
  const pricePerGuest =
    Number((tierSelection as AnyTierSelection)?.pricePerGuest || localStorage.getItem("rubiPerGuest") || 0) || 0;

  // NEW (extras): read per-guest extras in cents from LS (set by builders when an item has upcharge)
  const extrasCents =
    Number(localStorage.getItem("rubiPerGuestExtrasCents") || 0) || 0; // e.g., 200 = $2.00/guest

  // NEW (extras): effective ppg used for math and display
  const pricePerGuestWithExtras = pricePerGuest + extrasCents / 100;

  const baseCateringSubtotal = useMemo(
    () => Math.max(0, lockedGuestCount) * Math.max(0, pricePerGuestWithExtras),
    [lockedGuestCount, pricePerGuestWithExtras]
  );

  // No late-night add-ons.
  const grossSubtotal = baseCateringSubtotal;
  const serviceCharge = grossSubtotal * SERVICE_CHARGE_RATE;
  const taxableBase = grossSubtotal + serviceCharge;
  const taxes = taxableBase * SALES_TAX_RATE;
  const cardFees = taxableBase > 0 ? taxableBase * STRIPE_RATE + STRIPE_FLAT_FEE : 0;
  const grandTotal = taxableBase + taxes + cardFees;

  /* ---------- Summary ---------- */
  const summaryItems = useMemo(() => {
    const items: string[] = [];

    items.push(
      `Brother John’s ${menuChoice === "bbq" ? "BBQ" : "Mexican"} — ${lockedGuestCount} guests @ $${pricePerGuestWithExtras.toFixed(
        2
      )}/guest = ${money(baseCateringSubtotal)}`
    );

    // NEW (extras): show an explicit line when there are menu upcharges
    if (extrasCents > 0 && lockedGuestCount > 0) {
      items.push(
        `Menu Upcharges — +$${Number((extrasCents / 100)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} per guest × ${lockedGuestCount} = ${money(
          (extrasCents / 100) * lockedGuestCount
        )}`
      );
    }

    items.push(`22% Service Charge — ${money(serviceCharge)}`);
    items.push(`Subtotal before tax & card fees — ${money(taxableBase)}`);
    return items;
  }, [
    menuChoice,
    lockedGuestCount,
    pricePerGuestWithExtras,
    baseCateringSubtotal,
    extrasCents,
    serviceCharge,
    taxableBase,
  ]);

  // Portion beyond base catering (service+tax+fees)
  const addonsPortion = useMemo(
    () => Math.max(0, grandTotal - baseCateringSubtotal),
    [grandTotal, baseCateringSubtotal]
  );

  const paymentText = useMemo(
    () => `You're paying ${money(grandTotal)} today (includes 22% service charge, taxes & card fees).`,
    [grandTotal]
  );

  // Push to parent only when changed (+ snapshot)
  const refs = React.useRef({ itemsKey: "", addons: NaN as number, total: NaN as number, payText: "" });
  useEffect(() => {
    const itemsKey = JSON.stringify(summaryItems);
    if (refs.current.itemsKey !== itemsKey) {
      setLineItems(summaryItems);
      refs.current.itemsKey = itemsKey;
    }
    if (refs.current.addons !== addonsPortion) {
      setAddonsTotal?.(addonsPortion);
      refs.current.addons = addonsPortion;
    }
    if (refs.current.total !== grandTotal) {
      setTotal(grandTotal);
      refs.current.total = grandTotal;
    }
    if (refs.current.payText !== paymentText) {
      setPaymentSummaryText(paymentText);
      refs.current.payText = paymentText;
    }

    try {
      localStorage.setItem(
        "rubiCartSnapshot",
        JSON.stringify({
          menuChoice,
          tier: tierSelection,
          guests: lockedGuestCount,
          pricePerGuest,                // base ppg (without extras)
          pricePerGuestWithExtras,      // NEW (extras): effective ppg
          perGuestExtrasCents: extrasCents,
          selections,
          computed: {
            baseCateringSubtotal,
            serviceCharge,
            taxableBase,
            taxes,
            cardFees,
            grandTotal,
          },
          savedAt: new Date().toISOString(),
        })
      );
    } catch {}
  }, [
    summaryItems,
    addonsPortion,
    grandTotal,
    paymentText,
    menuChoice,
    tierSelection,
    lockedGuestCount,
    pricePerGuest,
    pricePerGuestWithExtras,
    extrasCents,
    selections,
    baseCateringSubtotal,
    serviceCharge,
    taxableBase,
    taxes,
    cardFees,
  ]);

    // 👇 This is the payload we’ll pass forward into contract/checkout/PDF
    const bookingSummary = {
      venueName: "Rubi House",
  
      catererName: "Brother John’s BBQ", // even for mexican choice it's still Brother John's, right?
                                         // if that changes vendor-by-menu, update this string accordingly
  
      menuChoice,                        // "bbq" or "mexican"
  
      guestCount: lockedGuestCount,
  
      // This is usually shown to the user as "Casual BroJo", "Street Taco Bar", etc.
      // You already have tierSelection coming in from the tier selector,
      // so we’ll try to grab something human-readable off it:
      selectedPackage:
        (tierSelection as any)?.label ||
        (tierSelection as any)?.tierName ||
        (tierSelection as any)?.displayName ||
        "Selected Package",
  
      // Detailed menu picks so admin knows exactly what to book
      selections, // <-- this already contains bbqStarters, bbqMeats, etc. or mexEntrees, mexSides, etc.
  
      // Money breakdown
      pricePerGuestBase: pricePerGuest, // without extras
      pricePerGuestWithExtras,         // with extras
      perGuestExtrasCents: extrasCents,
  
      lineItems: summaryItems,         // the human-readable bullet lines you show in the PDF
      totals: {
        baseCateringSubtotal,
        serviceCharge,
        taxableBase,
        taxes,
        cardFees,
        grandTotal,
      },
    };

  /* ---------- UI ---------- */
  const header = `Brother John’s ${menuChoice === "bbq" ? "BBQ" : "Mexican"} — Review`;

  // Type guards for rendering selections neatly
  const isBBQ = (s: AnySelections): s is RubiBBQSelections => menuChoice === "bbq";
  const isMex = (s: AnySelections): s is RubiMexSelections => menuChoice === "mexican";

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 780 }}>
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_cart.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ width: 180, margin: "0 auto 14px", borderRadius: 12 }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 4 }}>{header}</h2>
        <div className="px-prose-narrow" style={{ marginBottom: 10, color: "#2c62ba", fontWeight: 700 }}>
          {/* NEW (extras): show effective ppg */}
          {lockedGuestCount} guests @ {money(pricePerGuestWithExtras)} / guest
        </div>

        {/* Selections summary */}
        <div className="px-prose-narrow" style={{ margin: "8px auto 16px", maxWidth: 640, textAlign: "left" }}>
          <div className="px-title" style={{ textAlign: "center", marginBottom: 6 }}>Your Selections</div>

          {isBBQ(selections) ? (
            <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
              <li><strong>Starters:</strong> {selections.bbqStarters.join(", ") || "—"}</li>
              <li><strong>Smoked Meats:</strong> {selections.bbqMeats.join(", ") || "—"}</li>
              <li><strong>Sides:</strong> {selections.bbqSides.join(", ") || "—"}</li>
              {selections.bbqDesserts.length > 0 && (
                <li><strong>Desserts:</strong> {selections.bbqDesserts.join(", ")}</li>
              )}
            </ul>
          ) : isMex(selections) ? (
            <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
              {selections.mexPassedApps.length > 0 && (
                <li><strong>Passed Appetizers:</strong> {selections.mexPassedApps.join(", ")}</li>
              )}
              <li><strong>Starter or Soup:</strong> {selections.mexStartersOrSoup.join(", ") || "—"}</li>
              <li><strong>Entrées:</strong> {selections.mexEntrees.join(", ") || "—"}</li>
              <li><strong>Sides:</strong> {selections.mexSides.join(", ") || "—"}</li>
              {selections.mexDesserts.length > 0 && (
                <li><strong>Desserts:</strong> {selections.mexDesserts.join(", ")}</li>
              )}
            </ul>
          ) : null}
        </div>

        {/* Totals */}
        <div className="px-prose-narrow" style={{ marginTop: 16 }}>
          <div>Base Catering: <strong>{money(baseCateringSubtotal)}</strong></div>
          <div style={{ marginTop: 8 }}>22% Service Charge: <strong>{money(serviceCharge)}</strong></div>
          <div>Taxes & Card Fees: <strong>{money(taxes + cardFees)}</strong></div>
          <div style={{ fontWeight: 800, marginTop: 6, color: "#2c62ba" }}>Today’s Total: {money(grandTotal)}</div>
        </div>

        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 14 }}>
        <button
  className="boutique-primary-btn"
  style={{ width: 260 }}
  onClick={() => {
    onContinueToCheckout(bookingSummary);
  }}
>
  Continue
</button>
          <button className="boutique-back-btn" style={{ width: 260 }} onClick={onBackToMenu}>
            ⬅ Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default RubiCateringCart;