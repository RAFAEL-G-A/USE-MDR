"use client";

import { usePathname } from "next/navigation";

export function StoreRouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return children;

  return <div key={pathname} className="store-route-enter">{children}</div>;
}
