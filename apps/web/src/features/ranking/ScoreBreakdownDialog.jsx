import { successProbabilityFor } from "@vera/shared";
import { AlertCircle, BarChart3, FileText, Users } from "lucide-react";

import { ScoreBar } from "@/components/shared/ScoreBar";
import { ScoreChip } from "@/components/shared/ScoreChip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvaluation } from "@/features/evaluations/api";
import { useReviewApplication } from "@/features/screening/api";

const pct = (value) => `${Number(value).toFixed(2)}%`;

const TONES = {
  resume: "bg-resume-soft text-resume",
  interview: "bg-interview-soft text-interview",
  final: "bg-info-soft text-info",
};

/** One score card (design 11): a decorative icon disc, the section heading, then the stored numbers. */
function Block({ title, icon: Icon, tone, children }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface-blue/60 p-4 ring-1 ring-border/80">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-full ${TONES[tone]}`}>
          <Icon className="size-5" />
        </span>
        <h3 className="text-body-lg font-bold text-heading">{title}</h3>
      </div>
      {children}
    </section>
  );
}

/** A stored score: the chip and its bar (the bar only repeats the shown value). */
function Score({ kind, value }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <ScoreChip kind={kind} value={value} />
      <ScoreBar value={value} className="w-40" />
    </div>
  );
}

/** Skill names as pills; the list's own "none" when empty. */
function Skills({ label, skills, className }) {
  return (
    <div className="flex flex-col gap-1.5 text-body-sm">
      <span className="font-semibold text-heading">{label}</span>
      {skills.length === 0 ? (
        <span className="text-muted-foreground">none</span>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {skills.map((skill, i) => (
            <li key={`${i}-${skill}`} className={`rounded-md px-2 py-0.5 text-label-sm font-semibold ${className}`}>
              {skill}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Score breakdown for one ranked applicant (UI_GUIDELINES §4 ScoreBreakdownDialog, ALGORITHM.md §4): matched and missing
 * skills, section scores × section weights, the overall rating, and the final formula, all with the stored numbers.
 * Reuses GET /api/admin/applications/:id (matching details) and /evaluation (sections and scores); no new API.
 * No rank line under the title (Oct 19 change 3): the rank is the ranking table's column.
 */
export function ScoreBreakdownDialog({ row, onClose }) {
  const review = useReviewApplication(row.applicationId);
  const evaluation = useEvaluation(row.applicationId);
  const loading = review.isPending || evaluation.isPending;
  const failed = review.isError || evaluation.isError;
  const matching = review.data?.matching;
  const page = evaluation.data;
  const stored = page?.evaluation;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Score breakdown: {row.applicantName}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
        {failed && (
          <div className="flex flex-col items-start gap-2 text-body text-muted-foreground">
            <p className="flex items-center gap-2">
              <AlertCircle className="size-4 text-error" aria-hidden="true" />
              The breakdown could not be loaded.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                review.refetch();
                evaluation.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        )}

        {!loading && !failed && (
          <div className="flex flex-col gap-4">
            <Block title="Matching (SBERT)" icon={FileText} tone="resume">
              {matching ? (
                <>
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <Score kind="resume" value={matching.matchingScore} />
                    <span className="text-body-sm text-muted-foreground">
                      Skills {matching.skillsScore}% · Experience {matching.experienceScore}% · weights {matching.weights.skills}/
                      {matching.weights.experience}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 border-t border-border/70 pt-3">
                    <Skills label="Matched skills:" skills={matching.matchedSkills} className="bg-info-soft text-info" />
                    <Skills label="Missing skills:" skills={matching.missingSkills} className="bg-surface-subtle text-muted-foreground" />
                  </div>
                </>
              ) : (
                <p className="text-body-sm text-muted-foreground">No matching result.</p>
              )}
            </Block>

            {stored && (
              <>
                <Block
                  title={stored.reused ? `Interview (reused ratings from ${stored.source.jobTitle})` : "Interview (Competency Profile)"}
                  icon={Users}
                  tone="interview"
                >
                  <div className="overflow-x-auto rounded-lg bg-card ring-1 ring-border/80">
                    <table className="w-full text-body-sm">
                      <thead>
                        <tr className="border-b border-border/70 bg-surface-subtle text-left text-label-sm text-heading">
                          <th className="px-3 py-2 font-semibold">Section</th>
                          <th className="px-3 py-2 text-right font-semibold">Section score</th>
                          <th className="px-3 py-2 text-right font-semibold">Weight</th>
                          <th className="px-3 py-2 text-right font-semibold">Weight × score ÷ 100</th>
                        </tr>
                      </thead>
                      <tbody>
                        {page.sections.map((s) => (
                          <tr key={s.sectionCode} className="border-b border-border/70 last:border-b-0">
                            <td className="px-3 py-2">
                              {s.sectionCode}. {s.sectionName}
                            </td>
                            <td className="px-3 py-2 text-right tabular">{pct(stored.sectionScores[s.sectionCode])}</td>
                            <td className="px-3 py-2 text-right tabular">{s.weight}%</td>
                            <td className="px-3 py-2 text-right tabular">{((s.weight * stored.sectionScores[s.sectionCode]) / 100).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <Score kind="interview" value={stored.interviewScore} />
                    <span className="text-caption text-muted-foreground">Sum of the weighted sections, rounded once in exact hundredths (WSM-01).</span>
                  </div>
                  <p className="text-body-sm text-text">
                    <span className="font-semibold">Overall rating of probability of success:</span> {stored.overallRating} —{" "}
                    {successProbabilityFor(stored.interviewScore).description}
                  </p>
                </Block>

                <Block title="Final score" icon={BarChart3} tone="final">
                  <Score kind="final" value={stored.finalScore} />
                  <p className="rounded-lg bg-primary-soft px-3 py-2 text-body tabular text-text">
                    ({pct(stored.matchingScore)} + {pct(stored.interviewScore)}) ÷ 2 = <span className="font-semibold">{pct(stored.finalScore)}</span>
                  </p>
                  <p className="text-body-sm text-muted-foreground">
                    Passing score {pct(stored.passingScore)}: {stored.passed ? "passed" : "did not pass"} (final ≥ passing score).
                  </p>
                </Block>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
