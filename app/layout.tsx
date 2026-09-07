import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Onchain Router",
  description: "OpenRouter for onchain tools. AI agents discover, call and pay per use.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#0b0b0c",
          color: "#e8e8ea",
        }}
      >
        {children}
      </body>
    </html>
  );
}
