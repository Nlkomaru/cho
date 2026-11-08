import { Scalar } from "@scalar/hono-api-reference";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { aiRoutes } from "./ai-routes";
import { dishRoutes } from "./dish-routes";
import { imageRoutes } from "./image-routes";
import { ingredientRoutes } from "./ingredient-routes";
import { mealRoutes } from "./meal-routes";
import { settingsRoutes } from "./settings-routes";

import { mealLogSchema } from "../domain/ingredient";
import { nutritionFactsSchema } from "../domain/nutrition";
import { recipeSchema } from "../domain/recipe";

export type ApiBindings = {
  DB: D1Database;
  IMAGES_BUCKET: R2Bucket;
  INVENTIA_BASE_URL?: string;
  SETTINGS_ENCRYPTION_KEY?: string;
  CLOUDFLARE_ACCESS_CLIENT_ID?: string;
  CLOUDFLARE_ACCESS_CLIENT_SECRET?: string;
  INVENTIA_STOCK_WRITES_ENABLED?: string;
};

declare global {
  namespace Cloudflare {
    interface Env extends ApiBindings {}
  }
}

type ApiEnvironment = { Bindings: ApiBindings };

export const api = new OpenAPIHono<ApiEnvironment>();
api.route("/", aiRoutes);
api.route("/", settingsRoutes);
api.route("/", ingredientRoutes);
api.route("/", dishRoutes);
api.route("/", imageRoutes);
api.route("/", mealRoutes);

const healthRoute = createRoute({
  method: "get",
  path: "/api/health",
  summary: "Health check",
  responses: {
    200: {
      description: "Service is healthy.",
      content: {
        "application/json": {
          schema: z.object({ status: z.literal("ok") }).strict(),
        },
      },
    },
  },
});

api.openapi(healthRoute, (context) => context.json({ status: "ok" }, 200));

api.doc("/api/openapi", {
  openapi: "3.1.0",
  info: {
    title: "Cho API",
    version: "1.0.0",
  },
});

api.get("/api/scalar", Scalar({ url: "/api/openapi" }));

const schemas = {
  recipe: recipeSchema,
  nutrition: nutritionFactsSchema,
  meal: mealLogSchema,
} as const;

const schemaRoute = createRoute({
  method: "get",
  path: "/api/schemas/{schemaName}",
  summary: "Get a JSON Schema",
  request: {
    params: z.object({ schemaName: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "JSON Schema in draft-2020-12 format.",
      content: {
        "application/json": {
          schema: z.object({}).passthrough(),
        },
      },
    },
    404: {
      description: "The schema name is not supported.",
      content: {
        "application/json": {
          schema: z.object({ error: z.literal("Unknown schema"), schemaName: z.string() }).strict(),
        },
      },
    },
  },
});

api.openapi(schemaRoute, (context) => {
  const { schemaName } = context.req.valid("param");
  if (!Object.hasOwn(schemas, schemaName)) {
    return context.json({ error: "Unknown schema", schemaName }, 404);
  }
  const schema = schemas[schemaName as keyof typeof schemas];
  return context.json(z.toJSONSchema(schema, { target: "draft-2020-12" }), 200);
});

api.notFound((context) => context.json({ error: "Not found" }, 404));
api.onError((error, context) => {
  console.error("API request failed", error);
  return context.json({ error: "Internal server error" }, 500);
});
