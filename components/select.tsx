"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SelectOption = { value: string; label: string };

/**
 * A select whose open list is drawn by us rather than the browser. The closed
 * state of a native select can be styled, but the popup cannot, and on some
 * platforms it opens as a white system menu in the middle of a dark form.
 *
 * Keyboard follows the native control: arrows move, Enter and Space choose,
 * Escape closes, typing a letter jumps to the first match.
 */
export function Select({
  id,
  value,
  options,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const [active, setActive] = useState(0);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  function show() {
    // Open upward when the list would run past the bottom of the viewport.
    const rect = rootRef.current?.getBoundingClientRect();
    const estimated = Math.min(options.length, 8) * 38 + 12;
    setAbove(Boolean(rect && rect.bottom + estimated > window.innerHeight - 16));
    setActive(Math.max(selectedIndex, 0));
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const item = listRef.current?.children[active] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) return show();
        setActive((index) => Math.min(index + 1, last));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) return show();
        setActive((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActive(last);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) choose(active);
        else show();
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
      default: {
        if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return;
        const letter = event.key.toLowerCase();
        const from = open ? active + 1 : selectedIndex + 1;
        const order = [...options.keys()].map((i) => (from + i) % options.length);
        const hit = order.find((i) => options[i].label.toLowerCase().startsWith(letter));
        if (hit === undefined) return;
        if (open) setActive(hit);
        else onChange(options[hit].value);
      }
    }
  }

  return (
    <div ref={rootRef} className={`select${open ? " is-open" : ""}`}>
      <button
        type="button"
        id={id}
        className="select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className={`select-value${selected ? "" : " is-placeholder"}`}>
          {selected?.label ?? placeholder ?? ""}
        </span>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className={`select-menu${above ? " is-above" : ""}`}
          aria-activedescendant={`${listId}-${active}`}
        >
          {options.map((option, index) => (
            <li
              key={option.value || "__blank"}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              className={`select-option${index === active ? " is-active" : ""}${
                index === selectedIndex ? " is-selected" : ""
              }${option.value === "" ? " is-placeholder" : ""}`}
              onPointerMove={() => setActive(index)}
              onClick={() => choose(index)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
