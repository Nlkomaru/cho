import { DatePicker, Portal } from "@chakra-ui/react";
import { parseDate } from "@internationalized/date";
import { CalendarIcon, XIcon } from "lucide-react";

export interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * カレンダー値は `YYYY-MM-DD` のまま受け渡す。Date への変換は行わない。
 */
export function DateField({ label, value, onChange, placeholder }: DateFieldProps) {
  return (
    <DatePicker.Root
      locale="ja-JP"
      value={value ? [parseDate(value)] : []}
      onValueChange={(details) => onChange(details.value[0]?.toString() ?? "")}
    >
      <DatePicker.Label>{label}</DatePicker.Label>
      <DatePicker.Control>
        <DatePicker.Input
          placeholder={placeholder ?? "YYYY/MM/DD"}
          borderColor="border.outline"
          borderRadius="l3"
        />
        <DatePicker.IndicatorGroup>
          <DatePicker.Trigger aria-label="カレンダーを開く">
            <CalendarIcon aria-hidden="true" size={16} />
          </DatePicker.Trigger>
          <DatePicker.ClearTrigger aria-label="日付をクリア">
            <XIcon aria-hidden="true" size={14} />
          </DatePicker.ClearTrigger>
        </DatePicker.IndicatorGroup>
      </DatePicker.Control>
      <Portal>
        <DatePicker.Positioner>
          <DatePicker.Content>
            <DatePicker.View view="day">
              <DatePicker.Header />
              <DatePicker.DayTable />
            </DatePicker.View>
            <DatePicker.View view="month">
              <DatePicker.Header />
              <DatePicker.MonthTable />
            </DatePicker.View>
            <DatePicker.View view="year">
              <DatePicker.Header />
              <DatePicker.YearTable />
            </DatePicker.View>
          </DatePicker.Content>
        </DatePicker.Positioner>
      </Portal>
    </DatePicker.Root>
  );
}
