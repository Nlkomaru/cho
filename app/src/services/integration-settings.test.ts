import { expect, test } from "vite-plus/test";

import type { StoredSettings } from "../repositories/settings-repository";
import { encryptSecret } from "./crypto";
import { describeIntegrationSettings, resolveInventiaConnection } from "./integration-settings";

const encryptionKey = btoa("local-fixture-key".padEnd(32, "0"));
const env = {
  INVENTIA_BASE_URL: "https://inventia.nikomaru.dev",
  SETTINGS_ENCRYPTION_KEY: encryptionKey,
};
async function inventiaSettings(publicConfig: unknown = null): Promise<StoredSettings> {
  return {
    key: "inventia",
    encryptedPayload: await encryptSecret("inv_fixture_only", encryptionKey),
    publicConfig,
    updatedAt: "2026-11-08T00:00:00.000Z",
  };
}

test("missing credentials have actionable issues without requiring encryption", async () => {
  const status = await describeIntegrationSettings(
    { openrouter: null, inventia: null },
    { INVENTIA_BASE_URL: env.INVENTIA_BASE_URL },
  );
  expect(status.openrouter).toMatchObject({
    configured: false,
    usable: false,
    issue: "missing_token",
  });
  expect(status.inventia).toMatchObject({
    configured: false,
    usable: false,
    issue: "missing_token",
    tokenSettingsUrl: "https://inventia.nikomaru.dev/settings/tokens",
    capabilities: { readItems: false, writeStock: false },
  });
});

test("stored credentials remain configured when preview lacks the decryption key", async () => {
  const settings = await inventiaSettings({ providerId: "cho" });
  const { status, client } = await resolveInventiaConnection(settings, {
    INVENTIA_BASE_URL: env.INVENTIA_BASE_URL,
  });
  expect(status).toMatchObject({
    configured: true,
    usable: false,
    issue: "missing_encryption_key",
    providerId: "cho",
    capabilities: { readItems: false, writeStock: false },
  });
  expect(client).toBeNull();
});

test("read access does not require an external stock provider ID", async () => {
  const { status } = await resolveInventiaConnection(await inventiaSettings(), env);
  expect(status).toMatchObject({
    configured: true,
    usable: true,
    issue: null,
    providerId: null,
    capabilities: { readItems: true, writeStock: false },
  });
});

test("stock capability requires an explicit enabled flag and provider ID", async () => {
  const settings = await inventiaSettings({ providerId: "cho" });
  expect((await resolveInventiaConnection(settings, env)).status.capabilities).toEqual({
    readItems: true,
    writeStock: false,
  });
  expect(
    (await resolveInventiaConnection(settings, { ...env, INVENTIA_STOCK_WRITES_ENABLED: "false" }))
      .status.capabilities,
  ).toEqual({ readItems: true, writeStock: false });
  expect(
    (await resolveInventiaConnection(settings, { ...env, INVENTIA_STOCK_WRITES_ENABLED: "true" }))
      .status.capabilities,
  ).toEqual({ readItems: true, writeStock: true });
  expect(
    (
      await resolveInventiaConnection(await inventiaSettings(), {
        ...env,
        INVENTIA_STOCK_WRITES_ENABLED: "true",
      })
    ).status.capabilities.writeStock,
  ).toBe(false);
});

test("invalid encrypted data is stored but is not usable", async () => {
  const settings = { ...(await inventiaSettings()), encryptedPayload: "broken-ciphertext" };
  expect((await resolveInventiaConnection(settings, env)).status).toMatchObject({
    configured: true,
    usable: false,
    issue: "invalid_credentials",
  });
});

test("invalid public configuration is reported instead of being silently ignored", async () => {
  const settings = await inventiaSettings({ providerId: 42 });
  expect((await resolveInventiaConnection(settings, env)).status).toMatchObject({
    configured: true,
    usable: false,
    issue: "invalid_configuration",
  });
});

test.each(["javascript:alert(1)", "data:text/html,test", "https://user:password@example.com"])(
  "unsafe Inventia base %s never becomes a token settings link",
  async (baseUrl) => {
    const { status } = await resolveInventiaConnection(null, { INVENTIA_BASE_URL: baseUrl });
    expect(status).toMatchObject({
      usable: false,
      issue: "invalid_base_url",
      tokenSettingsUrl: null,
    });
  },
);

test("token settings link stays on the configured origin", async () => {
  const { status } = await resolveInventiaConnection(null, {
    INVENTIA_BASE_URL: "https://inventia.nikomaru.dev/path?redirect=https://example.com",
  });
  expect(status.tokenSettingsUrl).toBe("https://inventia.nikomaru.dev/settings/tokens");
});
