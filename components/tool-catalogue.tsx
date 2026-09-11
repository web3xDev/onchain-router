"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Brand } from "@/components/brand";
import { Author } from "@/components/author";

export type CatalogueEntry = {
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string;
  price: string;
  coverage: string;
  author: string;
  source?: string;
  inputs: string[];
};

export function ToolCatalogue({
  tools,
  categories,
}: {
  tools: CatalogueEntry[];
  categories: string[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();

    return tools.filter((tool) => {
      if (category && tool.category !== category) return false;
      if (!q) return true;

      // Searching the description as well, because people look for a capability
      // ("quorum", "borrow") far more often than they look for a tool's name.
      return [tool.name, tool.slug, tool.summary, tool.description, tool.category]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [tools, query, category]);

  return (
    <>
      <div className="filters">
        <input
          className="search"
          placeholder="Search tools: lending rates, quorum, delegates…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search tools"
        />
        <button
          type="button"
          className="chip"
          aria-pressed={category === null}
          onClick={() => setCategory(null)}
        >
          All
        </button>
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            className="chip"
            aria-pressed={category === name}
            onClick={() => setCategory(category === name ? null : name)}
          >
            {name}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          Nothing matches that yet.{" "}
          <Link href="/submit" className="link">
            Submit the tool
          </Link>{" "}
          you were looking for.
        </div>
      ) : (
        <div className="cards">
          {shown.map((tool) => (
            <Link key={tool.slug} href={`/tools/${tool.slug}`} className="card">
              <div className="card-top">
                <div>
                  <h3>{tool.name}</h3>
                  <div className="card-slug"><Author name={tool.author} /></div>
                </div>
                <span className="price">{tool.price}</span>
              </div>

              <p>{tool.summary}</p>

              <div className="card-foot">
                <span className="tag">{tool.category}</span>
                <span>{tool.coverage}</span>
                {tool.source === "graph" ? (
                  <span className="card-source">
                    <Brand id="graph" height={12} /> The Graph
                  </span>
                ) : (
                  tool.source && <span>{tool.source}</span>
                )}
                <span style={{ marginLeft: "auto" }}>no answer, no charge</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
