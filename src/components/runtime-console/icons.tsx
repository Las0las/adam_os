// Inline SVG icon set for the Enterprise Object Runtime. Stroke-based, inherits
// currentColor, no external icon dependency. One <Icon name=…/> switch.

type P = { size?: number; className?: string; strokeWidth?: number };

function S({
  size = 18,
  className,
  strokeWidth = 1.6,
  children,
}: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export type IconName =
  | "candidate"
  | "job"
  | "company"
  | "interview"
  | "offer"
  | "placement"
  | "document"
  | "approval"
  | "workflow"
  | "policy"
  | "revenue"
  | "intent"
  | "objects"
  | "runtime"
  | "capabilities"
  | "governance"
  | "confidence"
  | "skills"
  | "experience"
  | "culture"
  | "compensation"
  | "risk"
  | "clock"
  | "data"
  | "cost"
  | "alert"
  | "briefing"
  | "plus"
  | "chevron"
  | "bell"
  | "mic"
  | "send"
  | "command"
  | "check"
  | "search"
  | "sparkle"
  | "arrow"
  | "close"
  | "shield"
  | "play"
  | "link"
  | "code"
  | "hash"
  | "pin"
  | "open";

export function Icon({ name, ...p }: P & { name: IconName }) {
  switch (name) {
    case "candidate":
      return (
        <S {...p}>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
        </S>
      );
    case "job":
      return (
        <S {...p}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
          <path d="M3 12h18" />
        </S>
      );
    case "company":
      return (
        <S {...p}>
          <path d="M4 20V6l8-3 8 3v14" />
          <path d="M4 20h16" />
          <path d="M9 9h0M9 13h0M15 9h0M15 13h0" />
        </S>
      );
    case "interview":
      return (
        <S {...p}>
          <rect x="3" y="4.5" width="18" height="15" rx="2" />
          <path d="M3 9h18M8 3v3M16 3v3" />
          <path d="M8.5 14l2 2 4-4" />
        </S>
      );
    case "offer":
      return (
        <S {...p}>
          <path d="M20.5 13.5 13 21a2 2 0 0 1-2.8 0L3.5 14.3a2 2 0 0 1-.5-1.4V5a2 2 0 0 1 2-2h7.9a2 2 0 0 1 1.4.6l6.2 6.1a2 2 0 0 1 0 2.8Z" />
          <circle cx="8" cy="8" r="1.3" />
        </S>
      );
    case "placement":
      return (
        <S {...p}>
          <path d="M12 21s-7-4.5-7-10a7 7 0 0 1 14 0c0 5.5-7 10-7 10Z" />
          <circle cx="12" cy="11" r="2.4" />
        </S>
      );
    case "document":
      return (
        <S {...p}>
          <path d="M6 2.5h8L19 7v13.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1Z" />
          <path d="M13.5 2.5V7H19M8.5 12h7M8.5 16h7" />
        </S>
      );
    case "approval":
      return (
        <S {...p}>
          <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3Z" />
          <path d="M9 11.5l2 2 4-4" />
        </S>
      );
    case "workflow":
      return (
        <S {...p}>
          <rect x="3" y="4" width="6" height="5" rx="1" />
          <rect x="15" y="15" width="6" height="5" rx="1" />
          <path d="M6 9v4a2 2 0 0 0 2 2h7" />
        </S>
      );
    case "policy":
      return (
        <S {...p}>
          <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3Z" />
          <path d="M9.5 12h5M12 9.5v5" />
        </S>
      );
    case "revenue":
      return (
        <S {...p}>
          <path d="M4 16l5-5 3 3 7-7" />
          <path d="M15 7h5v5" />
        </S>
      );
    case "intent":
      return (
        <S {...p}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3.4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </S>
      );
    case "objects":
      return (
        <S {...p}>
          <circle cx="7.5" cy="8" r="3" />
          <circle cx="16.5" cy="8" r="3" />
          <path d="M3 20a4.5 4.5 0 0 1 9 0M12 20a4.5 4.5 0 0 1 9 0" />
        </S>
      );
    case "runtime":
      return (
        <S {...p}>
          <path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z" />
          <path d="M12 2.5V12M12 12l8-5M12 12l-8-5" />
        </S>
      );
    case "capabilities":
      return (
        <S {...p}>
          <path d="M5 19V9M10 19V5M15 19v-7M20 19v-4" />
        </S>
      );
    case "governance":
      return (
        <S {...p}>
          <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3Z" />
        </S>
      );
    case "confidence":
      return (
        <S {...p}>
          <path d="M3 12a9 9 0 1 1 9 9" />
          <path d="M8 12l3 3 5-6" />
        </S>
      );
    case "skills":
      return (
        <S {...p}>
          <path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L3.2 8.7l5.4-.8L12 3Z" />
        </S>
      );
    case "experience":
      return (
        <S {...p}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3.5 2" />
        </S>
      );
    case "culture":
      return (
        <S {...p}>
          <circle cx="9" cy="9" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 6.5a3 3 0 0 1 0 5.8M20.5 19a5.2 5.2 0 0 0-4-5" />
        </S>
      );
    case "compensation":
      return (
        <S {...p}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7.5v9M14.2 9.3c-.4-1-1.3-1.5-2.5-1.5-1.4 0-2.3.7-2.3 1.8 0 2.6 5 1.2 5 3.9 0 1.2-1 1.9-2.5 1.9-1.3 0-2.2-.5-2.6-1.5" />
        </S>
      );
    case "risk":
      return (
        <S {...p}>
          <path d="M12 3 2.5 20h19L12 3Z" />
          <path d="M12 10v4M12 17h0" />
        </S>
      );
    case "clock":
      return (
        <S {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3.5 2" />
        </S>
      );
    case "data":
      return (
        <S {...p}>
          <ellipse cx="12" cy="5.5" rx="7" ry="2.8" />
          <path d="M5 5.5v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6" />
          <path d="M5 11.5v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6" />
        </S>
      );
    case "cost":
      return (
        <S {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v10M14.5 9c-.5-1-1.4-1.5-2.5-1.5-1.4 0-2.4.8-2.4 2 0 2.7 5 1.3 5 4 0 1.2-1 2-2.6 2-1.2 0-2.1-.5-2.6-1.5" />
        </S>
      );
    case "alert":
      return (
        <S {...p}>
          <path d="M12 3 2.5 20h19L12 3Z" />
          <path d="M12 10v4M12 17h0" />
        </S>
      );
    case "briefing":
      return (
        <S {...p}>
          <path d="M4 5h16v11H8l-4 3.5V5Z" />
          <path d="M8 9h8M8 12.5h5" />
        </S>
      );
    case "plus":
      return (
        <S {...p}>
          <path d="M12 5v14M5 12h14" />
        </S>
      );
    case "chevron":
      return (
        <S {...p}>
          <path d="m6 9 6 6 6-6" />
        </S>
      );
    case "bell":
      return (
        <S {...p}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M10.5 21a2 2 0 0 0 3 0" />
        </S>
      );
    case "mic":
      return (
        <S {...p}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </S>
      );
    case "send":
      return (
        <S {...p}>
          <path d="M12 19V5M5 12l7-7 7 7" />
        </S>
      );
    case "command":
      return (
        <S {...p} strokeWidth={1.7}>
          <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z" />
        </S>
      );
    case "check":
      return (
        <S {...p} strokeWidth={2}>
          <path d="m5 12 4.5 4.5L19 7" />
        </S>
      );
    case "search":
      return (
        <S {...p}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4-4" />
        </S>
      );
    case "sparkle":
      return (
        <S {...p}>
          <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
          <path d="M7.5 7.5 9 9M15 15l1.5 1.5M16.5 7.5 15 9M9 15l-1.5 1.5" />
        </S>
      );
    case "arrow":
      return (
        <S {...p}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </S>
      );
    case "close":
      return (
        <S {...p} strokeWidth={1.8}>
          <path d="M6 6l12 12M18 6 6 18" />
        </S>
      );
    case "shield":
      return (
        <S {...p}>
          <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3Z" />
          <path d="M9 11.5l2 2 4-4" />
        </S>
      );
    case "link":
      return (
        <S {...p}>
          <path d="M10 13.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.54 3.54 0 0 0-5-5L11 7.5" />
          <path d="M14 10.5a3.5 3.5 0 0 0-5 0L6.5 13a3.54 3.54 0 0 0 5 5L13 16.5" />
        </S>
      );
    case "code":
      return (
        <S {...p}>
          <path d="m8 8-4 4 4 4" />
          <path d="m16 8 4 4-4 4" />
          <path d="m13.5 6-3 12" />
        </S>
      );
    case "hash":
      return (
        <S {...p}>
          <path d="M5 9h14M5 15h14M9.5 4 8 20M16 4l-1.5 16" />
        </S>
      );
    case "pin":
      return (
        <S {...p}>
          <path d="M12 17v5" />
          <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
        </S>
      );
    case "open":
      return (
        <S {...p}>
          <path d="M14 4h6v6" />
          <path d="M20 4 10 14" />
          <path d="M19 14v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </S>
      );
    case "play":
      return (
        <S {...p} strokeWidth={1.8}>
          <path d="M7 5l11 7-11 7V5Z" />
        </S>
      );
    default:
      return null;
  }
}
