import type { RecipeJson } from "@/domain/recipe";
import type {
  IngredientOption,
  RecipeDraft,
} from "@/routes/_app/dishes/new/-components/recipe-draft";

import { curryDishWithImages, curryRecipe, ingredientMaster } from "../recipe/fixtures";

/** エディターに渡す材料マスタ (id・名前・基準単位だけ)。 */
export const editorIngredients: IngredientOption[] = ingredientMaster.map(
  ({ id, name, baseUnit }) => ({
    id,
    name,
    baseUnit,
  }),
);

export const buildDraft = (overrides: Partial<RecipeDraft> = {}): RecipeDraft => ({
  name: "ポークカレー",
  category: "主菜",
  servings: "4",
  coverImageId: null,
  recipe: curryRecipe,
  ...overrides,
});

export const curryDraft = buildDraft();

/** 表紙と手順の写真があるカレー。 */
export const curryDraftWithImages = buildDraft({
  coverImageId: curryDishWithImages.coverImageId,
  recipe: curryDishWithImages.recipe,
});

/** API を呼ばずにアップロードしたことにする (ID は毎回新しい UUID)。 */
export const fakeUpload = () => resolveLater({ id: crypto.randomUUID() }, 1200);

export const blankEditorRecipe: RecipeJson = {
  ...curryRecipe,
  summary: null,
  equipment: [],
  ingredientGroups: [],
  ingredients: [],
  steps: [],
  globalCautions: [],
};

export const blankDraftFixture = buildDraft({
  name: "",
  category: "",
  servings: "2",
  recipe: { ...blankEditorRecipe, servings: 2 },
});

/** API を呼ばずに少し待ってから成功する。 */
export const resolveLater = <T>(value: T, ms = 600) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
