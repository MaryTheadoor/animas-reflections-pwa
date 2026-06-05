export default function PlaceholderImage({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full h-full flex items-center justify-center bg-warm-sand ${className}`}>
      <svg className="w-12 h-12 text-teal/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
