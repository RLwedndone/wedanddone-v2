// src/components/NewYumBuild/CustomVenues/Tubac/TubacCartCatering.tsx
import React, { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

// ---------- TAX & FEES ----------
const SERVICE_CHARGE_RATE = 0.22;
const SALES_TAX_RATE = 0.086;
const STRIPE_RATE = 0.029;
const STRIPE_FLAT_FEE = 0.3;

// ---------- PER-PERSON BASE PRICES (fallback if pricePerGuest prop isn't passed) ----------
const TIER_PRICE_PG: Record<string, number> = {
  // plated
  silver: 96,
  gold: 106,
  platinum: 126,
  // buffet
  peridot: 96,
  emerald: 102,
  turquoise: 102,
  diamond: 129,
};

// --- Buffet display helpers (only used for the readout) ---
const BUFFET_SALADS_BY_TIER: Record<string, string[]> = {
  peridot: [
    "Caesar Salad — focaccia croutons, Parmesan Reginato",
    "Arizona Heirloom Tomato Salad — ciliegine mozzarella, gastrique red onions, smoked sea salt, EVOO, basil",
  ],
  emerald: [
    "Baby Arugula Salad — tart cherries, Fuji apples, candied pecans, Manchego, caramelized onion, apple vinaigrette",
  ],
  turquoise: [
    "Arizona Heirloom Tomato Salad — ciliegine mozzarella, gastrique red onions, smoked sea salt, EVOO, basil",
    "Guajillo Spiked Caesar Salad — cotija, black bean salsa, corn frizzles",
  ],
  diamond: [
    "Heritage Salad — port braised pears, candied walnuts, gorgonzola, gastrique red onions, fig balsamic vinaigrette",
  ],
};

const BUFFET_ENTREES_FIXED_BY_TIER: Record<string, string[] | undefined> = {
  peridot: [
    "Pan-Seared Salmon — arugula pesto, capers, citrus butter sauce",
    "Chicken Scarpariello — white balsamic tomato risotto, Italian sausage, mushrooms, peppadews, fresh herbs pan sauce",
  ],
  diamond: [
    "Beef Tenderloin Diane — brandy, wild mushroom & Dijon demi-glace",
    "Pan-Seared Halibut — leek & watercress nage",
  ],
};

const BUFFET_ENTREES_CHOICE_BY_TIER: Record<
  string,
  | {
      always: string;
      chicken: string;
      fish: string;
    }
  | undefined
> = {
  emerald: {
    always: "Baseball Cut Top Sirloin — wild mushroom cabernet demi-glace",
    chicken: "Chicken Veronique — braised w/ white wine, grapes & rosemary",
    fish: "Wood-Grilled Salmon — confit cherry heirloom tomatoes, lemon beurre blanc",
  },
  turquoise: {
    always: "Annatto Rubbed New York Strip — grilled sliced & ranchero sauce",
    chicken: "Chicken Asado — mojo sauce, sweet stewed tomatoes",
    fish: "Pan-Seared Mahi Mahi — cucumber mango salsa, AZ citrus butter sauce",
  },
};

// ---------- ADD-ONS PRICING ----------
const UPGRADE_SECOND_APPETIZER_PER_GUEST = 17;

// Late Night Snacks (per person unless noted)
const LATE_NIGHT: { id: string; title: string; price: number; unit: "pp" | "each" }[] = [
  { id: "ln-chicken-empanada", title: "Chicken Empanadas", price: 9, unit: "pp" },
  { id: "ln-bbq-pulled-pork-slider", title: "BBQ Pulled Pork Sliders", price: 4, unit: "each" },
  { id: "ln-wood-burger-slider", title: "Wood-Grilled Burger Slider", price: 11, unit: "pp" },
  { id: "ln-hummus-board", title: "Hummus Board", price: 11, unit: "pp" },
  { id: "ln-beef-empanada", title: "Beef Empanadas", price: 11, unit: "pp" },
  { id: "ln-angus-sliders", title: "Grilled Angus Beef Sliders", price: 11, unit: "pp" },
  { id: "ln-nacho-bar", title: "Nacho Bar", price: 14, unit: "pp" },
  { id: "ln-sonoran-dogs", title: "Sonoran Dogs", price: 3, unit: "each" },
  { id: "ln-street-taco-station", title: "Street Taco Station (Select One protein)", price: 15, unit: "pp" },
];

// Dressing Room Snacks
const DRESSING_ROOM_SNACKS: { id: string; title: string; price: number; unit: "dozen" | "pp" }[] = [
  { id: "drs-choc-strawberries", title: "Chocolate Dipped Strawberries", price: 26, unit: "dozen" },
  { id: "drs-prosciutto-melon", title: "Prosciutto Wrapped Melon", price: 24, unit: "dozen" },
  { id: "drs-petit-fours", title: "Assortment of Petit Fours", price: 30, unit: "dozen" },
  { id: "drs-mini-quiches", title: "Assorted Mini Quiches", price: 27, unit: "dozen" },
  { id: "drs-tea-sandwiches", title: "Tea Sandwiches", price: 8, unit: "pp" },
  { id: "drs-cold-cut-sliders", title: "Cold Cut Sliders", price: 10, unit: "pp" },
];

// Beverages
const BEVERAGES: { id: string; title: string; price: number; unit: "bottle" | "can" | "serving" }[] = [
  { id: "bev-water", title: "Bottled Water", price: 3, unit: "bottle" },
  { id: "bev-can-soda", title: "Can Soda 12 oz (Coca-Cola products)", price: 4, unit: "can" },
  { id: "bev-topo", title: "Topo Chico 12 oz", price: 6, unit: "bottle" },
  { id: "bev-s-pellegrino", title: "San Pellegrino 1 liter", price: 9, unit: "bottle" },
  { id: "bev-juice", title: "Juice 10 oz (apple, orange, cranberry)", price: 5, unit: "serving" },
];

// ---------- Types ----------
type Extras = { extraAppetizer?: boolean };

export interface TubacMenuSelections {
  hors?: string[];
  horsPassed?: string[];      // ← add
  horsDisplayed?: string[];   // ← add
  salads: string[];
  entrees: string[];
  sides?: string[];
  extras?: Extras;
  service?: "plated" | "buffet";
  tier?: string;
  appetizers?: string[];
}

interface Props {
  menuSelections: TubacMenuSelections;
  serviceOption: "plated" | "buffet";
  pricePerGuest?: number;
  selectedTier?: string;
  guestCount?: number;
  setTotal: (grandTotal: number) => void;
  setLineItems: (items: string[]) => void;
  setPaymentSummaryText: (text: string) => void;
  setAddonsTotal: (amount: number) => void;
  onContinueToCheckout: () => void;
  onBackToMenu: () => void;
  onClose: () => void;
}

const TubacCartCatering: React.FC<Props> = ({
  menuSelections,
  serviceOption,
  pricePerGuest,
  selectedTier,
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

  // Quantities for add-ons
  type QtyMap = Record<string, number>;
  const [lateNightQty, setLateNightQty] = useState<QtyMap>({});
  const [dressingRoomQty, setDressingRoomQty] = useState<QtyMap>({});
  const [beverageQty, setBeverageQty] = useState<QtyMap>({});

  // ----- Branded, robust quantity control -----
  // Branded +/- control (same behavior as Florals)
const QtyControls: React.FC<{ value: number; onChange: (n: number) => void }> = ({ value, onChange }) => {
  const val = Number.isFinite(value) ? value : 0;
  return (
    <div className="px-qty">
      <button
        type="button"
        className="px-qty-btn px-qty-btn--minus"
        onClick={() => onChange(Math.max(0, val - 1))}
        aria-label="Decrease quantity"
      >
        <img src={`${import.meta.env.BASE_URL}assets/icons/qty_minus_pink_glossy.svg`} alt="" aria-hidden="true" />
      </button>

      <input
        type="number"
        min={0}
        value={val}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value || 0)))}
        className="px-input-number"
        inputMode="numeric"
      />

      <button
        type="button"
        className="px-qty-btn px-qty-btn--plus"
        onClick={() => onChange(val + 1)}
        aria-label="Increase quantity"
      >
        <img src={`${import.meta.env.BASE_URL}assets/icons/qty_plus_blue_glossy.svg`} alt="" aria-hidden="true" />
      </button>
    </div>
  );
};

  // Commit helpers for maps
  const changeLateNight = (id: string, next: number) =>
    setLateNightQty((m) => ({ ...m, [id]: Math.max(0, next) }));
  const changeDressing = (id: string, next: number) =>
    setDressingRoomQty((m) => ({ ...m, [id]: Math.max(0, next) }));
  const changeBeverage = (id: string, next: number) =>
    setBeverageQty((m) => ({ ...m, [id]: Math.max(0, next) }));

  // Restore + hydrate
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      try {
        const ls = JSON.parse(localStorage.getItem("tubacCartData") || "{}");
        setLateNightQty(ls.lateNightQty || {});
        setDressingRoomQty(ls.dressingRoomQty || {});
        setBeverageQty(ls.beverageQty || {});
        if (!guestCount && typeof ls.lockedGuestCount === "number") {
          setLockedGuestCount(ls.lockedGuestCount);
        }
      } catch {}

      if (guestCount) {
        setLockedGuestCount(guestCount);
        localStorage.setItem("tubacLockedGuestCount", String(guestCount));
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
          localStorage.setItem("tubacLockedGuestCount", String(gc));
        }
      } catch (e) {
        console.warn("[TubacCart] unable to fetch guest count:", e);
      }
    });
    return () => unsub();
  }, [guestCount]);

  // Persist to LS + FS whenever things change
  useEffect(() => {
    localStorage.setItem(
      "tubacCartData",
      JSON.stringify({
        lateNightQty,
        dressingRoomQty,
        beverageQty,
        lockedGuestCount,
      })
    );
    localStorage.setItem("yumStep", "cateringCart");
    const user = getAuth().currentUser;
    if (!user) return;

    (async () => {
      try {
        await setDoc(
          doc(db, "users", user.uid, "yumYumData", "tubacCartData"),
          {
            lateNightQty,
            dressingRoomQty,
            beverageQty,
            lockedGuestCount,
            savedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        await setDoc(
          doc(db, "users", user.uid),
          { progress: { yumYum: { step: "cateringCart" } } },
          { merge: true }
        );
      } catch (e) {
        console.error("❌ Failed to save Tubac cart to Firestore:", e);
      }
    })();
  }, [lateNightQty, dressingRoomQty, beverageQty, lockedGuestCount]);

  // ---------- Money helpers ----------
  const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

  // Resolve price per guest hierarchy
  const effectivePricePerGuest = useMemo(() => {
    if (typeof pricePerGuest === "number" && pricePerGuest > 0) return pricePerGuest;

    const stored = Number(localStorage.getItem("tubacPerGuest"));
    if (!isNaN(stored) && stored > 0) return stored;

    const tierKey = (selectedTier || menuSelections.tier || "").toLowerCase();
    return TIER_PRICE_PG[tierKey] || 0;
  }, [pricePerGuest, selectedTier, menuSelections.tier]);

  // ---------- Subtotals ----------
  const baseCateringSubtotal = useMemo(
    () => Math.max(0, lockedGuestCount) * Math.max(0, effectivePricePerGuest),
    [lockedGuestCount, effectivePricePerGuest]
  );

  const secondAppSubtotal = menuSelections?.extras?.extraAppetizer
    ? Math.max(0, lockedGuestCount) * UPGRADE_SECOND_APPETIZER_PER_GUEST
    : 0;

  const lateNightSubtotal = useMemo(() => {
    return LATE_NIGHT.reduce((sum, item) => {
      const qty = Number(lateNightQty[item.id] || 0);
      if (!qty) return sum;
      const chargeQty = item.unit === "pp" ? Math.max(qty, lockedGuestCount) : qty;
      return sum + chargeQty * item.price;
    }, 0);
  }, [lateNightQty, lockedGuestCount]);

  const dressingRoomSubtotal = useMemo(() => {
    return DRESSING_ROOM_SNACKS.reduce((sum, item) => {
      const qty = Number(dressingRoomQty[item.id] || 0);
      if (!qty) return sum;
      return sum + qty * item.price;
    }, 0);
  }, [dressingRoomQty]);

  const beverageSubtotal = useMemo(() => {
    return BEVERAGES.reduce((sum, item) => {
      const qty = Number(beverageQty[item.id] || 0);
      if (!qty) return sum;
      return sum + qty * item.price;
    }, 0);
  }, [beverageQty]);

  const grossSubtotal =
    baseCateringSubtotal +
    secondAppSubtotal +
    lateNightSubtotal +
    dressingRoomSubtotal +
    beverageSubtotal;

  const serviceCharge = grossSubtotal * SERVICE_CHARGE_RATE;
  const taxableBase = grossSubtotal + serviceCharge;
  const taxes = taxableBase * SALES_TAX_RATE;
  const cardFees = taxableBase > 0 ? taxableBase * STRIPE_RATE + STRIPE_FLAT_FEE : 0;
  const grandTotal = taxableBase + taxes + cardFees;

  // ---------- Summary: line items & outputs ----------

// 1) Build the items with useMemo so the array is stable unless inputs change
const summaryItems = useMemo(() => {
  const items: string[] = [];

  items.push(
    `Tubac Catering — ${lockedGuestCount} guests @ $${effectivePricePerGuest}/guest = ${money(baseCateringSubtotal)}`
  );

  if (secondAppSubtotal > 0) {
    items.push(
      `Second Appetizer Upgrade — $${UPGRADE_SECOND_APPETIZER_PER_GUEST} × ${lockedGuestCount} guests = ${money(
        secondAppSubtotal
      )}`
    );
  }

  LATE_NIGHT.forEach((i) => {
    const qty = Number(lateNightQty[i.id] || 0);
    if (!qty) return;
    const chargeQty = i.unit === "pp" ? Math.max(qty, lockedGuestCount) : qty;
    items.push(
      `${i.title}: ${chargeQty} ${i.unit === "pp" ? "guests" : i.unit} @ $${i.price}/${i.unit} = ${money(
        chargeQty * i.price
      )}`
    );
  });

  DRESSING_ROOM_SNACKS.forEach((i) => {
    const qty = Number(dressingRoomQty[i.id] || 0);
    if (!qty) return;
    items.push(`${i.title}: ${qty} ${i.unit} @ $${i.price}/${i.unit} = ${money(qty * i.price)}`);
  });

  BEVERAGES.forEach((i) => {
    const qty = Number(beverageQty[i.id] || 0);
    if (!qty) return;
    items.push(`${i.title}: ${qty} ${i.unit} @ $${i.price}/${i.unit} = ${money(qty * i.price)}`);
  });

  items.push(`22% Service Charge — ${money(serviceCharge)}`);
  items.push(`Subtotal before tax & card fees — ${money(taxableBase)}`);

  return items;
}, [
  lockedGuestCount,
  effectivePricePerGuest,
  baseCateringSubtotal,
  secondAppSubtotal,
  lateNightQty,
  dressingRoomQty,
  beverageQty,
  serviceCharge,
  taxableBase,
]);

// 2) Other memoized outputs
const extrasPortion = useMemo(
  () => Math.max(0, grandTotal - baseCateringSubtotal),
  [grandTotal, baseCateringSubtotal]
);

const paymentText = useMemo(
  () => `You're paying ${money(grandTotal)} today (includes 22% service charge, taxes & card fees).`,
  [grandTotal]
);

// 3) Send updates to parent ONLY when they actually change
const lastKeysRef = React.useRef({
  itemsKey: "",
  addons: NaN as number,
  total: NaN as number,
  payText: "",
});

useEffect(() => {
  const itemsKey = JSON.stringify(summaryItems);

  if (lastKeysRef.current.itemsKey !== itemsKey) {
    setLineItems(summaryItems);
    lastKeysRef.current.itemsKey = itemsKey;
  }

  if (lastKeysRef.current.addons !== extrasPortion) {
    setAddonsTotal(extrasPortion);
    lastKeysRef.current.addons = extrasPortion;
  }

  if (lastKeysRef.current.total !== grandTotal) {
    setTotal(grandTotal);
    lastKeysRef.current.total = grandTotal;
  }

  if (lastKeysRef.current.payText !== paymentText) {
    setPaymentSummaryText(paymentText);
    lastKeysRef.current.payText = paymentText;
  }

  // Persist compact order meta (safe: localStorage doesn't cause rerenders)
  try {
    const tierLabel =
      localStorage.getItem("tubacTierLabel") ||
      (selectedTier || menuSelections.tier || "").toString();

    localStorage.setItem(
      "tubacOrderMeta",
      JSON.stringify({
        serviceOption,
        tierLabel,
        pricePerGuest: effectivePricePerGuest,
        guests: lockedGuestCount,
        selections: {
          appetizers: menuSelections.appetizers?.length
            ? menuSelections.appetizers
            : menuSelections.hors || [],
          salads: menuSelections.salads || [],
          entrees: menuSelections.entrees || [],
          sides: menuSelections.sides || [],
          extras: menuSelections.extras || {},
        },
        computed: {
          baseCateringSubtotal,
          addonsSubtotal:
            secondAppSubtotal + lateNightSubtotal + dressingRoomSubtotal + beverageSubtotal,
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
  extrasPortion,
  grandTotal,
  paymentText,
  // props/values referenced inside the persistence block
  serviceOption,
  selectedTier,
  menuSelections.appetizers,
  menuSelections.hors,
  menuSelections.salads,
  menuSelections.entrees,
  menuSelections.sides,
  menuSelections.extras,
  effectivePricePerGuest,
  lockedGuestCount,
  baseCateringSubtotal,
  secondAppSubtotal,
  lateNightSubtotal,
  dressingRoomSubtotal,
  beverageSubtotal,
  serviceCharge,
  taxableBase,
  taxes,
  cardFees,
]);

  // Header bits
  const tierLabel =
    localStorage.getItem("tubacTierLabel") ||
    (selectedTier || menuSelections.tier || "").toString();
  const friendlyHeader = `${serviceOption === "plated" ? "Plated" : "Buffet"} • ${tierLabel || "—"}`;

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 780 }}>
      {/* Pink X */}
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

        <h2 className="px-title-lg" style={{ marginBottom: 4 }}>Tubac Catering — Review & Add-ons</h2>
        <div className="px-prose-narrow" style={{ marginBottom: 10, color: "#2c62ba", fontWeight: 700 }}>
          {friendlyHeader}
        </div>

        {/* Selections summary */}
        <div style={{ marginTop: 8, marginBottom: 18 }}>
          <h3 className="px-title" style={{ marginBottom: 6 }}>Your Selections</h3>
          <div className="px-prose-narrow">
          {(() => {
  // Prefer explicit passed/displayed if they exist
  let passed = menuSelections.horsPassed ?? [];
  let displayed = menuSelections.horsDisplayed ?? [];

  // If neither was provided, fall back to combined `hors`
  if (passed.length === 0 && displayed.length === 0) {
    const combined = menuSelections.hors ?? [];
    if (combined.length) {
      passed = combined.slice(0, 2);
      displayed = combined.slice(2);
    }
  }

  // Final plated-only fallback: use the plated appetizers as "passed"
  const isPlated = (menuSelections.service || serviceOption) === "plated";
  if (isPlated && passed.length === 0 && (menuSelections.appetizers?.length ?? 0) > 0) {
    passed = menuSelections.appetizers!.slice(0, 2);
  }

  return (
    <>
      <strong>Passed Hors d’Oeuvres:</strong>{" "}
      {passed.length ? passed.join(", ") : "—"}
      <br /><br />
      <strong>Displayed Hors d’Oeuvres:</strong>{" "}
      {displayed.length ? displayed.join(", ") : "—"}
      <br /><br />
    </>
  );
})()}

            {(() => {
              const tierKey = (selectedTier || menuSelections.tier || "")
                .toString()
                .toLowerCase();
              const chosen = menuSelections.salads || [];
              const fallback = serviceOption === "buffet" ? BUFFET_SALADS_BY_TIER[tierKey] || [] : [];
              const saladsToShow = chosen.length ? chosen : fallback;
              return (
                <>
                  <strong>Salads:</strong>{" "}
                  {saladsToShow.length ? saladsToShow.join(", ") : "None selected"}
                  <br /><br />
                </>
              );
            })()}

            {(() => {
              const tierKey = (selectedTier || menuSelections.tier || "")
                .toString()
                .toLowerCase();
              const picked = menuSelections.entrees || [];
              const fixed = BUFFET_ENTREES_FIXED_BY_TIER[tierKey];
              const choiceCfg = BUFFET_ENTREES_CHOICE_BY_TIER[tierKey];
              let entreesToShow: string[] = [];
              if (serviceOption === "buffet") {
                if (fixed) {
                  entreesToShow = fixed;
                } else if (choiceCfg) {
                  entreesToShow =
                    picked.length > 0
                      ? [choiceCfg.always, ...picked]
                      : [choiceCfg.always, `${choiceCfg.chicken} — or — ${choiceCfg.fish}`];
                }
              } else {
                entreesToShow = picked;
              }
              return (
                <>
                  <strong>Meals/Entrées:</strong>{" "}
                  {entreesToShow.length ? entreesToShow.join(", ") : "None selected"}
                </>
              );
            })()}
          </div>

          <div style={{ marginTop: 8, fontWeight: 700, color: "#2c62ba" }}>
            {lockedGuestCount} guests @ {money(effectivePricePerGuest)} / guest
          </div>
        </div>

        {/* Guest count panel */}
        <div
          style={{
            background: "#f5f7fb",
            border: "1px solid #d9deee",
            borderRadius: 12,
            padding: "12px 16px",
            margin: "0 auto 16px",
            maxWidth: 520,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, color: "#2c62ba" }}>Guest Count</div>
          <div className="px-prose-narrow">
            Number of Guests: <strong>{lockedGuestCount || 0}</strong>
          </div>
        </div>

        {/* UPGRADE LINE */}
{menuSelections?.extras?.extraAppetizer && (
  <div className="px-prose-narrow" style={{ marginBottom: 8 }}>
    Second Appetizer Upgrade: +{money(UPGRADE_SECOND_APPETIZER_PER_GUEST)} per guest
  </div>
)}

{/* Add-ons grid */}
<div style={{ display: "grid", gap: 14, margin: "0 auto", maxWidth: 680 }}>
  {/* Late Night Snacks */}
  <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 12, padding: 14, border: "1px solid #e8e8ef" }}>
    <div className="px-title" style={{ marginBottom: 4 }}>Late Night Snacks</div>
    <div className="px-prose-narrow" style={{ opacity: 0.8, marginBottom: 8 }}>
      Select quantities for anything you’d like to add.
    </div>
    {LATE_NIGHT.map((i) => (
      <div key={i.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px dashed #eee" }}>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 600 }}>{i.title}</div>
          <div style={{ color: "#555", fontSize: ".93rem" }}>
            {i.unit === "pp" ? `${money(i.price)} per person` : `${money(i.price)} each`}
          </div>
        </div>
        <QtyControls value={Number(lateNightQty[i.id] || 0)} onChange={(n) => changeLateNight(i.id, n)} />
      </div>
    ))}
  </div>

  {/* Dressing Room Snacks */}
  <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 12, padding: 14, border: "1px solid #e8e8ef" }}>
    <div className="px-title" style={{ marginBottom: 4 }}>Dressing Room Snacks</div>
    <div className="px-prose-narrow" style={{ opacity: 0.8, marginBottom: 8 }}>
      Order by the dozen or per person where noted.
    </div>
    {DRESSING_ROOM_SNACKS.map((i) => (
      <div key={i.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px dashed #eee" }}>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 600 }}>{i.title}</div>
          <div style={{ color: "#555", fontSize: ".93rem" }}>
            {i.unit === "dozen" ? `${money(i.price)} per dozen` : `${money(i.price)} per person`}
          </div>
        </div>
        <QtyControls value={Number(dressingRoomQty[i.id] || 0)} onChange={(n) => changeDressing(i.id, n)} />
      </div>
    ))}
  </div>

  {/* Beverages */}
  <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 12, padding: 14, border: "1px solid #e8e8ef" }}>
    <div className="px-title" style={{ marginBottom: 4 }}>Beverages</div>
    {BEVERAGES.map((i) => (
      <div key={i.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px dashed #eee" }}>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 600 }}>{i.title}</div>
          <div style={{ color: "#555", fontSize: ".93rem" }}>
            {i.unit === "can" ? `${money(i.price)} per can` : i.unit === "serving" ? `${money(i.price)} per serving` : `${money(i.price)} per bottle`}
          </div>
        </div>
        <QtyControls value={Number(beverageQty[i.id] || 0)} onChange={(n) => changeBeverage(i.id, n)} />
      </div>
    ))}
  </div>
</div>

        {/* Totals */}
        <div className="px-prose-narrow" style={{ marginTop: 16 }}>
          <div>Base Catering: <strong>{money(baseCateringSubtotal)}</strong></div>
          {secondAppSubtotal > 0 && <div>Second Appetizer Upgrade: <strong>{money(secondAppSubtotal)}</strong></div>}
          {lateNightSubtotal + dressingRoomSubtotal + beverageSubtotal > 0 && (
            <div>Add-ons Subtotal: <strong>{money(lateNightSubtotal + dressingRoomSubtotal + beverageSubtotal)}</strong></div>
          )}
          <div style={{ marginTop: 8 }}>22% Service Charge: <strong>{money(serviceCharge)}</strong></div>
          <div>Taxes & Card Fees: <strong>{money(taxes + cardFees)}</strong></div>
          <div style={{ fontWeight: 800, marginTop: 6, color: "#2c62ba" }}>Today’s Total: {money(grandTotal)}</div>
        </div>

        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 14 }}>
          <button className="boutique-primary-btn" style={{ width: 260 }} onClick={onContinueToCheckout}>Continue</button>
          <button className="boutique-back-btn" style={{ width: 260 }} onClick={onBackToMenu}>⬅ Back to Menu</button>
        </div>
      </div>
    </div>
  );
};

export default TubacCartCatering;