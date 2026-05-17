import * as THREE from 'three';
import { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { extend, useFrame, useThree } from '@react-three/fiber';
import {
  BallCollider,
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
  useRopeJoint,
  useSphericalJoint,
} from '@react-three/rapier';
import { Text3D, useGLTF, useTexture } from '@react-three/drei';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import type { Mesh } from 'three';

extend({ MeshLineGeometry, MeshLineMaterial });

/** Immutable axis for setFromUnitVectors (cylinder cap normal = local +Y). */
const STUD_CAP_UP = new THREE.Vector3(0, 1, 0);

const TAG_GLB = '/tag.glb';
const BADGE_IMAGE = '/badge-base.jpeg';
const BAND_TEXTURE = '/band-dark.jpg';

/**
 * Scales rope length, joint spacing, rope rest length, ball colliders, stud, and strap line width.
 * Badge GLB scale is unchanged (`scale={2.25}` on the tag group).
 */
const LANYARD_WORLD_SCALE = 0.5;

/** World Y of the rope + card group — lower moves the whole badge down in the frame. */
/** Too high and the strap spline crowds the metal clip; ~3.5 keeps lift without overlap. */
const LANYARD_ANCHOR_GROUP_Y = 4.5;
const LANYARD_ANCHOR_GROUP_X = -3;

/**
 * Card-end rope bead (j3) sits slightly below j1/j2 so the meshline drops away from the clip
 * before curving toward the anchor (stops strap overlapping clip geometry).
 */
const ROPE_J3_Y_OFFSET = -0.14;

/**
 * Visual-only: first spline control is nudged from j3 toward j2 so the strap MeshLine
 * stops at the hook ring instead of drawing through the GLB clip geometry. Physics still uses j3.
 * 0 = use real j3; ~0.15–0.28 typical; too high detaches the line from the badge.
 */
const LANYARD_STRAP_END_TRIM = 0.2;

/**
 * Exponential smoothing on the visual strap tip (follows j3→j2 trim target). Reduces MeshLine
 * miter blow-up / “cone” flicker when the card moves — the line tip stops snapping every frame.
 */
const LANYARD_STRAP_TIP_SMOOTH = 40;

/** CatmullRom samples along the strap; more points = smaller per-segment angles = safer miters. */
const LANYARD_CURVE_SAMPLES = 128;

/**
 * Stretches horizontal spacing between joints (longer strap arc, less “tight” chain).
 * 1 = minimum; raise toward ~1.5 for more length between anchor and card.
 */
const ROPE_SPAN_STRETCH = 1.42;

/**
 * Rope segment max length ÷ joint spacing — above ~2 adds slack so the lanyard can sag.
 */
const ROPE_LINK_SLACK = 2.45;

/** Rope: fixed → j1 → j2 → j3 → card, even spacing on X. */
const ROPE = {
  step: 0.5 * LANYARD_WORLD_SCALE * ROPE_SPAN_STRETCH,
  linkLength: 0.5 * LANYARD_WORLD_SCALE * ROPE_SPAN_STRETCH * ROPE_LINK_SLACK,
  ballRadius: 0.1 * LANYARD_WORLD_SCALE,
} as const;

/**
 * Strap rivet — lives on the lanyard curve (not parented to the card).
 * curveT: 0 = j3/card end of spline, 1 = anchor; ~0.06–0.15 sits just above the clip.
 * Cylinder axis Y is aligned to strap tangent each frame (disc ⊥ strap).
 */
const STRAP_STUD = {
  curveT: 0.1,
  radius: 0.04 * 2.25 * LANYARD_WORLD_SCALE,
  /** Taller than real scale so the disc isn’t paper-thin when seen at a grazing angle */
  height: 0.022 * 2.25 * LANYARD_WORLD_SCALE,
  segments: 32,
  /** Nudge along view normal so the stud clears the 2D mesh line (avoids z-fight / hiding). */
  outset: 0.04 * LANYARD_WORLD_SCALE,
} as const;

/**
 * MeshLine samples `vUV * repeat` — smaller |repeatU| stretches the texture along the strap
 * (fewer tiles, less cramped weave). Negative repeatU mirrors; lineWidth is screen px (scales with lanyard).
 */
const BAND_LINE = {
  /** Smaller |repeatU| = texture stretched more along the strap (good if the rope got longer). */
  repeatU: -2.05,
  repeatV: 1,
  lineWidth: 2.1 * LANYARD_WORLD_SCALE,
} as const;

useGLTF.preload(TAG_GLB);
useTexture.preload(BAND_TEXTURE);

type TagGltf = {
  nodes: {
    card: Mesh;
    clip: Mesh;
    clamp: Mesh;
  };
  materials: {
    base: THREE.MeshPhysicalMaterial;
    metal: THREE.MeshStandardMaterial;
  };
};

// Shared props for rope segments. Same for all segments except type overrides:
// - type: 'dynamic' = simulated by physics; 'fixed' = anchor; 'kinematicPosition' = moved by code (dragging)
// - canSleep: when true, bodies can sleep when idle (stops simulating) for performance
// - colliders: false = no auto collider from mesh; we add BallCollider/CuboidCollider explicitly
// - angularDamping / linearDamping: resistance to rotation and movement (smoother, less bouncy)
const segmentProps = {
  type: 'dynamic' as const,
  canSleep: true,
  colliders: false as const,
  angularDamping: 2,
  linearDamping: 2,
};

/**
 * Card photo size (uniform inset on all sides after UVs are normalized).
 *   0.03  = default — small margin
 *   0.08–0.12 = clearly smaller photo, more “frame” visible
 *   0.2   = photo quite small on the card
 *   0     = full bleed (edge to edge)
 * Tweak this number only — no other change needed to shrink or grow the image.
 * If the photo looks stretched, use CARD_IMAGE_FIT / CARD_IMAGE_LETTERBOX_COLOR below.
 */
const CARD_IMAGE_PADDING = 0.03;

/** Set false if the photo appears upside down on the card (V axis). */
const CARD_IMAGE_FLIP_V = true;

/**
 * Photo vs card opening (fixes stretched/squashed look).
 *   'contain' — keep photo aspect ratio; empty bands use CARD_IMAGE_LETTERBOX_COLOR
 *   'cover'   — fill the opening, crop edges if needed
 *   'fill'    — stretch to edges (ignores photo aspect; old behavior)
 * Alignment (contain/cover): CARD_IMAGE_ALIGN_X / CARD_IMAGE_ALIGN_Y below.
 */
const CARD_IMAGE_FIT: 'contain' | 'cover' | 'fill' = 'contain';

/** Bands around the photo when CARD_IMAGE_FIT is 'contain' (card plastic color). */
const CARD_IMAGE_LETTERBOX_COLOR = '#ffffff';

/** Max texture dimension (px); other side follows UV aspect. */
const CARD_TEXTURE_SIZE = 1024;

/**
 * Where the photo sits inside the card opening (like CSS object-position).
 * Only affects `contain` and `cover`; ignored for `fill`.
 *   X: 0 = left, 0.5 = center, 1 = right
 *   Y: 0 = top of texture canvas, 1 = bottom (if it looks inverted on the badge, flip: use 1−y)
 */
const CARD_IMAGE_ALIGN_X = 1;
const CARD_IMAGE_ALIGN_Y = 0.5;

/**
 * Name + subtitle on the badge (Text3D). Edit here instead of hunting through JSX.
 *
 * We intentionally do NOT use drei's <Center> or <Resize> here: they measure child bounds in
 * useLayoutEffect. Text3D geometry is often empty on the first pass, so bbox-based centering
 * scales differently every refresh → same numbers, shifting text. Explicit transforms only.
 *
 * groupPosition — moves the whole block on the card (rigid-body local units).
 *   X+ → right, Y+ → up, Z+ → toward the default camera.
 * groupRotation — [rx, ry, rz] in radians; Y = π flips to face the camera with the card.
 *
 * line1 / line2 — position [x,y,z] in Text3D units (before innerScale); Y separates the two lines.
 * innerScale — overall text size; negative X mirrors for correct front-face reading.
 *   (Former drei's <Resize height> scaled bbox height to ~1 world unit; ~0.007 × (1/0.0021) ≈ 3.35.)
 */
const BADGE_NAME = {
  groupPosition: [-0.72, 0.2, 0.025] as const,
  groupRotation: [0, Math.PI, 0] as const,
  innerScale: [-3.35, 3.35, 3.35] as const,
  line1: {
    text: 'Nolan',
    position: [0, -.28, 0] as const,
    size: .08,
    height: 0.03,
    color: '#f8fafc',
  },
  line2: {
    text: 'Druid',
    position: [0, -.38, 0] as const,
    size: 0.07,
    height: 0.025,
    color: '#e2e8f0',
  },
} as const;

/**
 * meshline leaves its miter clamp commented out and normalizes dir1+dir2 without a zero-length
 * guard — both cause huge miter spikes on sharp or near-antiparallel joins (the gray cone flicker).
 * Two targeted single-line replaces are used so whitespace in the dist file doesn't matter.
 */
function applyMeshLineMiterPatch(material: THREE.ShaderMaterial) {
  if (!material.vertexShader || material.vertexShader.includes('/*lanyardMiterPatch*/')) return;
  let vs = material.vertexShader;
  // 1. Guard the bisector normalize against near-zero input (antiparallel segments).
  vs = vs.replace(
    'dir = normalize(dir1 + dir2);',
    'vec2 b_=dir1+dir2; dir=dot(b_,b_)<1e-6?dir1:normalize(b_); /*lanyardMiterPatch*/',
  );
  // 2. Restore the miter-width clamp (commented out in the stock shader) with a tighter cap.
  vs = vs.replace(
    '//w = clamp(w / dot(miter, perp), 0., 4. * lineWidth * width);',
    'w = clamp(w / max(abs(dot(miter, perp)), 0.1), 0., 2. * lineWidth * width);',
  );
  if (vs !== material.vertexShader) {
    material.vertexShader = vs;
    material.needsUpdate = true;
  }
}

/**
 * Fraction of the strap (from the ring/j3 end) over which MeshLine width tapers from 0→1.
 * The ring GLB covers this invisible zone, so no gap is visible. Any miter artifact inside
 * this zone is rendered at near-zero width, making it visually harmless.
 */
const STRAP_TIP_TAPER = 0.15;

/** widthCallback for MeshLine — p=0 is the ring end, p=1 is the anchor. */
function strapWidthTaper(p: number): number {
  return p < STRAP_TIP_TAPER ? p / STRAP_TIP_TAPER : 1.0;
}

function cardFaceUvAspect(geometry: THREE.BufferGeometry): number {
  const uvAttr = geometry.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uvAttr) return 1;
  const uvs = uvAttr.array as Float32Array;
  let minU = Infinity,
    maxU = -Infinity,
    minV = Infinity,
    maxV = -Infinity;
  for (let i = 0; i < uvs.length; i += 2) {
    if (uvs[i] < minU) minU = uvs[i];
    if (uvs[i] > maxU) maxU = uvs[i];
    if (uvs[i + 1] < minV) minV = uvs[i + 1];
    if (uvs[i + 1] > maxV) maxV = uvs[i + 1];
  }
  const rangeU = maxU - minU || 1;
  const rangeV = maxV - minV || 1;
  return rangeU / rangeV;
}

