import { Box, Flex, Grid, Text } from "@chakra-ui/react";

import { Tooltip } from "@/components/ui/tooltip";

import { formatUtcDay, type McpDailyActivity } from "./mcp-model";

export interface McpActivityChartProps {
  days: readonly McpDailyActivity[];
}

const CHART_HEIGHT = 160;

/**
 * 日別の呼び出し数を縦棒で示す。軸ラベルは 7 日ごと。
 */
export function McpActivityChart({ days }: McpActivityChartProps) {
  const max = Math.max(0, ...days.map((day) => day.callCount));
  const total = days.reduce((sum, day) => sum + day.callCount, 0);
  const first = days[0]?.utcDate;
  const last = days[days.length - 1]?.utcDate;
  const summary =
    first && last
      ? `${first} から ${last} (UTC) の日別呼び出し数。合計 ${total.toLocaleString("ja-JP")} 回、最大 ${max.toLocaleString("ja-JP")} 回`
      : "日別呼び出し数";

  return (
    <Box>
      <Box position="relative" role="img" aria-label={summary}>
        <Flex
          position="absolute"
          insetInline="0"
          top="4"
          borderTopWidth="1px"
          borderColor="border"
          borderStyle="dashed"
          justify="flex-end"
          aria-hidden="true"
        >
          <Text textStyle="caption" color="fg.subtle" bg="bg" ps="1" mt="-8px" lineHeight="16px">
            {max.toLocaleString("ja-JP")}
          </Text>
        </Flex>
        <Grid
          templateColumns={`repeat(${days.length}, minmax(0, 1fr))`}
          alignItems="end"
          gap={{ base: "2px", md: "1" }}
          h={`${CHART_HEIGHT}px`}
          pt="4"
          pe="8"
          borderBottomWidth="1px"
          borderColor="border.strong"
        >
          {days.map((day) => {
            const ratio = max === 0 ? 0 : day.callCount / max;
            return (
              <Tooltip
                key={day.utcDate}
                content={`${formatUtcDay(day.utcDate)}  ${day.callCount.toLocaleString("ja-JP")} 回`}
              >
                <Box
                  h="full"
                  display="flex"
                  alignItems="flex-end"
                  cursor="default"
                  className="group"
                >
                  <Box
                    w="full"
                    borderTopRadius="l1"
                    bg={day.callCount > 0 ? "navy.900" : "navy.200"}
                    h={day.callCount > 0 ? `max(3px, ${ratio * 100}%)` : "2px"}
                    transition="background-color 120ms"
                    _groupHover={{ bg: "red.600" }}
                  />
                </Box>
              </Tooltip>
            );
          })}
        </Grid>
      </Box>
      <Grid
        templateColumns={`repeat(${days.length}, minmax(0, 1fr))`}
        gap={{ base: "2px", md: "1" }}
        pe="8"
        mt="1.5"
        aria-hidden="true"
      >
        {days.map((day, index) => (
          <Box key={day.utcDate} position="relative" h="4">
            {(index % 7 === 0 && index <= days.length - 5) || index === days.length - 1 ? (
              <Text
                position="absolute"
                left={index === days.length - 1 ? undefined : "0"}
                right={index === days.length - 1 ? "0" : undefined}
                textStyle="caption"
                color="fg.subtle"
                whiteSpace="nowrap"
                fontVariantNumeric="tabular-nums"
              >
                {formatUtcDay(day.utcDate)}
              </Text>
            ) : null}
          </Box>
        ))}
      </Grid>
    </Box>
  );
}
