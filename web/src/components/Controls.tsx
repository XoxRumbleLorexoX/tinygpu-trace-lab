import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";

interface Props {
  playing: boolean;
  cycle: number;
  maxCycle: number;
  speed: number;
  loop: boolean;
  range: [number, number];
  onPlaying: (playing: boolean) => void;
  onCycle: (cycle: number) => void;
  onSpeed: (speed: number) => void;
  onLoop: (loop: boolean) => void;
  onRange: (range: [number, number]) => void;
}

export function Controls({
  playing,
  cycle,
  maxCycle,
  speed,
  loop,
  range,
  onPlaying,
  onCycle,
  onSpeed,
  onLoop,
  onRange,
}: Props) {
  const setRangeStart = (value: number) =>
    onRange([Math.max(0, Math.min(value, range[1])), range[1]] as [
      number,
      number,
    ]);
  const setRangeEnd = (value: number) =>
    onRange([range[0], Math.min(maxCycle, Math.max(value, range[0]))] as [
      number,
      number,
    ]);
  const atStart = cycle <= 0;
  const atEnd = cycle >= maxCycle;

  return (
    <div className="controls" aria-label="Playback Controls">
      <button
        type="button"
        onClick={() => onPlaying(!playing)}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={17} /> : <Play size={17} />}
      </button>
      <button
        type="button"
        onClick={() => onCycle(Math.max(0, cycle - 1))}
        title="Step Backward"
        disabled={atStart}
      >
        <SkipBack size={17} />
      </button>
      <button
        type="button"
        onClick={() => onCycle(Math.min(maxCycle, cycle + 1))}
        title="Step Forward"
        disabled={atEnd}
      >
        <SkipForward size={17} />
      </button>
      <button
        type="button"
        onClick={() => onCycle(0)}
        title="Reset"
        disabled={atStart}
      >
        <RotateCcw size={17} />
      </button>
      <label>
        Event {cycle}
        <input
          type="range"
          min="0"
          max={maxCycle}
          value={cycle}
          onChange={(event) => onCycle(Number(event.currentTarget.value))}
          aria-label="Jump To Event"
        />
      </label>
      <label>
        {speed.toFixed(1)}x
        <input
          type="range"
          min="0.5"
          max="4"
          step="0.5"
          value={speed}
          onChange={(event) => onSpeed(Number(event.currentTarget.value))}
          aria-label="Playback Speed"
        />
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={loop}
          onChange={(event) => onLoop(event.currentTarget.checked)}
        />
        Loop Playback
      </label>
      <label className="range-field">
        Replay Range
        <span>
          <input
            type="number"
            min="0"
            max={range[1]}
            value={range[0]}
            onChange={(event) =>
              setRangeStart(Number(event.currentTarget.value))
            }
            aria-label="Replay Range Start"
          />
          <input
            type="number"
            min={range[0]}
            max={maxCycle}
            value={range[1]}
            onChange={(event) => setRangeEnd(Number(event.currentTarget.value))}
            aria-label="Replay Range End"
          />
        </span>
      </label>
    </div>
  );
}
