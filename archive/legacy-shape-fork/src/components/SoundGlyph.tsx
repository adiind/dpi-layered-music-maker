import type { SoundShape } from "../types/music";
import { classNames } from "../utils/classNames";

interface SoundGlyphProps {
  shape: SoundShape;
  color: string;
  active?: boolean;
  muted?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeClass = {
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-16 w-16",
};

export const SoundGlyph = ({ shape, color, active = false, muted = false, size = "md" }: SoundGlyphProps) => {
  const tone = muted ? "#dadce0" : color;
  const common = classNames(
    "transition-transform duration-150",
    sizeClass[size],
    active && !muted ? "scale-110" : "scale-100",
  );

  if (shape === "circle") {
    return (
      <span
        aria-hidden="true"
        className={classNames(common, "block rounded-full border-[3px]")}
        style={{ borderColor: tone, backgroundColor: muted ? "#f1f3f4" : `${tone}1A` }}
      />
    );
  }

  if (shape === "triangle") {
    return (
      <svg aria-hidden="true" className={common} viewBox="0 0 48 48">
        <path
          d="M24 7 43 40H5L24 7Z"
          fill={muted ? "#f1f3f4" : `${tone}22`}
          stroke={tone}
          strokeLinejoin="round"
          strokeWidth="3"
        />
      </svg>
    );
  }

  if (shape === "square") {
    return (
      <span
        aria-hidden="true"
        className={classNames(common, "block rounded-[6px] border-[3px]")}
        style={{ borderColor: tone, backgroundColor: muted ? "#f1f3f4" : `${tone}1A` }}
      />
    );
  }

  return (
    <svg aria-hidden="true" className={common} viewBox="0 0 48 48">
      <path
        d="M5 27C11 15 18 15 24 27C30 39 37 39 43 27"
        fill="none"
        stroke={tone}
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M5 19C11 7 18 7 24 19C30 31 37 31 43 19"
        fill="none"
        opacity="0.28"
        stroke={tone}
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
};
