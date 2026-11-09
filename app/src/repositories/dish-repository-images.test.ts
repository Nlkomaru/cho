import { afterEach, describe, expect, test } from "vite-plus/test";

import { dishSchema, ingredientSchema, type Dish } from "../domain/ingredient";
import { createDishService } from "../services/dish";
import { createTestD1Harness, type TestD1Harness } from "../tests/test-harness";
import { createDishRepository, DishImageError } from "./dish-repository";
import { createIngredientRepository } from "./ingredient-repository";

const imageA = "11111111-1111-4111-8111-111111111111";
const imageB = "22222222-2222-4222-8222-222222222222";
const imageC = "33333333-3333-4333-8333-333333333333";

let harness: TestD1Harness;
afterEach(() => harness.cleanup());

function insertImage(id: string, targetType = "unassigned", targetId = "unassigned") {
  harness.sqlite
    .prepare(
      "INSERT INTO media_images (id, target_type, target_id, object_key, content_type, byte_size) VALUES (?, ?, ?, ?, 'image/png', 10)",
    )
    .run(id, targetType, targetId, `images/${id}`);
}

function imageRow(id: string) {
  return harness.sqlite
    .prepare("SELECT target_type, target_id, sort_order FROM media_images WHERE id = ?")
    .get(id) as { target_type: string; target_id: string; sort_order: number } | undefined;
}

function dish(id: string, images: { cover?: string | null; steps?: string[][] } = {}): Dish {
  const stepImages = images.steps ?? [[]];
  return dishSchema.parse({
    id,
    name: `Dish ${id}`,
    servings: 1,
    coverImageId: images.cover ?? null,
    recipe: {
      servings: 1,
      ingredients: [
        {
          id: "rice",
          ingredientId: "ing-1",
          name: "Rice",
          amount: 100,
          unit: "g",
          displayAmount: "100 g",
        },
      ],
      steps: stepImages.map((imageIds, index) => ({
        id: `step-${index + 1}`,
        stepNumber: index + 1,
        phase: "cook",
        title: `Step ${index + 1}`,
        instruction: "Cook.",
        executionMode: "active",
        timing: { activeDurationSec: 60 },
        dependsOnStepIds: index === 0 ? [] : [`step-${index}`],
        inputs: index === 0 ? [{ type: "ingredient", ingredientEntryId: "rice" }] : [],
        imageIds,
      })),
    },
  });
}

async function setup() {
  harness = createTestD1Harness();
  await createIngredientRepository(harness.db).create(
    ingredientSchema.parse({
      id: "ing-1",
      name: "Rice",
      normalizedName: "rice",
      baseDimension: "mass",
      baseUnit: "g",
      nutritionBasisAmount: 100,
      nutritionPerBasis: {
        caloriesKcal: 350,
        proteinG: 6,
        fatG: 1,
        carbohydrateG: 78,
        fiberG: 1,
        saltEquivalentG: 0,
        micronutrients: [],
      },
    }),
  );
  return createDishRepository(harness.db);
}

function beforeNextBatch(action: () => void) {
  const original = harness.db.batch.bind(harness.db);
  harness.db.batch = ((queries: Parameters<typeof original>[0]) => {
    action();
    return original(queries);
  }) as typeof harness.db.batch;
}

