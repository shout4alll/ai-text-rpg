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

export default function EffectsLayer({ particles, bursts }: { particles: Particle[]; bursts: Burst[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden data-effects>
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
