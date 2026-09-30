import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CanvasTexture, Color, Vector3, type Mesh } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ExecutionEvent } from "@tinygpu-trace-lab/simulator";

export type Inspection = "program" | "registers" | "memory" | "arithmetic";
interface Props {
  event: ExecutionEvent;
  spatial: boolean;
  reducedMotion: boolean;
  inspect: (selection: Inspection) => void;
}
const blocks: Array<{
  id: Inspection;
  label: string;
  x: number;
  y: number;
  width: number;
  color: string;
}> = [
  {
    id: "program",
    label: "Program memory",
    x: 70,
    y: 30,
    width: 180,
    color: "#8dbef0",
  },
  {
    id: "registers",
    label: "Register file",
    x: 290,
    y: 170,
    width: 180,
    color: "#88dab0",
  },
  {
    id: "arithmetic",
    label: "ALU / LSU",
    x: 540,
    y: 170,
    width: 145,
    color: "#efba78",
  },
  {
    id: "memory",
    label: "Data memory",
    x: 70,
    y: 170,
    width: 180,
    color: "#e2a4ca",
  },
];

function activeBlock(event: ExecutionEvent): Inspection {
  if (event.stage === "Fetch" || event.stage === "Decode") return "program";
  if (event.stage === "Memory" && ["LDR", "STR"].includes(event.opcode))
    return "memory";
  if (event.stage === "Execute") return "arithmetic";
  return "registers";
}

