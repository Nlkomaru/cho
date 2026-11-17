import { Stack, VisuallyHidden } from "@chakra-ui/react";
import { Package, Plus } from "lucide-react";
import { useMemo } from "react";

import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Feedback } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/search-input";
import type { Food } from "@/domain/ingredient";

import { FoodTable } from "./food-table";

export interface FoodListViewProps {
  items: readonly Food[];
  loading?: boolean;
  error?: string;
  onRetry?(): void;
  query: string;
  onQueryChange(query: string): void;
  selectedId?: string | null;
  onSelect(item: Food): void;
  onAdd(): void;
}

/**
 * 定番食品一覧画面の本体。取得・保存はページ側で行う。
 */
export function FoodListView({
  items,
  loading,
  error,
  onRetry,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  onAdd,
}: FoodListViewProps) {
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term
      ? items.filter((item) =>
          `${item.name} ${item.category ?? ""} ${item.servingLabel}`
            .toLocaleLowerCase()
            .includes(term),
        )
      : items;
  }, [items, query]);

  return (
    <Page>
      <PageHeader
        title="定番食品"
        meta={loading ? undefined : `${items.length}件`}
        actions={
          <Button variant="primary" onClick={onAdd}>
            <Plus />
            定番食品を追加
          </Button>
        }
      />
      <Stack gap="4">
        {/* 空状態の見出し (h3) が h1 の直下にならないよう、一覧の見出しを置く */}
        <VisuallyHidden as="h2">定番食品一覧</VisuallyHidden>
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
          label="定番食品を検索"
          placeholder="食品名・カテゴリ・単位で検索"
          value={query}
          onChange={onQueryChange}
          maxW="sm"
        />
        <FoodTable
          items={visible}
          loading={loading}
          selectedId={selectedId}
          onSelect={onSelect}
          empty={
            items.length === 0 ? (
              <EmptyState
                icon={<Package strokeWidth={1.75} />}
                title="定番食品がありません"
                action={
                  <Button variant="outline" onClick={onAdd}>
                    <Plus />
                    定番食品を追加
                  </Button>
                }
              />
            ) : (
              <EmptyState title="一致する定番食品はありません" size="sm" />
            )
          }
        />
      </Stack>
    </Page>
  );
}
