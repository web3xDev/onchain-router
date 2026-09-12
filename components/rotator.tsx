"use client";

import { useEffect, useState } from "react";

/**
 * One line, several facts, shown one at a time. Each rolls up out of view as the
 * next rolls in from below, like a counter. The first item is repeated at the end
 * so the wrap back to it rolls the same way instead of rewinding. Reduced-motion
 * users get the first item, still.
 */
export function Rotator({ items, every = 2400 }: { items: string[]; every?: number }) {
  const [index, setIndex] = useState(0);
  const [snap, setSnap] = useState(false);

  useEffect(() => {
    if (items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => i + 1), every);
    return () => clearInterval(timer);
  }, [items.length, every]);

  // Landed on the duplicate: jump to the real first item with the transition off,
  // then turn it back on for the next roll.
  useEffect(() => {
    if (!snap) return;
    const frame = requestAnimationFrame(() => setSnap(false));
    return () => cancelAnimationFrame(frame);
  }, [snap]);

  const onEnd = () => {
    if (index === items.length) {
      setSnap(true);
      setIndex(0);
    }
  };

  const track = [...items, items[0]];

  return (
    <span className="rotator" aria-live="polite">
      <span
        className={`rotator-track${snap ? " is-snap" : ""}`}
        style={{ transform: `translateY(-${index * 100}%)` }}
        onTransitionEnd={onEnd}
      >
        {track.map((item, i) => (
          <span key={i} className="rotator-item" aria-hidden={i !== index % items.length}>
            {item}
          </span>
        ))}
      </span>
    </span>
  );
}
