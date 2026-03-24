import * as THREE from 'three';
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
  useSphericalJoint,
} from '@react-three/rapier';

interface BadgeCardProps {
  anchor: React.MutableRefObject<RapierRigidBody | null>;
}

export function BadgeCard({ anchor }: BadgeCardProps) {
  const card = useRef<RapierRigidBody | null>(null);
  const dragOffset = useRef<THREE.Vector3 | null>(null);
  const [dragged, setDragged] = useState(false);

  const vec = useRef(new THREE.Vector3()).current;
  const dir = useRef(new THREE.Vector3()).current;
  const ang = useRef(new THREE.Vector3()).current;
  const rot = useRef(new THREE.Vector3()).current;

  useSphericalJoint(anchor, card, [[0, 0, 0], [0, 1.45, 0]]);

  useFrame((state) => {
    if (!card.current) return;

    if (dragged && dragOffset.current) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));

      const target = {
        x: vec.x - dragOffset.current.x,
        y: vec.y - dragOffset.current.y,
        z: vec.z - dragOffset.current.z,
      };

      card.current.setNextKinematicTranslation(target);
    }

    // Nudge the card so it tends to face the viewer again
    ang.copy(card.current.angvel());
    rot.copy(card.current.rotation());
    card.current.setAngvel(
      { x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z },
      true,
    );
  });

  return (
    <RigidBody
      ref={card}
      position={[0, -0.35, 0]}
      type={dragged ? 'kinematicPosition' : 'dynamic'}
      colliders={false}
    >
      <CuboidCollider args={[0.8, 1.125, 0.02]} />
      <mesh
        onPointerDown={(e) => {
          if (!card.current) return;
          e.stopPropagation();
          const cardPos = card.current.translation();
          dragOffset.current = new THREE.Vector3().copy(e.point).sub(cardPos);
          setDragged(true);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          setDragged(false);
          dragOffset.current = null;
        }}
      >
        <planeGeometry args={[1.6, 2.25]} />
        <meshPhysicalMaterial
          color="#fafbfe"
          clearcoat={0.2}
          clearcoatRoughness={0.3}
          metalness={0.1}
          roughness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
    </RigidBody>
  );
}

