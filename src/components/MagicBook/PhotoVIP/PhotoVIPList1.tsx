import React, { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "../../../firebase/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface PhotoVIPListProps1 {
  onNext: () => void;
  onBack: () => void;
  goToTOC?: () => void;
}

type LoveBird = { name?: string; first?: string; last?: string; label?: string };
type VIPEntry = { name: string; role: string | string[] };

const PhotoVIPList1: React.FC<PhotoVIPListProps1> = ({ onNext, onBack, goToTOC }) => {
  const [loveBird1, setLoveBird1] = useState<{ first: string; label: string }>({
    first: "",
    label: "",
  });
  const [currentName, setCurrentName] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customRoleInput, setCustomRoleInput] = useState("");
  const [vipList, setVipList] = useState<VIPEntry[]>([]);
  const [userId, setUserId] = useState("");
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Scroll into view on mount
  useEffect(() => {
    try {
      cardRef.current?.scrollIntoView({ block: "start" });
    } catch {}
  }, []);

  // Roles used in UI
  const roleOptions = useMemo(() => {
    const roles = [
      "Mother",
      "Stepmother",
      "Father",
      "Stepfather",
      "Brother",
      "Sister",
      "Grandparent",
      "Maid of Honor",
      "Matron of Honor",
      "Bridesmaid",
      "Junior Bridesmaid",
      "Flower Girl",
      "Best Man",
      "Groomsman",
      "Junior Groomsman",
      "Ring Bearer",
      "Officiant",
      "Usher",
      "Reader",
      "Other",
    ];
    return Array.from(new Set(roles));
  }, []);

  // Load couple info + VIP list
  useEffect(() => {
    const raw = localStorage.getItem("magicBookCoupleInfo");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const lb1: LoveBird | undefined = parsed?.loveBird1;

        const firstName =
          (lb1?.first && String(lb1.first)) ||
          (lb1?.name && String(lb1.name).split(" ")[0]) ||
          "";

        const label = (lb1?.label && String(lb1.label)) || "";
        setLoveBird1({ first: firstName, label });
      } catch {}
    }

    try {
      const saved = JSON.parse(localStorage.getItem("magicBookVIPList1") || "[]");
      setVipList(Array.isArray(saved) ? (saved as VIPEntry[]) : []);
    } catch {
      setVipList([]);
    }

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const docRef = doc(db, "users", user.uid, "magicBookData", "vipList1");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setVipList(Array.isArray((data as any).list) ? ((data as any).list as VIPEntry[]) : []);
        }
      }
    });
  }, []);

  const saveVIPList = async (updatedList: VIPEntry[]) => {
    localStorage.setItem("magicBookVIPList1", JSON.stringify(updatedList));
    if (userId) {
      const docRef = doc(db, "users", userId, "magicBookData", "vipList1");
      await setDoc(docRef, { list: updatedList });
    }
  };

  const handleAddVIP = () => {
    const name = currentName.trim();
    if (!name || selectedRoles.length === 0) return;

    const newEntry: VIPEntry = { name, role: selectedRoles.map((r) => r.trim()) };
    const updatedList = [...vipList, newEntry];

    setVipList(updatedList);
    saveVIPList(updatedList);

    setCurrentName("");
    setSelectedRoles([]);
    setCustomRoleInput("");
  };

  const handleNext = () => {
    localStorage.setItem("magicStep", "vip2");
    onNext();
  };

  const handleBack = () => {
    localStorage.setItem("magicStep", "vip");
    onBack();
  };

  const handleBackToTOC = () => {
    if (typeof goToTOC === "function") {
      goToTOC();
      return;
    }
    localStorage.setItem("magicStep", "toc");
    window.dispatchEvent(new Event("magic:gotoTOC"));
  };

  const headerFont: React.CSSProperties = {
    fontFamily: "'Jenna Sue','Jena Sue',cursive",
    fontSize: "2.2rem",
    lineHeight: 1.1,
    color: "#2c62ba",
    textAlign: "center",
    margin: "0.25rem 0 1rem",
  };

  const inputRow: React.CSSProperties = {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: "0.75rem",
  };

  return (
    <div
      ref={cardRef}
      className="pixie-card wd-page-turn"
      style={{
        paddingTop: "1.25rem",
        paddingBottom: "1.25rem",
        position: "relative",
      }}
    >
      {/* Pink X */}
      <button className="pixie-card__close" onClick={handleBackToTOC} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* Top clipboard image */}
      <div style={{ marginBottom: "0.5rem", textAlign: "center" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/gold_top.png`}
          alt="VIP Clipboard Top"
          style={{ width: "86%", maxWidth: 520 }}
        />
      </div>

      {/* Header */}
      <h2 style={headerFont}>
        {loveBird1.first ? `${loveBird1.first}’s VIP List` : "Your VIP List"}
      </h2>

      {/* Add Name */}
      <div style={inputRow}>
        <input
          type="text"
          placeholder="Enter full name"
          value={currentName}
          onChange={(e) => setCurrentName(e.target.value)}
          style={{
            padding: "0.6rem 0.8rem",
            minWidth: 220,
            width: "60%",
            maxWidth: 360,
            borderRadius: 10,
            border: "1px solid #ccc",
          }}
        />
      </div>

      {/* Roles */}
      <div style={{ margin: "0.5rem auto 0.25rem", maxWidth: 680 }}>
        <div style={{ fontWeight: 600, marginBottom: "0.35rem", textAlign: "center" }}>
          Select all roles that apply
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
            gap: "0.5rem",
          }}
        >
          {roleOptions.map((role) => {
            const id = `vip1-role-${role.replace(/\s+/g, "-").toLowerCase()}`;
            return (
              <label key={role} htmlFor={id} style={{ display: "flex", gap: 8 }}>
                <input
                  id={id}
                  type="checkbox"
                  checked={selectedRoles.includes(role)}
                  onChange={() =>
                    setSelectedRoles((prev) =>
                      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
                    )
                  }
                />
                <span>{role}</span>
              </label>
            );
          })}
        </div>

        {/* Add custom role */}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Add another role (e.g., Cousin, Godmother)"
            value={customRoleInput}
            onChange={(e) => setCustomRoleInput(e.target.value)}
            style={{
              padding: "0.6rem 0.8rem",
              flex: 1,
              borderRadius: 10,
              border: "1px solid #ccc",
            }}
          />
          <button
            type="button"
            onClick={() => {
              const val = customRoleInput.trim();
              if (!val) return;
              setSelectedRoles((prev) => (prev.includes(val) ? prev : [...prev, val]));
              setCustomRoleInput("");
            }}
            style={{
              padding: "0.55rem 1rem",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Add role
          </button>
        </div>

        {selectedRoles.length > 0 && (
          <div style={{ marginTop: 8, fontSize: "0.9rem", color: "#555" }}>
            Selected: {selectedRoles.join(", ")}
          </div>
        )}
      </div>

      {/* Add button */}
      <div style={{ textAlign: "center", marginTop: "0.75rem" }}>
        <button
          onClick={handleAddVIP}
          type="button"
          style={{
            padding: "0.65rem 1.5rem",
            backgroundColor: "#2c62ba",
            color: "#fff",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
          }}
        >
          Add to my VIPs
        </button>
      </div>

      {/* List */}
      <hr style={{ margin: "1.25rem 0" }} />

      <div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {vipList.map((entry, index) => (
            <li
              key={index}
              style={{
                marginBottom: "0.6rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0 1.25rem", // ← ADD SPACING
              }}
            >
              <span>
                <strong>{entry.name}</strong> –{" "}
                {Array.isArray(entry.role) ? entry.role.join(", ") : entry.role}
              </span>

              <button
                onClick={() => {
                  const updated = vipList.filter((_, i) => i !== index);
                  setVipList(updated);
                  saveVIPList(updated);
                }}
                title="Remove"
                type="button"
                style={{
                  color: "red",
                  background: "none",
                  border: "none",
                  fontSize: "1rem",
                  cursor: "pointer",
                  marginRight: "0.25rem", // ← MOVE ❌ INWARD
                }}
              >
                ❌
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom clipboard image */}
      <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/gold_bottom.png`}
          alt="VIP Clipboard Bottom"
          style={{ width: "86%", maxWidth: 520 }}
        />
      </div>

      {/* Nav buttons */}
      <div
        style={{
          textAlign: "center",
          marginTop: "1rem",
          display: "grid",
          gap: "0.6rem",
          justifyItems: "center",
        }}
      >
        <button
          onClick={handleNext}
          style={{
            width: 180,
            backgroundColor: "#2c62ba",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            fontSize: "1.1rem",
            cursor: "pointer",
          }}
        >
          Turn the Page →
        </button>

        <button onClick={handleBack} className="boutique-back-btn" style={{ width: 250 }}>
          ⬅ Previous Page
        </button>

        <button
          onClick={handleBackToTOC}
          style={{
            backgroundColor: "#7b4bd8",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            fontSize: "1.05rem",
            fontWeight: 600,
            cursor: "pointer",
            width: 180,
          }}
        >
          🪄 Back to TOC
        </button>
      </div>
    </div>
  );
};

export default PhotoVIPList1;