/**
 * Clones the card geometry and normalizes its UV set so the image maps cleanly.
 * Second argument `flipU`: set true if the photo is mirrored left/right.
 * Padding defaults to CARD_IMAGE_PADDING above.
 */
function useRemappedCardGeometry(
  original: THREE.BufferGeometry,
  flipU = false,
  padding = CARD_IMAGE_PADDING,
): THREE.BufferGeometry {
  return useMemo(() => {
    const geo = original.clone();
    const uvAttr = geo.attributes.uv as THREE.BufferAttribute;
    const uvs = uvAttr.array as Float32Array;

    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (let i = 0; i < uvs.length; i += 2) {
      if (uvs[i] < minU) minU = uvs[i];
      if (uvs[i] > maxU) maxU = uvs[i];
      if (uvs[i + 1] < minV) minV = uvs[i + 1];
      if (uvs[i + 1] > maxV) maxV = uvs[i + 1];
    }

    const rangeU = maxU - minU || 1;
    const rangeV = maxV - minV || 1;

    for (let i = 0; i < uvs.length; i += 2) {
      // Normalize to 0→1 then apply padding: remap into [padding, 1-padding]
      const u = padding + ((uvs[i] - minU) / rangeU) * (1 - 2 * padding);
      const v = padding + ((uvs[i + 1] - minV) / rangeV) * (1 - 2 * padding);
      uvs[i] = flipU ? 1 - u : u;
      uvs[i + 1] = CARD_IMAGE_FLIP_V ? 1 - v : v;
    }

    uvAttr.needsUpdate = true;
    return geo;
  }, [original, flipU, padding]);
}

