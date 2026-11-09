import { Badge, Flex, Stack, chakra } from "@chakra-ui/react";
import { PackageMinus, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";

import { stockStatusName, type StockStatus } from "./meal-shared";

export interface MealStockPanelProps {
  status: StockStatus | null | undefined;
  /** 自炊のときだけ在庫を消費できる。 */
  selfCooked: boolean;
  working?: boolean;
  error?: string;
  onConsume?(): void;
}

const statusPalette: Record<StockStatus, "amber" | "green" | "red"> = {
  pending: "amber",
  succeeded: "green",
  failed: "red",
};

/**
 * Inventia の在庫消費の状態と操作。
 */
export function MealStockPanel({
  status,
  selfCooked,
  working,
  error,
  onConsume,
}: MealStockPanelProps) {
  const busy = working || status === "pending";
  return (
    <Stack gap="4">
      <Flex justify="space-between" align="center" gap="3" wrap="wrap">
        <chakra.span textStyle="body.sm" color="fg.muted">
          状態
        </chakra.span>
        <Badge colorPalette={status ? statusPalette[status] : "navy"}>
          {status ? stockStatusName[status] : "未実行"}
        </Badge>
      </Flex>
      {selfCooked ? (
        status === "succeeded" ? null : (
          <Button
            variant="secondary"
            size="sm"
            alignSelf="flex-start"
            loading={busy}
            disabled={busy || !onConsume}
            onClick={onConsume}
          >
            {status === "failed" ? (
              <RotateCw strokeWidth={1.75} />
            ) : (
              <PackageMinus strokeWidth={1.75} />
            )}
            {status === "failed" ? "在庫消費を再試行" : "在庫を消費する"}
          </Button>
        )
      ) : (
        <chakra.p textStyle="body.sm" color="fg.muted">
          自炊の記録のみ在庫を消費できます
        </chakra.p>
      )}
      {error ? <Feedback tone="error">{error}</Feedback> : null}
    </Stack>
  );
}
