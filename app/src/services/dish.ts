import {
  calculateDishCost,
  calculateDishNutrition,
  type Dish,
  type Ingredient,
} from "../domain/ingredient";
import { validateRecipeDag } from "../domain/recipe-scheduler";
import type { RecipeJson } from "../domain/recipe";
import { DishImageError } from "../repositories/dish-repository";

export interface DishRepository {
  list(): Promise<Dish[]>;
  getById(id: string): Promise<Dish | null>;
  create(input: Dish): Promise<Dish>;
  update(id: string, changes: Partial<Omit<Dish, "id">>): Promise<Dish | null>;
  delete(id: string): Promise<Dish | null>;
}
export interface DishIngredientRepository {
  getById(id: string): Promise<Ingredient | null>;
  /** Fetches many ingredients with a bounded number of queries. */
  getByIds?(ids: readonly string[]): Promise<Ingredient[]>;
}
export interface DishServiceOptions {
  repository: DishRepository;
  ingredientRepository: DishIngredientRepository;
}
export interface DishImageChanges {
  /** New cover, null to remove it, or undefined to keep it. */
  coverImageId?: string | null;
  /** Replaces the images of the listed steps; other steps keep theirs. */
  stepImages?: Readonly<Record<string, readonly string[]>>;
}
type DishInput = Omit<Dish, "totalNutrition" | "totalCostYen"> &
  Partial<Pick<Dish, "totalNutrition" | "totalCostYen">>;

export function createDishService({ repository, ingredientRepository }: DishServiceOptions) {
  async function loadIngredients(ids: readonly string[]): Promise<Map<string, Ingredient>> {
    const unique = [...new Set(ids)];
    if (ingredientRepository.getByIds) {
      const found = await ingredientRepository.getByIds(unique);
      return new Map(found.map((ingredient) => [ingredient.id, ingredient]));
    }
    const found = await Promise.all(unique.map((id) => ingredientRepository.getById(id)));
    return new Map(
      found.flatMap((ingredient) => (ingredient ? [[ingredient.id, ingredient] as const] : [])),
    );
  }
  async function calculate(
    recipe: RecipeJson,
    servings: number,
    known?: ReadonlyMap<string, Ingredient>,
  ) {
    const validation = validateRecipeDag(recipe);
    if (!validation.success) throw new Error(`Invalid recipe DAG: ${validation.errors.join("; ")}`);
    const lookup = known ?? (await loadIngredients(recipe.ingredients.map((e) => e.ingredientId)));
    const resolved = recipe.ingredients.map((entry) => {
      const ingredient = lookup.get(entry.ingredientId);
      if (!ingredient)
        throw new Error(
          `Unknown ingredient ${entry.ingredientId} referenced by recipe entry ${entry.id}`,
        );
      return { ingredient, amount: entry.amount };
    });
    return {
      totalNutrition: calculateDishNutrition(resolved, servings),
      totalCostYen: calculateDishCost(resolved, servings),
    };
  }
  async function complete(
    input: DishInput,
    known?: ReadonlyMap<string, Ingredient>,
  ): Promise<Dish> {
    const totals = await calculate(input.recipe, input.servings, known);
    return { ...input, ...totals };
  }
  async function update(id: string, changes: Partial<Omit<Dish, "id">>): Promise<Dish | null> {
    const current = await repository.getById(id);
    if (!current) return null;
    const updated = await complete({ ...current, ...changes, id });
    return repository.update(id, updated);
  }
  return {
    async list(): Promise<Dish[]> {
      const dishes = await repository.list();
      const known = await loadIngredients(
        dishes.flatMap((dish) => dish.recipe.ingredients.map((entry) => entry.ingredientId)),
      );
      return Promise.all(dishes.map((dish) => complete(dish, known)));
    },
    async get(id: string): Promise<Dish | null> {
      const dish = await repository.getById(id);
      return dish ? complete(dish) : null;
    },
    async create(input: DishInput): Promise<Dish> {
      return repository.create(await complete(input));
    },
    update,
    /** Attaches or replaces images without resending the whole recipe. */
    async setImages(id: string, changes: DishImageChanges): Promise<Dish | null> {
      const current = await repository.getById(id);
      if (!current) return null;
      const stepImages = changes.stepImages ?? {};
      const stepIds = new Set(current.recipe.steps.map((step) => step.id));
      const unknown = Object.keys(stepImages).filter((stepId) => !stepIds.has(stepId));
      if (unknown.length > 0) throw new DishImageError(`Unknown step: ${unknown.join(", ")}`);
      const recipe = {
        ...current.recipe,
        steps: current.recipe.steps.map((step) => {
          const imageIds = Object.hasOwn(stepImages, step.id) ? stepImages[step.id] : undefined;
          return imageIds ? { ...step, imageIds: [...imageIds] } : step;
        }),
      };
      return update(id, {
        recipe,
        ...(changes.coverImageId !== undefined ? { coverImageId: changes.coverImageId } : {}),
      });
    },
    delete: (id: string) => repository.delete(id),
  };
}
