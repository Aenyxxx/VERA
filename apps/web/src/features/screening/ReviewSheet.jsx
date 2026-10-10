import {
  APPLICATION_STATUS,
  DOCUMENT_TYPE_LABELS,
  DROP_REASON_LABELS,
  EDUCATION_LEVEL_LABELS,
  REQUEST_STATUS,
  REQUEST_STATUS_LABELS,
  REQUESTABLE_DOCUMENT_TYPES,
  VERIFICATION_STATUS,
} from "@vera/shared";
import { AlertCircle, CalendarClock, CheckCircle2, Eye, FilePlus2, History, Lock, Upload, XCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FieldError } from "@/components/shared/FieldError";
import { ScoreChip } from "@/components/shared/ScoreChip";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TONE_CLASSES } from "@/components/shared/tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { openSignedUrl } from "@/features/documents/api";
import { useReuseRatings } from "@/features/evaluations/api";
import { ScheduleInterviewDialog } from "@/features/interviews/ScheduleInterviewDialog";
import { formatBytes, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useDropApplication, useRequestDocument, useReviewApplication, useVerify, useWithdrawRequest } from "./api";

const selectClass =
  "h-11 w-full rounded-sm border border-input bg-card px-3 text-body outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const fullName = (a) => [a.firstName, a.middleName, a.lastName, a.suffix].filter(Boolean).join(" ");
const typeLabel = (doc) => (doc.label ? `${DOCUMENT_TYPE_LABELS[doc.documentType]} (${doc.label})` : DOCUMENT_TYPE_LABELS[doc.documentType]);

function Section({ title, children, action }) {
  return (
    <section className="flex flex-col gap-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-card-title font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-label-sm text-muted-foreground">{label}</dt>
      <dd className="text-body text-heading">{children || "—"}</dd>
    </div>
  );
}

/** "New upload to verify": re-uploaded or sent for a request, still pending (why fullyVerified went false). */
function NewUploadMarker() {
  return (
    <Badge className={cn("gap-1", TONE_CLASSES.warning)}>
      <Upload aria-hidden="true" />
      New upload to verify
    </Badge>
  );
}

/**
 * One file (resume or supporting document) with View and the verification actions. Actions only while the
 * application is in screening. Reject opens the remarks dialog; it never drops by itself (HR then requests or drops).
 */
