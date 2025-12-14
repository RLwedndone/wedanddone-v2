import React, { useEffect, useMemo, useState, useRef } from "react";

interface PhotoShotListCombinedProps {
  onNext: () => void;
  onBack: () => void;
  goToTOC?: () => void;
}

// VIP entries (support array roles)
type VIPEntry = { name: string; role: string | string[] };

type LoveBird = {
  first?: string;
  last?: string;
  name?: string; // legacy shape
  label?: string; // "Bride" | "Groom" | "Partner"
};

type ShotSelection = Record<string, string[]>;

const STORAGE_KEY = "photoShotListCombined";
const VIP_LB1_KEY = "magicBookVIPList1";
const VIP_LB2_KEY = "magicBookVIPList2";
const COUPLE_KEY = "magicBookCoupleInfo";

type ShotDef = {
  key: "everyone" | "parents" | "wedding_party";
  img: string;
  helper?: string;
};

const asArray = (r: string | string[]) => (Array.isArray(r) ? r : [r]);
const normalizeOneRole = (r: unknown) =>
  typeof r === "string"
    ? r.replace(/^[^’']+[’']s?\s+/i, "").trim().toLowerCase()
    : "";
const dedup = <T,>(arr: T[]) => Array.from(new Set(arr));

type RoleBuckets = {
  mothers: string[];
  fathers: string[];
  brothers: string[];
  sisters: string[];
  party: string[];
};

const bucketsFromVIPs = (list: VIPEntry[]): RoleBuckets => {
  const mothers = new Set<string>();
  const fathers = new Set<string>();
  const brothers = new Set<string>();
  const sisters = new Set<string>();
  const party = new Set<string>();

  list.forEach(({ name, role }) => {
    asArray(role).forEach((raw) => {
      const r = normalizeOneRole(raw);

      if (r === "mother" || r === "stepmother" || r.includes("step mother")) {
        mothers.add(name);
      } else if (
        r === "father" ||
        r === "stepfather" ||
        r.includes("step father")
      ) {
        fathers.add(name);
      } else if (r === "brother") {
        brothers.add(name);
      } else if (r === "sister") {
        sisters.add(name);
      } else if (
        r.includes("maid of honor") ||
        r.includes("matron of honor") ||
        r.includes("bridesmaid") ||
        r.includes("junior bridesmaid") ||
        r.includes("flower girl") ||
        r.includes("flowergirl") ||
        r === "best man" ||
        r.includes("groomsman") ||
        r.includes("junior groomsman") ||
        r === "ring bearer"
      ) {
        party.add(name);
      }
    });
  });

  return {
    mothers: [...mothers],
    fathers: [...fathers],
    brothers: [...brothers],
    sisters: [...sisters],
    party: [...party],
  };
};