describe("dish images", () => {
  test("a claim that loses a race rolls the whole save back", async () => {
    const repository = await setup();
    [imageA, imageB].forEach((id) => insertImage(id));

    beforeNextBatch(() =>
      harness.sqlite.prepare("DELETE FROM media_images WHERE id = ?").run(imageA),
    );
    await expect(repository.create(dish("d1", { steps: [[imageA]] }))).rejects.toThrow(
      "Image not found",
    );

    beforeNextBatch(() =>
      harness.sqlite
        .prepare("UPDATE media_images SET target_type = 'dish', target_id = 'other' WHERE id = ?")
        .run(imageB),
    );
    await expect(repository.create(dish("d2", { steps: [[imageB]] }))).rejects.toThrow(
      "attached to another recipe or meal",
    );
    expect(harness.sqlite.prepare("SELECT COUNT(*) AS count FROM dishes").get()).toEqual({
      count: 0,
    });
    expect(imageRow(imageB)).toEqual({ target_type: "dish", target_id: "other", sort_order: 0 });
  });

  test("a released image restarts its 24 hour grace period", async () => {
    const repository = await setup();
    insertImage(imageA);
    harness.sqlite
      .prepare("UPDATE media_images SET created_at = datetime('now', '-3 days') WHERE id = ?")
      .run(imageA);
    await repository.create(dish("dish-1", { cover: imageA }));
    await repository.update("dish-1", { coverImageId: null });

    const row = harness.sqlite
      .prepare(
        "SELECT created_at > datetime('now', '-1 hours') AS fresh FROM media_images WHERE id = ?",
      )
      .get(imageA) as { fresh: number };
    expect(row.fresh).toBe(1);
  });

  test("create claims the cover and step images in display order", async () => {
    const repository = await setup();
    [imageA, imageB, imageC].forEach((id) => insertImage(id));

    const created = await repository.create(
      dish("dish-1", { cover: imageA, steps: [[imageB], [imageC]] }),
    );

    expect(created.coverImageId).toBe(imageA);
    expect(created.recipe.steps.map((step) => step.imageIds)).toEqual([[imageB], [imageC]]);
    expect(imageRow(imageA)).toEqual({ target_type: "dish", target_id: "dish-1", sort_order: 0 });
    expect(imageRow(imageB)).toEqual({ target_type: "dish", target_id: "dish-1", sort_order: 1 });
    expect(imageRow(imageC)).toEqual({ target_type: "dish", target_id: "dish-1", sort_order: 2 });
  });

  test("rejects missing, duplicated, and foreign images without writing the dish", async () => {
    const repository = await setup();
    insertImage(imageA);
    insertImage(imageB, "meal_log", "meal-1");
    insertImage(imageC, "dish", "other-dish");

    await expect(repository.create(dish("d1", { cover: imageC }))).rejects.toThrow(
      "attached to another recipe or meal",
    );
    await expect(repository.create(dish("d2", { steps: [[imageB]] }))).rejects.toBeInstanceOf(
      DishImageError,
    );
    await expect(
      repository.create(dish("d3", { cover: imageA, steps: [[imageA]] })),
    ).rejects.toThrow("used more than once");
    await expect(
      repository.create(dish("d4", { cover: "44444444-4444-4444-8444-444444444444" })),
    ).rejects.toThrow("Image not found");

    expect(harness.sqlite.prepare("SELECT COUNT(*) AS count FROM dishes").get()).toEqual({
      count: 0,
    });
    expect(imageRow(imageA)?.target_type).toBe("unassigned");
  });

  test("update keeps moved images, releases removed ones, and delete releases the rest", async () => {
    const repository = await setup();
    [imageA, imageB, imageC].forEach((id) => insertImage(id));
    await repository.create(dish("dish-1", { cover: imageA, steps: [[imageB, imageC]] }));

    const updated = await repository.update("dish-1", {
      coverImageId: imageB,
      recipe: dish("dish-1", { steps: [[imageC]] }).recipe,
    });

    expect(updated?.coverImageId).toBe(imageB);
    expect(imageRow(imageA)).toEqual({
      target_type: "unassigned",
      target_id: "unassigned",
      sort_order: 0,
    });
    expect(imageRow(imageB)).toEqual({ target_type: "dish", target_id: "dish-1", sort_order: 0 });
    expect(imageRow(imageC)).toEqual({ target_type: "dish", target_id: "dish-1", sort_order: 1 });

    await repository.delete("dish-1");
    expect(imageRow(imageB)?.target_type).toBe("unassigned");
    expect(imageRow(imageC)?.target_type).toBe("unassigned");
  });

  test("setImages replaces only the listed steps and rejects unknown steps", async () => {
    const repository = await setup();
    [imageA, imageB, imageC].forEach((id) => insertImage(id));
    await repository.create(dish("dish-1", { cover: imageA, steps: [[imageB], []] }));
    const service = createDishService({
      repository,
      ingredientRepository: createIngredientRepository(harness.db),
    });

    const updated = await service.setImages("dish-1", {
      coverImageId: null,
      stepImages: { "step-2": [imageC] },
    });

    expect(updated?.coverImageId).toBeNull();
    expect(updated?.recipe.steps.map((step) => step.imageIds)).toEqual([[imageB], [imageC]]);
    expect(imageRow(imageA)?.target_type).toBe("unassigned");
    await expect(service.setImages("dish-1", { stepImages: { nope: [] } })).rejects.toThrow(
      "Unknown step: nope",
    );
    expect(await service.setImages("missing", { coverImageId: null })).toBeNull();
  });
});
