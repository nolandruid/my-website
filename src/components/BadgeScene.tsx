import * as THREE from 'three';
import { useEffect, useRef, useState, useMemo } from 'react';
import { extend, useFrame, useThree } from '@react-three/fiber';
import {
  BallCollider,
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
  useRopeJoint,
  useSphericalJoint,
} from '@react-three/rapier';
import { Center, Resize, Text3D, useTexture } from '@react-three/drei';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';

extend({ MeshLineGeometry, MeshLineMaterial });

const BADGE_IMAGE = '/badge-base.jpeg';

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

function useBadgeCanvasTexture(imageTexture: THREE.Texture): THREE.CanvasTexture | null {
  return useMemo(() => {
    const img = imageTexture.image as HTMLImageElement;
    const width = img?.naturalWidth || img?.width || 1;
    const height = img?.naturalHeight || img?.height || 1;
    if (!img || !width || !height) return null;
    const w = 1024;
    const h = Math.round(1024 * (height / width));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = true;
    tex.needsUpdate = true;
    return tex;
  }, [imageTexture]);
}

export function BadgeScene({ maxSpeed = 50, minSpeed = 10 }: { maxSpeed?: number; minSpeed?: number }) {
  const badgeImage = useTexture(BADGE_IMAGE) as THREE.Texture;
  const cardTexture = useBadgeCanvasTexture(badgeImage);
  const band = useRef<THREE.Mesh>(null);
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
  (curve as THREE.CatmullRomCurve3 & { curveType?: string }).curveType = 'chordal';

  const [dragged, setDragged] = useState<THREE.Vector3 | null>(null);
  const [hovered, setHovered] = useState(false);

  // Smoothed positions for j1, j2, and j3 (reduces lanyard flicker)
  const j1Lerped = useRef(new THREE.Vector3());
  const j2Lerped = useRef(new THREE.Vector3());
  const j3Lerped = useRef(new THREE.Vector3());

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
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
      curve.points[0].copy(j3Lerped.current);
      curve.points[1].copy(j2Lerped.current);
      curve.points[2].copy(j1Lerped.current);
      curve.points[3].copy(fixed.current.translation());
      const points = curve.getPoints(32);
      const rounded = points.map((p) => new THREE.Vector3(
        Math.round(p.x * 200) / 200,
        Math.round(p.y * 200) / 200,
        Math.round(p.z * 200) / 200,
      ));
      const geometry = band.current?.geometry as { setPoints?: (pts: THREE.Vector3[]) => void } | undefined;
      if (geometry?.setPoints) geometry.setPoints(rounded);

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
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody ref={j1} position={[0.5, 0, 0]} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody ref={j2} position={[1, 0, 0]} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody ref={j3} position={[1.5, 0, 0]} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          ref={card}
          position={[2, 0, 0]}
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
            }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              if (card.current) {
                setDragged(
                  new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())),
                );
              }
            }}
          >
            <mesh renderOrder={1}>
              <planeGeometry args={[0.8 * 2, 1.125 * 2]} />
              <meshPhysicalMaterial
                map={cardTexture ?? undefined}
                color={cardTexture ? undefined : '#64748b'}
                clearcoat={1}
                clearcoatRoughness={0.15}
                roughness={0.3}
                metalness={0.5}
                side={THREE.DoubleSide}
                envMapIntensity={1}
              />
            </mesh>
            <group position={[-0.72, 0.2, 0.01]} rotation={[0, Math.PI, 0]}>
              <Center bottom left>
                <Resize height>
                  <group scale={[-0.007, 0.007, 0.007]}>
                    <Text3D
                      font="/helvetiker_regular.typeface.json"
                      size={0.2} //size of the name
                      height={0.03}
                      bevelEnabled={false}
                      bevelSize={0}
                      position={[0, -0.4, 0]}
                    >
                      Nolan
                      <meshStandardMaterial color="#f8fafc" side={THREE.DoubleSide} />
                    </Text3D>
                    <Text3D
                      font="/helvetiker_regular.typeface.json"
                      size={0.15}
                      height={0.025}
                      bevelEnabled={false}
                      bevelSize={0}
                      position={[0, -0.7, 0]}
                    >
                      Druid
                      <meshStandardMaterial color="#e2e8f0" side={THREE.DoubleSide} />
                    </Text3D>
                  </group>
                </Resize>
              </Center>
            </group>
          </group>
        </RigidBody>
      </group>
      <mesh ref={band} renderOrder={0}>
        {/* @ts-expect-error meshline extended primitives */}
        <meshLineGeometry />
        {/* @ts-expect-error meshline extended primitives */}
        <meshLineMaterial
          color="white"
          resolution={[width, height]}
          lineWidth={1}
          depthTest={false}
        />
      </mesh>
    </>
  );
}
