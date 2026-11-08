import {
  calculateDishCost,
  calculateDishNutrition,
  type Dish,
  type Ingredient,
} from "../domain/ingredient";
import { validateRecipeDag } from "../domain/recipe-scheduler";
import type { RecipeJson } from "../domain/recipe";

export interface DishRepository {
  list(): Promise<Dish[]>;
  getById(id: string): Promise<Dish | null>;
  create(input: Dish): Promise<Dish>;
  update(id: string, changes: Partial<Omit<Dish, "id">>): Promise<Dish | null>;
  delete(id: string): Promise<Dish | null>;
}
export interface DishIngredientRepository {
  getById(id: string): Promise<Ingredient | null>;
}
export interface DishServiceOptions {
  repository: DishRepository;
  ingredientRepository: DishIngredientRepository;
}
type DishInput = Omit<Dish, "totalNutrition" | "totalCostYen"> &
  Partial<Pick<Dish, "totalNutrition" | "totalCostYen">>;

export function createDishService({ repository, ingredientRepository }: DishServiceOptions) {
  async function calculate(recipe: RecipeJson, servings: number) {
    const validation = validateRecipeDag(recipe);
    if (!validation.success) throw new Error(`Invalid recipe DAG: ${validation.errors.join("; ")}`);
    const resolved = await Promise.all(
      recipe.ingredients.map(async (entry) => {
        const ingredient = await ingredientRepository.getById(entry.ingredientId);
        if (!ingredient)
          throw new Error(
            `Unknown ingredient ${entry.ingredientId} referenced by recipe entry ${entry.id}`,
          );
        return { ingredient, amount: entry.amount };
      }),
    );
    return {
      totalNutrition: calculateDishNutrition(resolved, servings),
      totalCostYen: calculateDishCost(resolved, servings),
    };
  }
  async function complete(input: DishInput): Promise<Dish> {
    const totals = await calculate(input.recipe, input.servings);
    return { ...input, ...totals };
  }
  return {
    async list(): Promise<Dish[]> {
      return Promise.all((await repository.list()).map((dish) => complete(dish)));
    },
    async get(id: string): Promise<Dish | null> {
      const dish = await repository.getById(id);
      return dish ? complete(dish) : null;
    },
    async create(input: DishInput): Promise<Dish> {
      return repository.create(await complete(input));
    },
    async update(id: string, changes: Partial<Omit<Dish, "id">>): Promise<Dish | null> {
      const current = await repository.getById(id);
      if (!current) return null;
      const updated = await complete({ ...current, ...changes, id });
      return repository.update(id, updated);
    },
    delete: (id: string) => repository.delete(id),
  };
}
