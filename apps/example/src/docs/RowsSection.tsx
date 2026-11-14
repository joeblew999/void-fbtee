// A section of the Intl or Temporal page: a table of calls, each call's code across the columns and
// its results in the row below, one cell per side. A row whose sides disagree is highlighted. The
// browser tests read data-section, data-row, data-side and data-differs.
import { Fragment, type ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { cn } from "@/ui/utils";
import { DIFFERS_ROW } from "@/docs/differs";

export interface Row {
  key: string;
  code: string;
  differs: boolean;
  cells: { side: string; dir: string; content: ReactNode }[];
}

export function RowsSection({
  id,
  title,
  heads,
  cell,
  rows,
}: {
  id: string;
  title: ReactNode;
  /** The column headings, each with its own classes if any. */
  heads: { label: ReactNode; className?: string }[];
  /** The classes of every cell. */
  cell: string;
  rows: Row[];
}) {
  return (
    <section id={id} data-section={id} className="scroll-mt-20 pt-6">
      <h2 className="border-b pb-2 text-2xl font-medium">{title}</h2>
      <div className="mt-2">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              {heads.map((h, i) => (
                <TableHead key={i} className={h.className}>
                  {h.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <Fragment key={row.key}>
                {/* The call, across every column; its results in the row below. */}
                <TableRow className="border-b-0 hover:bg-transparent">
                  <TableCell colSpan={heads.length} dir="ltr" className={cn(cell, "pt-3 pb-0")}>
                    <code className="font-mono text-xs text-muted-foreground">{row.code}</code>
                  </TableCell>
                </TableRow>
                <TableRow
                  data-row={row.key}
                  className={row.differs ? DIFFERS_ROW : undefined}
                  data-differs={row.differs || undefined}
                >
                  {row.cells.map((c) => (
                    <TableCell key={c.side} className={cell} data-side={c.side} dir={c.dir}>
                      {c.content}
                    </TableCell>
                  ))}
                </TableRow>
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
