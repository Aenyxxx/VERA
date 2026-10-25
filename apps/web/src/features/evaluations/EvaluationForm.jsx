import { zodResolver } from "@hookform/resolvers/zod";
import { APPLICANT_TYPE_LABELS, APPLICATION_STATUS, RATING_INTERPRETATIONS, successProbabilityFor } from "@vera/shared";
import { CheckCircle2, Eye, History, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ScoreBar } from "@/components/shared/ScoreBar";
import { ScoreChip } from "@/components/shared/ScoreChip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TONE_CLASSES } from "@/components/shared/tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { openSignedUrl } from "@/features/documents/api";
import { initialsOf } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useSaveEvaluation } from "./api";
import { previewScores } from "./preview";
import { ratingsSchema, toRatingsBody } from "./schemas";

const RATINGS = [1, 2, 3, 4, 5];
const percent = (value) => `${Number(value).toFixed(2)}%`;

/**
 * One Competency Profile item: its name and the 1–5 choices (UI_GUIDELINES §6). Oct 19 change 2 (replaces the
 * per-choice text of decision 13): a choice shows only the number and the radio; the interpretation stays in its
 * label for screen readers (e.g. "Does not achieve expectations 1") and as the tooltip, and is shown once per section
 * in RatingHeader.
 */
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
            className="grid grid-cols-5 gap-1.5 sm:gap-2 lg:flex-1"
          >
            {RATINGS.map((n) => {
              const id = `rating-${item.competencyId}-${n}`;
              const chosen = field.value === n;
              return (
                <div
                  key={n}
                  title={`${RATING_INTERPRETATIONS[n].short} / ${RATING_INTERPRETATIONS[n].long}`}
                  className={cn(
                    "flex min-h-11 flex-col items-center gap-1 rounded-md border px-1 py-2 text-center transition-colors",
                    chosen
                      ? "border-primary bg-primary-soft ring-1 ring-primary"
                      : !readOnly && "hover:border-primary/60 hover:bg-surface-blue",
                  )}
                >
                  <Label htmlFor={id} className={cn("flex flex-1 flex-col items-center justify-center", !readOnly && "cursor-pointer")}>
                    <span className="sr-only">{RATING_INTERPRETATIONS[n].short}</span>{" "}
                    <span className={`font-heading text-body-lg font-bold tabular ${chosen ? "text-primary" : "text-heading"}`}>{n}</span>
                  </Label>
                  <RadioGroupItem id={id} value={String(n)} />
                </div>
              );
            })}
          </RadioGroup>
        )}
      />
    </li>
  );
}

/**
 * The five rating labels once, as column headers above a section's items (Oct 19 change 2), aligned with the 1–5
 * grid of ItemRating (same row layout: the lg:w-48 name column, then 5 columns). Hidden on phones, where the
 * "Rating scale" key is shown instead, and from screen readers, which read the label in each radio's name.
 */
