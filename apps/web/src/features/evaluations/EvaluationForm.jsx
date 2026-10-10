import { zodResolver } from "@hookform/resolvers/zod";
import { APPLICANT_TYPE_LABELS, APPLICATION_STATUS, RATING_INTERPRETATIONS, successProbabilityFor } from "@vera/shared";
import { CheckCircle2, Eye, History, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ScoreChip } from "@/components/shared/ScoreChip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TONE_CLASSES } from "@/components/shared/tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { openSignedUrl } from "@/features/documents/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useSaveEvaluation } from "./api";
import { previewScores } from "./preview";
import { ratingsSchema, toRatingsBody } from "./schemas";

const RATINGS = [1, 2, 3, 4, 5];
const percent = (value) => `${Number(value).toFixed(2)}%`;

/** One Competency Profile item: its name and the 1–5 choices, each with its interpretation (UI_GUIDELINES §6). */
function ItemRating({ item, control, readOnly }) {
  const labelId = `item-${item.competencyId}`;
  return (
    <li className="flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
      <span id={labelId} className="text-body font-semibold text-heading lg:w-48 lg:shrink-0">
        {item.competencyName}
      </span>
      <Controller
        name={item.competencyId}
        control={control}
        render={({ field }) => (
          <RadioGroup
            aria-labelledby={labelId}
            value={field.value == null ? "" : String(field.value)}
            onValueChange={(value) => field.onChange(Number(value))}
            disabled={readOnly}
            className="grid grid-cols-5 gap-1.5 sm:gap-2"
          >
            {RATINGS.map((n) => {
              const id = `rating-${item.competencyId}-${n}`;
              const chosen = field.value === n;
              return (
                <div
                  key={n}
                  title={`${RATING_INTERPRETATIONS[n].short} / ${RATING_INTERPRETATIONS[n].long}`}
                  className={cn(
                    "flex min-h-11 flex-col items-center gap-1 rounded-sm border px-1 py-2 text-center transition-colors",
                    chosen ? "border-primary bg-surface-blue" : !readOnly && "hover:bg-surface-blue",
                  )}
                >
                  <RadioGroupItem id={id} value={String(n)} />
                  <Label htmlFor={id} className={cn("flex flex-col items-center gap-0.5", !readOnly && "cursor-pointer")}>
                    <span className="text-body-lg font-semibold text-heading tabular">{n}</span>{" "}
                    <span className="sr-only text-caption leading-tight text-muted-foreground sm:not-sr-only">
                      {RATING_INTERPRETATIONS[n].short}
                    </span>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        )}
      />
    </li>
  );
}

/** A section card: A/B/C name, the vacancy's section weight, and the live section % (WSM-01 level 1). */
function SectionCard({ section, control, readOnly, score }) {
  const headingId = `section-${section.sectionCode}`;
  return (
    <section aria-labelledby={headingId} className="rounded-md border bg-card p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h2 id={headingId} className="text-card-title font-semibold">
          {section.sectionCode}. {section.sectionName}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={TONE_CLASSES.neutral}>Weight {section.weight}%</Badge>
          <span className={cn("rounded-sm px-1.5 py-0.5 text-label-sm font-semibold tabular", score == null ? TONE_CLASSES.neutral : TONE_CLASSES.interview)}>
            Section score {score == null ? `– rate all ${section.items.length} items` : percent(score)}
          </span>
        </div>
      </div>
      <ul className="flex flex-col">
        {section.items.map((item) => (
          <ItemRating key={item.competencyId} item={item} control={control} readOnly={readOnly} />
        ))}
      </ul>
    </section>
  );
}

function Fact({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-label-sm text-muted-foreground">{label}</dt>
      <dd className="text-body text-heading">{children}</dd>
    </div>
  );
}

/** Left column: applicant, interview, and the three score slots (matching / interview / final) + overall rating. */
function Summary({ data, scores, saved }) {
  const { application, interview } = data;
  const band = scores.interviewScore == null ? null : successProbabilityFor(scores.interviewScore);
  return (
    <section aria-labelledby="evaluation-summary" className="flex flex-col gap-4 rounded-md border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="evaluation-summary" className="text-card-title font-semibold">
          {application.applicantName}
        </h2>
        <StatusBadge kind="application" value={application.status} />
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Fact label="Group">{APPLICANT_TYPE_LABELS[application.applicantType]}</Fact>
        <Fact label="Interview (Philippine time)">{interview ? formatDateTime(interview.scheduledAt) : "No interview (reused ratings)"}</Fact>
      </dl>
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => openSignedUrl(`/admin/applications/${application.applicationId}/resume/url`)}
      >
        <Eye aria-hidden="true" />
        View resume
      </Button>

      <div className="flex flex-col gap-2 border-t pt-4">
        <h3 className="text-body font-semibold text-heading">Scores</h3>
        <div className="flex flex-wrap gap-2">
          <ScoreChip kind="resume" value={application.matchingScore} />
          <ScoreChip kind="interview" value={scores.interviewScore} />
          <ScoreChip kind="final" value={scores.finalScore} />
        </div>
        <p className="text-body-sm text-muted-foreground">
          Final = (matching + interview) ÷ 2 · passing score {percent(application.passingScore)}
        </p>
        {scores.passed != null && (
          <p className={cn("self-start rounded-sm px-2 py-1 text-body-sm font-semibold", scores.passed ? TONE_CLASSES.success : TONE_CLASSES.error)}>
            {saved
              ? scores.passed
                ? "Final score meets the passing score"
                : "Final score is below the passing score"
              : scores.passed
                ? "Passes with these ratings"
                : "Below the passing score with these ratings"}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1 border-t pt-4">
        <h3 className="text-body font-semibold text-heading">Overall rating of probability of success</h3>
        {band ? (
          <p className="text-body text-text">
            <span className="font-semibold tabular">{band.rating}</span> — {band.description}
          </p>
        ) : (
          <p className="text-body-sm text-muted-foreground">Appears once all {scores.total} items are rated.</p>
        )}
        <p className="text-caption text-muted-foreground">Informational only; pass or fail is decided by the final score.</p>
      </div>
    </section>
  );
}

/**
 * Interview Assessment evaluation (FR-INT-06, UI_GUIDELINES §6 HR pp.19–20): the Competency Profile, all 15 items
 * rated 1–5, grouped by section with the section weight, live section %, interview score, overall rating, and final
 * score from @vera/shared (preview only: the POST sends the ratings and the API recomputes). Once evaluated, or for
 * reused ratings (BR-21), the ratings are shown read-only with the stored scores.
 */
export function EvaluationForm({ data }) {
  const save = useSaveEvaluation();
  const [confirming, setConfirming] = useState(false);
  const { application, vacancy, sections, evaluation } = data;
  const readOnly = Boolean(evaluation);
  const itemIds = useMemo(() => sections.flatMap((s) => s.items.map((item) => item.competencyId)), [sections]);
  const schema = useMemo(() => ratingsSchema(itemIds), [itemIds]);

  const { control, handleSubmit } = useForm({
    resolver: zodResolver(schema),
    defaultValues: readOnly ? Object.fromEntries(evaluation.ratings.map((r) => [r.competencyId, r.rating])) : {},
  });
  const values = useWatch({ control });
  const preview = previewScores(sections, values ?? {}, application.matchingScore, application.passingScore);
  // Read-only: the stored values (the database's generated columns), not a recomputation.
  const scores = readOnly
    ? {
        ...preview,
        sections: evaluation.sectionScores,
        interviewScore: evaluation.interviewScore,
        overallRating: evaluation.overallRating,
        finalScore: evaluation.finalScore,
        passed: evaluation.passed,
      }
    : preview;
  const complete = preview.rated === preview.total;
  const canSave = !readOnly && data.canEvaluate && complete;

  function submit(formValues) {
    save.mutate(
      { applicationId: application.applicationId, ratings: toRatingsBody(itemIds, formValues) },
      {
        onSuccess: (result) => {
          toast.success(result.status === APPLICATION_STATUS.PASSED ? "Evaluation saved: passed" : "Evaluation saved: did not pass");
          setConfirming(false);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {evaluation?.reused && (
        <p role="status" className={cn("flex items-start gap-2 rounded-sm px-3 py-2 text-body-sm", TONE_CLASSES.info)}>
          <History className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Ratings from {evaluation.source.jobTitle} ({evaluation.source.companyName}), {formatDateTime(evaluation.source.ratedAt)}. This
            applicant was not interviewed again; the original ratings are shown read-only with this vacancy&apos;s section weights.
          </span>
        </p>
      )}
      {evaluation && !evaluation.reused && (
        <p role="status" className={cn("flex items-start gap-2 rounded-sm px-3 py-2 text-body-sm", TONE_CLASSES.neutral)}>
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Evaluation saved {formatDateTime(evaluation.computedAt)}. The ratings are read-only.</span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Summary data={data} scores={scores} saved={readOnly} />
          {!readOnly && (
            <div className="flex flex-col items-start gap-1.5 rounded-md border bg-card p-4 sm:p-6">
              <Button disabled={!canSave} aria-describedby="save-evaluation-caption" onClick={() => {
                save.reset();
                setConfirming(true);
              }}>
                <Save aria-hidden="true" />
                Save evaluation
              </Button>
              <p id="save-evaluation-caption" className="text-body-sm text-muted-foreground">
                {!data.canEvaluate
                  ? data.blockedReason
                  : complete
                    ? "The ratings cannot be changed after saving."
                    : `Rate all ${preview.total} items to save (${preview.rated} of ${preview.total} rated).`}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-3">
          {/* On phones the choices show only the number; the scale is listed once here. */}
          <div className="rounded-md border bg-card p-4 sm:hidden">
            <p className="mb-1 text-body-sm font-semibold text-heading">Rating scale</p>
            <ul className="flex flex-col gap-0.5 text-body-sm text-text">
              {RATINGS.map((n) => (
                <li key={n}>
                  <span className="font-semibold tabular">{n}</span> {RATING_INTERPRETATIONS[n].short}
                </li>
              ))}
            </ul>
          </div>
          {sections.map((section) => (
            <SectionCard
              key={section.sectionCode}
              section={section}
              control={control}
              readOnly={readOnly}
              score={scores.sections[section.sectionCode] ?? null}
            />
          ))}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirming(false)}
          title={`Save the evaluation for ${application.applicantName}?`}
          description={
            preview.passed
              ? `Final score ${percent(preview.finalScore)}: the applicant passes ${vacancy.jobTitle}. The ratings cannot be changed after saving.`
              : `Final score ${percent(preview.finalScore)} is below the passing score: the application closes, the applicant joins the applicant pool, and they can no longer apply to ${vacancy.companyName}'s jobs. The ratings cannot be changed after saving.`
          }
          confirmLabel="Save evaluation"
          pending={save.isPending}
          error={save.error?.message}
          onConfirm={handleSubmit(submit)}
        />
      )}
    </div>
  );
}
