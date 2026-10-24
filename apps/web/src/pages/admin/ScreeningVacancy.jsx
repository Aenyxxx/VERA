import { APPLICANT_TYPE, APPLICANT_TYPE_LABELS } from "@vera/shared";
import { AlertCircle, ArrowLeft, ChevronDown, Inbox, Lock } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ScoreBar } from "@/components/shared/ScoreBar";
import { ScoreChip } from "@/components/shared/ScoreChip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScreeningVacancy } from "@/features/screening/api";
import { ReviewSheet } from "@/features/screening/ReviewSheet";
import { ShortlistRow } from "@/features/screening/ShortlistRow";

// Tab names from UI_GUIDELINES §6 (HR p.15).
const GROUPS = [
  { type: APPLICANT_TYPE.EXPERIENCED, tab: "Applicants with Work Experience" },
  { type: APPLICANT_TYPE.FIRST_TIME, tab: "First-Time Job Seekers" },
];

const card = "overflow-hidden rounded-xl bg-card shadow-card ring-1 ring-border/80";

/** A white card with a heading bar (design 15's table card); rows are divided by hairlines. */
function ListCard({ id, title, footer, children }) {
  return (
    <section aria-labelledby={id} className={card}>
      <h2 id={id} className="border-b bg-surface-subtle px-4 py-3 font-heading text-card-title font-bold text-heading sm:px-6">
        {title}
      </h2>
      {children}
      {footer}
    </section>
  );
}

function GroupPanel({ group, type, vacancyId }) {
  const rowLink = (entry) => `/admin/screening/${vacancyId}/${entry.applicationId}`;
  return (
    <div className="flex flex-col gap-6">
      <ListCard
        id={`shortlist-title-${type}`}
        title={`Shortlist · ${group.shortlisted.length} of ${group.quota}`}
        footer={
          <p className="flex items-center gap-1.5 border-t bg-surface-blue/60 px-4 py-2.5 text-body-sm text-muted-foreground sm:px-6">
            <Lock className="size-3.5" aria-hidden="true" />
            Locked slots stay with their applicants.
          </p>
        }
      >
        {group.shortlisted.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No one shortlisted yet"
            description="Applicants who pass the threshold appear here automatically."
            className="rounded-none shadow-none ring-0"
          />
        ) : (
          <ul className="divide-y divide-border">
            {group.shortlisted.map((entry) => (
              <ShortlistRow key={entry.applicationId} entry={entry} to={rowLink(entry)} />
            ))}
          </ul>
        )}
      </ListCard>

      <ListCard id={`waiting-title-${type}`} title={`Waiting pool · ${group.waitingPool.length}`}>
        {group.waitingPool.length === 0 ? (
          <p className="px-4 py-4 text-body text-muted-foreground sm:px-6">No one is waiting.</p>
        ) : (
          <ul className="divide-y divide-border">
            {group.waitingPool.map((entry) => (
              <ShortlistRow key={entry.applicationId} entry={entry} to={rowLink(entry)} />
            ))}
          </ul>
        )}
      </ListCard>
    </div>
  );
}

function NotShortlisted({ lists }) {
  const total = lists.prescreenFailed.length + lists.belowThreshold.length;
  return (
    <details className={`group ${card}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-heading text-card-title font-bold text-heading outline-none transition-colors hover:bg-surface-blue focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>Not shortlisted · {total}</span>
        <ChevronDown className="size-5 shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid grid-cols-1 gap-6 border-t px-4 py-4 sm:px-6 lg:grid-cols-2">
        <section aria-labelledby="prescreen-title">
          <h3 id="prescreen-title" className="mb-2 text-body font-semibold text-heading">
            Prescreen failed · {lists.prescreenFailed.length}
          </h3>
          {lists.prescreenFailed.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lists.prescreenFailed.map((r) => (
                <li key={r.applicationId} className="text-body-sm">
                  <span className="font-semibold text-heading">{r.applicantName}</span> ({APPLICANT_TYPE_LABELS[r.applicantType]}) — {r.reason}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="below-title">
          <h3 id="below-title" className="mb-2 text-body font-semibold text-heading">
            Below threshold · {lists.belowThreshold.length}
          </h3>
          {lists.belowThreshold.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lists.belowThreshold.map((r) => (
                <li key={r.applicationId} className="flex flex-wrap items-center gap-2 text-body-sm">
                  <span className="font-semibold text-heading">{r.applicantName}</span>
                  <ScoreChip kind="resume" value={r.matchingScore} />
                  <ScoreBar value={r.matchingScore} className="w-16" />
                  <span className="text-muted-foreground">{r.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </details>
  );
}

/**
 * Resume Screening for one vacancy (FR-SCR-01, UI_GUIDELINES §6): tabs per group with the automatic shortlist
 * (2 × slots), locked markers, the waiting pool, and the not-shortlisted lists. The review sheet follows the URL
 * (/admin/screening/:vacancyId/:applicationId), so Back closes it.
 */
export default function ScreeningVacancy() {
  const { vacancyId, applicationId } = useParams();
  const navigate = useNavigate();
  const screening = useScreeningVacancy(vacancyId);

  const back = (
    <Link
      to="/admin/screening"
      className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-md text-body font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Resume Screening
    </Link>
  );

  if (screening.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (screening.isError) {
    return (
      <>
        {back}
        <EmptyState
          icon={AlertCircle}
          title={screening.error.status === 404 ? "Vacancy not found" : "The shortlist could not be loaded"}
          description={screening.error.message}
          action={screening.error.status !== 404 && <Button onClick={() => screening.refetch()}>Try again</Button>}
        />
      </>
    );
  }

  const { vacancy, groups, notShortlisted } = screening.data;
  return (
    <>
      {back}
      <PageHeader
        title={vacancy.jobTitle}
        description={`${vacancy.companyName} · ${vacancy.slotsNeeded} slot${vacancy.slotsNeeded === 1 ? "" : "s"} · shortlist ${vacancy.quota} per group · updates automatically`}
      />

      <Tabs defaultValue={APPLICANT_TYPE.EXPERIENCED}>
        {/* Long group names: on phones the tab list scrolls inside itself instead of widening the page. */}
        <TabsList aria-label="Applicant groups" className="max-w-full justify-start overflow-x-auto">
          {GROUPS.map(({ type, tab }) => (
            <TabsTrigger key={type} value={type}>
              {tab} ({groups[type].shortlisted.length}/{groups[type].quota})
            </TabsTrigger>
          ))}
        </TabsList>
        {GROUPS.map(({ type }) => (
          <TabsContent key={type} value={type} className="pt-4">
            <GroupPanel group={groups[type]} type={type} vacancyId={vacancyId} />
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-8">
        <NotShortlisted lists={notShortlisted} />
      </div>

      <ReviewSheet applicationId={applicationId} onClose={() => navigate(`/admin/screening/${vacancyId}`)} />
    </>
  );
}
