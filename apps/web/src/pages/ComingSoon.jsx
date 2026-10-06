import { Construction } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

/** Placeholder for routes whose screen is built in a later sprint slice (ROADMAP §4). */
export default function ComingSoon({ title, slice }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={Construction}
        title="This page is being built"
        description={slice ? `It arrives with roadmap slice ${slice}.` : undefined}
      />
    </>
  );
}
