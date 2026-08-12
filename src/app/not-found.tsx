import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col flex-1 min-h-screen items-center justify-center px-6 text-center bg-cream">
      <h1 className="text-6xl font-bold font-display text-gold mb-4">404</h1>
      <h2 className="text-2xl font-bold font-display mb-2">Page Not Found</h2>
      <p className="text-foreground mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-8 py-3 bg-gold text-white rounded-2xl font-semibold hover:bg-gold-light transition-colors btn-tactile btn-gold-tactile"
      >
        Back to Home
      </Link>
    </div>
  );
}
