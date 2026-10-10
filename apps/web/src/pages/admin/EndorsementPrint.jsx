import { APPLICANT_TYPE_LABELS, EDUCATION_LEVEL_LABELS, successProbabilityFor } from "@vera/shared";
import { AlertCircle, ArrowLeft, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEndorsementPrint } from "@/features/endorsements/api";
import { formatDateTime } from "@/lib/format";

const pct = (value) => (value == null ? "—" : `${Number(value).toFixed(2)}%`);
const GENDER = { male: "Male", female: "Female" };

function Fact({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-label-sm text-muted-foreground">{label}</dt>
      <dd className="text-body text-heading">{children || "—"}</dd>
    </div>
  );
}

/**
 * Printable endorsement (FR-END-05 simplified, S16): the document the agency sends to the client, saved with the
 * browser's Print → Save as PDF. HR document: the company and the scores are shown. Rendered without the admin
 * layout; the buttons are hidden when printing.
 */
export default function EndorsementPrint() {
  const { vacancyId, endorsementId } = useParams();
  const printable = useEndorsementPrint(endorsementId);
  const back = (
    <Link to={`/admin/endorsements/${vacancyId}`} className="inline-flex items-center gap-1 text-body text-primary hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to Endorsement Management
    </Link>
  );

  if (printable.isPending) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-4 p-6" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }
  if (printable.isError) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
        {back}
        <EmptyState
          icon={AlertCircle}
          title={printable.error.status === 404 ? "Endorsement not found" : "The endorsement could not be loaded"}
          description={printable.error.message}
        />
      </main>
    );
  }

  const { vacancy, company, candidates, sentAt, sentBy } = printable.data;
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 bg-white p-6 text-text print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {back}
        <Button onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Print / Save as PDF
        </Button>
      </div>

      <header className="flex flex-col gap-1 border-b pb-4">
        <p className="text-label-sm font-semibold tracking-wide text-primary uppercase">Confiable Manpower Solutions Inc.</p>
        <h1 className="text-page-title font-bold text-heading">Endorsement of candidates</h1>
        <p className="text-body-sm text-muted-foreground">
          Sent {formatDateTime(sentAt)} (Philippine time){sentBy ? ` by ${sentBy}` : ""}
        </p>
      </header>

      <section aria-labelledby="print-vacancy" className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
        <div>
          <h2 id="print-vacancy" className="mb-2 text-card-title font-semibold">Position</h2>
          <dl className="grid grid-cols-1 gap-2">
            <Fact label="Job title">{vacancy.jobTitle}</Fact>
            <Fact label="Deployment location">{vacancy.deploymentLocation}</Fact>
            <Fact label="Employment type">{vacancy.employmentType}</Fact>
            <Fact label="Slots">{vacancy.slotsNeeded}</Fact>
          </dl>
        </div>
        <div>
          <h2 className="mb-2 text-card-title font-semibold">Client</h2>
          <dl className="grid grid-cols-1 gap-2">
            <Fact label="Company">{company.companyName}</Fact>
            <Fact label="Contact person">{company.contactPersonName}</Fact>
            <Fact label="Contact email">{company.contactEmail}</Fact>
          </dl>
        </div>
      </section>

      <section aria-labelledby="print-candidates">
        <h2 id="print-candidates" className="mb-2 text-card-title font-semibold">
          Candidates ({candidates.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr className="border-b text-left text-label-sm text-muted-foreground">
                <th className="py-2 pr-2 font-semibold">Rank</th>
                <th className="py-2 pr-2 font-semibold">Name</th>
                <th className="py-2 pr-2 font-semibold">Group</th>
                <th className="py-2 pr-2 text-right font-semibold">Matching</th>
                <th className="py-2 pr-2 text-right font-semibold">Interview</th>
                <th className="py-2 pr-2 text-right font-semibold">Final</th>
                <th className="py-2 font-semibold">Overall rating</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.itemId} className="border-b last:border-b-0">
                  <td className="py-2 pr-2 tabular">{c.rank}</td>
                  <td className="py-2 pr-2 font-semibold text-heading">{c.fullName}</td>
                  <td className="py-2 pr-2">{APPLICANT_TYPE_LABELS[c.applicantType]}</td>
                  <td className="py-2 pr-2 text-right tabular">{pct(c.matchingScore)}</td>
                  <td className="py-2 pr-2 text-right tabular">{pct(c.interviewScore)}</td>
                  <td className="py-2 pr-2 text-right font-semibold tabular">{pct(c.finalScore)}</td>
                  <td className="py-2">
                    {c.overallRating != null ? `${c.overallRating} — ${successProbabilityFor(c.interviewScore).label}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {candidates.map((c) => (
        <section
          key={c.itemId}
          aria-label={`Profile of ${c.fullName}`}
          className="flex flex-col gap-3 rounded-md border p-4 break-inside-avoid print:rounded-none"
        >
          <h2 className="text-card-title font-semibold">
            <span className="tabular">#{c.rank}</span> {c.fullName}
          </h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 print:grid-cols-3">
            <Fact label="Email">{c.email}</Fact>
            <Fact label="Contact number">{c.contactNumber}</Fact>
            <Fact label="Age">{c.age}</Fact>
            <Fact label="Gender">{GENDER[c.gender] ?? c.gender}</Fact>
            <Fact label="Education">{EDUCATION_LEVEL_LABELS[c.educationLevel]}</Fact>
            <Fact label="Group">{APPLICANT_TYPE_LABELS[c.applicantType]}</Fact>
            <div className="sm:col-span-3 print:col-span-3">
              <Fact label="Address">{c.address}</Fact>
            </div>
          </dl>
          <p className="text-body-sm">
            <span className="font-semibold">Matched skills:</span> {c.matchedSkills.join(", ") || "none"}
          </p>
          <p className="text-body-sm tabular">
            Matching {pct(c.matchingScore)} · Interview {pct(c.interviewScore)} · Final {pct(c.finalScore)}
          </p>
        </section>
      ))}
    </main>
  );
}
