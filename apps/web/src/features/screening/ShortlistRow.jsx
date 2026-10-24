import { VERIFICATION_STATUS_LABELS } from "@vera/shared";
import { CheckCircle2, ChevronRight, FileClock, History, Lock, Upload } from "lucide-react";
import { Link } from "react-router-dom";

import { ScoreBar } from "@/components/shared/ScoreBar";
import { ScoreChip } from "@/components/shared/ScoreChip";
import { TONE_CLASSES } from "@/components/shared/tones";
import { Badge } from "@/components/ui/badge";
import { initialsOf } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Small labelled marker on a shortlist row (icon + text, never color alone). */
function Marker({ icon: Icon, tone, children, title }) {
  return (
    <Badge className={cn("gap-1", TONE_CLASSES[tone])} title={title}>
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  );
}

/**
 * One applicant in a group's shortlist or waiting pool (FR-SCR-01). Shows the matching score, whether the slot is
 * locked (BR-12), verification progress, "New upload to verify", pending requests, and earlier ratings (BR-21).
 * Design 15: the matching score is the row's centrepiece (chip + bar); from sm the row reads as table columns.
 */
export function ShortlistRow({ entry, to }) {
  return (
    <li>
      <Link
        to={to}
        className="group grid grid-cols-1 gap-3 px-4 py-4 outline-none transition-colors hover:bg-surface-blue focus-visible:bg-surface-blue focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6 lg:grid-cols-[minmax(0,14rem)_auto_minmax(0,1fr)_auto] lg:gap-6"
        aria-label={`Review ${entry.applicantName}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {/* decorative initials disc (design 15); the name stays in the text */}
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-nav text-label-sm font-semibold text-white"
          >
            {initialsOf(entry.applicantName)}
          </div>
          <p className="flex min-w-0 items-center gap-2 text-body font-semibold text-heading">
            <span className="truncate">{entry.applicantName}</span>
            {entry.locked && (
              <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Locked: verification started" />
            )}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end lg:items-start">
          <ScoreChip kind="resume" value={entry.matchingScore} size="md" />
          <ScoreBar value={entry.matchingScore} className="w-32" />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-body-sm text-muted-foreground">
            Resume: {VERIFICATION_STATUS_LABELS[entry.resumeStatus]?.label ?? "Missing"} · Documents{" "}
            {entry.documentsVerified} of {entry.documentsTotal} verified
          </span>
          <div className="flex flex-wrap gap-1.5 empty:hidden">
            {entry.fullyVerified && (
              <Marker icon={CheckCircle2} tone="success">
                Fully verified
              </Marker>
            )}
            {entry.newUploads > 0 && (
              <Marker icon={Upload} tone="warning" title="A document was re-uploaded or sent for a request and is pending">
                New upload to verify{entry.newUploads > 1 ? ` (${entry.newUploads})` : ""}
              </Marker>
            )}
            {entry.pendingRequests > 0 && (
              <Marker icon={FileClock} tone="warning">
                {entry.pendingRequests} request{entry.pendingRequests > 1 ? "s" : ""} pending
              </Marker>
            )}
            {entry.ratingsOnFile && (
              <Marker icon={History} tone="info">
                Ratings on file
              </Marker>
            )}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 justify-self-end text-body font-semibold text-primary sm:col-start-2 lg:col-start-4">
          Review
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}
