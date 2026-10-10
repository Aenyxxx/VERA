import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEndorsementVacancy } from "@/features/endorsements/api";
import { CandidatesTab } from "@/features/endorsements/CandidatesTab";
import { OutcomesTab } from "@/features/endorsements/OutcomesTab";

/** Endorsement Management for one vacancy (APP_FLOW §4.5, S16): Candidates and Outcomes tabs. */
export default function EndorsementVacancy() {
  const { vacancyId } = useParams();
  const view = useEndorsementVacancy(vacancyId);
  const back = (
    <Link to="/admin/endorsements" className="mb-3 inline-flex items-center gap-1 text-body text-primary hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" />
      Endorsement Management
    </Link>
  );

  if (view.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (view.isError) {
    return (
      <>
        {back}
        <EmptyState
          icon={AlertCircle}
          title={view.error.status === 404 ? "Vacancy not found" : "The endorsements could not be loaded"}
          description={view.error.message}
          action={view.error.status !== 404 && <Button onClick={() => view.refetch()}>Try again</Button>}
        />
      </>
    );
  }

  const data = view.data;
  const { vacancy } = data;
  return (
    <>
      {back}
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-page-title font-bold">{vacancy.jobTitle}</h1>
          <StatusBadge kind="vacancy" value={vacancy.status} />
        </div>
        <p className="text-body text-muted-foreground">
          {vacancy.companyName} · {vacancy.hiredCount} of {vacancy.slotsNeeded} slots filled
        </p>
      </div>
      <Tabs defaultValue={data.candidates.length > 0 || data.endorsements.length === 0 ? "candidates" : "outcomes"}>
        <TabsList aria-label="Endorsement sections">
          <TabsTrigger value="candidates">Candidates ({data.candidates.length})</TabsTrigger>
          <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
        </TabsList>
        <TabsContent value="candidates" className="pt-4">
          <CandidatesTab data={data} />
        </TabsContent>
        <TabsContent value="outcomes" className="pt-4">
          <OutcomesTab data={data} />
        </TabsContent>
      </Tabs>
    </>
  );
}
