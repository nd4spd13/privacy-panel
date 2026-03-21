"use client";
import { useRef, useEffect, useState } from "react";

/**
 * Scales a fixed-width label to fit its container on narrow viewports.
 * Uses a ResizeObserver to recompute whenever the container resizes.
 * The container height shrinks to match the scaled content so no blank
 * space is left below the label.
 */
export function LabelScaler({
  children,
  labelWidth = 380,
}: {
  children: React.ReactNode;
  labelWidth?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    function update() {
      const container = containerRef.current;
      const inner = innerRef.current;
      if (!container || !inner) return;
      const available = container.offsetWidth;
      const s = Math.min(1, available / labelWidth);
      setScale(s);
      // Collapse the container height so scaled-down content doesn't leave a gap
      setScaledHeight(s < 1 ? Math.round(inner.offsetHeight * s) : undefined);
    }

    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [labelWidth]);

  return (
    <div ref={containerRef} className="w-full" style={{ height: scaledHeight }}>
      <div
        ref={innerRef}
        style={{
          width: labelWidth,
          transformOrigin: "top left",
          transform: scale < 1 ? `scale(${scale})` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
