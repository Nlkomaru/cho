import { Alert, Box } from "@chakra-ui/react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "error";

export interface FeedbackProps {
  /** `status` は旧 API の別名で `info` と同じ。 */
  tone?: Tone | "status";
  title?: ReactNode;
  /** 右端に置く操作 ("再読み込み" など)。 */
  action?: ReactNode;
  /** 既定は error → alert、それ以外 → status。 */
  role?: "status" | "alert";
  size?: "sm" | "md";
  /** @deprecated role から決まるので不要。 */
  ariaLive?: "polite" | "assertive";
  children?: ReactNode;
}

const icons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
} as const;

/**
 * 画面内の通知。左の 2px バーと淡い地で種類を示す。
 * 保存完了などの一時的な通知は toaster を使い、ここには出さない。
 */
export function Feedback({
  tone = "info",
  title,
  action,
  role,
  size = "md",
  children,
}: FeedbackProps) {
  const status: Tone = tone === "status" ? "info" : tone;
  const Icon = icons[status];

  return (
    <Alert.Root
      status={status}
      size={size}
      role={role ?? (status === "error" ? "alert" : "status")}
    >
      <Alert.Indicator>
        <Icon strokeWidth={1.75} />
      </Alert.Indicator>
      <Alert.Content>
        {title ? <Alert.Title>{title}</Alert.Title> : null}
        {children ? <Alert.Description>{children}</Alert.Description> : null}
      </Alert.Content>
      {action ? (
        <Box flexShrink={0} alignSelf="center">
          {action}
        </Box>
      ) : null}
    </Alert.Root>
  );
}
