import { Stack, VisuallyHidden } from "@chakra-ui/react";
import { Carrot, Plus } from "lucide-react";
import { useMemo } from "react";

import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Feedback } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/search-input";
import type { Ingredient } from "@/domain/ingredient";

import { IngredientTable } from "./ingredient-table";

export interface IngredientListViewProps {
  items: readonly Ingredient[];
  loading?: boolean;
  error?: string;
  onRetry?(): void;
  query: string;
  onQueryChange(query: string): void;
  selectedId?: string | null;
  onSelect(item: Ingredient): void;
  onAdd(): void;
}

/**
 * 材料一覧画面の本体。取得・保存はページ側で行う。
 */
export function IngredientListView({
  items,
  loading,
  error,
  onRetry,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  onAdd,
}: IngredientListViewProps) {
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term
      ? items.filter((item) =>
          `${item.name} ${item.baseUnit} ${item.inventiaItemId ?? ""}`
            .toLocaleLowerCase()
            .includes(term),
        )
      : items;
  }, [items, query]);

  return (
    <Page>
      <PageHeader
        title="材料"
        meta={loading ? undefined : `${items.length}件`}
        actions={
          <Button variant="primary" onClick={onAdd}>
            <Plus />
            材料を追加
          </Button>
        }
      />
      <Stack gap="4">
        {/* 空状態の見出し (h3) が h1 の直下にならないよう、一覧の見出しを置く */}
        <VisuallyHidden as="h2">材料一覧</VisuallyHidden>
        {error ? (
          <Feedback
            tone="error"
            action={
              onRetry ? (
                <Button size="sm" variant="outline" onClick={onRetry}>
                  再読み込み
                </Button>
              ) : undefined
            }
          >
            {error}
          </Feedback>
        ) : null}
        <SearchInput
          label="材料を検索"
          placeholder="品目名・単位・Inventia ID で検索"
          value={query}
          onChange={onQueryChange}
          maxW="sm"
        />
        <IngredientTable
          items={visible}
          loading={loading}
          selectedId={selectedId}
          onSelect={onSelect}
          empty={
            items.length === 0 ? (
              <EmptyState
                icon={<Carrot strokeWidth={1.75} />}
                title="材料がありません"
                action={
                  <Button variant="outline" onClick={onAdd}>
                    <Plus />
                    材料を追加
                  </Button>
                }
              />
            ) : (
              <EmptyState title="一致する材料はありません" size="sm" />
            )
          }
        />
      </Stack>
    </Page>
  );
}
