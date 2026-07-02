"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SpecimenBackdrop } from "@/components/SpecimenBackdrop";

type RecentLesson = {
  id: string;
  title: string;
  prompt: string;
  status: string;
};

export default function LandingPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<RecentLesson[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch("/api/lesson")
      .then((r) => r.json())
      .then((d) => setRecent(d.lessons?.slice(0, 5) ?? []))
      .catch(() => {});
  }, []);

  const begin = async () => {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const { id } = await res.json();
      router.push(`/lesson/${id}`);
    } catch {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center px-6">
      <SpecimenBackdrop />

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-10">
        <header className="text-center select-none">
          <h1 className="font-serif text-6xl font-medium tracking-tight">
            Explain<span className="text-accent">D</span>
          </h1>
          <p className="mt-3 text-ink-dim font-serif text-xl italic">
            Anything, explained in motion.
          </p>
        </header>

        <div className="w-full border border-hairline-strong bg-bg/80 backdrop-blur-sm focus-within:border-accent/50 transition-colors">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                begin();
              }
            }}
            rows={4}
            placeholder={
              "Paste a concept, lecture notes, or just ask —\n“teach me Fourier transforms like I only know algebra”"
            }
            className="w-full resize-none bg-transparent px-5 py-4 font-serif text-lg placeholder:text-ink-faint focus:outline-none"
          />
          <div className="flex items-center justify-between border-t border-hairline px-5 py-2.5">
            <span className="text-xs text-ink-faint font-mono">
              enter to begin · shift+enter for newline
            </span>
            <button
              onClick={begin}
              disabled={!prompt.trim() || busy}
              className="text-sm tracking-wide px-4 py-1.5 border border-hairline-strong text-ink-dim hover:text-ink hover:border-accent/60 disabled:opacity-40 disabled:hover:border-hairline-strong transition-colors"
            >
              {busy ? "starting…" : "Teach me →"}
            </button>
          </div>
        </div>

        {recent.length > 0 && (
          <nav className="w-full">
            <h2 className="text-xs uppercase tracking-[0.2em] text-ink-faint mb-3">
              Continue
            </h2>
            <ul className="divide-y divide-hairline border-y border-hairline">
              {recent.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/lesson/${l.id}`}
                    className="block px-1 py-2.5 text-ink-dim hover:text-ink font-serif transition-colors truncate"
                  >
                    {l.title || l.prompt}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      <footer className="absolute bottom-5 z-10 flex gap-6 text-xs text-ink-faint">
        <Link href="/settings" className="hover:text-ink-dim transition-colors">
          settings
        </Link>
        <a
          href="https://github.com/adityabatra072/ExplainD"
          className="hover:text-ink-dim transition-colors"
        >
          github
        </a>
      </footer>
    </main>
  );
}
