import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AlertCircle, ArrowDown, ArrowUp, ChevronsUpDown, SearchX } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { EmptyState } from "./EmptyState";

/**
 * TanStack Table + shadcn table with sorting, client pagination, and loading / empty / no-match / error states.
 * @param {object} props
 * @param {import("@tanstack/react-table").ColumnDef[]} props.columns
 * @param {object[]} [props.data]
 * @param {boolean} [props.isLoading]
 * @param {boolean} [props.isError]
 * @param {() => void} [props.onRetry]
 * @param {boolean} [props.isFiltered] a search/filter is active (empty result = "no match", not "empty")
 * @param {{ title: string, description?: string, action?: React.ReactNode }} [props.empty]
 */
export function DataTable({ columns, data = [], isLoading, isError, onRetry, isFiltered, empty, pageSize = 10 }) {
  const [sorting, setSorting] = useState([]);
  // TanStack Table returns functions that cannot be memoized; this is expected with useReactTable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  if (isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="This list could not be loaded"
        description="Check your connection and try again."
        action={onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
      />
    );
  }

  if (!isLoading && data.length === 0) {
    return isFiltered ? (
      <EmptyState icon={SearchX} title="No matches" description="Try a different search or clear the filters." />
    ) : (
      <EmptyState title={empty?.title ?? "Nothing here yet"} description={empty?.description} action={empty?.action} />
    );
  }

  const { pageIndex } = table.getState().pagination;
  const first = pageIndex * pageSize + 1;
  const last = Math.min(first + pageSize - 1, data.length);

  return (
    <div className="rounded-md border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="bg-surface-subtle hover:bg-surface-subtle">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
                  return (
                    <TableHead key={header.id} className="h-10 text-label-sm font-semibold text-heading">
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon className="size-3.5" aria-hidden="true" />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j} className="h-12">
                        <Skeleton className="h-4 w-3/4" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="h-12 hover:bg-surface-blue">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
      {!isLoading && data.length > pageSize && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-body-sm text-muted-foreground">
          <span className="tabular">
            Showing {first}–{last} of {data.length}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
