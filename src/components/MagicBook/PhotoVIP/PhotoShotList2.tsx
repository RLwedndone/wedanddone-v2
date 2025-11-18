import React, { useEffect, useMemo, useState, useRef } from "react";

interface PhotoShotList2Props {
  onNext: () => void;
  onBack: () => void;
  goToTOC?: () => void; // ✅ allow overlay to pass Back-to-TOC
}

// Types stored in localStorage for VIP list entries
type VIPEntry = { name: string; role: string | string[] };

type LoveBird = {
  first?: string;
  last?: string;
  name?: string; // legacy shape
  label?: string; // "Bride" | "Groom" | "Partner"
};

type ShotSelection = Record<string, string[]>;

const STORAGE_KEY = "photoShotList2";
const VIP1_KEY = "magicBookVIPList1";
const VIP2_KEY = "magicBookVIPList2";
const COUPLE_KEY = "magicBookCoupleInfo";

type ShotDef = {
  key: string;
  label: string;
  img: string;
  helper?: string;
  allowAllVips?: boolean;
};

// ---------- role helpers ----------
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
      } else if (r === "father" || r === "stepfather" || r.includes("step father")) {
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

const PhotoShotList2: React.FC<PhotoShotList2Props> = ({
  onNext,
  onBack,
  goToTOC,
}) => {
  const [lb2FullName, setLb2FullName] = useState<string>("");
  const [lb2FirstName, setLb2FirstName] = useState<string>("");
  const [lb2Label, setLb2Label] = useState<string>("");

  const [vip1, setVip1] = useState<VIPEntry[]>([]);
  const [vip2, setVip2] = useState<VIPEntry[]>([]); // primary (LB2 side)

  const [selections, setSelections] = useState<ShotSelection>({});
  const [skippedShots, setSkippedShots] = useState<Record<string, boolean>>({});

  // Modal state
  const [activeShot, setActiveShot] = useState<string | null>(null);
  const [modalTemp, setModalTemp] = useState<string[]>([]);

  const cardRef = useRef<HTMLDivElement>(null);

  // Scroll card to top on mount
  useEffect(() => {
    try {
      cardRef.current?.scrollIntoView({ block: "start" });
    } catch {}
  }, []);

  // ----- Load couple info (supports legacy couple shapes)
  useEffect(() => {
    const raw = localStorage.getItem(COUPLE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const lb2: LoveBird | undefined = parsed?.loveBird2;
      const first =
        (lb2?.first && String(lb2.first)) ||
        (lb2?.name && String(lb2.name).split(" ")[0]) ||
        "";
      const last =
        (lb2?.last && String(lb2.last)) ||
        (lb2?.name && String(lb2.name).split(" ").slice(1).join(" ")) ||
        "";

      setLb2FirstName(first);
      setLb2FullName([first, last].filter(Boolean).join(" ").trim());
      setLb2Label(lb2?.label || "");
    } catch {
      /* ignore */
    }
  }, []);

  // ----- Load VIPs (LB2 primary, LB1 also for party options)
  useEffect(() => {
    const raw1 = localStorage.getItem(VIP1_KEY);
    const raw2 = localStorage.getItem(VIP2_KEY);
    try {
      const list1 = raw1 ? (JSON.parse(raw1) as VIPEntry[]) : [];
      const list2 = raw2 ? (JSON.parse(raw2) as VIPEntry[]) : [];
      setVip1(Array.isArray(list1) ? list1 : []);
      setVip2(Array.isArray(list2) ? list2 : []);
    } catch {
      setVip1([]);
      setVip2([]);
    }
  }, []);

  // ----- Hydrate selections + skipped flags
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setSelections(parsed.selections || {});
        setSkippedShots(parsed.skipped || {});
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ----- Persist on change
  useEffect(() => {
    const payload = { selections, skipped: skippedShots };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [selections, skippedShots]);

  // ----- Helpers
  const setSelection = (key: string, names: string[]) =>
    setSelections((prev) => ({ ...prev, [key]: names }));

  const toggleSkip = (key: string) =>
    setSkippedShots((prev) => ({ ...prev, [key]: !prev[key] }));

  const allVipForParty = useMemo(() => {
    const byName = new Map<string, VIPEntry>();
    [...vip1, ...vip2].forEach((v) => byName.set(v.name, v));
    return Array.from(byName.values());
  }, [vip1, vip2]);

  const you = lb2FirstName || "Lovebird";

  // ----- Role buckets
  const role1 = useMemo(() => bucketsFromVIPs(vip1), [vip1]); // LB1
  const role2 = useMemo(() => bucketsFromVIPs(vip2), [vip2]); // LB2 (primary)

  // ----- Visible shots
  const shotList: ShotDef[] = useMemo(() => {
    const parentCount = role2.mothers.length + role2.fathers.length;
    const hasParents = parentCount >= 2;
    const hasSiblings =
      role2.brothers.length > 0 || role2.sisters.length > 0;
    const hasFamily = hasParents || hasSiblings;
    const party = dedup([...role2.party, ...role1.party]);
    const hasParty = party.length > 0;

    const shots: ShotDef[] = [];

    if (hasFamily) {
      shots.push({
        key: "whole-family",
        label: `${you} with Whole Family`,
        img: `${import.meta.env.BASE_URL}assets/images/Shot_Cards/LB2_shot_1_whole_family.png`,
      });
    }
    if (hasParents) {
      shots.push({
        key: "parents",
        label: `${you} with Parents`,
        img: `${import.meta.env.BASE_URL}assets/images/Shot_Cards/LB2_shot_2_parents.png`,
      });
    }
    if (hasSiblings) {
      shots.push({
        key: "siblings",
        label: `${you} with Siblings`,
        img: `${import.meta.env.BASE_URL}assets/images/Shot_Cards/LB2_shot_3_siblings.png`,
      });
    }
    if (role2.mothers.length) {
      shots.push({
        key: "mom",
        label: `${you} with Mom`,
        img: `${import.meta.env.BASE_URL}assets/images/Shot_Cards/LB2_shot_4_mom.png`,
      });
    }
    if (role2.fathers.length) {
      shots.push({
        key: "dad",
        label: `${you} with Dad`,
        img: `${import.meta.env.BASE_URL}assets/images/Shot_Cards/LB2_shot_5_dad.png`,
      });
    }
    if (hasParty) {
      shots.push({
        key: "party",
        label: `${you} with Wedding Party`,
        img: `${import.meta.env.BASE_URL}assets/images/Shot_Cards/LB2_shot_6_party.png`,
        helper: "Include bridesmaids, groomsmen, flower girls, etc.",
        allowAllVips: true,
      });
    }

    return shots;
  }, [you, role1, role2]);

  // prune hidden
  useEffect(() => {
    const visible = new Set(shotList.map((s) => s.key));
    setSelections((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (!visible.has(k)) delete next[k];
      });
      return next;
    });
    setSkippedShots((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (!visible.has(k)) delete next[k];
      });
      return next;
    });
  }, [shotList]);

  // defaults
  useEffect(() => {
    if (!lb2FullName) return;

    const parents = dedup([...role2.mothers, ...role2.fathers]);
    const siblings = dedup([...role2.brothers, ...role2.sisters]);
    const party = dedup([...role2.party, ...role1.party]);

    const defaults: Record<string, string[]> = {
      "whole-family": dedup([...parents, ...siblings]),
      parents,
      siblings,
      mom: role2.mothers,
      dad: role2.fathers,
      party,
    };

    const visible = new Set(shotList.map((s) => s.key));

    setSelections((prev) => {
      const next = { ...prev };
      Object.entries(defaults).forEach(([key, names]) => {
        if (!visible.has(key)) return;
        if (skippedShots[key]) return;
        if (!next[key] || next[key].length === 0) next[key] = names || [];
      });
      return next;
    });
  }, [lb2FullName, role1, role2, skippedShots, shotList]);

  // modal plumbing
  const currentShotDef = shotList.find((s) => s.key === activeShot);
  const modalOptions: VIPEntry[] = currentShotDef?.allowAllVips
    ? allVipForParty
    : vip2;

  const openModal = (key: string) => {
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
  const selectAllModal = () => setModalTemp(modalOptions.map((o) => o.name));
  const clearAllModal = () => setModalTemp([]);
  const saveModal = () => {
    if (!activeShot) return;
    setSelection(activeShot, modalTemp);
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
    console.log(
      "[DBG][PhotoShotList2] TOC click – has goToTOC?",
      typeof goToTOC === "function"
    );
    if (typeof goToTOC === "function") {
      goToTOC();
      return;
    }
    // Fallback: set intent + tell overlay to navigate
    localStorage.setItem("magicStep", "toc");
    window.dispatchEvent(new Event("magic:gotoTOC"));
  };

  return (
    <>
      <div
        ref={cardRef}
        className="pixie-card"
        style={{ paddingTop: "1.25rem", paddingBottom: "1.25rem", position: "relative" }}
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

        {/* top icon */}
        <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          <img
            src={`${import.meta.env.BASE_URL}assets/images/ShotList2.png`}
            alt="Shot List Icon"
            style={{ width: "82%", maxWidth: 150 }}
          />
        </div>

        <h2 style={headerFont}>
          {lb2FirstName
            ? `${lb2FirstName}’s Formal Family Shot List`
            : "Formal Family Shot List"}
        </h2>

        <p
          style={{
            textAlign: "center",
            color: "#444",
            fontSize: "1rem",
            lineHeight: 1.4,
            margin: "0 0 1rem",
            padding: "0 0.5rem",
          }}
        >
          ✨ We’ve sprinkled a bit of magic and pre-filled each shot with VIPs
          from your list. Tap a card to peek inside and add or remove anyone you
          wish. For one-on-one portraits or anything extra special, use the
          Custom Shot box below.
        </p>

        {/* cards */}
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
            const skipped = !!skippedShots[shot.key];

            return (
              <div
                key={shot.key}
                style={{
                  width: "100%",
                  maxWidth: "680px",
                  border: "1px solid #eee",
                  borderRadius: 16,
                  background: "#fff",
                  overflow: "hidden",
                  boxShadow: "0 6px 14px rgba(0,0,0,0.06)",
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
                    alt={shot.label}
                    style={{
                      width: "50%",
                      maxWidth: 400,
                      height: "auto",
                      display: "block",
                      margin: "0 auto",
                      transition: "transform 0.2s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.transform = "scale(1.01)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.transform = "scale(1)")
                    }
                  />
                </div>

                <div style={{ padding: "0.8rem 0.9rem", textAlign: "center" }}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>
                    {shot.label}
                  </div>
                  {shot.helper && (
                    <div
                      style={{
                        color: "#666",
                        fontSize: "0.92rem",
                        marginBottom: 6,
                      }}
                    >
                      {shot.helper}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: "0.95rem",
                      color: "#444",
                      minHeight: 22,
                    }}
                  >
                    {skipped ? (
                      <em>Skipping this shot</em>
                    ) : chosen.length ? (
                      <>
                        <strong>Selected:</strong> {chosen.join(", ")}
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

        {/* custom shot */}
        <div
          style={{
            border: "1px solid #e7e7e7",
            borderRadius: 12,
            padding: "0.9rem",
            margin: "0.6rem 0 0.9rem",
            background: "#fafbff",
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
            Tip: Use this for one-on-one portraits (e.g., {you} + Best Man,{" "}
            {you} + Sister) or any special group.
          </div>
          <CustomShotForm you={you} />
        </div>

        {/* Nav */}
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          {/* Blue next */}
          <button
            onClick={onNext}
            style={{
              backgroundColor: "#2c62ba",
              color: "#fff",
              fontSize: "1.05rem",
              padding: "0.7rem 2rem",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              marginBottom: "0.75rem",
            }}
          >
            Turn the Page →
          </button>

          {/* Pink back */}
          <br />
          <button
            onClick={onBack}
            className="boutique-back-btn"
            style={{ width: 250, padding: "0.75rem 1rem" }}
          >
            ⬅ Previous Page
          </button>

          {/* Purple Back to TOC */}
          <div style={{ marginTop: "0.5rem" }}>
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
                marginTop: "0.5rem",
              }}
            >
              🪄 Back to TOC
            </button>
          </div>
        </div>
      </div>

      {/* Modal Overlay */}
      {activeShot && currentShotDef && (
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
            <div
              style={{
                fontWeight: 800,
                fontSize: "1.15rem",
                marginBottom: 4,
                color: "#2c62ba",
              }}
            >
              {currentShotDef.label}
            </div>
            {currentShotDef.helper && (
              <div style={{ color: "#666", marginBottom: 8 }}>
                {currentShotDef.helper}
              </div>
            )}

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
              {modalOptions.map((vip) => {
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

// ---------- CustomShotForm (unchanged except file-local constants)
const CustomShotForm: React.FC<{ you: string }> = ({ you }) => {
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
    } catch {
      /* ignore */
    }
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
    setCustoms((prev) => [
      ...prev,
      { id, label: t, names: arr },
    ]);
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
        Shot description (e.g., “{you} with Best Man”)
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
        placeholder={`${you}, Jimmy Jones`}
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

      <div
        style={{
          textAlign: "right",
          marginBottom: "0.5rem",
        }}
      >
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

export default PhotoShotList2;