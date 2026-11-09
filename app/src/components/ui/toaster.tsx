import {
  Box,
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster,
} from "@chakra-ui/react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

/**
 * 保存・削除・コピーの完了通知。画面内に成功メッセージを残さず、ここから出す。
 *
 * @example toaster.create({ type: "success", title: "保存しました" })
 */
export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
  max: 3,
});

const icons = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
} as const;

const iconColors = {
  success: "green.600",
  error: "red.600",
  warning: "amber.600",
  info: "navy.900",
} as const;

export function Toaster() {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => {
          const type = (toast.type ?? "info") as keyof typeof icons | "loading";
          const Icon = type === "loading" ? null : (icons[type] ?? Info);
          const color = type === "loading" ? "navy.900" : (iconColors[type] ?? "navy.900");
          return (
            <Toast.Root width={{ md: "sm" }}>
              {Icon ? (
                <Box color={color} mt="3px" flexShrink={0} aria-hidden="true">
                  <Icon size={16} strokeWidth={1.75} />
                </Box>
              ) : (
                <Spinner size="sm" color="navy.900" />
              )}
              <Stack gap="0.5" flex="1" maxWidth="100%">
                {toast.title ? <Toast.Title>{toast.title}</Toast.Title> : null}
                {toast.description ? (
                  <Toast.Description>{toast.description}</Toast.Description>
                ) : null}
              </Stack>
              {toast.action ? (
                <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
              ) : null}
              {toast.closable ? <Toast.CloseTrigger /> : null}
            </Toast.Root>
          );
        }}
      </ChakraToaster>
    </Portal>
  );
}
