"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ADMIN_EMAIL } from "@/lib/constants";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncUserDoc(u: User) {
  try {
    await setDoc(doc(db, "users", u.uid), {
      email: u.email,
      displayName: u.displayName,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch {
    // Silently fail — Firestore rules may block client write
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) syncUserDoc(u);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const logout = async () => {
    await signOut(auth);
  };

  const isAdmin = !!user && (user.email === ADMIN_EMAIL || !!user.email?.endsWith("@animasreflections.com"));

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, login, loginWithGoogle, logout }}>
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
          <p className="text-teal/60 mb-6">You must be logged in as an administrator.</p>
          <a
            href="/admin/login"
            className="px-6 py-3 bg-gold text-white rounded-2xl font-semibold hover:bg-gold-light transition-colors"
          >
            Admin Login
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
