import { z } from "zod";

export const micronutrientEntrySchema = z
  .object({
    key: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1).max(64),
    amount: z.number().min(0),
    unit: z.enum(["g", "mg", "ug", "kcal"]),
  })
  .strict();

export const nutritionFactsSchema = z
  .object({
    caloriesKcal: z.number().min(0),
    proteinG: z.number().min(0),
    fatG: z.number().min(0),
    carbohydrateG: z.number().min(0),
    fiberG: z.number().min(0).nullable().default(null),
    saltEquivalentG: z.number().min(0).nullable().default(null),
    micronutrients: z.array(micronutrientEntrySchema).default([]),
  })
  .strict();

export type MicronutrientEntry = z.infer<typeof micronutrientEntrySchema>;
export type NutritionFacts = z.infer<typeof nutritionFactsSchema>;

export function scaleNutritionFacts(facts: NutritionFacts, factor: number): NutritionFacts {
  if (!Number.isFinite(factor) || factor < 0)
    throw new RangeError("Nutrition scale factor must be finite and non-negative");
  return {
    caloriesKcal: facts.caloriesKcal * factor,
    proteinG: facts.proteinG * factor,
    fatG: facts.fatG * factor,
    carbohydrateG: facts.carbohydrateG * factor,
    fiberG: facts.fiberG === null ? null : facts.fiberG * factor,
    saltEquivalentG: facts.saltEquivalentG === null ? null : facts.saltEquivalentG * factor,
    micronutrients: facts.micronutrients.map((entry) => ({
      ...entry,
      amount: entry.amount * factor,
    })),
  };
}

/** Adds an optional nutrient; null only while no input has provided a value. */
const addOptional = (total: number | null, value: number | null) =>
  value === null ? total : (total ?? 0) + value;

/**
 * Sums nutrition facts. Fiber and salt add up the inputs that have a value, so one input
 * without them does not blank the whole total; they stay null only when no input has them.
 */
export function sumNutritionFacts(factsList: readonly NutritionFacts[]): NutritionFacts {
  const result: NutritionFacts = {
    caloriesKcal: 0,
    proteinG: 0,
    fatG: 0,
    carbohydrateG: 0,
    fiberG: factsList.length === 0 ? 0 : null,
    saltEquivalentG: factsList.length === 0 ? 0 : null,
    micronutrients: [],
  };
  const micros = new Map<string, MicronutrientEntry>();
  for (const facts of factsList) {
    result.caloriesKcal += facts.caloriesKcal;
    result.proteinG += facts.proteinG;
    result.fatG += facts.fatG;
    result.carbohydrateG += facts.carbohydrateG;
    result.fiberG = addOptional(result.fiberG, facts.fiberG);
    result.saltEquivalentG = addOptional(result.saltEquivalentG, facts.saltEquivalentG);
    for (const entry of facts.micronutrients) {
      const key = `${entry.key}\u0000${entry.unit}`;
      const previous = micros.get(key);
      micros.set(
        key,
        previous ? { ...previous, amount: previous.amount + entry.amount } : { ...entry },
      );
    }
  }
  result.micronutrients = [...micros.values()];
  return result;
}
