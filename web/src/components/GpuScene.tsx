import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import type { HardwareComponent, TraceEvent } from '@tinygpu-trace-lab/simulator';

interface Props {
  event: TraceEvent;
  cameraMode: string;
}

const components: Array<{ name: HardwareComponent; position: [number, number, number]; scale: [number, number, number]; color: string }> = [
  { name: 'Device Control Register', position: [-4.2, 2.1, 0], scale: [1.8, 0.45, 0.8], color: '#244355' },
  { name: 'Dispatcher', position: [-2.2, 1.2, 0], scale: [1.35, 0.55, 0.9], color: '#294756' },
  { name: 'Program Memory', position: [-4, -1.15, 0], scale: [1.55, 1.5, 0.65], color: '#26313f' },
  { name: 'Core', position: [0, 0.2, 0], scale: [2.1, 1.75, 1.1], color: '#223743' },
  { name: 'Register File', position: [-0.78, 0.45, 0.72], scale: [0.82, 0.72, 0.32], color: '#2e5d63' },
  { name: 'ALU', position: [0.4, 0.55, 0.76], scale: [0.72, 0.55, 0.34], color: '#5b5126' },
  { name: 'LSU', position: [0.4, -0.35, 0.76], scale: [0.72, 0.55, 0.34], color: '#564026' },
  { name: 'Condition Flags', position: [-0.72, -0.52, 0.76], scale: [0.72, 0.42, 0.34], color: '#3a4e34' },
  { name: 'Program Counter', position: [-0.05, 1.35, 0.8], scale: [0.78, 0.34, 0.28], color: '#36536b' },
  { name: 'Data Memory', position: [3.9, -0.9, 0], scale: [1.55, 1.8, 0.7], color: '#2c303a' },
  { name: 'Memory Controller', position: [2.35, 0.85, 0], scale: [1.35, 0.62, 0.9], color: '#493b27' }
];

export function GpuScene({ event, cameraMode }: Props) {
  const labelOffset = cameraMode.includes('Memory') ? 'memory-focus' : cameraMode.includes('Core') ? 'core-focus' : 'overview-focus';

  return (
    <div className={`scene ${labelOffset}`}>
      <Canvas camera={{ position: [0, 3.8, 7.2], fov: 48 }}>
        <color attach="background" args={['#0b1116']} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[4, 7, 5]} intensity={1.4} />
        <group rotation={[-0.32, 0.16, 0]}>
          {components.map((component) => (
            <HardwareBlock key={component.name} {...component} active={component.name === event.activeComponent} tokenType={event.tokenType} />
          ))}
          <TokenPath event={event} />
        </group>
      </Canvas>
      <div className="scene-map" aria-hidden="true">
        <div className={`map-node dcr ${event.activeComponent === 'Device Control Register' ? 'is-active' : ''}`}>Device Control Register</div>
        <div className={`map-node dispatcher ${event.activeComponent === 'Dispatcher' ? 'is-active' : ''}`}>Dispatcher</div>
        <div className={`map-node program ${event.activeComponent === 'Program Memory' ? 'is-active' : ''}`}>Program Memory</div>
        <div className={`map-node pc ${event.activeComponent === 'Program Counter' ? 'is-active' : ''}`}>Program Counter</div>
        <div className={`map-node data ${event.activeComponent === 'Data Memory' ? 'is-active' : ''}`}>Data Memory</div>
        <div className={`map-node memory ${event.activeComponent === 'Memory Controller' ? 'is-active' : ''}`}>Memory Controller</div>
        <div className={`map-node core ${event.activeComponent === 'Core' ? 'is-active' : ''}`}>
          <strong>Core Cluster</strong>
          <div className={`sub-node registers ${event.activeComponent === 'Register File' ? 'is-active' : ''}`}>Register File</div>
          <div className={`sub-node alu ${event.activeComponent === 'ALU' ? 'is-active' : ''}`}>ALU</div>
          <div className={`sub-node lsu ${event.activeComponent === 'LSU' ? 'is-active' : ''}`}>LSU</div>
          <div className={`sub-node flags ${event.activeComponent === 'Condition Flags' ? 'is-active' : ''}`}>Condition Flags</div>
        </div>
        <div className={`token-route instruction ${event.tokenType !== 'data' ? 'is-active' : ''}`} />
        <div className={`token-route data-path ${event.tokenType !== 'instruction' ? 'is-active' : ''}`} />
        <div className="token-dot" />
      </div>
    </div>
  );
}

function HardwareBlock({ name, position, scale, color, active, tokenType }: (typeof components)[number] & { active: boolean; tokenType: string }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pulse = active ? 1 + Math.sin(clock.elapsedTime * 7) * 0.045 : 1;
    ref.current.scale.set(scale[0] * pulse, scale[1] * pulse, scale[2] * pulse);
  });
  const emissive = active ? (tokenType === 'data' ? '#f59e0b' : '#22d3ee') : '#000000';

  return (
    <mesh ref={ref} position={position} castShadow receiveShadow name={name}>
      <boxGeometry />
      <meshStandardMaterial color={active ? '#f8fafc' : color} emissive={emissive} emissiveIntensity={active ? 0.75 : 0} roughness={0.55} metalness={0.2} />
    </mesh>
  );
}

function TokenPath({ event }: { event: TraceEvent }) {
  const points = useMemo(() => {
    const stageIndex = ['Fetch', 'Decode', 'Execute', 'Memory', 'Writeback'].indexOf(event.stage);
    return Array.from({ length: 5 }, (_, index) => [-3.5 + index * 1.75, Math.sin(index * 0.8) * 0.45, 1.08 + stageIndex * 0.02] as [number, number, number]);
  }, [event.stage]);
  const tokenColor = event.tokenType === 'data' ? '#f59e0b' : event.tokenType === 'combined' ? '#34d399' : '#22d3ee';

  return (
    <group>
      {points.map((point, index) => (
        <mesh key={`${event.cycle}-${index}`} position={point}>
          <sphereGeometry args={[index === ['Fetch', 'Decode', 'Execute', 'Memory', 'Writeback'].indexOf(event.stage) ? 0.105 : 0.045, 16, 16]} />
          <meshStandardMaterial color={tokenColor} emissive={tokenColor} emissiveIntensity={1.2} />
        </mesh>
      ))}
    </group>
  );
}
