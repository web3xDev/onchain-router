/** The mark: one route in, two out. Drawn inline so it takes any size and no request. */
export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ display: "block" }}>
      <rect width="64" height="64" rx="16" fill="var(--accent)" />
      <path
        d="M14 32h14c6 0 8-4 12-8s6-8 12-8M28 32c6 0 8 4 12 8s6 8 12 8"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="32" r="4" fill="#fff" />
    </svg>
  );
}
