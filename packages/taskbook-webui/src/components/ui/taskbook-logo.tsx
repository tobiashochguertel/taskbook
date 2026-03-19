interface TaskbookLogoProps {
  size?: number;
  className?: string;
}

export function TaskbookLogo({ size = 24, className }: TaskbookLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        x="3"
        y="3"
        width="26"
        height="26"
        rx="6"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
      />
      <path
        d="M10.5 16.5L14.5 20.5L21.5 12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
