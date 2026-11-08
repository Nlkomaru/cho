import { createRemoteJWKSet, jwtVerify, type RemoteJWKSet } from "jose";

export type CloudflareAccessEnvironment = {
  CLOUDFLARE_ACCESS_ISSUER?: string;
  CLOUDFLARE_ACCESS_AUDIENCE?: string;
  MCP_ADMIN_SUBJECTS?: string;
  MCP_ADMIN_EMAILS?: string;
};
export type AccessAdmin = { subject: string; email: string | null };

const remoteKeySets = new Map<string, RemoteJWKSet>();

function entries(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function remoteKeySet(issuer: string): RemoteJWKSet {
  const cached = remoteKeySets.get(issuer);
  if (cached) return cached;
  const keySet = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer));
  remoteKeySets.set(issuer, keySet);
  return keySet;
}

export async function verifyCloudflareAccessAdmin(
  request: Request,
  env: CloudflareAccessEnvironment,
  now = new Date(),
): Promise<AccessAdmin | null> {
  const issuer = env.CLOUDFLARE_ACCESS_ISSUER;
  const audience = env.CLOUDFLARE_ACCESS_AUDIENCE;
  const subjects = entries(env.MCP_ADMIN_SUBJECTS);
  const allowedEmails = new Set(
    [...entries(env.MCP_ADMIN_EMAILS)].map((email) => email.toLowerCase()),
  );
  if (!issuer || !audience || (subjects.size === 0 && allowedEmails.size === 0)) return null;

  let issuerUrl: URL;
  try {
    issuerUrl = new URL(issuer);
  } catch {
    return null;
  }
  if (
    issuerUrl.protocol !== "https:" ||
    issuerUrl.username ||
    issuerUrl.password ||
    issuerUrl.pathname !== "/" ||
    issuerUrl.search ||
    issuerUrl.hash
  )
    return null;

  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt || jwt.length > 16_384) return null;
  try {
    const { payload } = await jwtVerify(jwt, remoteKeySet(issuer), {
      algorithms: ["RS256"],
      issuer,
      audience,
      currentDate: now,
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const permitted =
      subjects.size > 0
        ? subjects.has(payload.sub)
        : email !== null && allowedEmails.has(email.trim().toLowerCase());
    return permitted ? { subject: payload.sub, email } : null;
  } catch {
    return null;
  }
}
