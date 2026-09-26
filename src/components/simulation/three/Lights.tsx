import { ScenePalette } from './constants';

export interface LightsProps {
  palette: ScenePalette;
}

export default function Lights({ palette }: LightsProps) {
  // In light theme: brighter ambient, whiter directional.
  // In dark theme: dimmer ambient, warm-cool mix for industrial feel.
  const isDark = palette.bg === '#020617';

  return (
    <>
      <ambientLight
        intensity={isDark ? 0.55 : 0.85}
        color={isDark ? '#94a3b8' : '#ffffff'}
      />
      <directionalLight
        position={[10, 18, 8]}
        intensity={isDark ? 1.1 : 1.0}
        color={isDark ? '#cbd5e1' : '#ffffff'}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0005}
      />
      <directionalLight
        position={[-8, 10, -6]}
        intensity={0.35}
        color={isDark ? '#06b6d4' : '#cbd5e1'}
      />
    </>
  );
}
