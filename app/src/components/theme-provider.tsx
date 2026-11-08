import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * 仕様は Light 固定。next-themes は強制 light のみで、
 * ダーク切替 UI は持たない。
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
