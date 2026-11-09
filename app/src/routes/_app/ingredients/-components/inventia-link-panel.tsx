import { Badge, Box, Flex, HStack, Stack, Text, chakra } from "@chakra-ui/react";
import { type KeyboardEvent, useState } from "react";

import { SubHeading } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { InventiaIconLink } from "@/components/ui/data-table";
import { Feedback } from "@/components/ui/feedback";
import { NumberField } from "@/components/ui/number-field";
import { SearchInput } from "@/components/ui/search-input";
import type { Ingredient } from "@/domain/ingredient";
import { formatDateJa, formatNumber } from "@/lib/format";

import { basisLabel, dimensionLabels, formatBasisPrice } from "./ingredient-form";

export interface InventiaItem {
  id: string;
  name: string;
  baseUnit: string;
  baseDimension: Ingredient["baseDimension"];
  currentQuantity: number;
}

export interface StockResult {
  found: boolean;
  currentQuantity: number | null;
  baseUnit: string | null;
}

export interface InventiaActions {
  search(query: string): Promise<InventiaItem[]>;
  /** 品目を紐付けて価格を同期する。synced=false は価格記録なし。 */
  link(ingredientId: string, itemId: string): Promise<{ synced: boolean }>;
  readStock(ingredientId: string): Promise<StockResult>;
  consumeStock(
    ingredientId: string,
    amount: number,
    idempotencyKey: string,
  ): Promise<{ currentQuantity: number }>;
}

export interface InventiaLinkPanelProps {
  ingredient: Ingredient;
  actions: InventiaActions;
  /** ストーリー用の初期状態。 */
  initialMatches?: InventiaItem[];
  initialStock?: StockResult;
}

type Busy = "" | "search" | "stock" | "consume" | `link:${string}`;

const messageOf = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback;

/**
 * Inventia との連携欄。品目の検索・紐付け (価格同期)・在庫の確認と消費。
 * 保存フォームの中に置くため、Enter で外側のフォームを送信しないようにしている。
 */
