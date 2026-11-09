import { Badge, Flex, Stack, chakra } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { Section } from "@/components/layout/section";
import { Feedback } from "@/components/ui/feedback";
import type { RecipeJson } from "@/domain/recipe";

type RecipeCaution = RecipeJson["globalCautions"][number];

export interface RecipeNotesProps {
  summary?: string | null;
  notes?: string | null;
  equipment?: readonly string[];
  cautions?: readonly RecipeCaution[];
}

const cautionTone = (severity: RecipeCaution["severity"]) =>
  severity === "critical" ? "error" : severity === "warning" ? "warning" : "info";

function NoteBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section title={title} headingLevel={3}>
      {children}
    </Section>
  );
}

/**
 * レシピの補足 (概要・メモ・器具・注意事項)。横の列に縦積みで置く。すべて空なら何も描かない。
 */
export function RecipeNotes({ summary, notes, equipment = [], cautions = [] }: RecipeNotesProps) {
  const hasSummary = Boolean(summary?.trim());
  const hasNotes = Boolean(notes?.trim());
  if (!hasSummary && !hasNotes && equipment.length === 0 && cautions.length === 0) return null;

  return (
    <Stack gap="10">
      {hasSummary ? (
        <NoteBlock title="概要">
          <chakra.p textStyle="body" color="fg">
            {summary}
          </chakra.p>
        </NoteBlock>
      ) : null}
      {hasNotes ? (
        <NoteBlock title="メモ">
          <chakra.p textStyle="body" color="fg" whiteSpace="pre-wrap">
            {notes}
          </chakra.p>
        </NoteBlock>
      ) : null}
      {equipment.length ? (
        <NoteBlock title="器具">
          <Flex as="ul" gap="1.5" wrap="wrap" listStyle="none" m="0" p="0">
            {equipment.map((item) => (
              <chakra.li key={item}>
                <Badge>{item}</Badge>
              </chakra.li>
            ))}
          </Flex>
        </NoteBlock>
      ) : null}
      {cautions.length ? (
        <NoteBlock title="注意事項">
          <Stack gap="2">
            {cautions.map((caution) => (
              <Feedback
                key={caution.id}
                size="sm"
                role="status"
                tone={cautionTone(caution.severity)}
                title={caution.title}
              >
                {caution.description}
                {caution.triggerCondition ? `（${caution.triggerCondition}）` : ""}
              </Feedback>
            ))}
          </Stack>
        </NoteBlock>
      ) : null}
    </Stack>
  );
}
