import React, { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

interface DocumentsScreenProps {
  onClose: () => void;
}

interface DocumentItem {
  title?: string;
  url?: string;
  uploadedAt?: string; // ISO
}

const DocumentsScreen: React.FC<DocumentsScreenProps> = ({ onClose }) => {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const prettyTitle = (d: DocumentItem, idx: number) => {
    if (d.title && d.title.trim()) return d.title;
    // fallback from filename
    const name = (d.url || "").split("/").pop() || "";
    if (/AddOnReceipt/i.test(name)) return "Floral Add‑On Receipt";
    if (/Agreement/i.test(name)) return "Floral Agreement";
    return `Document ${idx + 1}`;
  };

  const fetchDocuments = useCallback(async () => {
    const user = getAuth().currentUser;
    if (!user) return;

    try {
      setLoading(true);
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data() || {};
      const stored: DocumentItem[] = Array.isArray(data.documents) ? data.documents : [];

      // de‑dupe by url and sort newest first
      const unique = Object.values(
        stored.reduce<Record<string, DocumentItem>>((acc, item) => {
          const key = (item.url || "") as string;
          if (!acc[key]) acc[key] = item;
          return acc;
        }, {})
      ).sort((a, b) => {
        const ta = a.uploadedAt ? Date.parse(a.uploadedAt) : 0;
        const tb = b.uploadedAt ? Date.parse(b.uploadedAt) : 0;
        return tb - ta;
      });

      setDocs(unique);
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    // refresh when a purchase completes (PDF added)
    const handler = () => fetchDocuments();
    window.addEventListener("purchaseMade", handler);
    return () => window.removeEventListener("purchaseMade", handler);
  }, [fetchDocuments]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "auto",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "24px",
          padding: "2.5rem",
          maxWidth: "600px",
          width: "90%",
          boxShadow: "0 0 20px rgba(0,0,0,0.3)",
          position: "relative",
          textAlign: "center",
        }}
      >
        <button
          onClick={onClose}
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
          style={{ width: "175px", marginBottom: "0.2rem", marginTop: "-1rem" }}
        />

        <h2
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "2.2rem",
            color: "#2c62ba",
            marginBottom: "2rem",
          }}
        >
          Your Docs
        </h2>

        {loading ? (
          <p style={{ fontSize: "1rem" }}>Fetching your magical paperwork…</p>
        ) : docs.length === 0 ? (
          <p style={{ fontSize: "1rem" }}>
            This is where you'll find all your receipts and other important documents for your big day!
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center" }}>
            {docs.map((docItem, index) =>
              docItem.url ? (
                <a
                  key={docItem.url + index}
                  href={docItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: "#2c62ba",
                    color: "white",
                    padding: "0.75rem 1.5rem",
                    borderRadius: "12px",
                    textDecoration: "none",
                    fontWeight: "bold",
                    fontSize: "1rem",
                    width: "100%",
                    maxWidth: "300px",
                    textAlign: "center",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#244ea0")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2c62ba")}
                >
                  {prettyTitle(docItem, index)}
                  {docItem.uploadedAt && (
                    <div style={{ fontSize: "0.8rem", fontWeight: 400, opacity: 0.85, marginTop: 4 }}>
                      {new Date(docItem.uploadedAt).toLocaleDateString()}
                    </div>
                  )}
                </a>
              ) : (
                <div
                  key={`generating-${index}`}
                  style={{
                    backgroundColor: "#ccc",
                    color: "#444",
                    padding: "0.75rem 1.5rem",
                    borderRadius: "12px",
                    fontWeight: "bold",
                    fontSize: "1rem",
                    width: "100%",
                    maxWidth: "300px",
                    textAlign: "center",
                    fontStyle: "italic",
                  }}
                >
                  {prettyTitle(docItem, index)} (Generating…)
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsScreen;