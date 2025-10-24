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

const getFullContractAmount = (p: WnDPurchase): number => {
  if (p?.type === "manual") return 0; // outside items handled separately
  if (typeof p.fullContractAmount === "number") return p.fullContractAmount;
  if (typeof p.contractTotal === "number") return p.contractTotal;
  if (typeof p.total === "number") return p.total;

  const payFull = !!p?.payFull;
  const amount = Number(p?.amount ?? 0);
  const deposit = Number(p?.deposit ?? 0);
  const monthlyAmount = Number(p?.monthlyAmount ?? 0);
  const months = Number(p?.months ?? p?.installments ?? p?.numMonths ?? 0);

  if (payFull) return amount || deposit + monthlyAmount * months || 0;
  return Math.max(deposit + monthlyAmount * months, amount);
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

  return {
    totalBudget: Number(budget) || 0,
    totalSpent: totalWd + totalOutside,
    refresh,
  };
}