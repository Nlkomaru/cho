import { Box, Collapsible, Grid, Text, chakra, useSlotRecipe } from "@chakra-ui/react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useId } from "react";

import { CodeBlock } from "@/components/ui/code-block";

import { sectionSlotRecipe } from "../../../../../theme/slot-recipes/section";

import { licenseText, spdxUrl } from "./license-texts";

export interface LicensePackage {
  name: string;
  versions: readonly string[];
  author: string | null;
  homepage: string | null;
}

export interface LicenseGroupProps {
  license: string;
  packages: readonly LicensePackage[];
  /** 最初からパッケージの一覧を開いておく (検索中など)。 */
  defaultOpen?: boolean;
}

function PackageRow({ pkg }: { pkg: LicensePackage }) {
  return (
    <Grid
      as="li"
      templateColumns={{
        base: "minmax(0, 1fr) auto",
        md: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.5fr)",
      }}
      columnGap="4"
      rowGap="0.5"
      alignItems="baseline"
      py="2.5"
      borderBottomWidth="1px"
      borderColor="border"
    >
      <Box minW="0">
        {pkg.homepage ? (
          <chakra.a
            href={pkg.homepage}
            target="_blank"
            rel="noreferrer"
            display="inline-flex"
            alignItems="center"
            gap="1.5"
            maxW="full"
            textStyle="body.sm"
            color="fg.strong"
            fontWeight="500"
            borderRadius="l1"
            _hover={{
              textDecoration: "underline",
              textUnderlineOffset: "3px",
              "& svg": { color: "red.600" },
            }}
            _focusVisible={{ outline: "2px solid {colors.navy.900}", outlineOffset: "2px" }}
          >
            <chakra.span truncate>{pkg.name}</chakra.span>
            <ExternalLink size={12} strokeWidth={1.75} aria-hidden="true" />
          </chakra.a>
        ) : (
          <Text textStyle="body.sm" color="fg.strong" fontWeight="500" truncate>
            {pkg.name}
          </Text>
        )}
      </Box>
      <Text
        textStyle="body.sm"
        color="fg.muted"
        fontVariantNumeric="tabular-nums"
        textAlign={{ base: "end", md: "start" }}
        truncate
      >
        {pkg.versions.join(", ")}
      </Text>
      <Text
        textStyle="body.sm"
        color={pkg.author ? "fg.muted" : "fg.subtle"}
        gridColumn={{ base: "1 / -1", md: "auto" }}
        fontSize={{ base: "12px", md: "14px" }}
        truncate
      >
        {pkg.author ?? "—"}
      </Text>
    </Grid>
  );
}

/**
 * 1 つのライセンスに属するパッケージの一覧と、ライセンス本文。
 */
export function LicenseGroup({ license, packages, defaultOpen = false }: LicenseGroupProps) {
  const headingId = useId();
  const text = licenseText(license);
  // SubHeading と同じ見た目で、ページ直下の見出しなので h2 にする
  const styles = useSlotRecipe({ recipe: sectionSlotRecipe })();

  return (
    <Box as="section" aria-labelledby={headingId}>
      <Collapsible.Root defaultOpen={defaultOpen} lazyMount>
        <chakra.h2 id={headingId} m="0">
          <Collapsible.Trigger
            css={[
              styles.subHeading,
              {
                w: "full",
                cursor: "pointer",
                textAlign: "start",
                borderRadius: "l1",
                _hover: { "& [data-name]": { color: "red.700" } },
                _focusVisible: { outline: "2px solid {colors.navy.900}", outlineOffset: "2px" },
                "&[data-state=open] [data-chevron]": { transform: "rotate(180deg)" },
              },
            ]}
          >
            <chakra.span data-name="" css={[styles.subTitle, { color: "fg.strong" }]}>
              {license}
            </chakra.span>
            <Box as="span" aria-hidden="true" css={styles.subRule} />
            <Text
              as="span"
              textStyle="caption"
              color="fg.subtle"
              flexShrink={0}
              fontVariantNumeric="tabular-nums"
            >
              {packages.length} 件
            </Text>
            <ChevronDown
              data-chevron=""
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
              style={{ flexShrink: 0, transition: "transform 120ms" }}
            />
          </Collapsible.Trigger>
        </chakra.h2>
        <Collapsible.Content>
          <chakra.ul listStyle="none" mt="2">
            {packages.map((pkg) => (
              <PackageRow key={`${pkg.name}@${pkg.versions.join(",")}`} pkg={pkg} />
            ))}
          </chakra.ul>
          <Collapsible.Root mt="3" lazyMount>
            <Collapsible.Trigger
              display="inline-flex"
              alignItems="center"
              gap="1.5"
              textStyle="body.sm"
              fontWeight="500"
              color="fg.muted"
              cursor="pointer"
              borderRadius="l1"
              _hover={{ color: "fg.strong" }}
              _focusVisible={{ outline: "2px solid {colors.navy.900}", outlineOffset: "2px" }}
              css={{ "&[data-state=open] svg": { transform: "rotate(180deg)" } }}
            >
              ライセンス本文
              <ChevronDown
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                style={{ transition: "transform 120ms" }}
              />
            </Collapsible.Trigger>
            <Collapsible.Content>
              <Box pt="3">
                {text ? (
                  <CodeBlock code={text} label={`${license} の本文`} copyable={false} />
                ) : (
                  <chakra.a
                    href={spdxUrl(license)}
                    target="_blank"
                    rel="noreferrer"
                    display="inline-flex"
                    alignItems="center"
                    gap="1.5"
                    textStyle="body.sm"
                    color="red.600"
                    fontWeight="500"
                    _hover={{ textDecoration: "underline", textUnderlineOffset: "3px" }}
                    _focusVisible={{ outline: "2px solid {colors.navy.900}", outlineOffset: "2px" }}
                  >
                    SPDX で {license} の本文を読む
                    <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
                  </chakra.a>
                )}
              </Box>
            </Collapsible.Content>
          </Collapsible.Root>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
}
