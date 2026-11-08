import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";

import {
  createInventiaClient,
  describeInventiaFailure,
  InventiaHttpError,
  InventiaSearchLimitError,
  inventiaRequestErrorMessage,
} from "./inventia-client";

const item = (id: string, name = "Milk") => ({
  id,
  name,
  baseUnit: "mL",
  baseDimension: "volume",
  currentQuantity: 750,
  categoryId: "food",
  locationId: "fridge",
  lots: [],
});
const requests: { method: string; url: string; authorized: boolean; body: unknown }[] = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
  requests.push({
    method: request.method ?? "GET",
    url: url.pathname + url.search,
    authorized: request.headers.authorization === "Bearer inv_fixture_only",
    body,
  });
  response.setHeader("Content-Type", "application/json");
  if (url.searchParams.get("q") === "unauthorized") {
    response
      .writeHead(401)
      .end(JSON.stringify({ error: { code: "API_TOKEN_INVALID", message: "Invalid token" } }));
  } else if (url.searchParams.get("q") === "forbidden") {
    response
      .writeHead(403)
      .end(JSON.stringify({ error: { code: "FORBIDDEN", message: "Forbidden" } }));
  } else if (url.pathname === "/api/items") {
    if (url.searchParams.get("q") === "unbounded") {
      response.end(
        JSON.stringify({
          items: [item(`unbounded-${requests.length}`)],
          nextCursor: "again",
        }),
      );
    } else
      response.end(
        JSON.stringify(
          url.searchParams.has("cursor")
            ? { items: [item("milk-2")], nextCursor: null }
            : { items: [item("milk-1")], nextCursor: "next page/+=" },
        ),
      );
  } else if (url.pathname === "/api/items/renamed") {
    response.end(JSON.stringify(item("renamed", "Renamed milk")));
  } else if (url.pathname === "/api/items/item-g") {
    response.end(JSON.stringify(item("item-g", "Flour")));
  } else if (url.pathname === "/api/items/item-kg") {
    response.end(JSON.stringify({ ...item("item-kg", "Flour"), baseUnit: "kg" }));
  } else if (url.pathname === "/api/items/milk-1/prices") {
    response.end(
      JSON.stringify({
        items: [{ id: "price-1", unitPrice: 27.5, price: 275, contentAmount: 1000 }],
        nextCursor: "older-prices",
      }),
    );
  } else if (/^\/api\/items\/[^/]+\/prices$/.test(url.pathname)) {
    response.end(JSON.stringify({ items: [{ id: "price-1", unitPrice: 27.5 }], nextCursor: null }));
  } else if (/^\/api\/items\/[^/]+\/adjustments$/.test(url.pathname)) {
    const itemId = url.pathname.split("/")[3] ?? "";
    if (itemId.includes("shortage"))
      response.writeHead(409).end(
        JSON.stringify({
          error: { code: "INSUFFICIENT_STOCK", message: "Only 10 mL left" },
        }),
      );
    else if (itemId.includes("provider"))
      response.writeHead(404).end(
        JSON.stringify({
          error: {
            code: "EXTERNAL_PROVIDER_NOT_FOUND",
            message: "Unknown external provider",
          },
        }),
      );
    else if (itemId.includes("conflict"))
      response.writeHead(409).end(
        JSON.stringify({
          error: {
            code: "IDEMPOTENCY_CONFLICT",
            message: "Idempotency key reused with a different payload",
          },
        }),
      );
    else if (itemId.includes("gateway"))
      response.writeHead(500).end(
        JSON.stringify({
          error: { code: "INTERNAL_ERROR", message: "Something exploded" },
        }),
      );
    else
      response.writeHead(201).end(
        JSON.stringify({
          itemId,
          currentQuantity: 650,
          allocations: [],
          lots: [],
          movement: null,
          replayed: false,
        }),
      );
  } else {
    response
      .writeHead(404)
      .end(JSON.stringify({ error: { code: "ITEM_NOT_FOUND", message: "Not found" } }));
  }
});
let baseUrl = "";
beforeAll(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  const closed = once(server, "close");
  server.close();
  await closed;
});
const client = (stockWritesEnabled = false) =>
  createInventiaClient({ baseUrl, decryptedToken: "inv_fixture_only", stockWritesEnabled });

