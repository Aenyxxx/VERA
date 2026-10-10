import { successProbabilityFor } from "@vera/shared";
import { AlertCircle } from "lucide-react";

import { ScoreChip } from "@/components/shared/ScoreChip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvaluation } from "@/features/evaluations/api";
import { useReviewApplication } from "@/features/screening/api";

const pct = (value) => `${Number(value).toFixed(2)}%`;

function Block({ title, children }) {
  return (
    <section className="flex flex-col gap-2 border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-body font-semibold text-heading">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Score breakdown for one ranked applicant (UI_GUIDELINES §4 ScoreBreakdownDialog, ALGORITHM.md §4): matched and missing
 * skills, section scores × section weights, the overall rating, and the final formula, all with the stored numbers.
 * Reuses GET /api/admin/applications/:id (matching details) and /evaluation (sections and scores); no new API.
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
          <DialogDescription>Rank {row.rank} · the stored scores, rounded to 2 decimals (half-up) as in the ranking.</DialogDescription>
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
            <Block title="Matching (SBERT)">
              {matching ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <ScoreChip kind="resume" value={matching.matchingScore} />
                    <span className="text-body-sm text-muted-foreground">
                      Skills {matching.skillsScore}% · Experience {matching.experienceScore}% · weights {matching.weights.skills}/
                      {matching.weights.experience}
                    </span>
                  </div>
                  <p className="text-body-sm">
                    <span className="font-semibold">Matched skills:</span> {matching.matchedSkills.join(", ") || "none"}
                  </p>
                  <p className="text-body-sm">
                    <span className="font-semibold">Missing skills:</span> {matching.missingSkills.join(", ") || "none"}
                  </p>
                </>
              ) : (
                <p className="text-body-sm text-muted-foreground">No matching result.</p>
              )}
            </Block>

            {stored && (
              <>
                <Block title={stored.reused ? `Interview (reused ratings from ${stored.source.jobTitle})` : "Interview (Competency Profile)"}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-body-sm">
                      <thead>
                        <tr className="border-b text-left text-label-sm text-muted-foreground">
                          <th className="py-1.5 font-semibold">Section</th>
                          <th className="py-1.5 text-right font-semibold">Section score</th>
                          <th className="py-1.5 text-right font-semibold">Weight</th>
                          <th className="py-1.5 text-right font-semibold">Weight × score ÷ 100</th>
                        </tr>
                      </thead>
                      <tbody>
                        {page.sections.map((s) => (
                          <tr key={s.sectionCode} className="border-b last:border-b-0">
                            <td className="py-1.5">
                              {s.sectionCode}. {s.sectionName}
                            </td>
                            <td className="py-1.5 text-right tabular">{pct(stored.sectionScores[s.sectionCode])}</td>
                            <td className="py-1.5 text-right tabular">{s.weight}%</td>
                            <td className="py-1.5 text-right tabular">{((s.weight * stored.sectionScores[s.sectionCode]) / 100).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ScoreChip kind="interview" value={stored.interviewScore} />
                    <span className="text-caption text-muted-foreground">Sum of the weighted sections, rounded once in exact hundredths (WSM-01).</span>
                  </div>
                  <p className="text-body-sm text-text">
                    <span className="font-semibold">Overall rating of probability of success:</span> {stored.overallRating} —{" "}
                    {successProbabilityFor(stored.interviewScore).description}
                  </p>
                </Block>

                <Block title="Final score">
                  <p className="text-body tabular text-text">
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
