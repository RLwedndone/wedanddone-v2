// src/components/MagOMeter/useMagometerTotals.ts
import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

// Keep in sync with MagicCloud types/logic
type WnDPurchase = {
  type?: string; // "manual" means outside item (ignored here)
  label?: string;
  category?: string;
  boutique?: string;
  date?: string;

  amount?: number;
  amountChargedToday?: number;
  payFull?: boolean;
  deposit?: number;
  monthlyAmount?: number;
  months?: number;
  installments?: number;
  numMonths?: number;

  fullContractAmount?: number;
  contractTotal?: number;
  total?: number;

  items?: string[];
};

type OutsidePurchase = { label: string; amount: number };

const num = (v: any) => (typeof v === "number" && isFinite(v) ? v : 0);

const getFullContractAmount = (p: WnDPurchase): number => {
  // Outside/manual purchases are handled in the separate outside list
  if (!p || p.type === "manual") return 0;

  // 1) Strong signals for "total contract price"
  const strongTotals = [
    p.fullContractAmount,
    p.contractTotal,
    (p as any).amountTotal,   // sometimes used by older checkouts
    (p as any).grandTotal,    // sometimes used by venue flow
    p.total,
  ].map(num).filter(Boolean);

  if (strongTotals.length) return Math.max(...strongTotals);

  // 2) Infer total when we have payments metadata
  const payFull = !!p.payFull;
  const amountToday = num(p.amountChargedToday ?? p.amount); // today’s charge (often deposit)
  const deposit = num(p.deposit ?? amountToday);
  const monthly = num(p.monthlyAmount);
  const months =
    num((p as any).months) || num((p as any).installments) || num((p as any).numMonths);

  // If they paid in full, prefer amountToday if it’s clearly the full amount
  if (payFull) {
    // If a monthly plan exists, compute total from it; otherwise assume amountToday was the full
    const inferred = deposit + monthly * months;
    return inferred > 0 ? inferred : amountToday;
  }

  // Not pay-in-full:
  // Prefer an inferred plan total; otherwise fall back to the largest known number
  const inferredPlanTotal = deposit + monthly * months;
  return Math.max(inferredPlanTotal, amountToday, deposit);
};

export function useMagometerTotals() {
  const [budget, setBudget] = useState<number>(0);
  const [wdPurchases, setWdPurchases] = useState<WnDPurchase[]>([]);
  const [outsidePurchases, setOutsidePurchases] = useState<OutsidePurchase[]>([]);

  const refresh = async () => {
    // 1) Local fallbacks (guests)
    const localBudget = localStorage.getItem("magicBudget");
    if (localBudget) setBudget(parseInt(localBudget) || 0);

    const localOutside = localStorage.getItem("outsidePurchases");
    if (localOutside) {
      try {
        setOutsidePurchases(JSON.parse(localOutside));
      } catch {
        /* ignore */
      }
    }

    // 2) Firestore (if logged in)
    const user = getAuth().currentUser;
    if (user) {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data() || {};
      if (typeof data.budget === "number") setBudget(data.budget);
      if (Array.isArray(data.purchases)) setWdPurchases(data.purchases as WnDPurchase[]);
      if (Array.isArray(data?.budgetData?.outsidePurchases)) {
        setOutsidePurchases(data.budgetData.outsidePurchases as OutsidePurchase[]);
      }
    }
  };

  useEffect(() => {
    refresh();

    const handler = () => refresh();
    window.addEventListener("purchaseMade", handler);
    window.addEventListener("bookingsChanged", handler);
    window.addEventListener("budgetUpdated", handler);

    return () => {
      window.removeEventListener("purchaseMade", handler);
      window.removeEventListener("bookingsChanged", handler);
      window.removeEventListener("budgetUpdated", handler);
    };
  }, []);

  const totalWd = useMemo(
    () => wdPurchases.reduce((sum, p) => sum + getFullContractAmount(p), 0),
    [wdPurchases]
  );
  const totalOutside = useMemo(
    () => outsidePurchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [outsidePurchases]
  );

  // 🔄 NEW: Refresh whenever the logged-in user changes
useEffect(() => {
  const unsub = getAuth().onAuthStateChanged(() => {
    refresh(); // fetch budget + purchases for this user
  });
  return () => unsub();
}, []);

  const totalSpentCombined = totalWd + totalOutside;

  // 👇 NEW: remember locally that the user has spent something
  useEffect(() => {
    try {
      if (totalSpentCombined > 0) {
        localStorage.setItem("wandHasSpend", "true");
      }
    } catch {}
  }, [totalSpentCombined]);

  return {
    totalBudget: Number(budget) || 0,
    totalSpent: totalSpentCombined,
    hasAnySpend: totalSpentCombined > 0, // 👈 NEW (optional if you want to use it upstream)
    refresh,
  };
}