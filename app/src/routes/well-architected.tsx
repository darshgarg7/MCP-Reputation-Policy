import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChevronRight, Award } from "lucide-react";
import { AppHeader } from "@/components/rpl/app-header";
import { AppFooter } from "@/components/rpl/app-footer";
import { PillarCard } from "@/components/rpl/pillar-card";
import { PILLARS, overallScore } from "@/lib/well-architected";

export const Route = createFileRoute("/well-architected")({
  component: WellArchitectedPage,
  head: () => ({
    meta: [
      { title: "Well-Architected · RPL on AWS" },
      {
        name: "description",
        content:
          "How the Reputation Policy Layer maps to the six pillars of the AWS Well-Architected Framework — operational excellence, security, reliability, performance, cost, and sustainability.",
      },
      { property: "og:title", content: "Well-Architected · RPL on AWS" },
      {
        property: "og:description",
        content:
          "Pillar-by-pillar evidence that the Reputation Policy Layer is production-ready on AWS.",
      },
    ],
  }),
});

function WellArchitectedPage() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const overall = overallScore();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader />

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 lg:py-8 space-y-5">
        <div>
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <Link to="/rpl" className="hover:text-foreground">RPL</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground/80">Well-Architected</span>
          </div>
          <div className="mt-1 flex items-end justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Well-Architected Review · RPL
              </h1>
              <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
                Evidence that the Reputation Policy Layer adheres to all six pillars of the AWS
                Well-Architected Framework. Each card lists concrete features in this console and
                deep-links back to the relevant view.
              </p>
            </div>
            <div className="rounded-2xl border border-success/40 bg-success/5 px-4 py-3 flex items-center gap-3">
              <Award className="h-5 w-5 text-success" />
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  overall score
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground/95">
                  {overall.toFixed(2)}
                  <span className="text-xs font-normal text-muted-foreground">/5</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PILLARS.map((p) => (
            <PillarCard key={p.id} pillar={p} />
          ))}
        </div>

        <section className="glass rounded-2xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase mb-3">
            How to read this score
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-4xl">
            Scores are self-assessed against the AWS Well-Architected Framework Lens for
            Generative AI Workloads (2025). Each pillar's score reflects how many design questions
            in that pillar this implementation answers in the affirmative. Evidence rows are
            traceable back to features inspectable in this console — they are not aspirational.
          </p>
        </section>
      </div>

      <AppFooter />
    </main>
  );
}
