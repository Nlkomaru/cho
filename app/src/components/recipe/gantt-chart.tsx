import { Box, chakra, useSlotRecipe } from "@chakra-ui/react";
import { Check, ListOrdered } from "lucide-react";
import {
  forwardRef,
  type KeyboardEvent,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import type { RecipeStep } from "@/domain/recipe";
import type { RecipeGanttBar, RecipeGanttSchedule } from "@/domain/recipe-scheduler";
import { formatClock, formatMinutes } from "@/lib/format";

import { ganttChartRecipe } from "./gantt-chart.recipe";
import { heatLevelLabel } from "./recipe-labels";

export interface GanttChartProps {
  schedule: RecipeGanttSchedule;
  /** 火加減・目標温度をツールチップに出すため。 */
  steps?: readonly RecipeStep[];
  /** 強調する行 (手順の一覧と連動)。 */
  activeStepId?: string | null;
  /** 完了した行は薄く表示し、番号をチェックにする。 */
  completedStepIds?: readonly string[];
  /** バーまたは行ラベルを押したとき。 */
  onStepSelect?(stepId: string): void;
  /** アクセシブルな名前。既定 "工程表"。 */
  label?: string;
}

export interface GanttChartHandle {
  /** 指定した手順の行を画面内へスクロールする。 */
  scrollToStep(stepId: string, options?: { behavior?: ScrollBehavior }): void;
}

const TICK_MINUTES = [1, 2, 5, 10, 15, 30, 60, 120] as const;

/** 目盛りが `maxTicks` 本 (既定 10) 以内に収まる最小の間隔 (秒)。 */
export function pickTickInterval(totalSec: number, maxTicks = 10): number {
  const minutes = totalSec / 60;
  const interval = TICK_MINUTES.find((step) => minutes / step <= maxTicks) ?? 240;
  return interval * 60;
}

interface LaneGroup {
  id: string;
  label: string;
  bars: RecipeGanttBar[];
}

/** レーンは最初に始まる手順の順に並べる (炊飯器 → まな板 → コンロ → 手作業 など)。 */
function groupLanes(schedule: RecipeGanttSchedule): LaneGroup[] {
  const lanes = schedule.lanes
    .map((lane) => ({
      ...lane,
      bars: schedule.bars
        .filter((bar) => bar.laneId === lane.id)
        .sort((a, b) => a.startSec - b.startSec || a.stepNumber - b.stepNumber),
    }))
    .filter((lane) => lane.bars.length > 0);
  return lanes.sort(
    (a, b) =>
      a.bars[0].startSec - b.bars[0].startSec || a.bars[0].stepNumber - b.bars[0].stepNumber,
  );
}

interface Edge {
  key: string;
  d: string;
  critical: boolean;
}

interface OverlayGeometry {
  width: number;
  height: number;
  edges: Edge[];
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * 工程のガントチャート。レーン (器具) ごとに手順を並べ、依存関係を矢印で結ぶ。
 * バーと行ラベルはボタンで、Enter / クリックで `onStepSelect` を呼ぶ。上下キーで隣のバーへ移動する。
 */
export const GanttChart = forwardRef<GanttChartHandle, GanttChartProps>(function GanttChart(
  { schedule, steps, activeStepId, completedStepIds, onStepSelect, label = "工程表" },
  ref,
) {
  const recipe = useSlotRecipe({ recipe: ganttChartRecipe });
  const styles = recipe();

  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const axisTrackRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const barRefs = useRef(new Map<string, HTMLButtonElement>());
  const [geometry, setGeometry] = useState<OverlayGeometry | null>(null);

  const lanes = useMemo(() => groupLanes(schedule), [schedule]);
  const orderedBars = useMemo(() => lanes.flatMap((lane) => lane.bars), [lanes]);
  const barById = useMemo(
    () => new Map(schedule.bars.map((bar) => [bar.stepId, bar])),
    [schedule.bars],
  );
  const stepById = useMemo(() => new Map((steps ?? []).map((step) => [step.id, step])), [steps]);
  const completed = useMemo(() => new Set(completedStepIds ?? []), [completedStepIds]);

  const total = Math.max(schedule.totalDurationSec, 1);
  // 目盛りの文字 ("50:00") が重ならないよう、時間軸の幅に合わせて本数を減らす
  const [trackWidth, setTrackWidth] = useState<number | null>(null);
  const maxTicks = trackWidth == null ? 10 : Math.max(2, Math.min(10, Math.floor(trackWidth / 48)));
  const tickInterval = pickTickInterval(total, maxTicks);
  const ticks = useMemo(() => {
    const values: number[] = [];
    for (let sec = 0; sec <= total + 1e-6; sec += tickInterval) values.push(sec);
    return values;
  }, [total, tickInterval]);
  const pct = (sec: number) => `${(Math.min(Math.max(sec, 0), total) / total) * 100}%`;

  const [overflowEnd, setOverflowEnd] = useState(false);
  const updateOverflow = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setOverflowEnd(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
  }, []);

  // 依存の矢印は px で描くため、行とバーの実寸から座標を作る
  const measure = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const bodyRect = body.getBoundingClientRect();
    const edges: Edge[] = [];
    for (const bar of schedule.bars) {
      const target = barRefs.current.get(bar.stepId);
      if (!target) continue;
      const to = target.getBoundingClientRect();
      for (const dependencyId of bar.dependsOnStepIds) {
        const source = barRefs.current.get(dependencyId);
        const dependency = barById.get(dependencyId);
        if (!source || !dependency) continue;
        const from = source.getBoundingClientRect();
        const fromLeft = from.left - bodyRect.left;
        const fromX = from.right - bodyRect.left;
        const toX = to.left - bodyRect.left;
        const toY = to.top + to.height / 2 - bodyRect.top;
        const down = to.top >= from.bottom;
        // バーの右には終了時刻のラベルがあるので、線は終端の角から上下に出してラベルを横切らない
        const startY = (down ? from.bottom : from.top) - bodyRect.top;
        let d: string;
        if (toX - fromX >= 8) {
          // 間が空くときは終端から下ろし、次のバーの左端へ横から入る
          d = `M ${fromX} ${startY} V ${toY} H ${toX - 1}`;
        } else {
          // すぐ始まるときは終端から真下 (真上) に下ろし、次のバーの上辺 (下辺) に入る
          const x = Math.min(Math.max(fromX, toX + 2, fromLeft + 2), to.right - bodyRect.left - 2);
          const endY = (down ? to.top - 1 : to.bottom + 1) - bodyRect.top;
          d = `M ${x} ${startY} V ${endY}`;
        }
        edges.push({
          key: `${dependencyId}->${bar.stepId}`,
          d,
          critical: bar.isCriticalPath && dependency.isCriticalPath,
        });
      }
    }
    setGeometry({ width: body.scrollWidth, height: body.scrollHeight, edges });
    if (axisTrackRef.current) setTrackWidth(axisTrackRef.current.clientWidth);
    updateOverflow();
  }, [schedule.bars, barById, updateOverflow]);

  useLayoutEffect(() => {
    measure();
    const body = bodyRef.current;
    if (!body || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(body);
    if (scrollerRef.current) observer.observe(scrollerRef.current);
    return () => observer.disconnect();
  }, [measure]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToStep(stepId, options) {
        const row = rowRefs.current.get(stepId);
        const bar = barRefs.current.get(stepId);
        const behavior = options?.behavior ?? (prefersReducedMotion() ? "auto" : "smooth");
        row?.scrollIntoView({ behavior, block: "nearest" });
        const scroller = scrollerRef.current;
        if (bar && scroller) {
          const barRect = bar.getBoundingClientRect();
          const scrollerRect = scroller.getBoundingClientRect();
          const labelWidth = row?.firstElementChild?.getBoundingClientRect().width ?? 0;
          if (barRect.left < scrollerRect.left + labelWidth || barRect.right > scrollerRect.right)
            scroller.scrollTo({
              left: scroller.scrollLeft + barRect.left - scrollerRect.left - labelWidth - 24,
              behavior,
            });
        }
      },
    }),
    [],
  );

  const focusSibling = (stepId: string, delta: number) => {
    const index = orderedBars.findIndex((bar) => bar.stepId === stepId);
    const next = orderedBars[index + delta];
    if (next) barRefs.current.get(next.stepId)?.focus();
  };
  const handleBarKeyDown = (event: KeyboardEvent<HTMLButtonElement>, stepId: string) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusSibling(stepId, event.key === "ArrowDown" ? 1 : -1);
    }
  };

  if (schedule.bars.length === 0) {
    return <EmptyState icon={<ListOrdered strokeWidth={1.75} />} title="手順がありません" />;
  }

  const criticalCount = schedule.bars.filter((bar) => bar.isCriticalPath).length;

  return (
    <Box css={styles.root} role="group" aria-label={label}>
      <Box css={styles.header}>
        <chakra.ul css={styles.legend} aria-label="凡例">
          <chakra.li css={styles.legendItem}>
            <chakra.span css={styles.swatch} data-kind="work" aria-hidden="true" />
            作業
          </chakra.li>
          <chakra.li css={styles.legendItem}>
            <chakra.span css={styles.swatch} data-kind="wait" aria-hidden="true" />
            待機
          </chakra.li>
          {criticalCount > 0 ? (
            <chakra.li css={styles.legendItem}>
              <chakra.span css={styles.swatch} data-kind="critical" aria-hidden="true" />
              クリティカルパス
            </chakra.li>
          ) : null}
        </chakra.ul>
        <chakra.dl css={styles.total}>
          <chakra.dt srOnly>所要時間</chakra.dt>
          <chakra.dd css={styles.totalValue}>{formatClock(schedule.totalDurationSec)}</chakra.dd>
          {schedule.savedDurationSec > 0 ? (
            <>
              <chakra.dt srOnly>直列で行った場合</chakra.dt>
              <chakra.dd css={styles.totalNote}>
                直列 {formatClock(schedule.serialDurationSec)}
              </chakra.dd>
            </>
          ) : null}
        </chakra.dl>
      </Box>

      <Box css={styles.frame} data-overflow-end={overflowEnd ? "" : undefined}>
        <Box ref={scrollerRef} css={styles.scroller} onScroll={updateOverflow}>
          <Box ref={bodyRef} css={styles.body}>
            <Box css={styles.gridLayer} aria-hidden="true">
              {ticks.map((sec) => (
                <Box key={sec} css={styles.gridLine} style={{ left: pct(sec) }} />
              ))}
            </Box>

            {geometry ? (
              <chakra.svg
                css={styles.overlay}
                width={geometry.width}
                height={geometry.height}
                viewBox={`0 0 ${geometry.width} ${geometry.height}`}
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="gantt-arrow"
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="4"
                    markerHeight="4"
                    orient="auto"
                  >
                    <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--chakra-colors-navy-400)" />
                  </marker>
                  <marker
                    id="gantt-arrow-critical"
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="4"
                    markerHeight="4"
                    orient="auto"
                  >
                    <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--chakra-colors-red-300)" />
                  </marker>
                </defs>
                {geometry.edges.map((edge) => (
                  <path
                    key={edge.key}
                    d={edge.d}
                    fill="none"
                    strokeWidth={1}
                    stroke={
                      edge.critical
                        ? "var(--chakra-colors-red-300)"
                        : "var(--chakra-colors-navy-400)"
                    }
                    markerEnd={edge.critical ? "url(#gantt-arrow-critical)" : "url(#gantt-arrow)"}
                  />
                ))}
              </chakra.svg>
            ) : null}

            <Box css={styles.axisRow} aria-hidden="true">
              <span />
              <Box css={styles.timelineCell}>
                <Box ref={axisTrackRef} css={styles.track}>
                  {ticks.map((sec, index) => (
                    <chakra.span
                      key={sec}
                      css={styles.axisLabel}
                      data-edge={index === 0 ? "start" : undefined}
                      style={{ left: pct(sec) }}
                    >
                      {formatClock(sec)}
                    </chakra.span>
                  ))}
                </Box>
              </Box>
            </Box>

            {lanes.map((lane) => (
              <Box key={lane.id} role="group" aria-label={lane.label}>
                <Box css={styles.laneRow} aria-hidden="true">
                  <chakra.span css={styles.laneTitle}>{lane.label}</chakra.span>
                  <chakra.span css={styles.laneRule} />
                </Box>
                {lane.bars.map((bar) => {
                  const step = stepById.get(bar.stepId);
                  const isActive = activeStepId === bar.stepId;
                  const isCompleted = completed.has(bar.stepId);
                  const activeSec = bar.activeEndSec - bar.startSec;
                  const waitSec = bar.endSec - bar.activeEndSec;
                  const span = Math.max(bar.endSec - bar.startSec, 1);
                  const timeWindow = `${formatClock(bar.startSec)}〜${formatClock(bar.endSec)}`;
                  const heat = step ? heatLevelLabel(step.heatLevel) : null;
                  return (
                    <Box
                      key={bar.stepId}
                      ref={(node: HTMLDivElement | null) => {
                        if (node) rowRefs.current.set(bar.stepId, node);
                        else rowRefs.current.delete(bar.stepId);
                      }}
                      css={styles.row}
                      data-active={isActive ? "" : undefined}
                      data-completed={isCompleted ? "" : undefined}
                      data-critical={bar.isCriticalPath ? "" : undefined}
                    >
                      <Box css={styles.labelCell}>
                        <chakra.button
                          type="button"
                          tabIndex={-1}
                          css={styles.labelButton}
                          title={bar.title}
                          onClick={() => onStepSelect?.(bar.stepId)}
                        >
                          <chakra.span css={styles.stepNumber} aria-hidden="true">
                            {isCompleted ? <Check strokeWidth={2.5} /> : bar.stepNumber}
                          </chakra.span>
                          <chakra.span css={styles.stepTitle} data-title="">
                            {bar.title}
                          </chakra.span>
                        </chakra.button>
                      </Box>
                      <Box css={styles.timelineCell}>
                        <Box css={styles.track}>
                          <Tooltip
                            placement="top"
                            content={
                              <Box css={styles.tooltip}>
                                <strong>
                                  手順{bar.stepNumber} {bar.title}
                                </strong>
                                <span>
                                  {timeWindow}
                                  {bar.isCriticalPath ? " · クリティカルパス" : ""}
                                </span>
                                <span>
                                  作業 {formatMinutes(activeSec)}
                                  {waitSec > 0 ? ` · 待機 ${formatMinutes(waitSec)}` : ""}
                                  {heat ? ` · ${heat}` : ""}
                                  {step?.targetTempCelsius != null
                                    ? ` · ${step.targetTempCelsius}℃`
                                    : ""}
                                </span>
                                {bar.inputsSummary.length ? (
                                  <span>投入: {bar.inputsSummary.join("、")}</span>
                                ) : null}
                                {bar.outputLabel ? <span>→ {bar.outputLabel}</span> : null}
                              </Box>
                            }
                          >
                            <chakra.button
                              type="button"
                              ref={(node: HTMLButtonElement | null) => {
                                if (node) barRefs.current.set(bar.stepId, node);
                                else barRefs.current.delete(bar.stepId);
                              }}
                              css={styles.bar}
                              style={{
                                left: pct(bar.startSec),
                                width: `${((bar.endSec - bar.startSec) / total) * 100}%`,
                              }}
                              aria-label={`手順${bar.stepNumber} ${bar.title} ${timeWindow}${isCompleted ? " 完了" : ""}`}
                              aria-pressed={isActive}
                              onClick={() => onStepSelect?.(bar.stepId)}
                              onKeyDown={(event) => handleBarKeyDown(event, bar.stepId)}
                            >
                              {activeSec > 0 ? (
                                <chakra.span
                                  css={styles.barActive}
                                  style={{
                                    width: `${(activeSec / span) * 100}%`,
                                  }}
                                />
                              ) : null}
                              {waitSec > 0 ? (
                                <chakra.span
                                  css={styles.barWait}
                                  data-only={activeSec > 0 ? undefined : ""}
                                />
                              ) : null}
                            </chakra.button>
                          </Tooltip>
                          <chakra.span
                            css={styles.endLabel}
                            style={{ left: pct(bar.endSec) }}
                            aria-hidden="true"
                          >
                            {formatClock(bar.endSec)}
                          </chakra.span>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
});
