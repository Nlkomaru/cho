import { chakra } from "@chakra-ui/react";
import { useEffect, useState } from "react";

export interface FormTocItem {
  id: string;
  label: string;
}

export interface FormTocProps {
  items: readonly FormTocItem[];
  activeId: string | null;
  label?: string;
}

/**
 * フォームの目次。現在のセクションは紺の文字と赤い左罫で示す。
 */
export function FormToc({ items, activeId, label = "フォームの目次" }: FormTocProps) {
  return (
    <chakra.nav aria-label={label}>
      <chakra.ul listStyleType="none" m="0" p="0" borderStartWidth="1px" borderColor="border">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <chakra.li key={item.id}>
              <chakra.a
                href={`#${item.id}`}
                aria-current={active ? "location" : undefined}
                display="block"
                ms="-1px"
                ps="4"
                py="2"
                fontSize="14px"
                lineHeight="20px"
                fontWeight={active ? "500" : "400"}
                color={active ? "fg.strong" : "fg.muted"}
                borderStartWidth="2px"
                borderColor={active ? "red.600" : "transparent"}
                textDecoration="none"
                _hover={{ color: "fg.strong" }}
                focusVisibleRing="outside"
              >
                {item.label}
              </chakra.a>
            </chakra.li>
          );
        })}
      </chakra.ul>
    </chakra.nav>
  );
}

/**
 * 画面上部に最も近いセクションの id を返す。
 */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) visible.set(record.target.id, record.isIntersecting);
        const first = elements.find((element) => visible.get(element.id));
        if (first) setActive(first.id);
      },
      // ヘッダー直下から画面の上 4 割に入ったものを現在地とみなす
      { rootMargin: "-88px 0px -60% 0px" },
    );
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [key]);

  return active;
}