export function LabArchitecture({
  event,
  spatial,
  reducedMotion,
  inspect,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setCompact(entry.contentRect.width < 560);
    });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const circuitBlocks = compact
    ? blocks.map((block) => ({
        ...block,
        x: block.id === "program" || block.id === "memory" ? 12 : 192,
        y: block.id === "program" || block.id === "registers" ? 25 : 150,
        width: 156,
      }))
    : blocks;
  const active = activeBlock(event);
  const memoryOperand = event.operands.find(
    (operand) => operand.kind === "address",
  );
  const route =
    event.stage === "Fetch" || event.stage === "Decode"
      ? compact
        ? "M168 66H192"
        : "M250,68 L380,68 L380,170"
      : event.stage === "Memory" && event.opcode === "STR"
        ? compact
          ? "M192 90H180V191H168"
          : "M290,215 L250,215"
        : event.opcode === "LDR" &&
            ["Memory", "Writeback"].includes(event.stage)
          ? compact
            ? "M168 191H180V90H192"
            : "M250,215 L290,215"
          : event.stage === "Writeback"
            ? compact
              ? "M295 150V107"
              : "M540,238 L470,238"
            : compact
              ? "M235 107V150"
              : "M470,192 L540,192";
  const connections = compact
    ? [
        "M168 66H192",
        "M168 191H180V90H192",
        "M235 107V150",
        "M295 150V107",
        "M90 232V250H270V232",
      ]
    : [
        "M250 68H380V170",
        "M250 215H290",
        "M470 192H540",
        "M540 238H470",
        "M160 252V290H610V252",
      ];
  return (
    <div
      ref={container}
      className={`lab-architecture ${reducedMotion ? "still" : ""} ${compact && !spatial ? "compact-circuit" : ""}`}
    >
      <div className="architecture-status">
        <span className="status-light" />
        {event.stage}{" "}
        <span>
          THREAD {event.threadId} / PC {event.pc}
        </span>
      </div>
      {spatial ? (
        <SceneBoundary
          fallback={
            <p className="canvas-fallback">
              3D rendering is unavailable. The 2D circuit and all execution
              details remain available.
            </p>
          }
        >
          <Canvas
            camera={{ position: [0, 5.5, 8.5], fov: 42 }}
            gl={{ preserveDrawingBuffer: true }}
          >
            <color attach="background" args={["#141c18"]} />
            <ambientLight intensity={1.6} />
            <directionalLight position={[3, 6, 5]} intensity={2.5} />
            <gridHelper
              args={[18, 36, "#345245", "#23372d"]}
              position={[0, -0.4, 0]}
            />
            {blocks.map((block) => (
              <Chip
                key={block.id}
                block={block}
                active={block.id === active}
                reducedMotion={reducedMotion}
                onClick={() => inspect(block.id)}
              />
            ))}
            <DataLink
              start={event.opcode === "STR" ? [0, 0.2, 0.8] : [-2.4, 0.2, 0.8]}
              end={event.opcode === "STR" ? [-2.4, 0.2, 0.8] : [0, 0.2, 0.8]}
              color="#e2a4ca"
              active={
                (event.stage === "Memory" &&
                  ["LDR", "STR"].includes(event.opcode)) ||
                (event.stage === "Writeback" && event.opcode === "LDR")
              }
              reducedMotion={reducedMotion}
            />
            <DataLink
              start={
                event.stage === "Writeback" ? [2.4, 0.2, 0.8] : [0, 0.2, 0.8]
              }
              end={
                event.stage === "Writeback" ? [0, 0.2, 0.8] : [2.4, 0.2, 0.8]
              }
              color="#efba78"
              active={
                event.opcode !== "RET" &&
                (event.stage === "Execute" ||
                  (event.stage === "Writeback" &&
                    event.registerDiff.length > 0 &&
                    event.opcode !== "LDR"))
              }
              reducedMotion={reducedMotion}
            />
            <DataLink
              start={[-2.4, 0.2, -1.8]}
              end={[0, 0.2, 0.8]}
              color="#8dbef0"
              active={event.stage === "Fetch" || event.stage === "Decode"}
              reducedMotion={reducedMotion}
            />
            <Camera />
          </Canvas>
        </SceneBoundary>
      ) : (
        <svg
          className="circuit"
          viewBox={`0 0 ${compact ? 360 : 780} 330`}
          role="img"
          aria-label={`${event.opcode} in ${event.stage}, thread ${event.threadId}`}
        >
          <defs>
            <pattern
              id="circuit-grid"
              width="22"
              height="22"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M22 0H0V22"
                fill="none"
                stroke="#27372e"
                strokeWidth="0.5"
              />
            </pattern>
            <marker
              id="flow-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0 0L10 5L0 10Z" fill="#adcfbb" />
            </marker>
          </defs>
          <rect
            width={compact ? 360 : 780}
            height="330"
            fill="url(#circuit-grid)"
          />
          <g fill="none" stroke="#4b6457" strokeWidth="2">
            {connections.map((path) => (
              <path key={path} d={path} />
            ))}
          </g>
          <path
            d={route}
            fill="none"
            stroke="#d0e9d7"
            strokeWidth="3"
            markerEnd="url(#flow-arrow)"
            className="active-flow"
          />
          {circuitBlocks.map((block) => (
            <g
              key={block.id}
              className={`circuit-block ${active === block.id ? "active" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`Inspect ${block.label}`}
              onClick={() => inspect(block.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inspect(block.id);
                }
              }}
            >
              <rect
                x={block.x}
                y={block.y}
                width={block.width}
                height="82"
                rx="4"
                fill={active === block.id ? "#2f4437" : "#1b2921"}
                stroke={active === block.id ? block.color : "#4c6254"}
                strokeWidth={active === block.id ? 2 : 1}
              />
              <rect
                x={block.x + 12}
                y={block.y + 15}
                width="4"
                height="13"
                fill={block.color}
              />
              <text
                x={block.x + 24}
                y={block.y + 27}
                fill="#eef5ef"
                fontSize={compact ? 16 : 14}
              >
                {block.label}
              </text>
              <text
                x={block.x + 14}
                y={block.y + 55}
                fill={block.color}
                fontSize="13"
                fontFamily="monospace"
              >
                {block.id === "program"
                  ? `PC ${event.pc} / ${event.opcode}`
                  : block.id === "memory"
                    ? `address ${memoryOperand?.value ?? "--"}`
                    : block.id === "arithmetic"
                      ? `${event.opcode} ${event.resultValue === undefined ? "" : `= ${event.resultValue}`}`
                      : `R0 - R12 / T${event.threadId}`}
              </text>
            </g>
          ))}
          <text
            x={compact ? 12 : 495}
            y={compact ? 285 : 67}
            fill="#c8d9ce"
            fontSize={compact ? 16 : 14}
          >
            {event.activeThreads.length} active lane
            {event.activeThreads.length === 1 ? "" : "s"}
          </text>
          <text
            x={compact ? 12 : 495}
            y={compact ? 310 : 91}
            fill="#93ad9d"
            fontSize={compact ? 14 : 12}
          >
            {event.maskedThreads.length
              ? `Masked: ${event.maskedThreads.join(", ")}`
              : "No masked lanes in this issue"}
          </text>
          {!compact && (
            <text x="295" y="313" fill="#93ad9d" fontSize="11">
              DATA MOVEMENT / LOGICAL CONNECTIONS
            </text>
          )}
        </svg>
      )}
      <div className="architecture-legend">
        <span>
          <i style={{ background: "#8dbef0" }} />
          Instruction
        </span>
        <span>
          <i style={{ background: "#e2a4ca" }} />
          Memory
        </span>
        <span>
          <i style={{ background: "#efba78" }} />
          Computation
        </span>
      </div>
    </div>
  );
}

function Camera() {
  const { camera, gl, size } = useThree();
  useEffect(() => {
    const distance = Math.max(
      6.8,
      4.4 / ((Math.tan((21 * Math.PI) / 180) * size.width) / size.height),
    );
    camera.position.set(0, distance * 0.58, distance * 0.81);
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(0, 0, 0);
    controls.minDistance = 5;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.enablePan = false;
    controls.update();
    return () => controls.dispose();
  }, [camera, gl, size.width, size.height]);
  return null;
}

function Chip({
  block,
  active,
  reducedMotion,
  onClick,
}: {
  block: (typeof blocks)[number];
  active: boolean;
  reducedMotion: boolean;
  onClick: () => void;
}) {
  const position: [number, number, number] =
    block.id === "program"
      ? [-2.4, 0, -1.8]
      : [
          block.id === "memory" ? -2.4 : block.id === "registers" ? 0 : 2.4,
          0,
          0.8,
        ];
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current)
      ref.current.position.y =
        active && !reducedMotion ? 0.04 * Math.sin(clock.elapsedTime * 3) : 0;
  });
  return (
    <group position={position}>
      <mesh ref={ref} onClick={onClick}>
        <boxGeometry args={[1.8, 0.5, 1.15]} />
        <meshStandardMaterial
          color={active ? block.color : "#384c3f"}
          emissive={new Color(block.color)}
          emissiveIntensity={active ? 0.2 : 0}
          roughness={0.55}
        />
      </mesh>
      <SceneLabel text={block.label} position={[0, 0.8, 0]} />
    </group>
  );
}

function SceneLabel({
  text,
  position,
}: {
  text: string;
  position: [number, number, number];
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#eef5ef";
    context.font = "500 48px system-ui";
    context.textAlign = "center";
    context.fillText(text, 256, 64);
    return new CanvasTexture(canvas);
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[2.35, 0.5, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

function DataLink({
  start,
  end,
  color,
  active,
  reducedMotion,
}: {
  start: number[];
  end: number[];
  color: string;
  active: boolean;
  reducedMotion: boolean;
}) {
  const a = useMemo(() => new Vector3(...start), [start.join(",")]);
  const b = useMemo(() => new Vector3(...end), [end.join(",")]);
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current)
      ref.current.position
        .copy(a)
        .lerp(b, reducedMotion ? 0.5 : (clock.elapsedTime * 0.4) % 1);
  });
  const midpoint = a.clone().add(b).multiplyScalar(0.5);
  return (
    <group>
      <mesh
        position={midpoint}
        rotation={[
          Math.PI / 2,
          0,
          -Math.atan2(end[0] - start[0], end[2] - start[2]),
        ]}
      >
        <cylinderGeometry args={[0.02, 0.02, a.distanceTo(b), 8]} />
        <meshBasicMaterial color={active ? color : "#4b6457"} />
      </mesh>
      {active && (
        <mesh ref={ref}>
          <boxGeometry args={[0.14, 0.14, 0.14]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