export function InventiaLinkPanel({
  ingredient,
  actions,
  initialMatches,
  initialStock,
}: InventiaLinkPanelProps) {
  const [query, setQuery] = useState(ingredient.name);
  const [matches, setMatches] = useState<InventiaItem[] | null>(initialMatches ?? null);
  const [stock, setStock] = useState<StockResult | null>(initialStock ?? null);
  const [amount, setAmount] = useState("");
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const linked = Boolean(ingredient.inventiaItemId);
  const stockUnit = stock?.baseUnit ?? ingredient.baseUnit;

  async function run(kind: Busy, task: () => Promise<void>, fallback: string) {
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (cause) {
      setError(messageOf(cause, fallback));
    } finally {
      setBusy("");
    }
  }

  const search = () =>
    run(
      "search",
      async () => {
        if (!query.trim()) throw new Error("検索語を入力してください。");
        setMatches(await actions.search(query.trim()));
      },
      "Inventia を検索できませんでした。",
    );

  const link = (item: InventiaItem) =>
    run(
      `link:${item.id}`,
      async () => {
        const result = await actions.link(ingredient.id, item.id);
        setMatches(null);
        setStock(null);
        if (!result.synced) setNotice("紐付けました。価格の記録はまだありません。");
      },
      "価格を同期できませんでした。",
    );

  const readStock = () =>
    run(
      "stock",
      async () => {
        const result = await actions.readStock(ingredient.id);
        setStock(result);
        if (!result.found) setNotice("Inventia で紐付け先の品目が見つかりません。");
      },
      "在庫を取得できませんでした。",
    );

  const consume = () =>
    run(
      "consume",
      async () => {
        const value = Number(amount);
        if (!Number.isInteger(value) || value <= 0)
          throw new Error("消費量は1以上の整数で入力してください。");
        // 再送時に二重消費しないよう、成功するまで同じキーを使う
        const key = requestKey ?? crypto.randomUUID();
        setRequestKey(key);
        const result = await actions.consumeStock(ingredient.id, value, key);
        setStock({ found: true, currentQuantity: result.currentQuantity, baseUnit: stockUnit });
        setAmount("");
        setRequestKey(null);
      },
      "在庫を消費できませんでした。",
    );

  const onSearchKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    void search();
  };

  const price = formatBasisPrice(ingredient.latestUnitPriceYen);

  return (
    <Stack gap="5">
      <SubHeading
        trailing={linked ? <Badge colorPalette="green">連携済み</Badge> : <Badge>未連携</Badge>}
      >
        Inventia 連携
      </SubHeading>

      {error ? (
        <Feedback tone="error" size="sm">
          {error}
        </Feedback>
      ) : null}
      {notice ? (
        <Feedback tone="info" size="sm">
          {notice}
        </Feedback>
      ) : null}

      {linked ? (
        <Stack gap="4">
          <Box
            as="dl"
            display="grid"
            gridTemplateColumns="auto minmax(0, 1fr)"
            alignItems="center"
            columnGap="6"
            rowGap="2"
          >
            <Text as="dt" textStyle="label" color="fg.muted">
              品目 ID
            </Text>
            <HStack as="dd" gap="1" minW="0">
              <Text textStyle="mono" color="fg.strong" truncate>
                {ingredient.inventiaItemId}
              </Text>
              <InventiaIconLink itemId={ingredient.inventiaItemId} />
            </HStack>
            <Text as="dt" textStyle="label" color="fg.muted">
              単価
            </Text>
            <Text as="dd" textStyle="body.sm" fontVariantNumeric="tabular-nums">
              {price ? (
                <>
                  <chakra.span color="fg.strong" fontWeight="500">
                    {price}
                  </chakra.span>
                  <chakra.span color="fg.subtle">
                    {` / ${basisLabel(ingredient).replace(" あたり", "")}`}
                    {ingredient.latestPriceUpdatedAt
                      ? ` · ${formatDateJa(ingredient.latestPriceUpdatedAt)}更新`
                      : ""}
                  </chakra.span>
                </>
              ) : (
                <chakra.span color="fg.subtle">価格記録なし</chakra.span>
              )}
            </Text>
            <Text as="dt" textStyle="label" color="fg.muted">
              在庫
            </Text>
            <Flex as="dd" align="center" gap="3" wrap="wrap">
              <Text
                textStyle="body.sm"
                fontVariantNumeric="tabular-nums"
                color="fg.strong"
                fontWeight="500"
              >
                {stock === null ? (
                  <chakra.span color="fg.subtle" fontWeight="400">
                    未確認
                  </chakra.span>
                ) : stock.found && stock.currentQuantity !== null ? (
                  `${formatNumber(stock.currentQuantity)} ${stockUnit}`
                ) : (
                  <chakra.span color="fg.subtle" fontWeight="400">
                    取得できません
                  </chakra.span>
                )}
              </Text>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => void readStock()}
                loading={busy === "stock"}
              >
                在庫を確認
              </Button>
            </Flex>
          </Box>
          <Flex gap="3" align="end">
            <Box flex="1" maxW="48">
              <NumberField
                label="消費量"
                unit={stockUnit}
                min={1}
                step={1}
                value={amount}
                onChange={(next) => {
                  setAmount(next);
                  setRequestKey(null);
                }}
              />
            </Box>
            <Button
              type="button"
              variant="outline"
              onClick={() => void consume()}
              loading={busy === "consume"}
              disabled={!amount}
            >
              在庫を消費
            </Button>
          </Flex>
        </Stack>
      ) : null}

      <Stack gap="3">
        <Flex gap="3" align="end" onKeyDown={onSearchKeyDown}>
          <SearchInput
            label="Inventia の品目を検索"
            placeholder={linked ? "別の品目を検索" : "Inventia の品目を検索"}
            value={query}
            onChange={setQuery}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            flexShrink="0"
            onClick={() => void search()}
            loading={busy === "search"}
          >
            検索
          </Button>
        </Flex>
        {matches === null ? null : matches.length === 0 ? (
          <Text textStyle="body.sm" color="fg.muted" py="2">
            一致する品目はありません
          </Text>
        ) : (
          <chakra.ul
            listStyleType="none"
            borderTopWidth="1px"
            borderColor="border"
            aria-label="検索結果"
          >
            {matches.map((item) => {
              const current = item.id === ingredient.inventiaItemId;
              const mismatch = item.baseDimension !== ingredient.baseDimension;
              return (
                <chakra.li
                  key={item.id}
                  display="flex"
                  alignItems="center"
                  gap="3"
                  py="2.5"
                  borderBottomWidth="1px"
                  borderColor="border"
                >
                  <Box flex="1" minW="0">
                    <Text textStyle="body.sm" color="fg.strong" fontWeight="500" truncate>
                      {item.name}
                    </Text>
                    <Text
                      textStyle="caption"
                      color={mismatch ? "fg.warning" : "fg.subtle"}
                      fontVariantNumeric="tabular-nums"
                    >
                      {`在庫 ${formatNumber(item.currentQuantity)} ${item.baseUnit}`}
                      {mismatch ? ` · ${dimensionLabels[item.baseDimension]}の品目` : ""}
                    </Text>
                  </Box>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={current}
                    loading={busy === `link:${item.id}`}
                    aria-label={current ? `${item.name} (連携中)` : `${item.name} と連携`}
                    onClick={() => void link(item)}
                  >
                    {current ? "連携中" : "連携"}
                  </Button>
                </chakra.li>
              );
            })}
          </chakra.ul>
        )}
      </Stack>
    </Stack>
  );
}
