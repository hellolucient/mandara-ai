"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

export function NavLinks({
  items,
  tone,
}: {
  items: Array<{ href: string; label: string }>;
  tone: "rail" | "bar";
}) {
  const pathname = usePathname();
  return (
    <nav className={tone === "rail" ? "flex flex-col gap-1" : "flex gap-1 overflow-x-auto"}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm whitespace-nowrap",
              tone === "rail" && active && "bg-white/15 text-white",
              tone === "rail" && !active && "text-white/75 hover:bg-white/10 hover:text-white",
              tone === "bar" && active && "bg-primary text-primary-foreground",
              tone === "bar" && !active && "text-muted-foreground hover:bg-muted",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