/**
 * MeshLine's shader uses `texture2D(map, vUV * repeat)` and ignores Texture.matrix.
 * A tall strip (band-dark.jpg) must be rotated so pattern runs along the line's u axis.
 */
function useMeshlineStrapTexture(source: THREE.Texture): THREE.Texture {
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const img = source.image as HTMLImageElement | undefined;
    if (!img) return;

    const build = () => {
      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      if (!nw || !nh) return;

      const canvas = document.createElement('canvas');
      canvas.width = nh;
      canvas.height = nw;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -nw / 2, -nh / 2);

      const canvasTex = new THREE.CanvasTexture(canvas);
      canvasTex.wrapS = THREE.RepeatWrapping;
      canvasTex.wrapT = THREE.RepeatWrapping;
      canvasTex.colorSpace = THREE.SRGBColorSpace;
      canvasTex.flipY = false;
      canvasTex.needsUpdate = true;

      setTex((prev) => {
        if (prev instanceof THREE.CanvasTexture) prev.dispose();
        return canvasTex;
      });
    };

    if (img.complete && (img.naturalWidth || img.width)) build();
    else img.addEventListener('load', build);

    return () => {
      img.removeEventListener('load', build);
      setTex((prev) => {
        if (prev instanceof THREE.CanvasTexture) prev.dispose();
        return null;
      });
    };
  }, [source]);

  return tex ?? source;
}

