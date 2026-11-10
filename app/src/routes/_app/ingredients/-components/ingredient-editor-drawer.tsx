import { Grid, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { SubHeading } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Feedback } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { FormDrawer } from "@/components/ui/form-drawer";
import { NumberField } from "@/components/ui/number-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { Ingredient } from "@/domain/ingredient";

import {
  basisForDimension,
  basisLabel,
  type Dimension,
  dimensionLabels,
  emptyIngredientForm,
  type EstimateResult,
  type IngredientForm,
  type IngredientPayload,
  ingredientFormFrom,
  nutritionFormFrom,
  payloadFromForm,
} from "./ingredient-form";
import { type InventiaActions, InventiaLinkPanel } from "./inventia-link-panel";
import { NutritionFields } from "./nutrition-fields";

export interface IngredientEditorDrawerProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** null なら新規作成。 */
  ingredient: Ingredient | null;
  /** 失敗時は Error を投げる (メッセージをドロワー内に表示する)。 */
  onSave(payload: IngredientPayload): Promise<void>;
  onDelete(ingredient: Ingredient): Promise<void>;
  onEstimate(
    input: Pick<IngredientPayload, "name" | "baseDimension" | "baseUnit">,
  ): Promise<EstimateResult>;
  inventia: InventiaActions;
}

const dimensionItems = (Object.keys(dimensionLabels) as Dimension[]).map((value) => ({
  value,
  label: dimensionLabels[value],
}));

const messageOf = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback;

/**
 * 材料の作成・編集ドロワー。基本 → 栄養価 → Inventia 連携 (編集時のみ) → メモ。
 */
export function IngredientEditorDrawer({
  open,
  onOpenChange,
  ingredient,
  onSave,
  onDelete,
  onEstimate,
  inventia,
}: IngredientEditorDrawerProps) {
  const [form, setForm] = useState<IngredientForm>(emptyIngredientForm);
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const ingredientId = ingredient?.id;
  const linked = Boolean(ingredient?.inventiaItemId);

  // 開くたび・対象が変わるたびにフォームを作り直す
  // 同じ材料の更新 (Inventia 連携など) では入力中の内容を消さないよう、id だけを見る
  useEffect(() => {
    if (!open) return;
    setForm(ingredient ? ingredientFormFrom(ingredient) : emptyIngredientForm());
    setError("");
    setNotice("");
  }, [open, ingredientId]);

  const set = <K extends keyof IngredientForm>(key: K, value: IngredientForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    setError("");
    setNotice("");
    let payload: IngredientPayload;
    try {
      payload = payloadFromForm(form, !linked);
    } catch (cause) {
      setError(messageOf(cause, "入力内容を確認してください。"));
      return;
    }
    setSaving(true);
    try {
      await onSave(payload);
    } catch (cause) {
      setError(messageOf(cause, "材料を保存できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  async function estimate() {
    setEstimating(true);
    setError("");
    setNotice("");
    try {
      const result = await onEstimate({
        name: form.name.trim(),
        baseDimension: form.baseDimension,
        baseUnit: form.baseUnit.trim(),
      });
      setForm((current) => ({
        ...current,
        ...nutritionFormFrom(result),
        gramPerUnit:
          result.gramPerUnit === undefined ? current.gramPerUnit : String(result.gramPerUnit),
      }));
      setNotice("推定値を反映しました。確認してから保存してください。");
    } catch (cause) {
      setError(messageOf(cause, "栄養価を推定できませんでした。"));
    } finally {
      setEstimating(false);
    }
  }

  async function remove() {
    if (!ingredient) return;
    setDeleting(true);
    try {
      await onDelete(ingredient);
      setConfirmOpen(false);
    } catch (cause) {
      setConfirmOpen(false);
      setError(messageOf(cause, "材料を削除できませんでした。"));
    } finally {
      setDeleting(false);
    }
  }

  const basis = basisLabel({
    nutritionBasisAmount: Number(form.nutritionBasisAmount) || 0,
    baseUnit: form.baseUnit || "—",
  });

  return (
    <>
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={ingredient ? ingredient.name : "材料を追加"}
        size="lg"
        onSubmit={() => void save()}
        footer={
          <>
            {ingredient ? (
              <Button
                type="button"
                variant="danger"
                me="auto"
                onClick={() => setConfirmOpen(true)}
                disabled={saving}
              >
                削除
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              保存
            </Button>
          </>
        }
      >
        <Stack gap="10">
          {error ? <Feedback tone="error">{error}</Feedback> : null}
          {notice ? <Feedback tone="info">{notice}</Feedback> : null}

          <Stack gap="5">
            <SubHeading>基本</SubHeading>
            <Field label="材料名" required>
              <Input
                value={form.name}
                maxLength={120}
                required
                onChange={(event) => set("name", event.currentTarget.value)}
              />
            </Field>
            <Stack gap="1.5">
              <Text textStyle="label" color="fg.muted" aria-hidden="true">
                次元
              </Text>
              <SegmentedControl
                label="次元"
                value={form.baseDimension}
                items={dimensionItems}
                onChange={(dimension) =>
                  setForm((current) => ({
                    ...current,
                    baseDimension: dimension,
                    ...basisForDimension(dimension),
                  }))
                }
              />
            </Stack>
            <Grid
              templateColumns={{ base: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" }}
              gap="4"
            >
              <Field label="基準単位" required readOnly={form.baseDimension !== "count"}>
                <Input
                  value={form.baseUnit}
                  maxLength={50}
                  required
                  readOnly={form.baseDimension !== "count"}
                  onChange={(event) => set("baseUnit", event.currentTarget.value)}
                />
              </Field>
              <Field label="栄養価の基準量" readOnly>
                <Input value={`${form.nutritionBasisAmount} ${form.baseUnit}`} readOnly />
              </Field>
              <NumberField
                label="1単位あたりのグラム数"
                unit="g"
                min={0}
                step={0.1}
                value={form.gramPerUnit}
                onChange={(next) => set("gramPerUnit", next)}
              />
            </Grid>
            {linked ? null : (
              <Grid templateColumns={{ base: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" }}>
                <NumberField
                  label="単価（手入力）"
                  unit="円"
                  min={0}
                  step={1}
                  value={form.unitPriceYen}
                  helperText={`${basis}。Inventia と連携すると Inventia の価格を使います`}
                  onChange={(next) => set("unitPriceYen", next)}
                />
              </Grid>
            )}
          </Stack>

          <NutritionFields
            value={form}
            onChange={(nutrition) => setForm((current) => ({ ...current, ...nutrition }))}
            basis={basis}
            onEstimate={() => void estimate()}
            estimating={estimating}
            estimateDisabled={!form.name.trim()}
          />

          {ingredient ? (
            <InventiaLinkPanel key={ingredient.id} ingredient={ingredient} actions={inventia} />
          ) : null}

          <Stack gap="5">
            <SubHeading>メモ</SubHeading>
            <Textarea
              aria-label="メモ"
              value={form.memo}
              maxLength={2000}
              onChange={(event) => set("memo", event.currentTarget.value)}
            />
          </Stack>
        </Stack>
      </FormDrawer>
      {ingredient ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`「${ingredient.name}」を削除しますか？`}
          description="この操作は取り消せません。"
          confirmLabel="削除する"
          tone="danger"
          busy={deleting}
          onConfirm={() => void remove()}
        />
      ) : null}
    </>
  );
}
