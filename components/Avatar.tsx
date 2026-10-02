"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import {
  Box3,
  MathUtils,
  Quaternion,
  Euler,
  Vector3,
  type AnimationClip,
  type Group,
  type Mesh,
  type Object3D,
  type SkinnedMesh,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  AVATAR_HEIGHT,
  AVATAR_IDLE_URL,
  AVATAR_MODEL_URL,
  FLOOR_Y,
} from "@/lib/avatarConfig";
import { sampleMotion, useActionClock } from "@/lib/avatarMotion";
import type { AvatarAnimation, Emotion } from "@/types/game";

interface AvatarProps {
  animation: AvatarAnimation;
  /** 같은 animation이 연속으로 와도 다시 재생되도록 하는 트리거 카운터 */
  animationKey: number;
  emotion: Emotion;
}

/* -------------------------------------------------------------------------- */
/*  감정 → 블렌드셰이프(ARKit 52) 매핑. 해당 모프 타깃이 없는 모델에서는 무시된다.      */
/* -------------------------------------------------------------------------- */
const EMOTION_MORPHS: Record<Emotion, Record<string, number>> = {
  neutral: {},
  happy: { mouthSmileLeft: 0.7, mouthSmileRight: 0.7, cheekSquintLeft: 0.3, cheekSquintRight: 0.3 },
  sad: { mouthFrownLeft: 0.6, mouthFrownRight: 0.6, browInnerUp: 0.7 },
  angry: { browDownLeft: 0.8, browDownRight: 0.8, noseSneerLeft: 0.3, noseSneerRight: 0.3, mouthFrownLeft: 0.3, mouthFrownRight: 0.3 },
  surprised: { browInnerUp: 0.8, eyeWideLeft: 0.7, eyeWideRight: 0.7, jawOpen: 0.3 },
};
const ALL_MORPH_KEYS = Array.from(
  new Set(Object.values(EMOTION_MORPHS).flatMap((m) => Object.keys(m)))
);

/** Mixamo 등 외부 애니메이션 클립을 현재 스켈레톤에 맞게 정리한다. */
function retargetClips(clips: AnimationClip[]): AnimationClip[] {
  return clips.map((src) => {
    const clip = src.clone();
    clip.tracks = clip.tracks
      // 리그마다 단위(cm/m)가 달라 position 트랙은 모델이 날아가는 원인이 된다 → 제거
      .filter((t) => !t.name.endsWith(".position") && !t.name.endsWith(".scale"))
      .map((t) => {
        t.name = t.name.replace(/^mixamorig:?/, "");
        return t;
      });
    return clip;
  });
}

const HEAD_BONE = /head$/i;

export default function Avatar({ animation, animationKey, emotion }: AvatarProps) {
  const actionRef = useRef<Group>(null); // jump 등 몸 전체 오프셋
  const rootRef = useRef<Group>(null); // AnimationMixer 루트

  const { scene, animations: embeddedClips } = useGLTF(AVATAR_MODEL_URL);
  // IDLE_URL 이 없으면 같은 모델을 다시 가리킨다 (drei 캐시 → 추가 요청 없음).
  const idleSource = useGLTF(AVATAR_IDLE_URL ?? AVATAR_MODEL_URL);

  // 같은 GLB를 여러 곳에서 써도 안전하도록 복제 (SkinnedMesh 는 SkeletonUtils 필요)
  const model = useMemo(() => cloneSkinned(scene), [scene]);

  const clips = useMemo(
    () => (AVATAR_IDLE_URL ? retargetClips(idleSource.animations) : embeddedClips),
    [idleSource.animations, embeddedClips]
  );

  // 키 자동 맞춤 + 발바닥을 바닥에 정렬
  const fit = useMemo(() => {
    model.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const scale = size.y > 0 ? AVATAR_HEIGHT / size.y : 1;
    const center = box.getCenter(new Vector3());
    return {
      scale,
      position: [-center.x * scale, -box.min.y * scale, -center.z * scale] as [number, number, number],
    };
  }, [model]);

  // 머리 본 / 모프 타깃 / 렌더 설정 수집
  const rig = useMemo(() => {
    let head: Object3D | null = null;
    const morphs: { mesh: Mesh; index: number; key: string }[] = [];
    model.traverse((o) => {
      if (!head && (o as { isBone?: boolean }).isBone && HEAD_BONE.test(o.name)) head = o;
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        // 스킨 메쉬는 바인드 포즈 바운딩박스 기준으로 컬링되어 사라질 수 있어 비활성화
        if ((o as SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
        const dict = mesh.morphTargetDictionary;
        if (dict) {
          for (const key of ALL_MORPH_KEYS) {
            if (key in dict) morphs.push({ mesh, index: dict[key], key });
          }
        }
      }
    });
    const headBone = head as Object3D | null;
    const headAnimated =
      !!headBone &&
      clips.some((c) =>
        c.tracks.some((t) => t.name.startsWith(`${headBone.name}.`) && t.name.endsWith(".quaternion"))
      );
    return {
      head: headBone,
      headAnimated,
      headBase: headBone ? headBone.quaternion.clone() : new Quaternion(),
      morphs,
    };
  }, [model, clips]);

  // ---- idle 루프 재생 ------------------------------------------------------
  const { actions } = useAnimations(clips, rootRef);
  useEffect(() => {
    const clip = clips.find((c) => /idle/i.test(c.name)) ?? clips[0];
    const action = clip ? actions[clip.name] : null;
    if (!action) return;
    action.reset().fadeIn(0.3).play(); // 기본 LoopRepeat
    return () => {
      action.fadeOut(0.2);
    };
  }, [actions, clips]);

  // ---- 이벤트 동작(jump/nod/shake) + 감정 ------------------------------------
  const elapsedOf = useActionClock(animationKey);
  const tmpQuat = useMemo(() => new Quaternion(), []);
  const tmpEuler = useMemo(() => new Euler(), []);

  // 주의: useAnimations 가 먼저 등록한 useFrame(mixer.update) 뒤에 실행되어야 오프셋이 덮어써지지 않는다.
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const m = animation === "idle" ? sampleMotion("idle", 0) : sampleMotion(animation, elapsedOf(t));

    if (actionRef.current) {
      actionRef.current.position.y = FLOOR_Y + m.bodyY;
      // 머리 본이 없으면 몸 전체로 대체
      if (!rig.head) {
        actionRef.current.rotation.x = m.headPitch * 0.3;
        actionRef.current.rotation.y = m.headYaw * 0.5;
      }
    }

    if (rig.head) {
      tmpQuat.setFromEuler(tmpEuler.set(m.headPitch, m.headYaw, 0));
      if (rig.headAnimated) {
        rig.head.quaternion.multiply(tmpQuat); // 믹서가 쓴 idle 값 위에 얹기
      } else {
        rig.head.quaternion.copy(rig.headBase).multiply(tmpQuat);
      }
    }

    if (rig.morphs.length) {
      const weights = EMOTION_MORPHS[emotion];
      const k = 1 - Math.exp(-8 * delta);
      for (const { mesh, index, key } of rig.morphs) {
        const inf = mesh.morphTargetInfluences;
        if (inf) inf[index] = MathUtils.lerp(inf[index], weights[key] ?? 0, k);
      }
    }
  });

  return (
    <group ref={actionRef} position={[0, FLOOR_Y, 0]}>
      <group ref={rootRef}>
        <group scale={fit.scale} position={fit.position}>
          <primitive object={model} />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(AVATAR_MODEL_URL);
