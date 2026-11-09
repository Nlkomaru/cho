import { createFileRoute } from "@tanstack/react-router";

import licenseGroups from "./-data.json";
import { LicenseView } from "./-components/license-view";

export const Route = createFileRoute("/_app/license/")({
  staticData: {
    breadcrumbs: [{ label: "OSS ライセンス" }],
  },
  component: LicensePage,
});

function LicensePage() {
  return <LicenseView groups={licenseGroups} />;
}
