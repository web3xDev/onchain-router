"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Three steps with a line drawn through their numbers.
 *
 * When the section scrolls into view the line draws left to right and a dot rides it;
 * each number lights as the dot reaches it. Plays once, the way the hero does, so it
 * reads as "one request, three stops" rather than as decoration.
 */
export function StepsFlow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPlay(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`flow${play ? " flow-play" : ""}`}>
      <div className="flow-line" aria-hidden="true">
        <span className="flow-dot" />
      </div>
      {children}
    </div>
  );
}
