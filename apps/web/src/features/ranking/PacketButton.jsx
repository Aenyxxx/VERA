import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { saveFile } from "@/lib/apiClient";

import { downloadPacket } from "./api";

/**
 * Decisions 21, 33: one PDF per passed applicant (competency evaluation + the application's own resume), built on
 * request and downloaded from the Ranking tab.
 */
export function PacketButton({ row }) {
  const [pending, setPending] = useState(false);
  async function download() {
    setPending(true);
    try {
      saveFile(await downloadPacket(row.applicationId));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" disabled={pending} aria-label={`Download ${row.applicantName}'s endorsement packet`} onClick={download}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
      Download
    </Button>
  );
}
