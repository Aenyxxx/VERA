import { Building2, Eye, Pencil, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompanies } from "@/features/companies/api";
import { CompanyDetailSheet } from "@/features/companies/CompanyDetailSheet";
import { CompanyFormDialog } from "@/features/companies/CompanyFormDialog";
import { useDebounce } from "@/hooks/useDebounce";

/**
 * Company Management (FR-COMP-01..03): searchable table, add/edit dialog, detail drawer.
 * The drawer follows the URL (/admin/companies/:id), so a company link can be shared and Back closes it.
 */
export default function Companies() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim());
  const companies = useCompanies(debouncedSearch);
  // form = null (closed) or { companyId } (null = add); the key resets the form each time it opens
  const [form, setForm] = useState(null);
  const [formKey, setFormKey] = useState(0);

  function openForm(companyId = null) {
    setFormKey((key) => key + 1);
    setForm({ companyId });
  }

  const columns = [
    {
      id: "company",
      header: "Company",
      accessorFn: (row) => row.companyName,
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-heading">{row.original.companyName}</p>
          <p className="text-body-sm text-muted-foreground">{row.original.industry}</p>
        </div>
      ),
    },
    { id: "contact", header: "Contact person", accessorFn: (row) => row.contactPersonName },
    { id: "email", header: "Email", accessorFn: (row) => row.contactEmail },
    {
      id: "vacancies",
      header: "Vacancies",
      accessorFn: (row) => row.vacancyCount,
      cell: ({ row }) => <span className="tabular">{row.original.vacancyCount}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`View ${row.original.companyName}`}
            onClick={() => navigate(`/admin/companies/${row.original.companyId}`)}
          >
            <Eye aria-hidden="true" />
            View
          </Button>
          <Button variant="secondary" size="sm" aria-label={`Edit ${row.original.companyName}`} onClick={() => openForm(row.original.companyId)}>
            <Pencil aria-hidden="true" />
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Company Management"
        description="Client companies that request manpower from the agency."
        actions={
          <Button onClick={() => openForm()}>
            <Plus aria-hidden="true" />
            Add company
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          aria-label="Search company name"
          placeholder="Search company name"
          className="pl-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        data={companies.data?.data ?? []}
        isLoading={companies.isPending}
        isError={companies.isError}
        onRetry={companies.refetch}
        isFiltered={Boolean(debouncedSearch)}
        empty={{
          title: "No companies yet",
          description: "Add the first client company to start creating vacancies.",
          action: (
            <Button onClick={() => openForm()}>
              <Building2 aria-hidden="true" />
              Add company
            </Button>
          ),
        }}
      />

      <CompanyDetailSheet
        companyId={id}
        onClose={() => navigate("/admin/companies")}
        onEdit={(company) => openForm(company.companyId)}
      />

      {form && (
        <CompanyFormDialog key={formKey} open onOpenChange={(open) => !open && setForm(null)} companyId={form.companyId} />
      )}
    </>
  );
}
