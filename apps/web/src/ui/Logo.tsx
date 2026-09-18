/**
 * Clapeyron mark: a benzene hexagon crossed by a rising phase-boundary curve (the Clapeyron
 * equation describes exactly that line) ending at the critical point. Inline SVG so it renders
 * crisply at any size and follows the app's colours.
 */
export function Logo({ size = 22, title = "Clapeyron" }: { size?: number; title?: string }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 512 512" role="img" aria-label={title}>
      <defs>
        <linearGradient id="clp-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2aa7b5" />
          <stop offset="1" stopColor="#0d4a52" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#clp-bg)" />
      <polygon points="256,118 372,185 372,319 256,386 140,319 140,185" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="26" strokeLinejoin="round" />
      <path d="M92 400 C 200 392, 268 340, 316 250 S 390 132, 420 106" fill="none" stroke="#ffffff" strokeWidth="34" strokeLinecap="round" />
      <circle cx="420" cy="106" r="34" fill="#ffffff" />
      <circle cx="420" cy="106" r="16" fill="#0d4a52" />
    </svg>
  );
}
