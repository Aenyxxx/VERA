import { VERIFICATION_STATUS_LABELS } from "@vera/shared";
import { CheckCircle2, ChevronRight, FileClock, History, Lock, Upload } from "lucide-react";
import { Link } from "react-router-dom";

import { ScoreChip } from "@/components/shared/ScoreChip";
import { TONE_CLASSES } from "@/components/shared/tones";
import { Badge } from "@/components/ui/badge";
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
 */
export function ShortlistRow({ entry, to }) {
  return (
    <li>
      <Link
        to={to}
        className="flex flex-col gap-2 rounded-md border bg-card p-4 transition-colors hover:bg-surface-blue focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between"
        aria-label={`Review ${entry.applicantName}`}
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="flex items-center gap-2 text-body font-semibold text-heading">
            <span className="truncate">{entry.applicantName}</span>
            {entry.locked && (
              <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Locked: verification started" />
            )}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <ScoreChip kind="resume" value={entry.matchingScore} />
            <span className="text-body-sm text-muted-foreground">
              Resume: {VERIFICATION_STATUS_LABELS[entry.resumeStatus]?.label ?? "Missing"} · Documents{" "}
              {entry.documentsVerified} of {entry.documentsTotal} verified
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
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
        <span className="inline-flex items-center gap-1 self-end text-body font-semibold text-primary sm:self-center">
          Review
          <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}