function FileRow({ title, file, onView, actionsEnabled, onVerify, onReject, onRequestCopy, busy }) {
  const verified = file.verificationStatus === VERIFICATION_STATUS.VERIFIED;
  const rejected = file.verificationStatus === VERIFICATION_STATUS.REJECTED;
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body font-semibold text-heading">{title}</p>
          <p className="truncate text-body-sm text-muted-foreground">
            {file.fileName} · {formatBytes(file.fileSizeBytes)} · uploaded {formatDateTime(file.uploadedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge kind="verification" value={file.verificationStatus} />
          {file.newUpload && <NewUploadMarker />}
        </div>
      </div>
      {file.verificationRemarks && <p className="text-body-sm text-text">Remarks: {file.verificationRemarks}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={onView}>
          <Eye aria-hidden="true" />
          View
        </Button>
        {actionsEnabled && !verified && (
          <Button size="sm" onClick={onVerify} disabled={busy}>
            <CheckCircle2 aria-hidden="true" />
            Mark as verified
          </Button>
        )}
        {actionsEnabled && !rejected && (
          <Button variant="destructive" size="sm" onClick={onReject} disabled={busy}>
            <XCircle aria-hidden="true" />
            Reject
          </Button>
        )}
        {actionsEnabled && onRequestCopy && (
          <Button variant="secondary" size="sm" onClick={onRequestCopy} disabled={busy}>
            <FilePlus2 aria-hidden="true" />
            Request new copy
          </Button>
        )}
      </div>
    </li>
  );
}

function RejectDialog({ target, onClose, onConfirm, pending }) {
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Reject ${target.title}?`}
      description="The applicant's application stays in screening. Next, request a new copy or drop the application."
      confirmLabel="Reject"
      pending={pending}
      onConfirm={() => {
        if (!remarks.trim()) {
          setError("Say why the document is rejected.");
          return;
        }
        onConfirm(remarks.trim());
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reject-remarks">Remarks</Label>
        <Textarea
          id="reject-remarks"
          value={remarks}
          maxLength={500}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "reject-remarks-error" : undefined}
          onChange={(event) => {
            setRemarks(event.target.value);
            setError("");
          }}
        />
        <FieldError id="reject-remarks-error" message={error} />
      </div>
    </ConfirmDialog>
  );
}

function RequestDialog({ preset, documents, onClose, onConfirm, pending }) {
  const [documentType, setDocumentType] = useState(preset?.documentType ?? "");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const target = preset?.documentId ? documents.find((d) => d.documentId === preset.documentId) : null;

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={target ? `Request a new copy of ${typeLabel(target)}` : "Request a document"}
      description="The applicant is notified with your reason and a deadline (the agency's response deadline, 3 days by default). The due date is shown here after sending."
      confirmLabel="Send request"
      pending={pending}
      onConfirm={() => {
        const next = {};
        if (!documentType) next.documentType = "Choose a document type.";
        if (reason.trim().length < 3) next.reason = "Give the applicant a reason.";
        setErrors(next);
        if (Object.keys(next).length === 0) {
          onConfirm({ documentType, reason: reason.trim(), ...(target ? { targetDocumentId: target.documentId } : {}) });
        }
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="request-type">Document type</Label>
          <select
            id="request-type"
            className={selectClass}
            value={documentType}
            disabled={Boolean(target)}
            aria-invalid={Boolean(errors.documentType)}
            onChange={(event) => setDocumentType(event.target.value)}
          >
            <option value="">Select a document type</option>
            {REQUESTABLE_DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {DOCUMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <FieldError id="request-type-error" message={errors.documentType} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="request-reason">Reason (shown to the applicant)</Label>
          <Textarea
            id="request-reason"
            value={reason}
            maxLength={500}
            aria-invalid={Boolean(errors.reason)}
            aria-describedby={errors.reason ? "request-reason-error" : undefined}
            onChange={(event) => setReason(event.target.value)}
          />
          <FieldError id="request-reason-error" message={errors.reason} />
        </div>
        <p className="text-body-sm text-muted-foreground">The resume can't be requested during the sprint: reject it and drop the application instead.</p>
      </div>
    </ConfirmDialog>
  );
}

function DropDialog({ companyName, applicantName, onClose, onConfirm, pending, error }) {
  const [reason, setReason] = useState("failed_verification");
  const [remarks, setRemarks] = useState("");
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Drop ${applicantName}'s application?`}
      description={`This closes the application and the applicant can no longer apply to ${companyName}'s jobs. The next applicant in line moves up automatically.`}
      confirmLabel="Drop application"
      destructive
      pending={pending}
      error={error}
      onConfirm={() => onConfirm({ reason, remarks: remarks.trim() })}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="drop-reason">Reason (HR only; the applicant is told only that it closed)</Label>
          <select id="drop-reason" className={selectClass} value={reason} onChange={(event) => setReason(event.target.value)}>
            {Object.entries(DROP_REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="drop-remarks">Remarks (optional)</Label>
          <Textarea id="drop-remarks" value={remarks} maxLength={500} onChange={(event) => setRemarks(event.target.value)} />
        </div>
      </div>
    </ConfirmDialog>
  );
}

const IN_INTERVIEW = [APPLICATION_STATUS.INTERVIEW_SCHEDULED, APPLICATION_STATUS.INTERVIEW_CONFIRMED];

/** The stored result once evaluated or computed from reused ratings (S14), with a link to the evaluation page. */
function EvaluationResult({ data }) {
  const { evaluation } = data;
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ScoreChip kind="interview" value={evaluation.interviewScore} />
        <ScoreChip kind="final" value={evaluation.finalScore} />
        <Badge className={evaluation.passed ? TONE_CLASSES.success : TONE_CLASSES.error}>
          {evaluation.passed ? "Passed" : "Did not pass"}
        </Badge>
      </div>
      <p className="text-body-sm text-muted-foreground">
        {evaluation.reused ? "Computed from reused ratings (no interview)." : "From the interview evaluation."}
      </p>
      <Link
        to={`/admin/interviews/${data.vacancy.vacancyId}/${data.application.applicationId}`}
        className="font-semibold text-primary hover:underline"
      >
        View evaluation
      </Link>
    </div>
  );
}

/**
 * After full verification (FR-SCR-06): Schedule interview (S13), or for ratings on file (BR-21) Compute final
 * score (S14). Once scheduled, the interview is managed elsewhere; once scored, the result is shown.
 */
function NextStep({ data, onSchedule, onComputeReused }) {
  if (data.evaluation) return <EvaluationResult data={data} />;
  if (IN_INTERVIEW.includes(data.application.status)) {
    return (
      <p className="text-body-sm text-text">
        Interview scheduled. Edit the time or mark a no-show in{" "}
        <Link to="/admin/interviews" className="font-semibold text-primary hover:underline">
          Interviews Assessment
        </Link>
        .
      </p>
    );
  }
  if (data.application.status !== APPLICATION_STATUS.SHORTLISTED) return null;
  if (!data.fullyVerified) {
    return (
      <p className="text-body-sm text-muted-foreground">
        Next step opens when the resume and every document are verified and no request is pending.
      </p>
    );
  }
  if (data.nextStep === "reuse_ratings") {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <Button aria-describedby="next-step-caption" onClick={onComputeReused}>
          <History aria-hidden="true" />
          Compute final score (reused ratings)
        </Button>
        <p id="next-step-caption" className="text-body-sm text-muted-foreground">
          Applicants with ratings on file are not interviewed again: their earlier ratings count with this vacancy&apos;s section weights.
        </p>
      </div>
    );
  }
  return (
    <Button className="self-start" onClick={onSchedule}>
      <CalendarClock aria-hidden="true" />
      Schedule interview
    </Button>
  );
}

