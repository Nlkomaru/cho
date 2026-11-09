import { Stack, VisuallyHidden } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Plus } from "lucide-react";
import { useMemo } from "react";

import { Page } from "@/components/layout/page";
import { MetaSeparator, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Feedback } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/search-input";

import { type DishRow, DishTable } from "./dish-table";

export interface DishListViewProps {
  rows: readonly DishRow[];
  loading?: boolean;
  error?: string;
  onRetry?(): void;
  query: string;
  onQueryChange(query: string): void;
  onSelect(row: DishRow): void;
}

function AddDishButton({ variant }: { variant: "primary" | "outline" }) {
  return (
    <Button asChild variant={variant}>
      <Link to="/dishes/new" search={{ dishId: undefined }}>
        <Plus />
        レシピを追加
      </Link>
    </Button>
  );
}

/**
 * レシピ一覧画面の本体。取得はページ側で行い、ここは表示だけ。
 */
export function DishListView({
  rows,
  loading,
  error,
  onRetry,
  query,
  onQueryChange,
  onSelect,
}: DishListViewProps) {
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term
      ? rows.filter((row) => `${row.name} ${row.category ?? ""}`.toLocaleLowerCase().includes(term))
      : rows;
  }, [rows, query]);

  return (
    <Page>
      <PageHeader
        title="レシピ"
        meta={
          loading ? undefined : rows.length === 0 ? (
            "0件"
          ) : (
            <>
              <span>{rows.length}件</span>
              <MetaSeparator />
              <span>栄養価・原価は1人前</span>
            </>
          )
        }
        actions={<AddDishButton variant="primary" />}
      />
      <Stack gap="4">
        {/* 空状態の見出し (h3) が h1 の直下にならないよう、一覧の見出しを置く */}
        <VisuallyHidden as="h2">レシピ一覧</VisuallyHidden>
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
          label="レシピを検索"
          placeholder="料理名・カテゴリで検索"
          value={query}
          onChange={onQueryChange}
          maxW="sm"
        />
        <DishTable
          rows={visible}
          loading={loading}
          onSelect={onSelect}
          empty={
            rows.length === 0 ? (
              <EmptyState
                icon={<BookOpen strokeWidth={1.75} />}
                title="レシピがありません"
                action={<AddDishButton variant="outline" />}
              />
            ) : (
              <EmptyState title="一致するレシピはありません" size="sm" />
            )
          }
        />
      </Stack>
    </Page>
  );
}
