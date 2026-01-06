import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { AppHeader } from "@/components/rpl/app-header";
import { AppFooter } from "@/components/rpl/app-footer";
import { SCENARIOS } from "@/lib/scenarios";
import { Play, Sparkles } from "lucide-react";

export const Route = createFileRoute("/scenarios")({
  component: ScenariosPage,
  head: () => ({
    meta: [
      { title: "Scenarios · RPL Live Demos" },
      {
        name: "description",
        content:
          "Guided 30–60 second scenarios that exercise the Reputation Policy Layer against poisoning, goal shifts, and noisy-neighbor failures.",
      },
      { property: "og:title", content: "Scenarios · RPL Live Demos" },
      {
        property: "og:description",
        content:
          "Run a scripted attack or policy-shift scenario through the live RPL backend and watch the dashboard react in real time.",
      },
    ],
  }),
});

function ScenariosPage() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  function run(id: string) {
    toast.success("Launching scenario", { description: "Returning to the RPL dashboard…" });
    navigate({ to: "/rpl", search: { run: id } as never });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" />
      <AppHeader />

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 lg:py-8 space-y-5">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-success">
            <Sparkles className="h-3 w-3" />
            <span>Live · backed by the real Python RPL service</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Guided Scenarios</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Each scenario sequences a real series of <code className="font-mono text-foreground/80">/execute</code>{" "}
            calls against the backend to exercise a specific failure mode or policy behavior. Watch
            the RPL dashboard react live — reputation collapses, circuit breakers trip, goals shift.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((s) => (
            <article
              key={s.id}
              onMouseEnter={() => setHovered(s.id)}
              onMouseLeave={() => setHovered(null)}
              className="glass rounded-2xl p-5 flex flex-col"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                  {s.durationLabel}
                </span>
                <code className="font-mono text-[10px] text-muted-foreground">{s.id}</code>
              </div>
              <h2 className="text-base font-semibold text-foreground/95 leading-snug">{s.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">{s.blurb}</p>
              <div className="mt-4 pt-3 border-t border-border/60 space-y-1.5">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Steps
                </div>
                <ul className="space-y-0.5">
                  {s.steps.slice(0, 4).map((st, i) => (
                    <li key={i} className="font-mono text-[10px] text-foreground/70 truncate">
                      <span className="text-muted-foreground">▸</span> {st.caption}
                    </li>
                  ))}
                  {s.steps.length > 4 && (
                    <li className="font-mono text-[10px] text-muted-foreground">
                      …+{s.steps.length - 4} more
                    </li>
                  )}
                </ul>
              </div>
              <button
                onClick={() => run(s.id)}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Play className="h-3.5 w-3.5" />
                Run scenario
              </button>
            </article>
          ))}
        </div>
      </div>

      <AppFooter />
    </main>
  );
}
