"use client";

/**
 * 화면 위에 떠오르는 리액션 효과 (하트, 💢, 💧 …) 와 유저가 보낸 마음 리액션 버스트.
 * 상위(ChatApp)에서 particles / bursts 배열을 관리하고, 각 항목은 애니메이션 후 자동 제거된다.
 */
export interface Particle {
  id: number;
  emoji: string;
  /** 시작 가로 위치 (%) */
  x: number;
  /** 가로 흔들림 (px) */
  dx: number;
  /** 지연 (ms) */
  delay: number;
  /** 지속 (ms) */
  dur: number;
  /** 크기 (rem) */
  size: number;
}

export interface Burst {
  id: number;
  emoji: string;
}

/** 화면 터치 효과: 손가락 자리에서 튀어나가는 이모지 */
export interface TouchSpark {
  id: number;
  emoji: string;
  /** 터치 위치 (%) */
  x: number;
  y: number;
  /** 날아가는 거리 (px) */
  dx: number;
  dy: number;
  rot: number;
  dur: number;
  delay: number;
  size: number;
}

/** 화면 터치 효과: 물결 + 한마디 */
export interface TouchMark {
  id: number;
  x: number;
  y: number;
  /** 한마디 (없으면 물결만) */
  line?: string;
  color: string;
}

interface EffectsLayerProps {
  particles: Particle[];
  bursts: Burst[];
  sparks?: TouchSpark[];
  marks?: TouchMark[];
}

export default function EffectsLayer({ particles, bursts, sparks = [], marks = [] }: EffectsLayerProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden data-effects>
      {marks.map((m) => (
        <span
          key={`r${m.id}`}
          className="touch-ripple absolute h-24 w-24 rounded-full border-2"
          style={{ left: `${m.x}%`, top: `${m.y}%`, borderColor: m.color, background: `${m.color}22` }}
        />
      ))}
      {sparks.map((p) => (
        <span
          key={p.id}
          className="touch-pop absolute select-none drop-shadow"
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              fontSize: `${p.size}rem`,
              opacity: 0,
              animationDelay: `${p.delay}ms`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
              "--dur": `${p.dur}ms`,
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}
      {marks
        .filter((m) => m.line)
        .map((m) => (
          <span
            key={`l${m.id}`}
            data-touch-line
            className="touch-line absolute whitespace-nowrap rounded-2xl bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-lg"
            // 손가락에 가리지 않도록 터치 지점보다 위에, 화면 밖으로 나가지 않게
            style={{ left: `${Math.min(80, Math.max(20, m.x))}%`, top: `${Math.max(8, m.y - 14)}%` }}
          >
            {m.line}
          </span>
        ))}
      {particles.map((p) => (
        <span
          key={p.id}
          className="float-up absolute select-none"
          style={
            {
              left: `${p.x}%`,
              bottom: "28%",
              fontSize: `${p.size}rem`,
              animationDelay: `${p.delay}ms`,
              opacity: 0,
              "--dx": `${p.dx}px`,
              "--rise": "-42vh",
              "--dur": `${p.dur}ms`,
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}
      {bursts.map((b) => (
        <span
          key={b.id}
          className="heart-burst absolute left-1/2 top-[40%] select-none text-7xl drop-shadow-lg"
          data-burst={b.emoji}
        >
          {b.emoji}
        </span>
      ))}
    </div>
  );
}
