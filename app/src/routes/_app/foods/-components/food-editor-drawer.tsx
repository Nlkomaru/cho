import { Grid, Input, Stack, Textarea } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { SubHeading } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Feedback } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { FormDrawer } from "@/components/ui/form-drawer";
import { NumberField } from "@/components/ui/number-field";
import type { Food } from "@/domain/ingredient";
import { NutritionFields } from "@/routes/_app/ingredients/-components/nutrition-fields";

import {
  emptyFoodForm,
  type FoodForm,
  type FoodPayload,
  foodFormFrom,
  payloadFromFoodForm,
} from "./food-form";

export interface FoodEditorDrawerProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** null なら新規作成。 */
  food: Food | null;
  /** 失敗時は Error を投げる (メッセージをドロワー内に表示する)。 */
  onSave(payload: FoodPayload): Promise<void>;
  onDelete(food: Food): Promise<void>;
}

const messageOf = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback;

/**
 * 定番食品の作成・編集ドロワー。基本 → 栄養価 → メモ。
 */
export function FoodEditorDrawer({
  open,
  onOpenChange,
  food,
  onSave,
  onDelete,
}: FoodEditorDrawerProps) {
  const [form, setForm] = useState<FoodForm>(emptyFoodForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const foodId = food?.id;

  // 開くたび・対象が変わるたびにフォームを作り直す
  useEffect(() => {
    if (!open) return;
    setForm(food ? foodFormFrom(food) : emptyFoodForm());
    setError("");
  }, [open, foodId, food]);

  const set = <K extends keyof FoodForm>(key: K, value: FoodForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    setError("");
    let payload: FoodPayload;
    try {
      payload = payloadFromFoodForm(form);
    } catch (cause) {
      setError(messageOf(cause, "入力内容を確認してください。"));
      return;
    }
    setSaving(true);
    try {
      await onSave(payload);
    } catch (cause) {
      setError(messageOf(cause, "定番食品を保存できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!food) return;
    setDeleting(true);
    try {
      await onDelete(food);
      setConfirmOpen(false);
    } catch (cause) {
      setConfirmOpen(false);
      setError(messageOf(cause, "定番食品を削除できませんでした。"));
    } finally {
      setDeleting(false);
    }
  }

  const basis = `${form.servingLabel.trim() || "1食分"} あたり`;

  return (
    <>
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={food ? food.name : "定番食品を追加"}
        size="lg"
        onSubmit={() => void save()}
        footer={
          <>
            {food ? (
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

          <Stack gap="5">
            <SubHeading>基本</SubHeading>
            <Field label="食品名" required>
              <Input
                value={form.name}
                maxLength={120}
                required
                placeholder="例: プロテインバー・サラダチキン・白米 150g"
                onChange={(event) => set("name", event.currentTarget.value)}
              />
            </Field>
            <Grid
              templateColumns={{
                base: "minmax(0, 1fr)",
                sm: "repeat(3, minmax(0, 1fr))",
              }}
              gap="4"
            >
              <Field label="カテゴリ">
                <Input
                  value={form.category}
                  maxLength={64}
                  placeholder="例: 主食・間食"
                  onChange={(event) => set("category", event.currentTarget.value)}
                />
              </Field>
              <Field label="1食分の目安" required>
                <Input
                  value={form.servingLabel}
                  maxLength={64}
                  required
                  placeholder="例: 1食分・1個・1本"
                  onChange={(event) => set("servingLabel", event.currentTarget.value)}
                />
              </Field>
              <NumberField
                label="価格"
                unit="円"
                min={0}
                step={1}
                value={form.priceYen}
                helperText={basis}
                onChange={(next) => set("priceYen", next)}
              />
            </Grid>
          </Stack>

          <NutritionFields
            value={form}
            onChange={(nutrition) => setForm((current) => ({ ...current, ...nutrition }))}
            basis={basis}
          />

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
      {food ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`「${food.name}」を削除しますか？`}
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
