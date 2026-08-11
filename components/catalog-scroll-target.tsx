"use client";

import { useEffect } from "react";

type CatalogScrollTargetProps = {
  navigationKey: string;
  targetId: string;
};

export function CatalogScrollTarget({ navigationKey, targetId }: CatalogScrollTargetProps) {
  useEffect(() => {
    const scrollToTarget = () => {
      if (window.location.hash !== `#${targetId}`) return;
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const scrollTimeout = window.setTimeout(scrollToTarget, 100);
    window.addEventListener("hashchange", scrollToTarget);

    return () => {
      window.clearTimeout(scrollTimeout);
      window.removeEventListener("hashchange", scrollToTarget);
    };
  }, [navigationKey, targetId]);

  return null;
}
