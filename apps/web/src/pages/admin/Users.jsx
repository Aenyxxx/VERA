import { ACCOUNT_STATUS, ROLE_LABELS } from "@vera/shared";
import { Plus, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { TONE_CLASSES } from "@/components/shared/tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSetAccountStatus, useStaffUsers } from "@/features/users/api";
import { CreateHrDialog } from "@/features/users/CreateHrDialog";
import { formatDateTime } from "@/lib/format";

const STATUS_LOOK = {
  [ACCOUNT_STATUS.ACTIVE]: { label: "Active", tone: "success" },
  [ACCOUNT_STATUS.INACTIVE]: { label: "Inactive", tone: "neutral" },
};

/**
 * User Management (decision 19, PRD FR-AUTH-07 / FR-ADM-04; admin only): staff accounts, Add HR account, and
 * Deactivate / Activate. Nobody deactivates their own row (the API also refuses it and the last active admin).
 */
export default function Users() {
  const users = useStaffUsers();
  const setStatus = useSetAccountStatus();
  const [creating, setCreating] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [target, setTarget] = useState(null); // the row being activated or deactivated

  function openCreate() {
    setCreateKey((key) => key + 1);
    setCreating(true);
  }

  function openStatus(row) {
    setStatus.reset();
    setTarget(row);
  }

  const deactivating = target?.accountStatus === ACCOUNT_STATUS.ACTIVE;
  const name = target?.fullName || target?.email;

  function confirmStatus() {
    const accountStatus = deactivating ? ACCOUNT_STATUS.INACTIVE : ACCOUNT_STATUS.ACTIVE;
    setStatus.mutate(
      { userId: target.userId, accountStatus },
      {
        onSuccess: (result) => {
          if (accountStatus === ACCOUNT_STATUS.ACTIVE) toast.success(`${name} can sign in again`);
          else if (result.signInBlocked) toast.success(`${name} can no longer sign in`);
          else toast.warning(`${name} is deactivated in VERA, but the sign-in block failed. Press Deactivate again.`);
          setTarget(null);
        },
      },
    );
  }

  const columns = [
    {
      id: "name",
      header: "Name",
      accessorFn: (row) => row.fullName ?? row.email,
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-heading">
            {row.original.fullName ?? "—"}
            {row.original.isSelf && <span className="ml-2 text-body-sm font-normal text-muted-foreground">(you)</span>}
          </p>
          <p className="text-body-sm text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    { id: "role", header: "Role", accessorFn: (row) => ROLE_LABELS[row.role] ?? row.role },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => row.accountStatus,
      cell: ({ row }) => {
        const look = STATUS_LOOK[row.original.accountStatus];
        return <Badge className={TONE_CLASSES[look.tone]}>{look.label}</Badge>;
      },
    },
    {
      id: "lastSignIn",
      header: "Last sign-in",
      accessorFn: (row) => row.lastSignInAt,
      cell: ({ row }) => <span className="tabular">{row.original.lastSignInAt ? formatDateTime(row.original.lastSignInAt) : "Never"}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.isSelf ? null : (
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => openStatus(row.original)}>
              {row.original.accountStatus === ACCOUNT_STATUS.ACTIVE ? "Deactivate" : "Activate"}
            </Button>
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="User Management"
        description="Admin and HR accounts. HR staff cannot register by themselves; add them here."
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" />
            Add HR account
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={users.data ?? []}
        isLoading={users.isPending}
        isError={users.isError}
        onRetry={users.refetch}
        empty={{
          title: "No staff accounts",
          description: "Add the first HR account.",
          action: (
            <Button onClick={openCreate}>
              <UserCog aria-hidden="true" />
              Add HR account
            </Button>
          ),
        }}
      />

      {creating && <CreateHrDialog key={createKey} open={creating} onOpenChange={setCreating} />}

      {target && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setTarget(null)}
          title={deactivating ? `Deactivate ${name}?` : `Activate ${name}?`}
          description={
            deactivating
              ? `${name} can no longer sign in. Their past work stays in VERA.`
              : `${name} can sign in again with their current password.`
          }
          confirmLabel={deactivating ? "Deactivate" : "Activate"}
          destructive={deactivating}
          pending={setStatus.isPending}
          error={setStatus.error?.message}
          onConfirm={confirmStatus}
        />
      )}
    </>
  );
}