function useBadgeCanvasTexture(
  imageTexture: THREE.Texture,
  fit: 'contain' | 'cover' | 'fill',
  uvAspect: number,
): THREE.CanvasTexture | null {
  return useMemo(() => {
    const img = imageTexture.image as HTMLImageElement;
    const iw = img?.naturalWidth || img?.width || 1;
    const ih = img?.naturalHeight || img?.height || 1;
    if (!img || !iw || !ih) return null;

    const a = Math.max(uvAspect, 1e-6);
    let cw: number;
    let ch: number;
    if (a >= 1) {
      cw = CARD_TEXTURE_SIZE;
      ch = Math.max(1, Math.round(CARD_TEXTURE_SIZE / a));
    } else {
      ch = CARD_TEXTURE_SIZE;
      cw = Math.max(1, Math.round(CARD_TEXTURE_SIZE * a));
    }

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const ax = Math.min(1, Math.max(0, CARD_IMAGE_ALIGN_X));
    const ay = Math.min(1, Math.max(0, CARD_IMAGE_ALIGN_Y));

    if (fit === 'fill') {
      ctx.drawImage(img, 0, 0, cw, ch);
    } else if (fit === 'contain') {
      ctx.fillStyle = CARD_IMAGE_LETTERBOX_COLOR;
      ctx.fillRect(0, 0, cw, ch);
      const scale = Math.min(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const ox = (cw - dw) * ax;
      const oy = (ch - dh) * ay;
      ctx.drawImage(img, ox, oy, dw, dh);
    } else {
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const ox = (cw - dw) * ax;
      const oy = (ch - dh) * ay;
      ctx.drawImage(img, ox, oy, dw, dh);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    tex.needsUpdate = true;
    return tex;
  }, [imageTexture, fit, uvAspect, CARD_IMAGE_ALIGN_X, CARD_IMAGE_ALIGN_Y]);
}

export function BadgeScene({ maxSpeed = 50, minSpeed = 10, onDragStart, onDragEnd }: { maxSpeed?: number; minSpeed?: number; onDragStart?: () => void; onDragEnd?: () => void }) {
  const { nodes, materials } = useGLTF(TAG_GLB) as unknown as TagGltf;
  const cardGeo = useRemappedCardGeometry(nodes.card.geometry, false);
  const cardUvAspect = useMemo(() => cardFaceUvAspect(nodes.card.geometry), [nodes.card.geometry]);
  const badgeImage = useTexture(BADGE_IMAGE) as THREE.Texture;
  const bandMapSource = useTexture(BAND_TEXTURE) as THREE.Texture;
  const strapTex = useMeshlineStrapTexture(bandMapSource);
  const cardTexture = useBadgeCanvasTexture(badgeImage, CARD_IMAGE_FIT, cardUvAspect);
  const bandRepeatVec = useMemo(
    () => new THREE.Vector2(BAND_LINE.repeatU, BAND_LINE.repeatV),
    [],
  );
  const bandMatRef = useRef<THREE.ShaderMaterial>(null);
  const band = useRef<THREE.Mesh>(null);
  const strapStudGroupRef = useRef<THREE.Group>(null);
  const studCurvePoint = useRef(new THREE.Vector3());
  const studCurveTangent = useRef(new THREE.Vector3());
  const studFaceNormal = useRef(new THREE.Vector3());
  const studFallbackAxis = useRef(new THREE.Vector3());
  const cameraWorldPos = useRef(new THREE.Vector3());
  const fixed = useRef<RapierRigidBody | null>(null);
  const j1 = useRef<RapierRigidBody | null>(null);
  const j2 = useRef<RapierRigidBody | null>(null);
  const j3 = useRef<RapierRigidBody | null>(null);
  const card = useRef<RapierRigidBody | null>(null);

  const vec = useRef(new THREE.Vector3()).current;
  const ang = useRef(new THREE.Vector3()).current;
  const rot = useRef(new THREE.Vector3()).current;
  const dir = useRef(new THREE.Vector3()).current;

  const { size } = useThree();
  const width = size.width;
  const height = size.height;

  useLayoutEffect(() => {
    const m = bandMatRef.current;
    if (!m?.uniforms?.useMap) return;
    applyMeshLineMiterPatch(m);
    m.uniforms.useMap.value = 1;
    m.uniforms.map.value = strapTex;
    m.uniforms.repeat.value.copy(bandRepeatVec);
    m.uniforms.resolution.value.set(width, height);
  }, [strapTex, bandRepeatVec, width, height]);

  // 4-point curve: j3 (near card) → j2 → j1 → fixed (anchor). Chordal type reduces overshoot.
  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
  );
  // 'centripetal' guarantees no cusps or self-intersections between control points,
  // making it the safest type for dynamically-driven strap geometry.
  (curve as THREE.CatmullRomCurve3 & { curveType?: string }).curveType = 'centripetal';

  const [dragged, setDragged] = useState<THREE.Vector3 | null>(null);
  const [hovered, setHovered] = useState(false);

  // Smoothed positions for j1, j2, and j3 (reduces lanyard flicker)
  const j1Lerped = useRef(new THREE.Vector3());
  const j2Lerped = useRef(new THREE.Vector3());
  const j3Lerped = useRef(new THREE.Vector3());
  const lanyardBandEnd = useRef(new THREE.Vector3());
  const smoothedStrapTip = useRef(new THREE.Vector3());
  const strapTipSmoothingReady = useRef(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], ROPE.linkLength]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], ROPE.linkLength]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], ROPE.linkLength]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => {
        document.body.style.cursor = 'auto';
      };
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      });
    }
    if (fixed.current && j1.current && j2.current && j3.current && card.current) {
      [j1, j2, j3].forEach((ref, i) => {
        const lerped = [j1Lerped, j2Lerped, j3Lerped][i].current;
        const pos = ref.current!.translation();
        const clampedDistance = Math.max(0.1, Math.min(1, lerped.distanceTo(pos)));
        const t = delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed));
        lerped.lerp(pos, t);
      });
      lanyardBandEnd.current
        .copy(j3Lerped.current)
        .lerp(j2Lerped.current, LANYARD_STRAP_END_TRIM);
      if (!strapTipSmoothingReady.current) {
        smoothedStrapTip.current.copy(lanyardBandEnd.current);
        strapTipSmoothingReady.current = true;
      } else {
        const k = 1 - Math.exp(-LANYARD_STRAP_TIP_SMOOTH * delta);
        smoothedStrapTip.current.lerp(lanyardBandEnd.current, k);
      }
      curve.points[0].copy(smoothedStrapTip.current);
      curve.points[1].copy(j2Lerped.current);
      curve.points[2].copy(j1Lerped.current);
      curve.points[3].copy(fixed.current.translation());
      const points = curve.getPoints(LANYARD_CURVE_SAMPLES);
      const geometry = band.current?.geometry as {
        setPoints?: (pts: THREE.Vector3[], widthCb?: (p: number) => number) => void;
      } | undefined;
      if (geometry?.setPoints) geometry.setPoints(points, strapWidthTaper);

      const studGrp = strapStudGroupRef.current;
      if (studGrp) {
        curve.getPointAt(STRAP_STUD.curveT, studCurvePoint.current);
        curve.getTangentAt(STRAP_STUD.curveT, studCurveTangent.current);
        const t = studCurveTangent.current;
        t.normalize();
        studGrp.position.copy(studCurvePoint.current);

        // Cap faces camera: local +Y → toward camera, projected ⊥ strap (meshline is 2D — pull out a bit).
        const n = studFaceNormal.current;
        state.camera.getWorldPosition(cameraWorldPos.current);
        n.copy(cameraWorldPos.current).sub(studCurvePoint.current).normalize();
        n.addScaledVector(t, -n.dot(t));
        if (n.lengthSq() < 1e-6) {
          const f = studFallbackAxis.current;
          f.set(0, 1, 0);
          n.crossVectors(t, f);
          if (n.lengthSq() < 1e-6) {
            f.set(1, 0, 0);
            n.crossVectors(t, f);
          }
        }
        n.normalize();
        if (Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)) {
          studGrp.quaternion.setFromUnitVectors(STUD_CAP_UP, n);
        }
        studGrp.position.addScaledVector(n, STRAP_STUD.outset);
      }

      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel(
        { x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z },
        true,
      );
    }
  });

  return (
    <>
      <group position={[LANYARD_ANCHOR_GROUP_X, LANYARD_ANCHOR_GROUP_Y, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody ref={j1} position={[ROPE.step, 0, 0]} {...segmentProps}>
          <BallCollider args={[ROPE.ballRadius]} />
        </RigidBody>
        <RigidBody ref={j2} position={[ROPE.step * 2, 0, 0]} {...segmentProps}>
          <BallCollider args={[ROPE.ballRadius]} />
        </RigidBody>
        <RigidBody ref={j3} position={[ROPE.step * 3, ROPE_J3_Y_OFFSET, 0]} {...segmentProps}>
          <BallCollider args={[ROPE.ballRadius]} />
        </RigidBody>
        <RigidBody
          ref={card}
          position={[ROPE.step * 4, 0, 0]}
          {...segmentProps}
          type={dragged ? 'kinematicPosition' : 'dynamic'}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            position={[0, 0, -0.05]}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerUp={(e) => {
              (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
              setDragged(null);
              onDragEnd?.();
            }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              if (card.current) {
                setDragged(
                  new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())),
                );
                onDragStart?.();
              }
            }}
          >
            {/* Vercel tag.glb: rotation flips card so printed face aims at camera; offset+scale align clip hole with spherical joint. */}
            <group position={[0, -1.2, 0]} scale={2.25} rotation={[0, Math.PI, 0]}>
              <mesh geometry={cardGeo} renderOrder={1}>
                <meshPhysicalMaterial
                  color="#ffffff"
                  map={cardTexture ?? materials.base.map}
                  map-anisotropy={16}
                  metalness={0}
                  roughness={0.45}
                  clearcoat={0.35}
                  clearcoatRoughness={0.25}
                  envMapIntensity={1}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Black back: z=0.005 in the π-rotated group maps to world z≈−0.01 when card
                  faces camera (photo wins depth), and to +0.01 when physics flips the card
                  (black wins depth, covers photo). Both DoubleSide so no normal-flip artifacts. */}
              <mesh geometry={cardGeo} position={[0, 0, 0.005]} renderOrder={2}>
                <meshPhysicalMaterial
                  color="#080808"
                  metalness={0.9}
                  roughness={0.05}
                  clearcoat={1}
                  clearcoatRoughness={0.03}
                  envMapIntensity={2}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* polygonOffset + renderOrder: ring draws after strap so it isn’t “shadowed” by meshline depth */}
              <mesh
                geometry={nodes.clip.geometry}
                material={materials.metal}
                material-roughness={0.3}
                material-polygonOffset
                material-polygonOffsetFactor={-4}
                material-polygonOffsetUnits={-4}
                renderOrder={2}
              />
              <mesh
                geometry={nodes.clamp.geometry}
                material={materials.metal}
                material-polygonOffset
                material-polygonOffsetFactor={-4}
                material-polygonOffsetUnits={-4}
                renderOrder={2}
              />
            </group>
            <group
              position={[...BADGE_NAME.groupPosition]}
              rotation={[...BADGE_NAME.groupRotation] as [number, number, number]}
            >
              <group scale={BADGE_NAME.innerScale}>
                <Text3D
                  font="/helvetiker_regular.typeface.json"
                  size={BADGE_NAME.line1.size}
                  height={BADGE_NAME.line1.height}
                  bevelEnabled={false}
                  bevelSize={0}
                  position={[...BADGE_NAME.line1.position]}
                >
                  {BADGE_NAME.line1.text}
                  <meshStandardMaterial color={BADGE_NAME.line1.color} side={THREE.DoubleSide} />
                </Text3D>
                <Text3D
                  font="/helvetiker_regular.typeface.json"
                  size={BADGE_NAME.line2.size}
                  height={BADGE_NAME.line2.height}
                  bevelEnabled={false}
                  bevelSize={0}
                  position={[...BADGE_NAME.line2.position]}
                >
                  {BADGE_NAME.line2.text}
                  <meshStandardMaterial color={BADGE_NAME.line2.color} side={THREE.DoubleSide} />
                </Text3D>
              </group>
            </group>
          </group>
        </RigidBody>
      </group>
      <mesh ref={band} renderOrder={0}>
        {/* @ts-expect-error meshline extended primitives */}
        <meshLineGeometry />
        {/* @ts-expect-error meshline extended primitives */}
        <meshLineMaterial
          ref={bandMatRef}
          color="white"
          depthTest={true}
          depthWrite={true}
          resolution={[width, height]}
          map={strapTex}
          repeat={bandRepeatVec}
          lineWidth={BAND_LINE.lineWidth}
          useMap={1}
        />
      </mesh>
    </>
  );
}
