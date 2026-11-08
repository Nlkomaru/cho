import { expect, test } from "vite-plus/test";
import { api } from "./index";

test("health endpoint is available without Cloudflare bindings", async () => {
  const response = await api.fetch(new Request("http://localhost/api/health"));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
