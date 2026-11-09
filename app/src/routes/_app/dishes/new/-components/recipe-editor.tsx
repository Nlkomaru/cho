import { Box, chakra, Grid, Stack } from "@chakra-ui/react";
import { ChevronsDownUp, ChevronsUpDown, Plus, Sparkles } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { GanttChart } from "@/components/recipe/gantt-chart";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { toaster } from "@/components/ui/toaster";
import {
  recipeSchema,
  type RecipeIngredientEntry,
  type RecipeJson,
  type RecipeStep,
} from "@/domain/recipe";

import { AiStructureDialog } from "./ai-structure-dialog";
import { BasicInfo } from "./basic-info";
import { CautionList } from "./caution-editor";
import { EDITOR_MAX_W, EditorActionBar } from "./editor-action-bar";
import { FormToc, useActiveSection } from "./form-toc";
import { GroupManager } from "./group-manager";
import { IngredientRows } from "./ingredient-rows";
import {
  checkDraft,
  emptyEntry,
  emptyStep,
  fieldIds,
  makeId,
  previewSchedule,
  removeEntry,
  removeGroup,
  removeStep,
  syncGroups,
  type DraftIssue,
  type IngredientOption,
  type RecipeDraft,
} from "./recipe-draft";
import { StepEditor } from "./step-editor";

/** 保存 API に渡す料理の内容。 */
export interface RecipeSavePayload {
  name: string;
  category: string | null;
  servings: number;
  recipe: RecipeJson;
}

/** AI 構造化 API の入力。 */
export interface RecipeStructureRequest {
  dishName: string;
  ingredients: RecipeIngredientEntry[];
  rawStepsText: string;
}

export interface RecipeEditorProps {
  mode: "create" | "edit";
  initial: RecipeDraft;
  /** 材料マスタ。 */
  ingredients: readonly IngredientOption[];
  /** 編集時のパンくずに使う。 */
  dish?: { id: string; name: string };
  /** 失敗したら Error を投げる。 */
  onSave(payload: RecipeSavePayload): Promise<void>;
  onStructure(request: RecipeStructureRequest): Promise<unknown>;
  onCancel(): void;
  /** 保存バーを画面下に固定する (Storybook では false)。 */
  fixedActionBar?: boolean;
}

const sections = [
  { id: "recipe-basic", label: "基本情報" },
  { id: "recipe-ingredients", label: "材料" },
  { id: "recipe-steps", label: "手順" },
  { id: "recipe-cautions", label: "注意事項" },
] as const;

const fieldMessage = (message: string) => message.replace(/^[^:：]+: /, "");

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 手順の生成物を消したとき、それを参照していた投入も外す。 */
function dropDanglingIntermediates(recipe: RecipeJson): RecipeJson {
  const outputs = new Set(
    recipe.steps.flatMap((step) => step.outputs.map((output) => `${step.id}::${output.id}`)),
  );
  return {
    ...recipe,
    steps: recipe.steps.map((step) => ({
      ...step,
      inputs: step.inputs.filter(
        (input) =>
          input.type !== "intermediate" || outputs.has(`${input.fromStepId}::${input.outputId}`),
      ),
    })),
  };
}

/**
 * レシピの作成・編集フォーム。データの取得と保存 API は親 (route) が持つ。
 */
