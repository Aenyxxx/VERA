import { APPLICATION_STATUS } from "@vera/shared";
import { Info } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

/** Why Apply is unavailable (BR-17): one ongoing application at a time; hired blocks until training_failed. */
function ongoingMessage(blocking) {
  return blocking.status === APPLICATION_STATUS.HIRED
    ? `You are hired as ${blocking.jobTitle}, so you cannot apply to another job.`
    : `You have an ongoing application for ${blocking.jobTitle}. You can apply to another job once it is finished.`;
}

/** Info banner on the job list and job detail while the applicant cannot apply. */
export function OngoingApplicationNotice({ blocking, className }) {
  return (
    <div role="status" className={cn("flex items-start gap-3 rounded-md border border-info/30 bg-info-soft p-4", className)}>
      <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
      <p className="text-body text-text">
        {ongoingMessage(blocking)}{" "}
        <Link to="/applicant" className="font-semibold text-primary hover:underline">
          See your application
        </Link>
      </p>
    </div>
  );
}
