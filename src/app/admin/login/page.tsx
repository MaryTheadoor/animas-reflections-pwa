"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { SITE } from "@/lib/content";
import { ADMIN_EMAIL } from "@/lib/constants";

function friendlyError(err: unknown): string {
  if (!(err instanceof Error)) return "Login failed. Please try again.";
  const msg = err.message;
  if (msg.includes("auth/invalid-credential") || msg.includes("auth/user-not-found") || msg.includes("auth/wrong-password")) {
    return "Invalid email or password. Please try again.";
  }
  if (msg.includes("auth/too-many-requests")) {
    return "Too many attempts. Please wait and try again.";
  }
  if (msg.includes("auth/invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (msg.includes("auth/popup-closed-by-user")) {
    return "Sign-in was cancelled. Please try again.";
  }
  return msg;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle, isAdmin, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      router.push("/admin");
    }
  }, [isAdmin, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col flex-1 min-h-screen items-center justify-center px-6 bg-cream">
        <div className="flex gap-3">
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce" />
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:130ms]" />
          <div className="w-3 h-3 bg-gold rounded-full animate-bounce [animation-delay:260ms]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen items-center justify-center px-6 bg-cream">
      <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <Image
            src="/logo.png"
            alt={SITE.name}
            width={60}
            height={60}
            className="mx-auto mb-4 rounded-xl"
          />
          <h1 className="text-xl font-bold font-display">Admin Login</h1>
          <p className="text-sm text-foreground mt-1">{SITE.name} CMS</p>
        </div>

        {!ADMIN_EMAIL && (
          <div className="bg-amber-50 text-amber-700 rounded-xl p-3 text-xs mb-4 text-center">
            Admin email not configured. Set <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_ADMIN_EMAIL</code> in <code className="bg-amber-100 px-1 rounded">.env.local</code>.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-xl border border-primary/20 bg-white focus:border-gold focus:ring-1 focus:ring-gold outline-none"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-xl border border-primary/20 bg-white focus:border-gold focus:ring-1 focus:ring-gold outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-gold text-white font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 btn-tactile btn-gold-tactile"
          >
            {loading ? "Signing in..." : "Sign In with Email"}
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-warm-sand" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-foreground/80">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-3 rounded-2xl bg-primary text-white font-semibold hover:bg-primary-light transition-colors btn-tactile btn-primary-tactile flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign In with Google
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-foreground hover:text-primary transition-colors">
            Back to site
          </Link>
        </div>
      </div>
    </div>
  );
}
