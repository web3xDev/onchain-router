import type { ReactNode } from "react";

/**
 * A small highlighter for the handful of snippets the site shows.
 *
 * Covers what those snippets contain, TypeScript and shell, and nothing more. A
 * full grammar would be a dependency for four code blocks.
 */

type Lang = "ts" | "sh" | "text";

const KEYWORDS = new Set([
  "const", "let", "var", "await", "async", "new", "import", "from", "export", "return",
  "function", "if", "else", "true", "false", "null", "undefined",
]);

// Order matters: comments and strings first so their contents are not re-tokenised.
const TOKEN =
  /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|(\b[A-Za-z_$][\w$]*\b)|([{}()\[\],;.:=<>+\-*/!?&|]+)/g;

function highlightTs(source: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of source.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) out.push(source.slice(last, index));

    const [text, comment, string, number, call, word, punct] = match;
    let cls = "";
    if (comment) cls = "c-comment";
    else if (string) cls = "c-string";
    else if (number) cls = "c-number";
    else if (call) cls = KEYWORDS.has(call) ? "c-keyword" : "c-call";
    else if (word) cls = KEYWORDS.has(word) ? "c-keyword" : /^[A-Z]/.test(word) ? "c-type" : "";
    else if (punct) cls = "c-punct";

    out.push(cls ? <span key={key++} className={cls}>{text}</span> : text);
    last = index + text.length;
  }

  if (last < source.length) out.push(source.slice(last));
  return out;
}

const SH_TOKEN = /(#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(^|\n)(\s*)(\S+)|(\s--?[a-zA-Z-]+)|(\\\n)/g;

function highlightSh(source: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let continued = false;

  for (const match of source.matchAll(SH_TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) out.push(source.slice(last, index));

    const [text, comment, string, lineStart, indent, command, flag, cont] = match;
    if (comment) out.push(<span key={key++} className="c-comment">{text}</span>);
    else if (string) out.push(<span key={key++} className="c-string">{text}</span>);
    else if (command !== undefined) {
      out.push(lineStart + indent);
      // The first word of a line is the command, unless the previous line ended in "\".
      out.push(
        continued ? command : <span key={key++} className="c-call">{command}</span>,
      );
      continued = false;
    } else if (flag) out.push(<span key={key++} className="c-flag">{text}</span>);
    else if (cont) {
      out.push(<span key={key++} className="c-punct">{text}</span>);
      continued = true;
    }
    last = index + text.length;
  }

  if (last < source.length) out.push(source.slice(last));
  return out;
}

export function Code({ lang = "text", children }: { lang?: Lang; children: string }) {
  const body = lang === "ts" ? highlightTs(children) : lang === "sh" ? highlightSh(children) : children;
  return <pre className="code">{body}</pre>;
}
