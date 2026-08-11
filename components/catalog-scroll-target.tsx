"use client";

import { useEffect } from "react";

type CatalogScrollTargetProps = {
  navigationKey: string;
  targetId: string;
};

export function CatalogScrollTarget({ navigationKey, targetId }: CatalogScrollTargetProps) {
  useEffect(() => {
    if (window.location.hash !== `#${targetId}`) return;

    const animationFrame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [navigationKey, targetId]);

  return null;
}
