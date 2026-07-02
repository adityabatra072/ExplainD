import { getSettings } from "@/lib/store/settings";

export type ResearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export interface ResearchAdapter {
  name: string;
  isConfigured(): boolean;
  search(q: string, maxResults?: number): Promise<ResearchResult[]>;
}

/* ── Exa ─────────────────────────────────────────────────────────── */
class ExaAdapter implements ResearchAdapter {
  name = "exa";
  constructor(private apiKey?: string) {}
  isConfigured() {
    return Boolean(this.apiKey);
  }
  async search(q: string, maxResults = 5): Promise<ResearchResult[]> {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: q,
        numResults: maxResults,
        contents: { text: { maxCharacters: 600 } },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`exa ${res.status}`);
    const data = (await res.json()) as {
      results: { title: string; url: string; text?: string }[];
    };
    return data.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.text ?? "",
    }));
  }
}

/* ── Perplexity (sonar; returns a synthesized answer w/ citations) ─ */
class PerplexityAdapter implements ResearchAdapter {
  name = "perplexity";
  constructor(private apiKey?: string) {}
  isConfigured() {
    return Boolean(this.apiKey);
  }
  async search(q: string): Promise<ResearchResult[]> {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "user",
            content: `Give concise, factual notes (5 bullets max) on: ${q}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`perplexity ${res.status}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      citations?: string[];
    };
    const content = data.choices[0]?.message.content ?? "";
    return [
      {
        title: "Perplexity research notes",
        url: data.citations?.[0] ?? "https://perplexity.ai",
        snippet: content.slice(0, 1600),
      },
      ...(data.citations ?? []).slice(0, 4).map((url) => ({
        title: "citation",
        url,
        snippet: "",
      })),
    ];
  }
}

/* ── Wikipedia (free, reliable — preferred no-key path) ───────────── */
class WikipediaAdapter implements ResearchAdapter {
  name = "wikipedia";
  isConfigured() {
    return true;
  }
  async search(q: string, maxResults = 3): Promise<ResearchResult[]> {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(q)}&limit=${maxResults}`,
      { signal: AbortSignal.timeout(8_000), headers: UA }
    );
    if (!searchRes.ok) throw new Error(`wikipedia search ${searchRes.status}`);
    const search = (await searchRes.json()) as {
      pages: { key: string; title: string; excerpt: string }[];
    };
    const results: ResearchResult[] = [];
    for (const page of search.pages.slice(0, maxResults)) {
      try {
        const sumRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.key)}`,
          { signal: AbortSignal.timeout(8_000), headers: UA }
        );
        if (!sumRes.ok) continue;
        const sum = (await sumRes.json()) as { extract?: string };
        results.push({
          title: page.title,
          url: `https://en.wikipedia.org/wiki/${page.key}`,
          snippet: (sum.extract ?? "").slice(0, 800),
        });
      } catch {
        // skip page on timeout
      }
    }
    return results;
  }
}

/* ── DuckDuckGo HTML (free fallback; fragile scrape) ──────────────── */
class DuckDuckGoAdapter implements ResearchAdapter {
  name = "duckduckgo";
  isConfigured() {
    return true;
  }
  async search(q: string, maxResults = 5): Promise<ResearchResult[]> {
    const { load } = await import("cheerio");
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(8_000), headers: UA }
    );
    if (!res.ok) throw new Error(`ddg ${res.status}`);
    const $ = load(await res.text());
    const out: ResearchResult[] = [];
    $(".result").each((_, el) => {
      if (out.length >= maxResults) return;
      const a = $(el).find(".result__a");
      const title = a.text().trim();
      let url = a.attr("href") ?? "";
      // DDG wraps links: //duckduckgo.com/l/?uddg=<encoded>
      const m = url.match(/uddg=([^&]+)/);
      if (m) url = decodeURIComponent(m[1]);
      const snippet = $(el).find(".result__snippet").text().trim();
      if (title && url) out.push({ title, url, snippet });
    });
    return out;
  }
}

const UA = {
  "User-Agent": "ExplainD/2.0 (education engine; local app)",
};

/* ── Dispatcher ────────────────────────────────────────────────────── */

export function getResearchAdapters(): ResearchAdapter[] {
  const s = getSettings();
  const adapters: ResearchAdapter[] = [];
  const exa = new ExaAdapter(s.research.exaApiKey);
  const pplx = new PerplexityAdapter(s.research.perplexityApiKey);
  if (exa.isConfigured()) adapters.push(exa);
  if (pplx.isConfigured()) adapters.push(pplx);
  adapters.push(new WikipediaAdapter(), new DuckDuckGoAdapter());
  return adapters;
}

export async function research(query: string): Promise<string | null> {
  for (const adapter of getResearchAdapters()) {
    try {
      const results = await adapter.search(query);
      if (results.length === 0) continue;
      const notes = results
        .map((r) => `- ${r.title} (${r.url}): ${r.snippet}`)
        .join("\n");
      return notes.slice(0, 6000); // ~2k tokens cap
    } catch {
      // try next adapter
    }
  }
  return null;
}

/**
 * Heuristic: research topical/current subjects; skip timeless math/CS.
 * "always"/"off" settings override.
 */
export function shouldResearch(prompt: string): boolean {
  const s = getSettings();
  if (s.research.enabled === "always") return true;
  if (s.research.enabled === "off") return false;
  const topical =
    /\b(20(2[3-9]|3\d))\b|latest|current|recent|today|this (year|month|week)|news|version|release/i;
  return topical.test(prompt);
}

export async function maybeResearch(prompt: string): Promise<string | null> {
  if (!shouldResearch(prompt)) return null;
  return research(prompt);
}