test("search reads every upstream item page and preserves encoded cursors", async () => {
  const result = await client().searchItems("牛乳");
  expect(result.map((value) => value.id)).toEqual(["milk-1", "milk-2"]);
  const searchRequests = requests.filter((request) => request.url.startsWith("/api/items?"));
  expect(searchRequests.every((request) => request.authorized)).toBe(true);
  expect(new URL(searchRequests.at(-1)?.url ?? "", baseUrl).searchParams.get("cursor")).toBe(
    "next page/+=",
  );
});

test("price page maps upstream records to the existing price DTO", async () => {
  expect(await client().getItemPrices("milk-1")).toEqual([{ unitPrice: 27.5 }]);
  expect(requests.at(-1)?.url).toBe("/api/items/milk-1/prices?limit=5");
});

test("stock lookup reads linked identity directly and only treats 404 as missing", async () => {
  expect(await client().getItem("renamed")).toMatchObject({
    id: "renamed",
    name: "Renamed milk",
    currentQuantity: 750,
  });
  expect(requests.at(-1)?.url).toBe("/api/items/renamed");
  expect(await client().getItem("missing")).toBeNull();
});

test.each([401, 403])(
  "upstream %i is an authorization failure, not an empty list",
  async (status) => {
    const query = status === 401 ? "unauthorized" : "forbidden";
    await expect(client().searchItems(query)).rejects.toMatchObject({ status });
    expect(inventiaRequestErrorMessage(new InventiaHttpError(status), "Search failed")).toContain(
      status === 401 ? "API token" : "denied access",
    );
  },
);

test("read-only clients cannot issue stock requests", async () => {
  const before = requests.length;
  await expect(
    client().adjustStock("milk-1", {
      delta: -100,
      reason: "consume",
      idempotencyKey: "fixture-readonly",
      note: "Fixture",
      externalProviderId: "cho",
      externalId: "meal-1",
    }),
  ).rejects.toThrow("stock writes are disabled");
  expect(requests).toHaveLength(before);
});

test("enabled stock writes use the actual adjustments endpoint", async () => {
  const input = {
    delta: -100,
    reason: "consume" as const,
    idempotencyKey: "fixture-adjustment",
    note: "Fixture",
    externalProviderId: "cho",
    externalId: "meal-1",
  };
  expect(await client(true).adjustStock("milk-1", input)).toEqual({
    currentQuantity: 650,
    allocations: [],
  });
  expect(requests.at(-1)).toMatchObject({
    method: "POST",
    url: "/api/items/milk-1/adjustments",
    authorized: true,
    body: input,
  });
});

test("search stops at the page cap with an explicit narrowing error", async () => {
  const before = requests.length;
  const error = await client()
    .searchItems("unbounded")
    .catch((failure: unknown) => failure);
  expect(error).toBeInstanceOf(InventiaSearchLimitError);
  expect(inventiaRequestErrorMessage(error, "Search failed")).toContain("Narrow the search query");
  const pages = requests.slice(before).filter((request) => request.url.startsWith("/api/items?"));
  expect(pages).toHaveLength(10);
});

const adjustmentInput = {
  delta: -1,
  reason: "consume" as const,
  idempotencyKey: "fixture-upstream-error",
  note: "Fixture",
  externalProviderId: "cho",
  externalId: "meal-1",
};

test.each([
  ["stock-shortage", 409, "INSUFFICIENT_STOCK", 409, "enough stock", "Only 10 mL left"],
  [
    "provider-missing",
    404,
    "EXTERNAL_PROVIDER_NOT_FOUND",
    409,
    "Provider ID",
    "Unknown external provider",
  ],
  [
    "idempotency-conflict",
    409,
    "IDEMPOTENCY_CONFLICT",
    409,
    "idempotency key",
    "Idempotency key reused with a different payload",
  ],
  ["gateway", 500, "INTERNAL_ERROR", 502, "Stock failed", "Something exploded"],
])(
  "%s reads the upstream code and maps it to an actionable failure",
  async (itemId, upstreamStatus, code, mappedStatus, hint, upstreamMessage) => {
    const failure = await client(true)
      .adjustStock(itemId, adjustmentInput)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(InventiaHttpError);
    expect(failure).toMatchObject({ status: upstreamStatus, code });
    const described = describeInventiaFailure(failure, "Stock failed");
    expect(described.status).toBe(mappedStatus);
    expect(described.error).toContain(hint);
    expect(described.error).not.toContain(upstreamMessage);
  },
);