// ---------- Custom Shot box (stored alongside selections in STORAGE_KEY)
const CustomShotForm: React.FC = () => {
  const [title, setTitle] = useState("");
  const [names, setNames] = useState("");
  const [error, setError] = useState("");
  const [customs, setCustoms] = useState<
    Array<{ id: string; label: string; names: string[] }>
  >([]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setCustoms(parsed?.custom || []);
    } catch {}
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const base = raw ? JSON.parse(raw) : {};
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...base, custom: customs })
    );
  }, [customs]);

  const parseNames = (raw: string) =>
    raw
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

  const add = () => {
    setError("");
    const t = title.trim();
    const arr = parseNames(names);
    if (!t)
      return setError("Please enter a short shot description.");
    if (arr.length < 2)
      return setError(
        "Add at least two names, separated by commas."
      );
    const id = `custom-${Date.now()}`;
    setCustoms((prev) => [...prev, { id, label: t, names: arr }]);
    setTitle("");
    setNames("");
  };

  const remove = (id: string) =>
    setCustoms((prev) => prev.filter((c) => c.id !== id));

  return (
    <>
      <label
        style={{
          display: "block",
          fontSize: "0.9rem",
          marginBottom: "0.25rem",
        }}
      >
        Shot description (e.g., “Couple with Grandparents”)
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Short description"
        style={{
          width: "100%",
          padding: "0.55rem 0.7rem",
          borderRadius: 8,
          border: "1px solid #dcdcdc",
          marginBottom: "0.6rem",
          fontSize: "0.95rem",
        }}
      />

      <label
        style={{
          display: "block",
          fontSize: "0.9rem",
          marginBottom: "0.25rem",
        }}
      >
        Who’s in this photo? (comma-separated)
      </label>
      <input
        value={names}
        onChange={(e) => setNames(e.target.value)}
        placeholder="Rachel, Travis, Grandma Sue"
        style={{
          width: "100%",
          padding: "0.55rem 0.7rem",
          borderRadius: 8,
          border: "1px solid #dcdcdc",
          marginBottom: "0.6rem",
          fontSize: "0.95rem",
        }}
      />

      {error && (
        <div
          style={{
            color: "#c0392b",
            fontSize: "0.9rem",
            marginBottom: "0.4rem",
          }}
        >
          {error}
        </div>
      )}

      {/* ⭐ Centered add button */}
      <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
        <button
          onClick={add}
          style={{
            backgroundColor: "#2c62ba",
            color: "#fff",
            fontSize: "0.95rem",
            padding: "0.55rem 1.1rem",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
          }}
        >
          + Add Custom Shot
        </button>
      </div>

      {customs.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {customs.map((c) => (
            <li
              key={c.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 10,
                padding: "0.75rem",
                marginBottom: "0.6rem",
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {`Custom – ${c.label}`}
                </div>
                <button
                  onClick={() => remove(c.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2c62ba",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: "0.95rem",
                  color: "#444",
                }}
              >
                <strong>Names:</strong>{" "}
                {c.names.join(", ")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

const PhotoShotListCombined: React.FC<PhotoShotListCombinedProps> = ({
  onNext,
  onBack,
  goToTOC,
}) => {
  const [lb1FullName, setLb1FullName] = useState("");
  const [lb2FullName, setLb2FullName] = useState("");
  const [lb1FirstName, setLb1FirstName] = useState("");
  const [lb2FirstName, setLb2FirstName] = useState("");

  const [vip1, setVip1] = useState<VIPEntry[]>([]);
  const [vip2, setVip2] = useState<VIPEntry[]>([]);
  const [selections, setSelections] = useState<ShotSelection>({});
  const [activeShot, setActiveShot] =
    useState<ShotDef["key"] | null>(null);
  const [modalTemp, setModalTemp] = useState<string[]>([]);

  const cardRef = useRef<HTMLDivElement>(null);

  // Scroll into view on mount
  useEffect(() => {
    try {
      cardRef.current?.scrollIntoView({ block: "start" });
    } catch {}
  }, []);

  // Couple info
  useEffect(() => {
    const raw = localStorage.getItem(COUPLE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const lb1: LoveBird | undefined = parsed?.loveBird1;
      const lb2: LoveBird | undefined = parsed?.loveBird2;

      const lb1First =
        (lb1?.first && String(lb1.first)) ||
        (lb1?.name && String(lb1.name).split(" ")[0]) ||
        "";
      const lb1Last =
        (lb1?.last && String(lb1.last)) ||
        (lb1?.name && String(lb1.name).split(" ").slice(1).join(" ")) ||
        "";
      setLb1FirstName(lb1First);
      setLb1FullName(
        [lb1First, lb1Last].filter(Boolean).join(" ").trim()
      );

      const lb2First =
        (lb2?.first && String(lb2.first)) ||
        (lb2?.name && String(lb2.name).split(" ")[0]) ||
        "";
      const lb2Last =
        (lb2?.last && String(lb2.last)) ||
        (lb2?.name && String(lb2.name).split(" ").slice(1).join(" ")) ||
        "";
      setLb2FirstName(lb2First);
      setLb2FullName(
        [lb2First, lb2Last].filter(Boolean).join(" ").trim()
      );
    } catch {}
  }, []);

  // VIPs
  useEffect(() => {
    try {
      const list1 = JSON.parse(
        localStorage.getItem(VIP_LB1_KEY) || "[]"
      );
      setVip1(Array.isArray(list1) ? (list1 as VIPEntry[]) : []);
    } catch {
      setVip1([]);
    }
    try {
      const list2 = JSON.parse(
        localStorage.getItem(VIP_LB2_KEY) || "[]"
      );
      setVip2(Array.isArray(list2) ? (list2 as VIPEntry[]) : []);
    } catch {
      setVip2([]);
    }
  }, []);

  // Hydrate selections
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setSelections(parsed.selections || {});
      }
    } catch {}
  }, []);

  // Persist selections
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ selections }));
  }, [selections]);

  const role1 = useMemo(() => bucketsFromVIPs(vip1), [vip1]);
  const role2 = useMemo(() => bucketsFromVIPs(vip2), [vip2]);

  const allVIPs = useMemo(() => {
    const byName = new Map<string, VIPEntry>();
    [...vip1, ...vip2].forEach((v) => byName.set(v.name, v));
    return Array.from(byName.values());
  }, [vip1, vip2]);

  const parentsBoth = useMemo(
    () =>
      dedup([
        ...role1.mothers,
        ...role1.fathers,
        ...role2.mothers,
        ...role2.fathers,
      ]),
    [role1, role2]
  );
  const siblingsBoth = useMemo(
    () =>
      dedup([
        ...role1.brothers,
        ...role1.sisters,
        ...role2.brothers,
        ...role2.sisters,
      ]),
    [role1, role2]
  );
  const partyBoth = useMemo(
    () => dedup([...role1.party, ...role2.party]),
    [role1, role2]
  );

  const hasParentsCard = parentsBoth.length >= 2;
  const hasWeddingCard = partyBoth.length > 0;
  const hasEveryoneCard =
    parentsBoth.length + siblingsBoth.length + partyBoth.length > 0;

  const shotList: ShotDef[] = useMemo(() => {
    const shots: ShotDef[] = [];
    if (hasEveryoneCard)
      shots.push({
        key: "everyone",
        img: `${import.meta.env.BASE_URL}assets/images/Shot_Cards/everyone.png`,
      });
    if (hasParentsCard)
      shots.push({
        key: "parents",
        img: `${import.meta.env.BASE_URL}assets/images/Shot_Cards/parents.png`,
      });
    if (hasWeddingCard)
      shots.push({
        key: "wedding_party",
        img: `${import.meta.env.BASE_URL}assets/images/Shot_Cards/wedding_party.png`,
      });
    return shots;
  }, [hasEveryoneCard, hasParentsCard, hasWeddingCard]);

  // Prune hidden shots
  useEffect(() => {
    const visible = new Set(shotList.map((s) => s.key));
    setSelections((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (!visible.has(k as ShotDef["key"])) delete next[k];
      });
      return next;
    });
  }, [shotList]);

  // Defaults
  useEffect(() => {
    if (!lb1FullName || !lb2FullName) return;

    const defaults: Record<ShotDef["key"], string[]> = {
      everyone: dedup([
        ...parentsBoth,
        ...siblingsBoth,
        ...partyBoth,
      ]),
      parents: parentsBoth,
      wedding_party: partyBoth,
    };

    const visible = new Set(shotList.map((s) => s.key));
    setSelections((prev) => {
      const next = { ...prev };
      (Object.keys(defaults) as Array<ShotDef["key"]>).forEach(
        (key) => {
          if (!visible.has(key)) return;
          if (!next[key] || next[key].length === 0) {
            next[key] = defaults[key] || [];
          }
        }
      );
      return next;
    });
  }, [lb1FullName, lb2FullName, parentsBoth, siblingsBoth, partyBoth, shotList]);

  const openModal = (key: ShotDef["key"]) => {
    setActiveShot(key);
    setModalTemp(selections[key] || []);
  };

  const closeModal = () => {
    setActiveShot(null);
    setModalTemp([]);
  };

  const toggleModalName = (name: string, checked: boolean) => {
    setModalTemp((prev) => {
      const set = new Set(prev);
      if (checked) set.add(name);
      else set.delete(name);
      return Array.from(set);
    });
  };

  const selectAllModal = () => setModalTemp(allVIPs.map((o) => o.name));
  const clearAllModal = () => setModalTemp([]);
  const saveModal = () => {
    if (!activeShot) return;
    setSelections((prev) => ({ ...prev, [activeShot]: modalTemp }));
    closeModal();
  };

  const headerFont: React.CSSProperties = {
    fontFamily: "'Jenna Sue','Jena Sue',cursive",
    fontSize: "2.2rem",
    lineHeight: 1.1,
    color: "#2c62ba",
    textAlign: "center",
    margin: "0.25rem 0 1rem",
  };

  const handleBackToTOC = () => {
    if (typeof goToTOC === "function") {
      goToTOC();
      return;
    }
    localStorage.setItem("magicStep", "toc");
    window.dispatchEvent(new Event("magic:gotoTOC"));
  };

  const you1 = lb1FirstName || "Partner 1";
  const you2 = lb2FirstName || "Partner 2";

  return (
    <>
      {/* MAIN CARD */}
      <div
        ref={cardRef}
        className="pixie-card wd-page-turn"
        style={{ padding: "1.25rem 0", position: "relative" }}
      >
        {/* Pink X = Back to TOC */}
        <button
          className="pixie-card__close"
          onClick={handleBackToTOC}
          aria-label="Close"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>

        {/* Inner wrapper with side padding */}
        <div
          style={{
            width: "100%",
            maxWidth: 560,
            margin: "0 auto",
            padding: "0 1.5rem",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: "0.5rem",
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/images/combined_shots.png`}
              alt="Combined Shot List Icon"
              style={{ width: "100%", maxWidth: 350 }}
            />
          </div>

          <h2 style={headerFont}>Combined Formal Shot List</h2>

          <p
            style={{
              textAlign: "center",
              color: "#444",
              fontSize: "1rem",
              lineHeight: 1.4,
              maxWidth: 520,
              margin: "0 auto 1rem",
            }}
          >
            ✨ We’ve waved our little wand and pre-filled each photo
            using your VIP lists. Tap a card to add or remove anyone —
            you’re the director! For one-on-one portraits or special
            groups, use the Custom Shot box below.
          </p>

          {/* Shot cards */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              alignItems: "center",
              marginBottom: "1rem",
              width: "100%",
            }}
          >
            {shotList.map((shot) => {
              const chosen = selections[shot.key] || [];
              return (
                <div
                  key={shot.key}
                  style={{
                    width: "100%",
                    maxWidth: 680,
                    border: "1px solid #eee",
                    borderRadius: 16,
                    background: "#fff",
                    overflow: "hidden",
                    boxShadow: "0 6px 14px rgba(0, 0, 0, 0.06)",
                    margin: "0 auto",
                  }}
                >
                  <div
                    onClick={() => openModal(shot.key)}
                    style={{
                      cursor: "pointer",
                      position: "relative",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      paddingTop: "0.25rem",
                    }}
                  >
                    <img
                      src={shot.img}
                      alt=""
                      style={{
                        width: "70%",
                        maxWidth: 400,
                        height: "auto",
                        display: "block",
                        margin: "0 auto",
                        transition: "transform 0.2s ease",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.transform =
                          "scale(1.01)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.transform =
                          "scale(1)")
                      }
                    />
                  </div>

                  <div
                    style={{
                      padding: "0.8rem 0.9rem",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        color: "#444",
                        minHeight: 22,
                      }}
                    >
                      {chosen.length ? (
                        <>
                          <strong>Selected:</strong>{" "}
                          {chosen.join(", ")}
                        </>
                      ) : (
                        <em>Click the card to choose names</em>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom shot box */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              width: "100%",
              margin: "0.6rem 0 0.9rem",
            }}
          >
            <div
              style={{
                border: "1px solid #e7e7e7",
                borderRadius: 12,
                padding: "0.9rem",
                background: "#fafbff",
                width: "100%",
                maxWidth: 560,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: "0.5rem",
                  color: "#2c62ba",
                }}
              >
                Add a Custom Shot
              </div>
              <div
                style={{
                  color: "#555",
                  fontSize: "0.92rem",
                  marginBottom: "0.5rem",
                }}
              >
                Tip: Great for one-on-ones (e.g., {you1} + {you2}) or any
                special grouping.
              </div>
              <CustomShotForm />
            </div>
          </div>
        </div>

        {/* Nav buttons – full-width area */}
        <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
          <button
            onClick={onNext}
            style={{
              width: 200,
              backgroundColor: "#2c62ba",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "0.85rem 1rem",
              fontSize: "1.1rem",
              cursor: "pointer",
            }}
          >
            Turn the Page →
          </button>
          <br />
          <button
            onClick={onBack}
            className="boutique-back-btn"
            style={{
              width: 240,
              padding: "0.85rem 1rem",
              marginTop: "0.6rem",
            }}
          >
            ⬅ Previous Page
          </button>
          <div style={{ marginTop: "0.75rem" }}>
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
                width: 200,
              }}
            >
              🪄 Back to TOC
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {activeShot && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 92vw)",
              background: "#fff",
              borderRadius: 14,
              boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
              padding: "1rem 1rem 1.1rem",
            }}
          >
            <div style={{ color: "#666", marginBottom: 8 }}>
              Select everyone to include in this photo:
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginBottom: "0.6rem",
              }}
            >
              <button
                onClick={selectAllModal}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  cursor: "pointer",
                }}
              >
                Select All
              </button>
              <button
                onClick={clearAllModal}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  cursor: "pointer",
                }}
              >
                Clear All
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "0.6rem 0.9rem",
                maxHeight: "50vh",
                overflow: "auto",
                paddingRight: 4,
              }}
            >
              {allVIPs.map((vip) => {
                const roles = Array.isArray(vip.role)
                  ? vip.role
                  : [vip.role];
                const checked = modalTemp.includes(vip.name);
                return (
                  <label
                    key={vip.name}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        toggleModalName(vip.name, e.target.checked)
                      }
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      <span style={{ fontWeight: 600 }}>
                        {vip.name}
                      </span>
                      {roles.length ? (
                        <span style={{ color: "#666" }}>
                          {" "}
                          ({roles.join(", ")})
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                marginTop: "0.9rem",
              }}
            >
              <button
                onClick={closeModal}
                style={{
                  padding: "0.55rem 1.1rem",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveModal}
                style={{
                  padding: "0.55rem 1.1rem",
                  borderRadius: 10,
                  border: "none",
                  background: "#2c62ba",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PhotoShotListCombined;