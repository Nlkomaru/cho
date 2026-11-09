import { z } from "zod";

export const mcpToolNames = [
  "list_ingredients",
  "create_ingredient",
  "list_recipes",
  "create_recipe",
  "record_meal",
] as const;

export const mcpToolNameSchema = z.enum(mcpToolNames);
export type McpToolName = z.infer<typeof mcpToolNameSchema>;
