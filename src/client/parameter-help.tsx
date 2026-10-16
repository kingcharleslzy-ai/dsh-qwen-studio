import { useId, useLayoutEffect, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
export const STEPS_HELP =
  "步数是模型逐步生成图像的次数。更多步数通常耗时更长，并不保证更好。可先用 20 步试构图，再尝试 40 步；不同模型的合适值不同。";
export const SEED_HELP =
  "种子决定生成时使用的随机起点。留空会随机选择；固定种子并保持模型、描述和参数一致，有助于复现和比较。改变描述仍会改变画面，不同运行环境不保证完全一致。";
export function ParameterHelp({ name, text }: { name: string; text: string }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    fontFamily: "inherit",
    fontSize: "14px",
  });
  const show = () => {
    clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (document.activeElement !== trigger.current) setOpen(false);
    }, 120);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !tooltip.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const box = tooltip.current.getBoundingClientRect();
      const font = getComputedStyle(trigger.current);
      const gap = 8,
        margin = 12;
      const left = Math.max(
        margin,
        Math.min(rect.left, window.innerWidth - box.width - margin),
      );
      const top =
        rect.top - box.height - gap >= margin
          ? rect.top - box.height - gap
          : Math.min(
              rect.bottom + gap,
              Math.max(margin, window.innerHeight - box.height - margin),
            );
      setPosition({
        left,
        top,
        fontFamily: font.fontFamily,
        fontSize: font.fontSize,
      });
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        event.stopPropagation();
      }
    };
    place();
    const observer = new ResizeObserver(place);
    if (tooltip.current) observer.observe(tooltip.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);
  return (
    <span className="q2-help" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={trigger}
        type="button"
        aria-label={`${name}说明`}
        aria-describedby={open ? id : undefined}
        onFocus={show}
        onBlur={() => {
          clearTimeout(timer.current);
          setOpen(false);
        }}
        onClick={(e) => {
          e.preventDefault();
          show();
        }}
      >
        <CircleHelp />
      </button>
      {open &&
        createPortal(
          <span
            ref={tooltip}
            id={id}
            role="tooltip"
            className="q2 q2-tooltip-layer"
            style={position}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
