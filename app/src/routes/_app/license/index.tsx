import { Link, SimpleGrid, Text } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";

import { Card } from "../../../components/ui/card";
import { Page, PageHeader } from "../../../components/ui/page";
import { Section } from "../../../components/ui/section";
import licenseGroups from "./-data.json";

export const Route = createFileRoute("/_app/license/")({
  staticData: {
    breadcrumbs: [{ label: "OSS ライセンス" }],
  },
  component: LicensePage,
});

function LicensePage() {
  return (
    <Page>
      <PageHeader title="OSS ライセンス" />
      {licenseGroups.map((group) => (
        <Section
          key={group.license}
          title={group.license}
          divided={false}
          actions={<Text textStyle="caption">{group.packages.length} パッケージ</Text>}
        >
          <SimpleGrid as="ul" columns={{ base: 1, md: 2, xl: 3 }} gap="3" listStyle="none">
            {group.packages.map((packageInfo) => (
              <Card
                as="li"
                key={`${packageInfo.name}-${packageInfo.versions.join("-")}`}
                titleAs="h3"
                title={packageInfo.name}
                meta={packageInfo.versions.map((version) => `v${version}`).join(", ")}
                footer={
                  packageInfo.homepage ? (
                    <Link
                      aria-label={`${packageInfo.name} のサイトを新しいタブで開く`}
                      href={packageInfo.homepage}
                      rel="noreferrer"
                      target="_blank"
                      flexShrink="0"
                    >
                      <ExternalLinkIcon aria-hidden="true" size={16} />
                    </Link>
                  ) : undefined
                }
              >
                <Text textStyle="caption" as="span">
                  Author: {packageInfo.author ?? "Unknown"}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </Section>
      ))}
    </Page>
  );
}