function RatingHeader() {
  return (
    <div aria-hidden="true" data-rating-header="" className="mb-2 hidden sm:flex sm:flex-col lg:flex-row lg:items-end lg:justify-between lg:gap-4">
      <span className="hidden lg:block lg:w-48 lg:shrink-0" />
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 lg:flex-1">
        {RATINGS.map((n) => (
          <span
            key={n}
            className="flex items-center justify-center rounded-md bg-surface-subtle px-1 py-1.5 text-center text-caption leading-tight font-semibold text-heading"
          >
            {RATING_INTERPRETATIONS[n].short}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A section card: A/B/C name, the vacancy's section weight, and the live section % (WSM-01 level 1). */
function SectionCard({ section, control, readOnly, score }) {
  const headingId = `section-${section.sectionCode}`;
  return (
    <section aria-labelledby={headingId} className="rounded-xl bg-card p-4 shadow-card ring-1 ring-border/80 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b pb-3">
        <h2 id={headingId} className="font-heading text-card-title font-bold text-heading">
          {section.sectionCode}. {section.sectionName}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={TONE_CLASSES.neutral}>Weight {section.weight}%</Badge>
          <div className="flex flex-col items-end gap-1">
            <span className={`rounded-md px-2 py-0.5 text-label-sm font-semibold tabular ${score == null ? TONE_CLASSES.neutral : TONE_CLASSES.interview}`}>
              Section score {score == null ? `– rate all ${section.items.length} items` : percent(score)}
            </span>
            <ScoreBar value={score} className="w-full" />
          </div>
        </div>
      </div>
      <RatingHeader />
      <ul className="flex flex-col">
        {section.items.map((item) => (
          <ItemRating key={item.competencyId} item={item} control={control} readOnly={readOnly} />
        ))}
      </ul>
    </section>
  );
}

/** One score slot of the summary: the chip and its bar (the bar only repeats the shown value). */
function ScoreSlot({ kind, value }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <ScoreChip kind={kind} value={value} size="md" />
      <ScoreBar value={value} className="w-full" />
    </div>
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

/** Right column (decision 13): applicant, interview, and the three score slots (matching / interview / final) + overall rating. */
function Summary({ data, scores, saved }) {
  const { application, interview } = data;
  const band = scores.interviewScore == null ? null : successProbabilityFor(scores.interviewScore);
  return (
    <section
      aria-labelledby="evaluation-summary"
      className="relative flex flex-col gap-4 overflow-hidden rounded-xl bg-card p-4 pt-5 shadow-card ring-1 ring-border/80 sm:p-6 sm:pt-7"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary to-cyan" />
      <div className="flex items-center gap-3">
        {/* decorative initials disc (design 20); the name is the heading next to it */}
        <div
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-body font-bold text-primary-foreground"
        >
          {initialsOf(application.applicantName)}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
          <h2 id="evaluation-summary" className="font-heading text-card-title font-bold text-heading">
            {application.applicantName}
          </h2>
          <StatusBadge kind="application" value={application.status} />
        </div>
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
        <h3 className="font-heading text-body font-bold text-heading">Scores</h3>
        {/* design 20's three score slots: each chip with its bar (nothing for a score not computed yet) */}
        <div className="grid grid-cols-1 gap-3 rounded-lg bg-surface-blue/60 p-3 ring-1 ring-border/80 sm:grid-cols-3 lg:grid-cols-1">
          <ScoreSlot kind="resume" value={application.matchingScore} />
          <ScoreSlot kind="interview" value={scores.interviewScore} />
          <ScoreSlot kind="final" value={scores.finalScore} />
        </div>
        {/* Decision 40-1: no "Final = (matching + interview) ÷ 2 · passing score" line; the scores stay. */}
        {scores.passed != null && (
          <p className={`self-start rounded-md px-2 py-1 text-body-sm font-semibold ${scores.passed ? TONE_CLASSES.success : TONE_CLASSES.error}`}>
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
        <h3 className="font-heading text-body font-bold text-heading">Overall rating of probability of success</h3>
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
  // Decision 35: no "Rate all 15 items" caption; Save simply stays disabled until all items are rated.
  const caption = !data.canEvaluate ? data.blockedReason : complete ? "The ratings cannot be changed after saving." : null;

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
        <p role="status" className={`flex items-start gap-2 rounded-md px-3 py-2 text-body-sm ${TONE_CLASSES.info}`}>
          <History className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Ratings from {evaluation.source.jobTitle} ({evaluation.source.companyName}), {formatDateTime(evaluation.source.ratedAt)}. This
            applicant was not interviewed again; the original ratings are shown read-only with this vacancy&apos;s section weights.
          </span>
        </p>
      )}
      {evaluation && !evaluation.reused && (
        <p role="status" className={`flex items-start gap-2 rounded-md px-3 py-2 text-body-sm ${TONE_CLASSES.neutral}`}>
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Evaluation saved {formatDateTime(evaluation.computedAt)}. The ratings are read-only.</span>
        </p>
      )}

      {/* Decision 13: competency cards on the left, applicant card on the right (on phones: rate first, then save). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-3">
          {/* On phones the section column headers are hidden; the scale is listed once here. */}
          <div className="rounded-xl bg-card p-4 shadow-card ring-1 ring-border/80 sm:hidden">
            <p className="mb-1 font-heading text-body-sm font-bold text-heading">Rating scale</p>
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

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Summary data={data} scores={scores} saved={readOnly} />
          {!readOnly && (
            <div className="flex flex-col items-start gap-1.5 rounded-xl bg-card p-4 shadow-card ring-1 ring-border/80 sm:p-6">
              <Button disabled={!canSave} aria-describedby={caption ? "save-evaluation-caption" : undefined} onClick={() => {
                save.reset();
                setConfirming(true);
              }}>
                <Save aria-hidden="true" />
                Save evaluation
              </Button>
              {caption && (
                <p id="save-evaluation-caption" className="text-body-sm text-muted-foreground">
                  {caption}
                </p>
              )}
            </div>
          )}
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
