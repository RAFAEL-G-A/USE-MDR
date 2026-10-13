const FLIGHT_DURATION_MS = 760;

export function buildCartFlightKeyframes(deltaX: number, deltaY: number): Keyframe[] {
  const arcLift = Math.min(72, Math.max(28, Math.abs(deltaY) * 0.12));

  return [
    { offset: 0, opacity: 1, transform: "translate3d(0, 0, 0) scale(1) rotate(0deg)" },
    { offset: 0.18, opacity: 1, transform: `translate3d(${deltaX * 0.12}px, ${deltaY * 0.08 - 18}px, 0) scale(0.9) rotate(-2deg)` },
    { offset: 0.58, opacity: 0.96, transform: `translate3d(${deltaX * 0.62}px, ${deltaY * 0.48 - arcLift}px, 0) scale(0.52) rotate(4deg)` },
    { offset: 0.88, opacity: 0.82, transform: `translate3d(${deltaX * 0.94}px, ${deltaY * 0.9 - 8}px, 0) scale(0.18) rotate(-3deg)` },
    { offset: 1, opacity: 0, transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.06) rotate(0deg)` },
  ];
}

function pulseTarget(target: HTMLElement) {
  target.animate(
    [
      { transform: "scale(1)" },
      { offset: 0.45, transform: "scale(1.2)" },
      { transform: "scale(1)" },
    ],
    { duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  );
}

function visibleTarget(selector: string) {
  return [...document.querySelectorAll<HTMLElement>(selector)].find((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && window.getComputedStyle(candidate).visibility !== "hidden";
  }) ?? null;
}

function flyProductToTarget(source: HTMLElement | null, targetSelector: string) {
  if (!source || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const target = visibleTarget(targetSelector);
  const sourceImage = source.matches("img") ? source : source.querySelector<HTMLElement>("img");
  if (!target || !sourceImage) return;
  if (typeof sourceImage.animate !== "function" || typeof target.animate !== "function") return;

  const sourceRect = sourceImage.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (!sourceRect.width || !sourceRect.height || !targetRect.width || !targetRect.height) return;

  const clone = sourceImage.cloneNode(true) as HTMLElement;
  const sourceStyle = window.getComputedStyle(sourceImage);
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("data-fly-to-cart", "true");
  Object.assign(clone.style, {
    position: "fixed",
    zIndex: "100",
    left: `${sourceRect.left}px`,
    top: `${sourceRect.top}px`,
    width: `${sourceRect.width}px`,
    height: `${sourceRect.height}px`,
    margin: "0",
    borderRadius: sourceStyle.borderRadius || "1.5rem",
    objectFit: "cover",
    pointerEvents: "none",
    transformOrigin: "center",
    willChange: "transform, opacity",
    boxShadow: "0 16px 38px rgb(93 31 53 / 22%)",
  });
  document.body.appendChild(clone);

  const sourceCenterX = sourceRect.left + sourceRect.width / 2;
  const sourceCenterY = sourceRect.top + sourceRect.height / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const animation = clone.animate(
    buildCartFlightKeyframes(targetCenterX - sourceCenterX, targetCenterY - sourceCenterY),
    { duration: FLIGHT_DURATION_MS, easing: "cubic-bezier(0.22, 0.78, 0.2, 1)", fill: "forwards" },
  );

  void animation.finished
    .then(() => pulseTarget(target))
    .catch(() => undefined)
    .finally(() => clone.remove());
}

export function flyProductToCart(source: HTMLElement | null) {
  flyProductToTarget(source, "[data-cart-target]");
}

export function flyProductToFavorites(source: HTMLElement | null) {
  flyProductToTarget(source, "[data-favorites-target]");
}
