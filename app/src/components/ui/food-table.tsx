import { Box, chakra } from "@chakra-ui/react";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

export function Dash() {
  return (
    <chakra.span color="fg.muted" userSelect="none" aria-hidden="true">
      —
    </chakra.span>
  );
}

export function formatNutritionAmount(
  value: number | null | undefined,
  unit: string,
  digits = 1,
): ReactNode {
  if (value == null || !Number.isFinite(value)) return <Dash />;
  return (
    <chakra.span
      fontFamily="mono"
      fontFeatureSettings="'tnum' 1"
      whiteSpace="nowrap"
      textStyle="numeric.sm"
    >
      {value.toLocaleString("ja-JP", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
      })}{" "}
      <chakra.span color="fg.muted" fontSize="xs">
        {unit}
      </chakra.span>
    </chakra.span>
  );
}

export function formatPrice(value: number | null | undefined): ReactNode {
  if (value == null || !Number.isFinite(value)) return <Dash />;
  return (
    <chakra.span
      fontFamily="mono"
      fontFeatureSettings="'tnum' 1"
      whiteSpace="nowrap"
      textStyle="numeric.sm"
      fontWeight="medium"
    >
      ¥{Math.round(value).toLocaleString("ja-JP")}
    </chakra.span>
  );
}

export function InventiaIconLink({
  itemId,
  baseUrl = "https://inventia.nikomaru.dev",
}: {
  itemId: string | null | undefined;
  baseUrl?: string;
}) {
  if (!itemId) return <Dash />;
  const href = `${baseUrl.replace(/\/+$/, "")}/inventory/items/${encodeURIComponent(itemId)}`;
  return (
    <chakra.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Inventia で開く: ${itemId}`}
      aria-label={`Inventia で開く: ${itemId}`}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      w="7"
      h="7"
      borderRadius="sm"
      color="fg.muted"
      _hover={{ color: "fg.subtle", bg: "bg.muted" }}
      transition="colors 0.15s ease"
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink size={15} />
    </chakra.a>
  );
}

export interface TableFrameProps {
  busy?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  head: ReactNode;
  children: ReactNode;
}

export function TableFrame({
  busy,
  empty,
  emptyMessage = "データがありません。",
  head,
  children,
}: TableFrameProps) {
  return (
    <Box
      w="full"
      overflowX="auto"
      border="1px solid"
      borderColor="border"
      borderRadius="md"
      bg="bg.panel"
    >
      <chakra.table
        w="full"
        borderCollapse="separate"
        borderSpacing="0"
        aria-busy={busy}
        style={{ minWidth: "760px" }}
      >
        <chakra.thead
          position="sticky"
          top="0"
          zIndex="1"
          bg="bg.subtle"
          backdropFilter="blur(8px)"
        >
          {head}
        </chakra.thead>
        <chakra.tbody>
          {empty ? (
            <chakra.tr>
              <chakra.td colSpan={10} p="8" textAlign="center" color="fg.muted" fontSize="sm">
                {emptyMessage}
              </chakra.td>
            </chakra.tr>
          ) : (
            children
          )}
        </chakra.tbody>
      </chakra.table>
    </Box>
  );
}

export interface FoodHeaderCellProps {
  children: ReactNode;
  align?: "left" | "right" | "center";
  width?: string | number;
}

export function FoodHeaderCell({ children, align = "left", width }: FoodHeaderCellProps) {
  return (
    <chakra.th
      scope="col"
      h="9"
      px="3"
      py="1.5"
      textAlign={align}
      borderBottom="1px solid"
      borderColor="border"
      textStyle="caption"
      color="fg.muted"
      fontWeight="semibold"
      whiteSpace="nowrap"
      w={width}
    >
      {children}
    </chakra.th>
  );
}

export interface FoodBodyCellProps {
  children: ReactNode;
  align?: "left" | "right" | "center";
  width?: string | number;
}

export function FoodBodyCell({ children, align = "left", width }: FoodBodyCellProps) {
  return (
    <chakra.td
      px="3"
      py="2.5"
      textAlign={align}
      borderBottom="1px solid"
      borderColor="border.muted"
      fontSize="sm"
      w={width}
      whiteSpace={align === "left" ? "normal" : "nowrap"}
    >
      {children}
    </chakra.td>
  );
}
