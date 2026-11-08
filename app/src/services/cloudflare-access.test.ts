import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { expect, test } from "vite-plus/test";

import { verifyCloudflareAccessAdmin } from "./cloudflare-access";

async function signedAccessJwt(input: {
  issuer: string;
  audience: string;
  subject: string;
  email: string;
  privateKey: CryptoKey;
}) {
  return new SignJWT({ email: input.email })
    .setProtectedHeader({ alg: "RS256", kid: "cho-test-key" })
    .setIssuer(input.issuer)
    .setAudience(input.audience)
    .setSubject(input.subject)
    .setExpirationTime("5m")
    .sign(input.privateKey);
}

test("Cloudflare Access requires a verified JWT and prefers the configured subject allowlist", async () => {
  const issuer = "https://cho-access-test.cloudflareaccess.com";
  const audience = "cho-test-audience";
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ keys: [{ ...jwk, kid: "cho-test-key", alg: "RS256", use: "sig" }] }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  try {
    const jwt = await signedAccessJwt({
      issuer,
      audience,
      subject: "allowed-subject",
      email: "Admin@Example.com",
      privateKey,
    });
    const request = new Request("https://cho.example/api/mcp/tokens", {
      headers: { "Cf-Access-Jwt-Assertion": jwt },
    });
    const env = {
      CLOUDFLARE_ACCESS_ISSUER: issuer,
      CLOUDFLARE_ACCESS_AUDIENCE: audience,
      MCP_ADMIN_SUBJECTS: "allowed-subject",
      MCP_ADMIN_EMAILS: "other@example.com",
    };
    expect(await verifyCloudflareAccessAdmin(request, env)).toEqual({
      subject: "allowed-subject",
      email: "Admin@Example.com",
    });
    expect(
      await verifyCloudflareAccessAdmin(request, {
        ...env,
        MCP_ADMIN_SUBJECTS: "different-subject",
      }),
    ).toBeNull();
    expect(
      await verifyCloudflareAccessAdmin(request, {
        ...env,
        CLOUDFLARE_ACCESS_AUDIENCE: "other-audience",
      }),
    ).toBeNull();
    expect(
      await verifyCloudflareAccessAdmin(request, {
        CLOUDFLARE_ACCESS_ISSUER: issuer,
        CLOUDFLARE_ACCESS_AUDIENCE: audience,
      }),
    ).toBeNull();

    const emailJwt = await signedAccessJwt({
      issuer,
      audience,
      subject: "email-allowed-subject",
      email: "Admin@Example.com",
      privateKey,
    });
    const emailRequest = new Request("https://cho.example/api/mcp/tokens", {
      headers: { "Cf-Access-Jwt-Assertion": emailJwt },
    });
    expect(
      await verifyCloudflareAccessAdmin(emailRequest, {
        CLOUDFLARE_ACCESS_ISSUER: issuer,
        CLOUDFLARE_ACCESS_AUDIENCE: audience,
        MCP_ADMIN_EMAILS: " admin@example.com ",
      }),
    ).toMatchObject({ subject: "email-allowed-subject" });
    expect(
      await verifyCloudflareAccessAdmin(
        new Request("https://cho.example/api/mcp/tokens", {
          headers: { "Cf-Access-Jwt-Assertion": "not-a-jwt" },
        }),
        env,
      ),
    ).toBeNull();
  } finally {
    globalThis.fetch = originalFetch;
  }
});
