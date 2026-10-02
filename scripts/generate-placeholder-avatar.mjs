/**
 * 플레이스홀더 휴머노이드 GLB 생성기.
 * - Mixamo/RPM과 같은 본 이름(Hips, Spine, Neck, Head, LeftArm...)을 쓰는 노드 계층
 * - 4초 루프 'idle' 클립 포함 (호흡 / 시선 / 팔 흔들림)
 * 실제 모델을 넣기 전, 로딩·애니메이션 파이프라인 검증용이다.
 *
 *   npm run gen:placeholder
 */
import { Document, NodeIO } from "@gltf-transform/core";
import { mkdirSync } from "node:fs";

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene("Scene");

const skin = doc
  .createMaterial("Skin")
  .setBaseColorFactor([0.87, 0.7, 0.62, 1])
  .setRoughnessFactor(0.7)
  .setMetallicFactor(0);
const cloth = doc
  .createMaterial("Cloth")
  .setBaseColorFactor([0.35, 0.22, 0.55, 1])
  .setRoughnessFactor(0.8)
  .setMetallicFactor(0);

/** 박스 메쉬 생성. offsetY 로 중심을 올려 관절(피벗)이 박스 끝에 오도록 한다. */
function boxMesh(name, w, h, d, offsetY, material) {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  // 6면 × 4정점
  const faces = [
    { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
  ];
  const pos = [], nor = [], idx = [];
  faces.forEach((f, i) => {
    f.v.forEach((p) => {
      pos.push(p[0], p[1] + offsetY, p[2]);
      nor.push(...f.n);
    });
    const o = i * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(nor)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint16Array(idx)).setBuffer(buffer))
    .setMaterial(material);
  return doc.createMesh(name).addPrimitive(prim);
}

function bone(name, translation, mesh, parent) {
  const n = doc.createNode(name).setTranslation(translation);
  if (mesh) n.setMesh(mesh);
  parent.addChild(n);
  return n;
}

// ---- 본 계층 (발바닥이 y=0) ----------------------------------------------
const hips = doc.createNode("Hips").setTranslation([0, 0.9, 0]).setMesh(boxMesh("Pelvis", 0.32, 0.18, 0.2, 0.0, cloth));
scene.addChild(hips);

bone("LeftUpLeg", [-0.09, -0.05, 0], boxMesh("LegL", 0.13, 0.85, 0.14, -0.425, cloth), hips);
bone("RightUpLeg", [0.09, -0.05, 0], boxMesh("LegR", 0.13, 0.85, 0.14, -0.425, cloth), hips);

const spine = bone("Spine", [0, 0.09, 0], boxMesh("Torso", 0.34, 0.5, 0.2, 0.25, cloth), hips);
const neck = bone("Neck", [0, 0.5, 0], boxMesh("NeckMesh", 0.08, 0.08, 0.08, 0.04, skin), spine);
const head = bone("Head", [0, 0.08, 0], boxMesh("HeadMesh", 0.2, 0.24, 0.22, 0.12, skin), neck);
const armL = bone("LeftArm", [-0.22, 0.45, 0], boxMesh("ArmL", 0.09, 0.6, 0.09, -0.3, skin), spine);
const armR = bone("RightArm", [0.22, 0.45, 0], boxMesh("ArmR", 0.09, 0.6, 0.09, -0.3, skin), spine);

// ---- idle 애니메이션 (4초 루프) ------------------------------------------
const quatFromEuler = ([x, y, z]) => {
  const c = (a) => Math.cos(a / 2), s = (a) => Math.sin(a / 2);
  const [cx, cy, cz, sx, sy, sz] = [c(x), c(y), c(z), s(x), s(y), s(z)];
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
};

const anim = doc.createAnimation("idle");
const times = new Float32Array([0, 1, 2, 3, 4]);
const input = doc.createAccessor().setType("SCALAR").setArray(times).setBuffer(buffer);

function rotChannel(node, eulers) {
  const out = doc
    .createAccessor()
    .setType("VEC4")
    .setArray(new Float32Array(eulers.flatMap(quatFromEuler)))
    .setBuffer(buffer);
  const sampler = doc.createAnimationSampler().setInput(input).setOutput(out).setInterpolation("LINEAR");
  anim.addSampler(sampler).addChannel(
    doc.createAnimationChannel().setTargetNode(node).setTargetPath("rotation").setSampler(sampler)
  );
}
function transChannel(node, values) {
  const out = doc.createAccessor().setType("VEC3").setArray(new Float32Array(values.flat())).setBuffer(buffer);
  const sampler = doc.createAnimationSampler().setInput(input).setOutput(out).setInterpolation("LINEAR");
  anim.addSampler(sampler).addChannel(
    doc.createAnimationChannel().setTargetNode(node).setTargetPath("translation").setSampler(sampler)
  );
}

// 호흡: 몸통 앞뒤로 살짝, 힙 상하 미세 이동
rotChannel(spine, [[0, 0, 0], [0.03, 0, 0], [0, 0, 0], [0.03, 0, 0], [0, 0, 0]]);
transChannel(hips, [[0, 0.9, 0], [0, 0.905, 0], [0, 0.9, 0], [0, 0.905, 0], [0, 0.9, 0]]);
// 시선: 좌우로 천천히
rotChannel(head, [[0, 0, 0], [0.02, 0.12, 0], [0, 0, 0], [0.02, -0.12, 0], [0, 0, 0]]);
// 팔: 몸 옆에서 살짝 흔들림
rotChannel(armL, [[0, 0, 0.06], [0, 0, 0.09], [0, 0, 0.06], [0, 0, 0.03], [0, 0, 0.06]]);
rotChannel(armR, [[0, 0, -0.06], [0, 0, -0.03], [0, 0, -0.06], [0, 0, -0.09], [0, 0, -0.06]]);

mkdirSync("public/models", { recursive: true });
await new NodeIO().write("public/models/placeholder.glb", doc);
console.log("wrote public/models/placeholder.glb");
