"use client";

import { useEffect } from "react";

interface Props {
  name: string;
  props?: Record<string, string>;
}

export function PlausibleEvent({ name, props }: Props) {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).plausible?.(name, props ? { props } : undefined);
  // Fire once on mount — deps intentionally empty
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