export function RecipeEditor({
  mode,
  initial,
  ingredients,
  dish,
  onSave,
  onStructure,
  onCancel,
  fixedActionBar = true,
}: RecipeEditorProps) {
  const [draft, setDraft] = useState(initial);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const activeSection = useActiveSection(sections.map((section) => section.id));
  const { recipe } = draft;

  const check = useMemo(() => (submitted ? checkDraft(draft) : null), [submitted, draft]);
  const issues: readonly DraftIssue[] = check && !check.success ? check.issues : [];
  const errors = useMemo(
    () =>
      Object.fromEntries(
        issues.map((issue) => [issue.fieldId, fieldMessage(issue.message)] as const).reverse(),
      ),
    [issues],
  );
  const schedule = useMemo(() => previewSchedule(recipe), [recipe]);

  const changeRecipe = (update: (current: RecipeJson) => RecipeJson) =>
    setDraft((current) => ({ ...current, recipe: update(current.recipe) }));
  const updateStep = (id: string, patch: Partial<RecipeStep>) =>
    changeRecipe((current) =>
      dropDanglingIntermediates({
        ...current,
        steps: current.steps.map((step) => (step.id === id ? { ...step, ...patch } : step)),
      }),
    );
  const setStepOpen = (id: string, open: boolean) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  // 手順を開いてから要素を探す (描画を 2 フレーム待つ)
  const reveal = (elementId: string, stepId?: string, focus = true) => {
    if (stepId) setStepOpen(stepId, true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const element = document.getElementById(elementId);
        if (!element) return;
        element.scrollIntoView({
          block: "center",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
        if (focus) element.focus({ preventScroll: true });
      }),
    );
  };

  const addStep = () => {
    const step = emptyStep(recipe.steps.length + 1);
    changeRecipe((current) => ({ ...current, steps: [...current.steps, step] }));
    reveal(fieldIds.step(step.id, "title"), step.id);
  };

  const addEntry = () => {
    const entry = emptyEntry();
    changeRecipe((current) => ({ ...current, ingredients: [...current.ingredients, entry] }));
    reveal(fieldIds.entry(entry.id, "ingredient"));
  };

  const missingForAi = [
    ...(draft.name.trim() ? [] : ["料理名"]),
    ...(recipe.ingredients.length &&
    recipe.ingredients.every(
      (entry) => entry.ingredientId && entry.amount > 0 && entry.displayAmount.trim(),
    )
      ? []
      : ["材料"]),
  ];

  async function structure(text: string) {
    setAiBusy(true);
    setAiError("");
    try {
      const entries = recipe.ingredients.map((entry) => ({ ...entry }));
      const result = await onStructure({
        dishName: draft.name.trim(),
        ingredients: entries,
        rawStepsText: text,
      });
      const checked = recipeSchema.safeParse({
        ...(typeof result === "object" && result !== null ? result : {}),
        servings: Number(draft.servings),
        ingredients: entries,
      });
      if (!checked.success)
        throw new Error(
          checked.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("\n"),
        );
      setDraft((current) => ({ ...current, recipe: checked.data }));
      setExpanded(new Set());
      setAiOpen(false);
      toaster.create({ type: "success", title: "手順を作成しました" });
    } catch (cause) {
      setAiError(cause instanceof Error ? cause.message : "手順を作成できませんでした。");
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setSaveError("");
    const result = checkDraft(draft);
    if (!result.success) {
      const first = result.issues[0];
      reveal(first.fieldId, first.stepId);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: draft.name.trim(),
        category: draft.category.trim() || null,
        servings: Number(draft.servings),
        recipe: result.recipe,
      });
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "レシピを保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  const stepErrorCount = (stepId: string) =>
    issues.filter((issue) => issue.stepId === stepId).length;
  const allOpen = recipe.steps.length > 0 && recipe.steps.every((step) => expanded.has(step.id));
  const stepIssues = issues.filter((issue) => issue.fieldId === fieldIds.steps);
  const hasCycle = recipe.steps.length > 0 && schedule === null;

  return (
    <Page size="lg">
      <Box maxW={EDITOR_MAX_W}>
        <PageHeader
          title={mode === "edit" ? "レシピを編集" : "レシピを作成"}
          breadcrumbs={[
            { label: "レシピ", to: "/dishes" },
            ...(dish ? [{ label: dish.name, to: `/dishes/${dish.id}` }] : []),
          ]}
          actions={
            <Button variant="outline" onClick={() => setAiOpen(true)}>
              <Sparkles />
              テキストから作成
            </Button>
          }
        />
      </Box>
      <chakra.form
        onSubmit={submit}
        noValidate
        aria-label={mode === "edit" ? "レシピを編集" : "レシピを作成"}
      >
        <Grid
          templateColumns={{ base: "minmax(0, 1fr)", lg: "200px minmax(0, 800px)" }}
          columnGap={{ lg: "16" }}
        >
          <Box
            display={{ base: "none", lg: "block" }}
            position="sticky"
            top="88px"
            alignSelf="start"
          >
            <FormToc items={sections} activeId={activeSection} />
          </Box>
          <Stack
            gap={{ base: "10", md: "12" }}
            minW="0"
            css={{ "& > [id]": { scrollMarginTop: "88px" } }}
          >
            <Section id="recipe-basic" title="基本情報">
              <BasicInfo
                name={draft.name}
                category={draft.category}
                servings={draft.servings}
                summary={recipe.summary}
                equipment={recipe.equipment}
                errors={errors}
                onFieldsChange={(patch) =>
                  setDraft((current) => ({
                    ...current,
                    ...patch,
                    recipe:
                      patch.servings !== undefined && Number(patch.servings) >= 1
                        ? { ...current.recipe, servings: Math.round(Number(patch.servings)) }
                        : current.recipe,
                  }))
                }
                onSummaryChange={(summary) => changeRecipe((current) => ({ ...current, summary }))}
                onEquipmentChange={(equipment) =>
                  changeRecipe((current) => ({ ...current, equipment }))
                }
              />
            </Section>

            <Section
              id="recipe-ingredients"
              title="材料"
              meta={recipe.ingredients.length ? `${recipe.ingredients.length}品` : undefined}
            >
              <Stack gap="8">
                <IngredientRows
                  entries={recipe.ingredients}
                  groups={recipe.ingredientGroups}
                  ingredients={ingredients}
                  errors={errors}
                  onAdd={addEntry}
                  onRemove={(id) => changeRecipe((current) => removeEntry(current, id))}
                  onChange={(id, patch) =>
                    changeRecipe((current) =>
                      syncGroups({
                        ...current,
                        ingredients: current.ingredients.map((entry) =>
                          entry.id === id ? { ...entry, ...patch } : entry,
                        ),
                      }),
                    )
                  }
                />
                <GroupManager
                  groups={recipe.ingredientGroups}
                  errors={errors}
                  onAdd={() =>
                    changeRecipe((current) => ({
                      ...current,
                      ingredientGroups: [
                        ...current.ingredientGroups,
                        { id: makeId("grp"), symbol: "★", label: "", ingredientEntryIds: [] },
                      ],
                    }))
                  }
                  onRemove={(id) => changeRecipe((current) => removeGroup(current, id))}
                  onChange={(id, patch) =>
                    changeRecipe((current) => ({
                      ...current,
                      ingredientGroups: current.ingredientGroups.map((group) =>
                        group.id === id ? { ...group, ...patch } : group,
                      ),
                    }))
                  }
                />
              </Stack>
            </Section>

            <Section
              id="recipe-steps"
              title="手順"
              meta={recipe.steps.length ? `${recipe.steps.length}手順` : undefined}
              actions={
                recipe.steps.length ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      setExpanded(
                        allOpen ? new Set() : new Set(recipe.steps.map((step) => step.id)),
                      )
                    }
                  >
                    {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
                    {allOpen ? "すべて閉じる" : "すべて開く"}
                  </Button>
                ) : undefined
              }
            >
              <Stack gap="6">
                {schedule ? (
                  <GanttChart
                    schedule={schedule}
                    steps={recipe.steps}
                    label="工程表のプレビュー"
                    onStepSelect={(stepId) => reveal(`step-editor-${stepId}`, stepId, false)}
                  />
                ) : null}
                {stepIssues.length ? (
                  <Feedback tone="error" size="sm" role="status">
                    {stepIssues.length === 1 ? (
                      stepIssues[0].message
                    ) : (
                      <chakra.ul m="0" ps="4">
                        {stepIssues.map((issue) => (
                          <li key={issue.message}>{issue.message}</li>
                        ))}
                      </chakra.ul>
                    )}
                  </Feedback>
                ) : null}
                {hasCycle ? (
                  <Feedback tone="warning" size="sm">
                    手順の依存関係が循環しているため、工程表を表示できません
                  </Feedback>
                ) : null}
                {recipe.steps.length ? (
                  <Stack as="ol" gap="2" m="0" p="0">
                    {recipe.steps.map((step) => (
                      <StepEditor
                        key={step.id}
                        step={step}
                        steps={recipe.steps}
                        entries={recipe.ingredients}
                        groups={recipe.ingredientGroups}
                        expanded={expanded.has(step.id)}
                        onExpandedChange={(open) => setStepOpen(step.id, open)}
                        errors={errors}
                        errorCount={expanded.has(step.id) ? 0 : stepErrorCount(step.id)}
                        onChange={(patch) => updateStep(step.id, patch)}
                        onRemove={() => changeRecipe((current) => removeStep(current, step.id))}
                      />
                    ))}
                  </Stack>
                ) : null}
                <Button
                  id={fieldIds.steps}
                  variant="outline"
                  size="sm"
                  alignSelf="start"
                  onClick={addStep}
                >
                  <Plus />
                  手順を追加
                </Button>
              </Stack>
            </Section>

            <Section id="recipe-cautions" title="注意事項">
              <CautionList
                cautions={recipe.globalCautions}
                errors={errors}
                onChange={(globalCautions) =>
                  changeRecipe((current) => ({ ...current, globalCautions }))
                }
              />
            </Section>
          </Stack>
        </Grid>
        <EditorActionBar
          issues={issues}
          error={saveError}
          busy={saving}
          submitLabel="保存"
          onCancel={onCancel}
          onIssueSelect={(issue) => reveal(issue.fieldId, issue.stepId)}
          fixed={fixedActionBar}
        />
      </chakra.form>
      <AiStructureDialog
        open={aiOpen}
        onOpenChange={(open) => {
          setAiOpen(open);
          if (!open) setAiError("");
        }}
        missing={missingForAi}
        stepCount={recipe.steps.length}
        busy={aiBusy}
        error={aiError}
        onSubmit={(text) => void structure(text)}
      />
    </Page>
  );
}