/**
 * Applicant review sheet (FR-SCR-02..06, UI_GUIDELINES §6 HR pp.16–17): profile, matching details, resume and
 * documents with verification actions, document requests, the gated next step, and Drop.
 * Full width on phones, 480px drawer from the sm breakpoint.
 */
export function ReviewSheet({ applicationId, onClose }) {
  const review = useReviewApplication(applicationId);
  const verify = useVerify();
  const requestDocument = useRequestDocument();
  const withdraw = useWithdrawRequest();
  const drop = useDropApplication();
  const [rejecting, setRejecting] = useState(null); // { kind, id, title }
  const [requesting, setRequesting] = useState(null); // {} or { documentType, documentId }
  const [dropping, setDropping] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [computing, setComputing] = useState(false);
  const reuse = useReuseRatings();

  const data = review.data;
  const inScreening = data?.application.status === APPLICATION_STATUS.SHORTLISTED;
  const busy = verify.isPending || requestDocument.isPending || withdraw.isPending;

  function runVerify(kind, id, status, remarks) {
    verify.mutate(
      { kind, id, status, remarks, applicationId },
      {
        onSuccess: () => {
          toast.success(status === VERIFICATION_STATUS.VERIFIED ? "Marked as verified" : "Rejected");
          setRejecting(null);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Sheet open={Boolean(applicationId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[480px]">
        <SheetHeader className="px-4 pt-6 sm:px-6">
          <SheetTitle className="pr-8 text-section-title font-bold text-heading">
            {data ? fullName(data.applicant) : "Applicant review"}
          </SheetTitle>
          <SheetDescription>{data ? `${data.vacancy.jobTitle} · ${data.vacancy.companyName}` : "Loading the application"}</SheetDescription>
        </SheetHeader>

        {review.isPending && applicationId && (
          <div className="flex flex-col gap-3 px-4 sm:px-6" aria-busy="true">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {review.isError && (
          <div className="px-4 sm:px-6">
            <EmptyState
              icon={AlertCircle}
              title={review.error.status === 404 ? "Application not found" : "The application could not be loaded"}
              description={review.error.message}
              action={review.error.status !== 404 && <Button onClick={() => review.refetch()}>Try again</Button>}
            />
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-4 px-4 pb-6 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge kind="application" value={data.application.status} />
              {data.application.locked && (
                <Badge className={cn("gap-1", TONE_CLASSES.neutral)}>
                  <Lock aria-hidden="true" />
                  Locked
                </Badge>
              )}
              {data.reusableEvaluation && (
                <Badge className={cn("gap-1", TONE_CLASSES.info)}>
                  <History aria-hidden="true" />
                  Ratings on file
                </Badge>
              )}
            </div>
            {data.reusableEvaluation && (
              <p className="text-body-sm text-text">
                Ratings on file from {data.reusableEvaluation.jobTitle} ({data.reusableEvaluation.companyName}),{" "}
                {formatDateTime(data.reusableEvaluation.ratedAt)}. This applicant is not interviewed again.
              </p>
            )}
            {!inScreening && (
              <p role="status" className="rounded-sm bg-surface-subtle px-3 py-2 text-body-sm text-muted-foreground">
                This application is no longer in screening, so verification actions are closed.
              </p>
            )}

            <Section title="Applicant">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Fact label="Email">{data.applicant.email}</Fact>
                <Fact label="Contact number">{data.applicant.contactNumber}</Fact>
                <Fact label="Age">{data.applicant.age}</Fact>
                <Fact label="Gender">{data.applicant.gender}</Fact>
                <Fact label="Education">{EDUCATION_LEVEL_LABELS[data.applicant.educationLevel]}</Fact>
                <Fact label="Height">{data.applicant.heightCm ? `${data.applicant.heightCm} cm` : null}</Fact>
                <Fact label="Address">
                  {[data.applicant.addressLine, data.applicant.city, data.applicant.province].filter(Boolean).join(", ")}
                </Fact>
              </dl>
            </Section>

            <Section title="Matching details">
              {data.matching ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <ScoreChip kind="resume" value={data.matching.matchingScore} />
                    <span className="text-body-sm text-muted-foreground">
                      Skills {data.matching.skillsScore}% · Experience {data.matching.experienceScore}% · weights{" "}
                      {data.matching.weights.skills}/{data.matching.weights.experience}
                    </span>
                  </div>
                  <p className="text-body-sm">
                    <span className="font-semibold">Matched:</span> {data.matching.matchedSkills.join(", ") || "none"}
                  </p>
                  <p className="text-body-sm">
                    <span className="font-semibold">Missing:</span> {data.matching.missingSkills.join(", ") || "none"}
                  </p>
                </div>
              ) : (
                <p className="text-body-sm text-muted-foreground">No matching result (prescreen failed).</p>
              )}
            </Section>

            <Section title="Resume">
              {data.resume ? (
                <ul>
                  <FileRow
                    title="Resume"
                    file={data.resume}
                    actionsEnabled={inScreening}
                    busy={busy}
                    onView={() => openSignedUrl(`/admin/applications/${applicationId}/resume/url`)}
                    onVerify={() => runVerify("resume", data.resume.resumeId, VERIFICATION_STATUS.VERIFIED)}
                    onReject={() => setRejecting({ kind: "resume", id: data.resume.resumeId, title: "the resume" })}
                  />
                </ul>
              ) : (
                <p className="text-body-sm text-muted-foreground">No current resume.</p>
              )}
            </Section>

            <Section
              title={`Supporting documents · ${data.documents.length}`}
              action={
                inScreening && (
                  <Button variant="secondary" size="sm" onClick={() => setRequesting({})} disabled={busy}>
                    <FilePlus2 aria-hidden="true" />
                    Request a document
                  </Button>
                )
              }
            >
              {data.documents.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">No supporting documents. Request any that the client needs.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.documents.map((doc) => (
                    <FileRow
                      key={doc.documentId}
                      title={typeLabel(doc)}
                      file={doc}
                      actionsEnabled={inScreening}
                      busy={busy}
                      onView={() => openSignedUrl(`/admin/applications/${applicationId}/documents/${doc.documentId}/url`)}
                      onVerify={() => runVerify("document", doc.documentId, VERIFICATION_STATUS.VERIFIED)}
                      onReject={() => setRejecting({ kind: "document", id: doc.documentId, title: typeLabel(doc) })}
                      onRequestCopy={() => setRequesting({ documentType: doc.documentType, documentId: doc.documentId })}
                    />
                  ))}
                </ul>
              )}
            </Section>

            <Section title={`Requests · ${data.requests.filter((r) => r.status === REQUEST_STATUS.PENDING).length} pending`}>
              {data.requests.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">No document requests.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.requests.map((r) => (
                    <li key={r.requestId} className="flex flex-col gap-1 rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-body font-semibold text-heading">{DOCUMENT_TYPE_LABELS[r.documentType]}</p>
                        <Badge className={TONE_CLASSES[REQUEST_STATUS_LABELS[r.status].tone]}>{REQUEST_STATUS_LABELS[r.status].label}</Badge>
                      </div>
                      <p className="text-body-sm text-text">{r.reason}</p>
                      <p className="text-body-sm text-muted-foreground">Due {formatDateTime(r.dueAt)} (Philippine time)</p>
                      {r.status === REQUEST_STATUS.PENDING && inScreening && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="self-start"
                          disabled={busy}
                          onClick={() =>
                            withdraw.mutate(r.requestId, {
                              onSuccess: () => toast.success("Request withdrawn"),
                              onError: (error) => toast.error(error.message),
                            })
                          }
                        >
                          Withdraw request
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Next step">
              <NextStep
                data={data}
                onSchedule={() => setScheduling(true)}
                onComputeReused={() => {
                  reuse.reset();
                  setComputing(true);
                }}
              />
              {inScreening && (
                <Button variant="destructive" className="self-start" onClick={() => setDropping(true)}>
                  Drop application
                </Button>
              )}
            </Section>
          </div>
        )}

        {rejecting && (
          <RejectDialog
            target={rejecting}
            pending={verify.isPending}
            onClose={() => setRejecting(null)}
            onConfirm={(remarks) => runVerify(rejecting.kind, rejecting.id, VERIFICATION_STATUS.REJECTED, remarks)}
          />
        )}
        {requesting && data && (
          <RequestDialog
            preset={requesting}
            documents={data.documents}
            pending={requestDocument.isPending}
            onClose={() => setRequesting(null)}
            onConfirm={(body) =>
              requestDocument.mutate(
                { applicationId, ...body },
                {
                  onSuccess: () => {
                    toast.success("Request sent");
                    setRequesting(null);
                  },
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          />
        )}
        {scheduling && data && (
          <ScheduleInterviewDialog
            open
            onOpenChange={(open) => !open && setScheduling(false)}
            applicationId={applicationId}
            applicantName={fullName(data.applicant)}
            jobTitle={data.vacancy.jobTitle}
            onDone={() => {
              setScheduling(false);
              onClose(); // the application left screening (interview_scheduled)
            }}
          />
        )}
        {computing && data?.reusableEvaluation && (
          <ConfirmDialog
            open
            onOpenChange={(open) => !open && setComputing(false)}
            title={`Compute the final score for ${fullName(data.applicant)}?`}
            description={`Uses the 15 ratings from ${data.reusableEvaluation.jobTitle} (${data.reusableEvaluation.companyName}), ${formatDateTime(data.reusableEvaluation.ratedAt)}, with ${data.vacancy.jobTitle}'s section weights, and this application's matching score. There is no interview. The result is final: below the passing score, the application closes and the applicant can no longer apply to ${data.vacancy.companyName}'s jobs.`}
            confirmLabel="Compute final score"
            pending={reuse.isPending}
            error={reuse.error?.message}
            onConfirm={() =>
              reuse.mutate(applicationId, {
                onSuccess: (result) => {
                  toast.success(`Final score ${Number(result.finalScore).toFixed(2)}%: ${result.passed ? "passed" : "did not pass"}`);
                  setComputing(false);
                },
              })
            }
          />
        )}
        {dropping && data && (
          <DropDialog
            companyName={data.vacancy.companyName}
            applicantName={fullName(data.applicant)}
            pending={drop.isPending}
            error={drop.error?.message}
            onClose={() => setDropping(false)}
            onConfirm={(body) =>
              drop.mutate(
                { applicationId, ...body },
                {
                  onSuccess: () => {
                    toast.success("Application dropped");
                    setDropping(false);
                    onClose();
                  },
                },
              )
            }
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
