import React, { useEffect, useState, useCallback, useRef } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

interface DocumentsScreenProps {
  onClose: () => void;
  onViewed?: () => void | Promise<void>;
}

interface DocumentItem {
  title?: string;
  url?: string;
  uploadedAt?: any; // ISO string OR Firestore Timestamp OR {seconds,nanoseconds}
}

const DocumentsScreen: React.FC<DocumentsScreenProps> = ({ onClose, onViewed }) => {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ per-doc clicked memory (flips immediately + persists)
  const [openedUrls, setOpenedUrls] = useState<Set<string>>(() => new Set());
  const openedKeyRef = useRef<string>("wd_docs_opened_urls_guest");
  const openedLoadedRef = useRef(false);

  // ✅ baseline loaded flag to prevent NEW/VIEWED weirdness
  const [baselineReady, setBaselineReady] = useState(false);
  const baselineLastViewedMsRef = useRef<number | null>(null);

  // ✅ prevent double-writing docsLastViewedAt on re-renders
  const hasMarkedViewedRef = useRef(false);

  const prettyTitle = (d: DocumentItem, idx: number) => {
    if (d.title && d.title.trim()) return d.title;
    const name = (d.url || "").split("/").pop() || "";
    if (/AddOnReceipt/i.test(name)) return "Floral Add-On Receipt";
    if (/Agreement/i.test(name)) return "Floral Agreement";
    return `Document ${idx + 1}`;
  };

  // ✅ supports:
  // - Firestore Timestamp (has toDate)
  // - plain object Timestamp { seconds, nanoseconds }
  // - ISO string
  // - Date
  const normalizeToMs = (v: any): number => {
    if (!v) return 0;

    if (v instanceof Date) return v.getTime();

    if (typeof v?.toDate === "function") {
      const d = v.toDate();
      return d instanceof Date ? d.getTime() : 0;
    }

    if (typeof v === "object" && typeof v.seconds === "number") {
      const msFromSeconds = v.seconds * 1000;
      const msFromNanos =
        typeof v.nanoseconds === "number" ? Math.floor(v.nanoseconds / 1e6) : 0;
      return msFromSeconds + msFromNanos;
    }

    const ms = Date.parse(String(v));
    return Number.isFinite(ms) ? ms : 0;
  };

  const persistOpenedUrls = (nextSet: Set<string>) => {
    try {
      localStorage.setItem(openedKeyRef.current, JSON.stringify(Array.from(nextSet)));
    } catch {}
  };

  const loadOpenedUrlsOnce = (uid: string) => {
    if (openedLoadedRef.current) return;

    openedKeyRef.current = `wd_docs_opened_urls_${uid}`;
    openedLoadedRef.current = true;

    try {
      const raw = localStorage.getItem(openedKeyRef.current);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) setOpenedUrls(new Set(arr.filter(Boolean)));
      else setOpenedUrls(new Set());
    } catch {
      setOpenedUrls(new Set());
    }
  };

  const fetchDocuments = useCallback(async () => {
    const user = getAuth().currentUser;
    if (!user) return;

    // ✅ per-user key + load clicked state ONCE (do NOT re-load every fetch)
    loadOpenedUrlsOnce(user.uid);

    try {
      setLoading(true);
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data() || {};

      // ✅ freeze baseline ONCE per open
      if (baselineLastViewedMsRef.current === null) {
        const lvRaw = (data as any).docsLastViewedAt;
        const lvMs = normalizeToMs(lvRaw) || null;
        baselineLastViewedMsRef.current = lvMs;
        setBaselineReady(true);
      }

      const stored: DocumentItem[] = Array.isArray((data as any).documents)
        ? (data as any).documents
        : [];

      // de-dupe by url and sort newest first
      const unique = Object.values(
        stored.reduce<Record<string, DocumentItem>>((acc, item) => {
          const key = (item.url || "") as string;
          if (!key) return acc;
          if (!acc[key]) acc[key] = item;
          return acc;
        }, {})
      ).sort((a, b) => normalizeToMs(b.uploadedAt) - normalizeToMs(a.uploadedAt));

      setDocs(unique);
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ mark Docs as "viewed" once when screen opens (clears alerts for FUTURE opens)
  // ✅ mark Docs as "viewed" ONLY when they close (or after they actually interact)
const markDocsViewed = useCallback(async () => {
  const user = getAuth().currentUser;
  if (!user) return;
  if (hasMarkedViewedRef.current) return;

  hasMarkedViewedRef.current = true;

  try {
    await updateDoc(doc(db, "users", user.uid), {
      docsLastViewedAt: serverTimestamp(),
    });

    if (onViewed) await onViewed(); // (Dashboard can clear badge here)
  } catch (e) {
    console.warn("⚠️ Could not update docsLastViewedAt:", e);
  }
}, [onViewed]);

// ✅ close wrapper
const handleClose = useCallback(async () => {
  await markDocsViewed();
  onClose();
}, [markDocsViewed, onClose]);

useEffect(() => {
  fetchDocuments();

  const handler = () => fetchDocuments();
  window.addEventListener("purchaseMade", handler);
  window.addEventListener("documentsUpdated", handler);

  return () => {
    window.removeEventListener("purchaseMade", handler);
    window.removeEventListener("documentsUpdated", handler);
  };
}, [fetchDocuments]);

  const isDocNew = (docItem: DocumentItem) => {
    const url = docItem.url || "";
    if (url && openedUrls.has(url)) return false; // ✅ clicked before → viewed

    const uploadedMs = normalizeToMs(docItem.uploadedAt);
    if (!uploadedMs) return false;

    const baselineMs = baselineLastViewedMsRef.current;

    // never opened docs before → everything new until clicked
    if (!baselineMs) return true;

    return uploadedMs > baselineMs;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "24px",
          padding: "2.5rem 2rem",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "90vh",
          boxShadow: "0 0 20px rgba(0,0,0,0.3)",
          position: "relative",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <button
  onClick={handleClose}
  style={{
    position: "absolute",
    top: "1rem",
    right: "1rem",
    fontSize: "1.5rem",
    background: "none",
    border: "none",
    cursor: "pointer",
  }}
>
  ✖
</button>

        <img
          src={`${import.meta.env.BASE_URL}assets/images/gold_docs.png`}
          alt="Envelope"
          style={{ width: "150px", margin: "0 auto 0.5rem", display: "block" }}
        />

        <h2
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "2.2rem",
            color: "#2c62ba",
            marginBottom: "1.2rem",
          }}
        >
          Your Docs
        </h2>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            paddingRight: "0.25rem",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <style>{`div::-webkit-scrollbar { display: none; }`}</style>

          {loading || !baselineReady ? (
            <p style={{ fontSize: "1rem" }}>Fetching your magical paperwork…</p>
          ) : docs.length === 0 ? (
            <p style={{ fontSize: "1rem" }}>
              This is where you'll find all your receipts and documents!
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                alignItems: "center",
                paddingBottom: "0.5rem",
              }}
            >
              {docs.map((docItem, index) => {
                const isNew = isDocNew(docItem);

                const bg = isNew ? "#2c62ff" : "#2c62ba";
                const glow = isNew ? "0 0 14px rgba(44, 98, 255, 0.55)" : "none";

                return docItem.url ? (
                  <a
                    key={(docItem.url || "") + index}
                    href={docItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      const url = docItem.url || "";
                      if (!url) return;

                      setOpenedUrls((prev) => {
                        const next = new Set(prev);
                        next.add(url);
                        persistOpenedUrls(next);
                        return next;
                      });
                    }}
                    style={{
                      backgroundColor: bg,
                      boxShadow: glow,
                      color: "white",
                      padding: "0.6rem 1.2rem",
                      borderRadius: "10px",
                      textDecoration: "none",
                      fontWeight: "bold",
                      fontSize: "0.95rem",
                      width: "100%",
                      maxWidth: "260px",
                      textAlign: "center",
                      transition:
                        "background-color 0.2s, box-shadow 0.2s, transform 0.08s",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.01)";
                      e.currentTarget.style.backgroundColor = isNew ? "#2457ff" : "#244ea0";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.backgroundColor = bg;
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <span>{prettyTitle(docItem, index)}</span>
                      {isNew && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            background: "rgba(255,255,255,0.18)",
                            padding: "3px 8px",
                            borderRadius: 999,
                            letterSpacing: 0.4,
                          }}
                        >
                          NEW
                        </span>
                      )}
                    </div>

                    {!!normalizeToMs(docItem.uploadedAt) && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 400,
                          opacity: 0.9,
                          marginTop: 4,
                        }}
                      >
                        {new Date(normalizeToMs(docItem.uploadedAt)).toLocaleDateString()}
                      </div>
                    )}
                  </a>
                ) : (
                  <div
                    key={`generating-${index}`}
                    style={{
                      backgroundColor: "#ccc",
                      color: "#444",
                      padding: "0.6rem 1.2rem",
                      borderRadius: "10px",
                      fontWeight: "bold",
                      fontSize: "0.95rem",
                      width: "100%",
                      maxWidth: "260px",
                      textAlign: "center",
                      fontStyle: "italic",
                    }}
                  >
                    {prettyTitle(docItem, index)} (Generating…)
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentsScreen;