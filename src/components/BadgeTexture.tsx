import * as THREE from 'three';
import { Text, PerspectiveCamera } from '@react-three/drei';

interface BadgeTextureProps {
  texture?: THREE.Texture | null;
}

export function BadgeTexture({ texture }: BadgeTextureProps) {
  const planeWidth = 1.6;
  const img = texture?.image as HTMLImageElement | undefined;
  const textureAspect =
    img && img.width && img.height ? img.width / img.height : 1.4;

  if (texture) texture.flipY = false;

  return (
    <>
      <color attach="background" args={['#475569']} />
      <ambientLight intensity={0.8} />
      <PerspectiveCamera makeDefault manual aspect={1.05} position={[0, 0, 2.2]} />
      <mesh>
        <planeGeometry args={[planeWidth, planeWidth / textureAspect]} />
        <meshBasicMaterial
          map={texture ?? undefined}
          color={texture ? undefined : new THREE.Color('#475569')}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, 0.15, 0.01]}
        fontSize={0.22}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
        maxWidth={1.4}
      >
        Nolan
      </Text>
      <Text
        position={[0, -.5, 0.01]}
        fontSize={0.14}
        color="#e2e8f0"
        anchorX="center"
        anchorY="middle"
        maxWidth={1.4}
      >
        Druid
      </Text>
    </>
  );
}

