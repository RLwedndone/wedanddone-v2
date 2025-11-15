import React, { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import type { ValleyHoSelections, ValleyHoService } from "./ValleyHoMenuBuilder";

/* ---------- TAX & FEES (same as others) ---------- */
const SERVICE_CHARGE_RATE = 0.25;
const SALES_TAX_RATE = 0.086;
const STRIPE_RATE = 0.029;
const STRIPE_FLAT_FEE = 0.3;

/* ---------- Kids + Late Night (easy to tweak) ---------- */
const KIDS_MEAL_PRICE = 40;               // $/kid
const LATE_NIGHT = {
  NACHO_PER_GUEST: 28,                    // $/guest
  SLIDER_PER_SLIDER: 12,                  // $/slider
  PRETZEL_PER_GUEST: 25,                  // $/guest
};

/* ---------- Plated entrée prices (for max-price rule) ---------- */
const PLATED_PRICE_MAP = new Map<string, number>([
  ["Roasted Free-Range Chicken Breast with Onion Pan Jus", 94],
  ["Seared Scottish Salmon with Lemon Butter Sauce", 96],
  ["Chef’s Seasonal White Fish with Spicy Romesco Sauce", 100],
  ["Slow-Braised Beef Short Ribs with Cabernet Jus", 103],
  ["Grilled Filet of Beef with Red Wine Demi-Glace", 106],
  ["Chilean Sea Bass with White Miso Ponzu", 115],
  // (Filet + Lobster duet omitted: market price)
]);

/* ---------- Types ---------- */
interface Props {
  serviceOption: ValleyHoService;
  menuSelections: ValleyHoSelections;
  guestCount?: number;
  pricePerGuest?: number;
  setTotal: (grandTotal: number) => void;
  setLineItems: (items: string[]) => void;
  setPaymentSummaryText: (text: string) => void;
  onContinueToCheckout: () => void;
  onBackToMenu: () => void;
  onClose: () => void;
}

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const ValleyHoCartCatering: React.FC<Props> = ({
  serviceOption,
  menuSelections,
  guestCount = 0,
  pricePerGuest,
  setTotal,
  setLineItems,
  setPaymentSummaryText,
  onContinueToCheckout,
  onBackToMenu,
  onClose,
}) => {
  /* ---------- guest count hydrate ---------- */
  const [lockedGuestCount, setLockedGuestCount] = useState<number>(guestCount || 0);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      try {
        if (guestCount > 0) {
          setLockedGuestCount(guestCount);
          localStorage.setItem("valleyHoLockedGuestCount", String(guestCount));
        } else {
          if (user) {
            const snap = await getDoc(doc(db, "users", user.uid));
            const d: any = snap.data() || {};
            const gcFS =
              Number(d?.guestCount) ||
              Number(d?.profileData?.guestCount) ||
              Number(localStorage.getItem("magicGuestCount") || 0) ||
              0;
            if (gcFS) {
              setLockedGuestCount(gcFS);
              localStorage.setItem("valleyHoLockedGuestCount", String(gcFS));
            }
          } else {
            const gcLS =
              Number(localStorage.getItem("valleyHoLockedGuestCount") || 0) ||
              Number(localStorage.getItem("magicGuestCount") || 0) ||
              0;
            if (gcLS) setLockedGuestCount(gcLS);
          }
        }
      } catch {}
    });
    return () => unsub();
  }, [guestCount]);

  /* ---------- Add-on quantities (persist to LS) ---------- */
  const [kidsQty, setKidsQty] = useState<number>(() => Number(localStorage.getItem("vhKidsQty") || 0));
  const [nachoQty, setNachoQty] = useState<number>(() => {
    // default Nacho to guest count (common pattern); user can edit
    const v = localStorage.getItem("vhNachoQty");
    return v != null ? Number(v) : lockedGuestCount;
  });
  const [sliderQty, setSliderQty] = useState<number>(() => Number(localStorage.getItem("vhSliderQty") || 0));
  const [pretzelQty, setPretzelQty] = useState<number>(() => {
    const v = localStorage.getItem("vhPretzelQty");
    return v != null ? Number(v) : 0;
  });

  useEffect(() => {
    try {
      localStorage.setItem("vhKidsQty", String(kidsQty));
      localStorage.setItem("vhNachoQty", String(nachoQty));
      localStorage.setItem("vhSliderQty", String(sliderQty));
      localStorage.setItem("vhPretzelQty", String(pretzelQty));
    } catch {}
  }, [kidsQty, nachoQty, sliderQty, pretzelQty]);

  /* ---------- price per guest ---------- */
  const effectivePP = useMemo(() => {
    if (typeof pricePerGuest === "number" && pricePerGuest > 0) return pricePerGuest;
    if (serviceOption === "stations") return 119;
    const labels = menuSelections.platedEntrees || [];
    let max = 0;
    for (const lbl of labels) max = Math.max(max, PLATED_PRICE_MAP.get(lbl) || 0);
    if (max > 0) return max;
    const ls = Number(localStorage.getItem("valleyHoPerGuest") || 0);
    return isFinite(ls) ? ls : 0;
  }, [serviceOption, menuSelections.platedEntrees, pricePerGuest]);

  /* ---------- money math ---------- */
  const peopleSubtotal = Math.max(0, lockedGuestCount) * Math.max(0, effectivePP);

  const kidsSubtotal = Math.max(0, kidsQty) * KIDS_MEAL_PRICE;
  const nachoSubtotal = Math.max(0, nachoQty) * LATE_NIGHT.NACHO_PER_GUEST;
  const sliderSubtotal = Math.max(0, sliderQty) * LATE_NIGHT.SLIDER_PER_SLIDER;
  const pretzelSubtotal = Math.max(0, pretzelQty) * LATE_NIGHT.PRETZEL_PER_GUEST;

  const addOnsSubtotal = kidsSubtotal + nachoSubtotal + sliderSubtotal + pretzelSubtotal;

  const baseCateringSubtotal = peopleSubtotal + addOnsSubtotal;

  const serviceCharge = baseCateringSubtotal * SERVICE_CHARGE_RATE;
  const taxableBase = baseCateringSubtotal + serviceCharge;
  const taxes = taxableBase * SALES_TAX_RATE;
  const cardFees = taxableBase > 0 ? taxableBase * STRIPE_RATE + STRIPE_FLAT_FEE : 0;
  const grandTotal = taxableBase + taxes + cardFees;

  /* ---------- selections summary text ---------- */
  const selectionsBlock = useMemo(() => {
    if (serviceOption === "plated") {
      return [
        `Hors d’oeuvres: ${menuSelections.hors?.join(", ") || "—"}`,
        `Salad: ${menuSelections.salad?.[0] || "—"}`,
        `Entrées (up to 3): ${menuSelections.platedEntrees?.join(", ") || "—"}`,
      ];
    }

    const rowA =
      menuSelections.stationA === "pasta"
        ? `Pasta Station: ${menuSelections.pastaPicks?.join(", ") || "—"}`
        : menuSelections.stationA === "rice"
        ? `Rice Bowl Station — Bases: ${menuSelections.riceBases?.join(", ") || "—"}; Proteins: ${menuSelections.riceProteins?.join(", ") || "—"}`
        : "Row A: —";
    const rowB =
      menuSelections.stationB === "sliders"
        ? `Slider Station: ${menuSelections.sliderPicks?.join(", ") || "—"}`
        : menuSelections.stationB === "tacos"
        ? `Street Taco Station: ${menuSelections.tacoPicks?.join(", ") || "—"}`
        : "Row B: —";

    return [
      `Hors d’oeuvres: ${menuSelections.hors?.join(", ") || "—"}`,
      "Antipasti Station: Included",
      rowA,
      rowB,
    ];
  }, [serviceOption, menuSelections]);

  /* ---------- push summary to parent + persist ---------- */
  useEffect(() => {
    const header =
      serviceOption === "plated" ? "Hotel Valley Ho Catering (Plated)" : "Hotel Valley Ho Catering (Stations)";

    const items: string[] = [
      `${header} — ${lockedGuestCount} guests @ $${effectivePP}/guest = ${money(peopleSubtotal)}`,
    ];

    if (kidsQty > 0) items.push(`Kids’ meals — ${kidsQty} × ${money(KIDS_MEAL_PRICE)} = ${money(kidsSubtotal)}`);
    if (nachoQty > 0) items.push(`Late Night: Nacho Bar — ${nachoQty} × ${money(LATE_NIGHT.NACHO_PER_GUEST)} = ${money(nachoSubtotal)}`);
    if (sliderQty > 0) items.push(`Late Night: Sliders — ${sliderQty} × ${money(LATE_NIGHT.SLIDER_PER_SLIDER)} = ${money(sliderSubtotal)}`);
    if (pretzelQty > 0) items.push(`Late Night: Pretzel Board — ${pretzelQty} × ${money(LATE_NIGHT.PRETZEL_PER_GUEST)} = ${money(pretzelSubtotal)}`);

    items.push(
      `22% Service Charge — ${money(serviceCharge)}`,
      `Subtotal before tax & fees — ${money(taxableBase)}`
    );

    setLineItems(items);
    setTotal(grandTotal);
    setPaymentSummaryText(
      `You're paying ${money(grandTotal)} today (includes 22% service charge, taxes & card fees).`
    );

    try {
      localStorage.setItem("yumStep", "valleyHoCart");
      localStorage.setItem(
        "valleyHoCartSnapshot",
        JSON.stringify({
          serviceOption,
          perGuest: effectivePP,
          guests: lockedGuestCount,
          selections: menuSelections,
          addOns: {
            kidsQty,
            nachoQty,
            sliderQty,
            pretzelQty,
            prices: { KIDS_MEAL_PRICE, ...LATE_NIGHT },
          },
          computed: {
            peopleSubtotal,
            addOnsSubtotal,
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

      const u = getAuth().currentUser;
      if (u) {
        setDoc(
          doc(db, "users", u.uid, "yumYumData", "valleyHoCart"),
          {
            serviceOption,
            perGuest: effectivePP,
            guests: lockedGuestCount,
            selections: menuSelections,
            addOns: {
              kidsQty,
              nachoQty,
              sliderQty,
              pretzelQty,
              prices: { KIDS_MEAL_PRICE, ...LATE_NIGHT },
            },
            computed: {
              peopleSubtotal,
              addOnsSubtotal,
              baseCateringSubtotal,
              serviceCharge,
              taxableBase,
              taxes,
              cardFees,
              grandTotal,
            },
            savedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        setDoc(
          doc(db, "users", u.uid),
          { progress: { yumYum: { step: "valleyHoCart" } } },
          { merge: true }
        );
      }
    } catch {}
  }, [
    serviceOption,
    effectivePP,
    lockedGuestCount,
    menuSelections,
    peopleSubtotal,
    addOnsSubtotal,
    serviceCharge,
    taxableBase,
    taxes,
    cardFees,
    grandTotal,
    kidsQty,
    nachoQty,
    sliderQty,
    pretzelQty,
    setLineItems,
    setPaymentSummaryText,
    setTotal,
  ]);

  /* ---------- Qty helpers ---------- */
  const clamp = (n: number) => Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));

  const renderQtyRow = (
    label: string,
    qty: number,
    setQty: (n: number) => void,
    unitPrice: number
  ) => (
    <div className="px-item" style={{ alignItems: "center" }}>
      <div className="px-item__label">
        {label} <span style={{ opacity: 0.75 }}>— {money(unitPrice)}</span>
      </div>

      <div className="px-qty">
        <button
          type="button"
          className="px-qty-btn px-qty-btn--minus"
          onClick={() => setQty(clamp(qty - 1))}
          aria-label={`Decrease ${label}`}
        >
          <img src={`${import.meta.env.BASE_URL}assets/icons/qty_minus_pink_glossy.svg`} alt="" aria-hidden="true" />
        </button>

        <input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(clamp(Number(e.target.value)))}
          className="px-input-number"
          inputMode="numeric"
        />

        <button
          type="button"
          className="px-qty-btn px-qty-btn--plus"
          onClick={() => setQty(clamp(qty + 1))}
          aria-label={`Increase ${label}`}
        >
          <img src={`${import.meta.env.BASE_URL}assets/icons/qty_plus_blue_glossy.svg`} alt="" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  /* ---------- UI ---------- */
  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 760 }}>
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

        <h2 className="px-title-lg" style={{ marginBottom: 4 }}>
          Hotel Valley Ho — Review
        </h2>
        <div className="px-prose-narrow" style={{ marginBottom: 10, color: "#2c62ba", fontWeight: 700 }}>
          {serviceOption === "plated" ? "Plated Dinner" : "Reception Stations"}
        </div>

        {/* Selections */}
        <div className="px-prose-narrow" style={{ margin: "8px auto 16px", maxWidth: 640, textAlign: "left" }}>
          <div className="px-title" style={{ textAlign: "center", marginBottom: 6 }}>Your Selections</div>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
            {selectionsBlock.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <div style={{ marginTop: 10, textAlign: "center", fontWeight: 700, color: "#2c62ba" }}>
            {lockedGuestCount} guests @ {money(effectivePP)} / guest
          </div>
        </div>

        {/* Add-ons */}
        <div style={{ textAlign: "left", margin: "0 auto 18px", maxWidth: 640 }}>
          <div className="px-title" style={{ textAlign: "center", marginBottom: 8 }}>
            Add-ons
          </div>

          {/* Kids meals */}
          {renderQtyRow("Kids’ Meals", kidsQty, setKidsQty, KIDS_MEAL_PRICE)}

          {/* Late night snacks */}
          {renderQtyRow("Late Night — Nacho Bar (per guest)", nachoQty, setNachoQty, LATE_NIGHT.NACHO_PER_GUEST)}
          {renderQtyRow("Late Night — Sliders (per slider)", sliderQty, setSliderQty, LATE_NIGHT.SLIDER_PER_SLIDER)}
          {renderQtyRow("Late Night — Pretzel Board (per guest)", pretzelQty, setPretzelQty, LATE_NIGHT.PRETZEL_PER_GUEST)}
        </div>

        {/* Totals */}
        <div className="px-prose-narrow" style={{ marginTop: 4 }}>
          <div>Base Catering (guests + add-ons): <strong>{money(baseCateringSubtotal)}</strong></div>
          <div style={{ marginTop: 6 }}>22% Service Charge: <strong>{money(serviceCharge)}</strong></div>
          <div>Taxes & Card Fees: <strong>{money(taxes + cardFees)}</strong></div>
          <div style={{ fontWeight: 800, marginTop: 8, color: "#2c62ba" }}>
            Today’s Total: {money(grandTotal)}
          </div>
        </div>

        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 14 }}>
          <button className="boutique-primary-btn" style={{ width: 260 }} onClick={onContinueToCheckout}>
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

export default ValleyHoCartCatering;