interface IconProps {
  className?: string;
}

export const PlayIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
  </svg>
);

export const StopIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 7h10v10H7z" fill="currentColor" />
  </svg>
);

export const ShuffleIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M16.9 4.6 20.3 8l-3.4 3.4-1.1-1.1 1.5-1.5h-2.1c-1.4 0-2.5.7-3.2 1.9l-1 1.7-1.3-1 1-1.7c1-1.6 2.7-2.6 4.8-2.6h2.1l-1.5-1.5 1.1-1ZM4 7.2h2.2c2 0 3.7 1 4.7 2.7l2.2 3.7c.7 1.1 1.8 1.8 3.2 1.8h1.1l-1.5-1.5 1.1-1.1 3.4 3.4-3.4 3.4-1.1-1.1 1.5-1.5h-1.1c-2 0-3.7-1-4.7-2.7L9.4 10.6C8.7 9.4 7.6 8.8 6.2 8.8H4V7.2Zm6.2 5.4 1.3 1-1 1.7C9.5 17 7.8 18 5.8 18H4v-1.6h1.8c1.4 0 2.5-.7 3.2-1.9l1.2-1.9Z"
      fill="currentColor"
    />
  </svg>
);

export const VolumeIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9.2v5.6h3.4l4.4 3.5V5.7L7.4 9.2H4Zm10.4.2a4.2 4.2 0 0 1 0 5.2l1.2 1.1a5.8 5.8 0 0 0 0-7.4l-1.2 1.1Z" fill="currentColor" />
  </svg>
);

export const MutedIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9.2v5.6h3.4l4.4 3.5V5.7L7.4 9.2H4Zm11.3.4 1.7 1.7 1.7-1.7 1.1 1.1-1.7 1.7 1.7 1.7-1.1 1.1-1.7-1.7-1.7 1.7-1.1-1.1 1.7-1.7-1.7-1.7 1.1-1.1Z" fill="currentColor" />
  </svg>
);
