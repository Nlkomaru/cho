import { bindings, defineConfig } from "cf/config";

export default defineConfig(({ isPreview, mode }) => {
  const preview = isPreview || mode === "preview" || process.env.CHO_PREVIEW === "true";
  const smoke = mode === "smoke";
  const production = mode === "production" && !preview && !smoke;
  const databaseId =
    process.env.CLOUDFLARE_DATABASE_ID ??
    (smoke ? "33333333-3333-4333-8333-333333333333" : undefined);

  return {
    worker: {
      name: "cho",
      compatibilityDate: "2026-08-26",
      compatibilityFlags: ["nodejs_compat"],
      entrypoint: "@tanstack/react-start/server-entry",
      workersDev: true,
      previewUrls: true,
      observability: {
        enabled: true,
      },
      domains: ["cho.nikomaru.dev"],
      env: {
        INVENTIA_BASE_URL: bindings.text("https://inventia.nikomaru.dev"),
        ...(production
          ? {
              INVENTIA_STOCK_WRITES_ENABLED: bindings.text("true"),
              MCP_MANAGEMENT_ENABLED: bindings.text("true"),
            }
          : preview
            ? {
                INVENTIA_STOCK_WRITES_ENABLED: bindings.text("false"),
                MCP_MANAGEMENT_ENABLED: bindings.text("false"),
              }
            : smoke
              ? {
                  MCP_MANAGEMENT_ENABLED: bindings.text("true"),
                  MCP_ALLOWED_ORIGINS: bindings.text("https://cho-smoke.example"),
                }
              : {}),
        DB: bindings.d1({
          name: "cho",
          ...(databaseId ? { id: databaseId } : {}),
          dev: {
            remote: !smoke,
          },
        }),
        ...(!preview
          ? {
              IMAGES_BUCKET: bindings.r2({
                name: "cho-images",
                dev: {
                  remote: !smoke,
                },
              }),
            }
          : {}),
        ASSETS: bindings.assets(),
      },
    },
  };
});
