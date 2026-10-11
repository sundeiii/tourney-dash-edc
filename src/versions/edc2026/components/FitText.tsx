import { useLayoutEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  id?: string;
  className?: string;
  /** smallest allowed size, as a fraction of the CSS font size */
  min?: number;
};

/** Shrinks its font until the text fits on one line; needs a fixed-width, nowrap, overflow-hidden box. */
export function FitText({ children, id, className, min = 0.5 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const fit = () => {
      el.style.fontSize = "";
      const base = parseFloat(getComputedStyle(el).fontSize);
      let size = base;
      while (el.scrollWidth > el.clientWidth && size > base * min) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
    };

    fit();
    // the first measurement can happen with fallback font metrics
    document.fonts.ready.then(fit);
  }, [children, min]);

  return (
    <div ref={ref} id={id} className={className}>
      {children}
    </div>
  );
}
