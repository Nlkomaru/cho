import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, test } from "vite-plus/test";

const MIGRATION = "0005_recipe_ingredient_labels.sql";
const migrations = new URL("../../migrations/", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, migrations), "utf8");

function databaseBefore(migration: string) {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith(".sql") && name < migration)
    .sort())
    sqlite.exec(read(file));
  return sqlite;
}

const legacyEntry = (id: string, ingredientId: string, extra: Record<string, unknown>) => ({
  id,
  ingredientId,
  amount: 100,
  unit: "g",
  displayAmount: "100g",
  role: "main",
  groupId: null,
  prepNote: null,
  ...extra,
});

describe(MIGRATION, () => {
  test("drops names equal to the master name and moves other names to label", () => {
    const sqlite = databaseBefore(MIGRATION);
    const insertIngredient = sqlite.prepare(
      `INSERT INTO ingredients (id, name, normalized_name, base_dimension, base_unit, nutrition_basis_amount, nutrition_json)
       VALUES (?, ?, ?, 'mass', 'g', 100, '{}')`,
    );
    insertIngredient.run("ing-onion", "玉ねぎ", "玉ねぎ");
    insertIngredient.run("ing-salt", "食塩", "食塩");
    const ingredients = [
      legacyEntry("e-onion", "ing-onion", { name: "玉ねぎ" }),
      legacyEntry("e-garnish", "ing-onion", { name: "玉ねぎ（飾り用）" }),
      legacyEntry("e-salt", "ing-salt", { name: "塩", label: "ひとつまみの塩" }),
      legacyEntry("e-new", "ing-salt", { label: null }),
    ];
    const recipe = { schemaVersion: "1.0", servings: 2, ingredients, steps: [], other: "kept" };
    sqlite
      .prepare("INSERT INTO dishes (id, name, servings, recipe_json) VALUES (?, ?, ?, ?)")
      .run("dish-1", "オニオンスープ", 2, JSON.stringify(recipe));

    sqlite.exec(read(MIGRATION));
    const row = sqlite.prepare("SELECT recipe_json FROM dishes WHERE id = 'dish-1'").get() as {
      recipe_json: string;
    };
    const migrated = JSON.parse(row.recipe_json) as typeof recipe;

    expect(migrated.other).toBe("kept");
    expect(migrated.ingredients.map((entry) => entry.id)).toEqual([
      "e-onion",
      "e-garnish",
      "e-salt",
      "e-new",
    ]);
    for (const entry of migrated.ingredients) expect(entry).not.toHaveProperty("name");
    expect(migrated.ingredients.map((entry) => entry.label)).toEqual([
      null,
      "玉ねぎ（飾り用）",
      "ひとつまみの塩",
      null,
    ]);
    expect(migrated.ingredients[1]).toMatchObject({ ingredientId: "ing-onion", amount: 100 });

    // Running it again leaves the data unchanged
    sqlite.exec(read(MIGRATION));
    const again = sqlite.prepare("SELECT recipe_json FROM dishes WHERE id = 'dish-1'").get() as {
      recipe_json: string;
    };
    expect(JSON.parse(again.recipe_json)).toEqual(migrated);
  });
});
