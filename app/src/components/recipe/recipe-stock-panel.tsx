import { Badge, Flex, Stack, chakra } from "@chakra-ui/react";
import { PackageMinus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";

export interface RecipeStockConsumptionResult {
  ingredientId: string;
  ingredientName: string;
  inventiaItemId: string;
  consumedAmount: number;
  unit: string;
  currentQuantity: number;
}

export interface RecipeStockPanelProps {
  /** 消費する人前数。 */
  servings: number;
  working?: boolean;
  /** 直近の在庫消費の結果。未実行なら null / undefined。 */
  results?: readonly RecipeStockConsumptionResult[] | null;
  error?: string;
  onConsume?(): void;
}

/**
 * レシピの材料を Inventia 在庫から消費する操作と結果を表示するパネル。
 */
export function RecipeStockPanel({
  servings,
  working,
  results,
  error,
  onConsume,
}: RecipeStockPanelProps) {
  return (
    <Stack gap="4">
      <Button
        variant="secondary"
        size="sm"
        alignSelf="flex-start"
        loading={working}
        disabled={working || !onConsume}
        onClick={onConsume}
      >
        <PackageMinus strokeWidth={1.75} />
        {servings}人前の在庫を消費する
      </Button>

      {error ? <Feedback tone="error">{error}</Feedback> : null}

      {results ? (
        results.length === 0 ? (
          <chakra.p textStyle="body.sm" color="fg.muted">
            Inventia に紐付いた材料がありませんでした。
          </chakra.p>
        ) : (
          <Stack as="ul" gap="2" listStyle="none" m="0" p="0">
            {results.map((item) => (
              <Flex
                as="li"
                key={item.ingredientId}
                justify="space-between"
                align="baseline"
                gap="3"
                py="1.5"
                borderBottomWidth="1px"
                borderColor="border.subtle"
              >
                <chakra.span textStyle="body.sm" color="fg" minW="0" truncate>
                  {item.ingredientName}
                </chakra.span>
                <Flex align="center" gap="2" shrink={0} fontVariantNumeric="tabular-nums">
                  <chakra.span textStyle="body.sm" color="fg.muted">
                    -{item.consumedAmount}
                    {item.unit}
                  </chakra.span>
                  <Badge colorPalette="green">
                    残 {item.currentQuantity}
                    {item.unit}
                  </Badge>
                </Flex>
              </Flex>
            ))}
          </Stack>
        )
      ) : null}
    </Stack>
  );
}
