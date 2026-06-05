"use client";

import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions, auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { SQUARE_APP_ID, SQUARE_LOCATION_ID } from "@/lib/constants";

interface DebugInfo {
  firebaseConfig: Record<string, string>;
  functionsStatus: string;
  catalogItemCount: number | null;
  catalogError: string | null;
  authUser: string;
  firestoreStatus: string;
  squareAppId: string;
  squareLocationId: string;
  buildTimestamp: string;
}

export function useDebugInfo() {
  const [info, setInfo] = useState<DebugInfo>({
    firebaseConfig: {},
    functionsStatus: "pending",
    catalogItemCount: null,
    catalogError: null,
    authUser: "checking...",
    firestoreStatus: "pending",
    squareAppId: SQUARE_APP_ID,
    squareLocationId: SQUARE_LOCATION_ID,
    buildTimestamp: new Date().toISOString(),
  });

  useEffect(() => {
    // Auth
    const unsub = onAuthStateChanged(auth, (u) => {
      setInfo((prev) => ({
        ...prev,
        authUser: u ? `${u.email} (${u.uid.slice(0, 8)})` : "not logged in",
      }));
    });

    // Functions test
    httpsCallable(functions, "fetchSquareCatalog")({})
      .then((r) => {
        const data = r.data as { items: unknown[] };
        setInfo((prev) => ({
          ...prev,
          functionsStatus: "connected",
          catalogItemCount: data.items?.length ?? 0,
        }));
      })
      .catch((err) => {
        setInfo((prev) => ({
          ...prev,
          functionsStatus: `error: ${err.message}`,
          catalogError: err.message,
        }));
      });

    // Firestore test
    getDoc(doc(db, "config", "site"))
      .then(() => setInfo((prev) => ({ ...prev, firestoreStatus: "connected" })))
      .catch((err) =>
        setInfo((prev) => ({ ...prev, firestoreStatus: `error: ${err.message}` }))
      );

    return unsub;
  }, []);

  return info;
}

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const info = useDebugInfo();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-50 bg-teal text-white text-xs rounded-full w-8 h-8 flex items-center justify-center shadow-md hover:bg-teal-light transition-colors"
        title="Debug Panel"
      >
        D
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none">
      <div className="pointer-events-auto w-96 max-h-screen overflow-y-auto bg-white shadow-elevated border border-warm-sand rounded-2xl m-4 p-4 text-xs font-mono">
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-teal text-sm">Debug Panel</span>
          <button onClick={() => setOpen(false)} className="text-teal/40 hover:text-teal">&times;</button>
        </div>
        {[
          ["Build", info.buildTimestamp],
          ["Auth", info.authUser],
          ["Functions", info.functionsStatus],
          ["Catalog Items", info.catalogItemCount?.toString() ?? "pending"],
          ["Catalog Error", info.catalogError ?? "none"],
          ["Firestore", info.firestoreStatus],
          ["Square App ID", info.squareAppId],
          ["Square Location", info.squareLocationId],
        ].map(([label, value]) => (
          <div key={label as string} className="flex justify-between py-1 border-b border-warm-sand/30">
            <span className="text-teal/50">{label}</span>
            <span className={`text-right max-w-[60%] truncate ${
              String(value).startsWith("error") ? "text-red-500" : "text-teal"
            }`}>{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
