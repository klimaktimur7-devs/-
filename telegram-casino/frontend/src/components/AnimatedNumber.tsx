import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  durationMs?: number;
}

export function AnimatedNumber({ value, decimals = 2, durationMs = 500 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    let frameId: number;
    let start: number | null = null;

    function tick(now: number) {
      if (start === null) start = now;
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value, durationMs]);

  return <>{display.toFixed(decimals)}</>;
}
