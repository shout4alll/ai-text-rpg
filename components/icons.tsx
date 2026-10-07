/**
 * 화면 아이콘 (선 아이콘, currentColor). 크기는 className 의 h-/w- 로.
 */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const IconBack = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const IconPhone = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 005 5l1.3-2 4 1.6V17a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z" />
  </svg>
);
export const IconMore = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="19" cy="12" r="1.7" />
  </svg>
);
export const IconUser = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0115 0" />
  </svg>
);
/** 카톡 모드 (말풍선) */
export const IconBubble = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4c4.97 0 9 3.13 9 7s-4.03 7-9 7c-.9 0-1.77-.1-2.6-.3L5 19.5l1.1-3.3C4.2 14.9 3 13.06 3 11c0-3.87 4.03-7 9-7z" />
  </svg>
);
/** 영상 모드 (사람 화면) */
export const IconScreen = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="3" width="16" height="18" rx="3" />
    <circle cx="12" cy="10" r="2.6" />
    <path d="M7.5 18a4.5 4.5 0 019 0" />
  </svg>
);
export const IconImage = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M20.5 16l-5-5-8.5 8.5" />
  </svg>
);
export const IconHeart = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7a4.3 4.3 0 017.5 2.8C19.5 15.4 12 20 12 20z" />
  </svg>
);
export const IconSend = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 19V6M6 11.5L12 5.5l6 6" />
  </svg>
);
export const IconChats = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6.5A2.5 2.5 0 016.5 4h8A2.5 2.5 0 0117 6.5v5a2.5 2.5 0 01-2.5 2.5H9l-3.5 3v-3A2.5 2.5 0 014 11.5z" />
    <path d="M20 9.5v6a2 2 0 01-2 2v2.5l-3-2.5h-3.5" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconSound = ({ muted, ...p }: P & { muted?: boolean }) => (
  <svg {...base(p)}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {muted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11" />}
  </svg>
);
export const IconSparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" />
    <path d="M18.5 16.5l.8 2 2 .7-2 .8-.8 2-.7-2-2-.8 2-.7z" />
  </svg>
);
export const IconGift = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="9" width="16" height="11" rx="2" />
    <path d="M3 9h18M12 9v11M12 9c-1.5-3.5-5.5-3.5-5 0M12 9c1.5-3.5 5.5-3.5 5 0" />
  </svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const IconBackup = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" />
  </svg>
);
export const IconBrain = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 5a3 3 0 00-3 3 3 3 0 00-1 5.5A3 3 0 008 18a2.5 2.5 0 004 .5V5.5A2.5 2.5 0 009 5zM15 5a3 3 0 013 3 3 3 0 011 5.5A3 3 0 0116 18a2.5 2.5 0 01-4 .5" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
  </svg>
);
export const IconCrown = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 17l-1-9 5 4 4-7 4 7 5-4-1 9z" />
    <path d="M5 20h14" />
  </svg>
);
export const IconBell = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 16.5V11a6 6 0 1112 0v5.5l1.5 2h-15z" />
    <path d="M10 20.5a2.2 2.2 0 004 0" />
  </svg>
);
