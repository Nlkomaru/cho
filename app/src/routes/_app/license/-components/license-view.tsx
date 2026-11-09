import { Box, Stack, chakra } from "@chakra-ui/react";
import { PackageSearch } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";

import { LicenseGroup, type LicensePackage } from "./license-group";

export interface LicenseGroupData {
  license: string;
  packages: readonly LicensePackage[];
}

export interface LicenseViewProps {
  groups: readonly LicenseGroupData[];
  /** 検索欄の初期値 (Storybook 用)。 */
  initialQuery?: string;
}

/**
 * OSS ライセンス画面の本体。パッケージ名で絞り込める。
 */
export function LicenseView({ groups, initialQuery = "" }: LicenseViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);

  const total = useMemo(
    () => groups.reduce((sum, group) => sum + group.packages.length, 0),
    [groups],
  );

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((group) => ({
        license: group.license,
        packages: group.packages.filter((pkg) => pkg.name.toLowerCase().includes(needle)),
      }))
      .filter((group) => group.packages.length > 0);
  }, [groups, deferredQuery]);

  const searching = deferredQuery.trim() !== "";
  const shown = filtered.reduce((sum, group) => sum + group.packages.length, 0);

  return (
    <Page size="md">
      <PageHeader
        title="OSS ライセンス"
        meta={
          deferredQuery.trim()
            ? `${shown.toLocaleString("ja-JP")} / ${total.toLocaleString("ja-JP")} パッケージ`
            : `${total.toLocaleString("ja-JP")} パッケージ`
        }
      />
      <Stack gap="10">
        <SearchInput
          value={query}
          onChange={setQuery}
          label="パッケージを検索"
          placeholder="パッケージ名で検索"
          maxW="sm"
        />
        {filtered.length === 0 ? (
          // 見出しの階層を保つため、結果なしのときだけ見えない h2 を置く
          <Box>
            <chakra.h2 srOnly>検索結果</chakra.h2>
            <EmptyState
              icon={<PackageSearch strokeWidth={1.75} />}
              title="該当するパッケージはありません"
            />
          </Box>
        ) : (
          filtered.map((group) => (
            // 検索中は一致したパッケージが見えるよう開いた状態で描き直す
            <LicenseGroup
              key={`${group.license}:${searching}`}
              license={group.license}
              packages={group.packages}
              defaultOpen={searching}
            />
          ))
        )}
      </Stack>
    </Page>
  );
}
