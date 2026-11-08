import { Box, Heading, Link, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";

import licenseGroups from "./-data.json";

export const Route = createFileRoute("/_app/license/")({
  staticData: {
    breadcrumbs: [{ label: "OSS ライセンス" }],
  },
  component: LicensePage,
});

function LicensePage() {
  return (
    <Stack as="main" mx="auto" w="full" maxW="6xl" gap="8" p={{ base: "4", sm: "6", lg: "8" }}>
      <Stack as="header" gap="2">
        <Heading as="h1" color="fg.subtle" fontSize="3xl" fontWeight="600">
          OSS ライセンス
        </Heading>
        <Text color="fg">Cho で利用しているオープンソースソフトウェアの一覧です。</Text>
      </Stack>
      {licenseGroups.map((group) => (
        <Stack as="section" key={group.license} gap="3">
          <Box>
            <Heading as="h2" color="fg.subtle" fontSize="xl" fontWeight="600">
              {group.license}
            </Heading>
            <Text color="fg.muted" fontSize="sm">
              {group.packages.length} パッケージ
            </Text>
          </Box>
          <SimpleGrid
            as="ul"
            columns={{ base: 1, md: 2, xl: 3 }}
            gap="3"
            listStyle="none"
            m="0"
            p="0"
          >
            {group.packages.map((packageInfo) => (
              <Box
                as="li"
                key={`${packageInfo.name}-${packageInfo.versions.join("-")}`}
                borderWidth="1px"
                borderColor="border"
                borderRadius="l3"
                bg="bg.panel"
                color="fg"
                p="4"
              >
                <Stack gap="3">
                  <Box
                    display="flex"
                    alignItems="flex-start"
                    justifyContent="space-between"
                    gap="3"
                  >
                    <Box minW="0">
                      <Heading
                        as="h3"
                        color="fg.subtle"
                        fontSize="md"
                        fontWeight="600"
                        overflowWrap="anywhere"
                      >
                        {packageInfo.name}
                      </Heading>
                      <Text color="fg.muted" fontSize="sm">
                        {packageInfo.versions.map((version) => `v${version}`).join(", ")}
                      </Text>
                    </Box>
                    {packageInfo.homepage ? (
                      <Link
                        aria-label={`${packageInfo.name} のサイトを新しいタブで開く`}
                        href={packageInfo.homepage}
                        rel="noreferrer"
                        target="_blank"
                        flexShrink="0"
                        borderRadius="md"
                        color="fg.muted"
                        p="1"
                        _hover={{ color: "fg.subtle" }}
                        _focusVisible={{
                          outline: "2px solid",
                          outlineColor: "red.border",
                          outlineOffset: "2px",
                        }}
                      >
                        <ExternalLinkIcon aria-hidden="true" size={16} />
                      </Link>
                    ) : null}
                  </Box>
                  <Text color="fg.muted" fontSize="sm">
                    Author: {packageInfo.author ?? "Unknown"}
                  </Text>
                </Stack>
              </Box>
            ))}
          </SimpleGrid>
        </Stack>
      ))}
    </Stack>
  );
}
