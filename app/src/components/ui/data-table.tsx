import { Box, chakra, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { dataTable } from "../../../theme/slot-recipes/data-table";

export interface DataTableProps {
  columns: readonly ReactNode[];
  children: ReactNode;
  label?: string;
}

/**
 * 一覧の表。罫線・文字サイズはレシピ側で決める。
 */
export function DataTable({ columns, children, label }: DataTableProps) {
  const recipe = useSlotRecipe({ recipe: dataTable });
  const styles = recipe();

  return (
    <Box css={styles.root}>
      <chakra.table aria-label={label} css={styles.table}>
        <chakra.thead css={styles.head}>
          <chakra.tr>
            {columns.map((column, index) => (
              <chakra.th key={index} scope="col" css={styles.headerCell}>
                {column}
              </chakra.th>
            ))}
          </chakra.tr>
        </chakra.thead>
        <chakra.tbody css={styles.body}>{children}</chakra.tbody>
      </chakra.table>
    </Box>
  );
}

export interface DataTableRowProps {
  children: ReactNode;
}

export function DataTableRow({ children }: DataTableRowProps) {
  const recipe = useSlotRecipe({ recipe: dataTable });
  const styles = recipe();

  return <chakra.tr css={styles.row}>{children}</chakra.tr>;
}

export interface DataTableCellProps {
  numeric?: boolean;
  children: ReactNode;
}

export function DataTableCell({ numeric = false, children }: DataTableCellProps) {
  const recipe = useSlotRecipe({ recipe: dataTable });
  const styles = recipe();

  return <chakra.td css={numeric ? styles.cellNumeric : styles.cell}>{children}</chakra.td>;
}
