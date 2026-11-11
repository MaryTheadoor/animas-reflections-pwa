"use client";

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/lib/firebase";
import { ADMIN_EMAIL } from "@/lib/constants";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function getAdminEmails(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, "config", "admin"));
    if (snap.exists()) {
      const data = snap.data() as { emails?: string[] };
      return (data.emails ?? []).map((e) => e.toLowerCase().trim());
    }
  } catch {
    // Silently fail
  }
  return [];
}

// Admin detection: (1) hardcoded env fallback, (2) Firestore config/admin doc managed
// via Admin → Admins tab.
//
// DO NOT reintroduce a domain rule (e.g. "any @animasreflections.com address"). Email/
// password signup is public and unverified, so an attacker can register an address on a
// domain they do not own and inherit admin. Verified live 2026-10-06; see
// docs/STATUS_SWEEP.md §0.
async function isUserAdmin(email: string | null): Promise<boolean> {
  if (!email) return false;
  const lowered = email.toLowerCase().trim();
  if (ADMIN_EMAIL && lowered === ADMIN_EMAIL.toLowerCase().trim()) return true;
  const adminEmails = await getAdminEmails();
  return adminEmails.includes(lowered);
}

// Writes a minimal user profile doc on every auth state change so the Users tab
// in Admin has a record. merge:true preserves existing fields if Firestore rules
// allow the write (rules may block client writes to users/; that's intentionally silent).
async function syncUserDoc(u: User) {
  try {
    const ref = doc(db, "users", u.uid);
    // createdAt is written only on the very first sync so each user keeps a real
    // "joined" date; updatedAt refreshes on every sign-in.
    const existing = await getDoc(ref);
    await setDoc(ref, {
      email: u.email,
      displayName: u.displayName,
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch {
    // Silently fail — Firestore rules may block client write
  }
}

/** Asks the backend to mint this user's `admin` custom claim, if eligible. */
async function syncMyAdminClaim(): Promise<void> {
  await httpsCallable(functions, "syncMyAdminClaim")();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  // Guards the claim sync so the token refresh below cannot re-trigger
  // onAuthStateChanged into an infinite loop. One sync per user per session.
  const claimSyncedFor = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        syncUserDoc(u);
        const admin = await isUserAdmin(u.email);
        setIsAdmin(admin);
        // Cloud Storage rules cannot read Firestore in this project, so they
        // authorize admin uploads with the `admin` custom claim. Mint it, then
        // force a token refresh so admin image uploads work in this session
        // rather than an hour later. Failures are non-fatal: storage.rules
        // also carries a bootstrap email list.
        if (admin && claimSyncedFor.current !== u.uid) {
          claimSyncedFor.current = u.uid;
          try {
            await syncMyAdminClaim();
            await u.getIdToken(true);
          } catch {
            // Non-fatal — see comment above.
          }
        }
      } else {
        claimSyncedFor.current = null;
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (popupErr) {
      throw new Error(
        popupErr instanceof Error ? popupErr.message : "Google sign-in was cancelled"
      );
    }
  };

  // Customer "forgot password". Same account store as the admin console, so the
  // reset email works for shoppers and staff alike.
  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, login, loginWithGoogle, sendPasswordReset, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <div className="flex gap-3">
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce" />
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:130ms]" />
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:260ms]" />
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold font-display mb-4">Access Denied</h1>
          <p className="text-foreground mb-2">You must be logged in as an administrator.</p>
          {user && (
            <p className="text-xs text-foreground/70 mb-4">
              Signed in as: {user.email}. 
              If this should be an admin account, add it in the Admin Users tab.
            </p>
          )}
          {!user && (
            <Link
              href="/admin/login"
              className="inline-block px-6 py-3 bg-gold text-on-gold rounded-2xl font-semibold hover:bg-gold-light transition-colors"
            >
              Admin Login
            </Link>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
