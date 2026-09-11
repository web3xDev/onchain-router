import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** The same mark the nav carries, so the tab matches the header. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        <svg viewBox="0 0 64 64" width="32" height="32"><rect width="64" height="64" rx="16" fill="#d25020"/><path d="M14 32h14c6 0 8-4 12-8s6-8 12-8M28 32c6 0 8 4 12 8s6 8 12 8" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="14" cy="32" r="4" fill="#fff"/></svg>
      </div>
    ),
    size,
  );
}
