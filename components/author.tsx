import { Logo } from "@/components/logo";

/** "by <author>", with the router's own mark when the router is the author. */
export function Author({ name, size = 12 }: { name: string; size?: number }) {
  return (
    <span className="author">
      by{" "}
      {name === "OnchainRouter" && <Logo size={size} />}
      {name}
    </span>
  );
}
