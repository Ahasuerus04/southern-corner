"use client";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { Play, Pause, SkipBack, SkipForward, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { clock, type Track } from "@/lib/types";
type State = {
  list: Track[];
  idx: number;
  playing: boolean;
  select: (l: Track[], i: number) => void;
  toggle: () => void;
  step: (n: number) => void;
};
const usePlayer = create<State>((set, get) => ({
  list: [],
  idx: 0,
  playing: false,
  select: (list, idx) => set({ list, idx, playing: true }),
  toggle: () => set((s) => ({ playing: !s.playing })),
  step: (n) => {
    const s = get();
    if (s.list.length)
      set({ idx: (s.idx + n + s.list.length) % s.list.length, playing: true });
  },
}));
export function PlayTrack({
  list,
  index = 0,
  label = false,
}: {
  list: Track[];
  index?: number;
  label?: boolean;
}) {
  const s = usePlayer(),
    active = s.list[s.idx]?.id === list[index]?.id,
    Icon = active && s.playing ? Pause : Play;
  return (
    <button
      className={label ? "primary" : "play-btn"}
      aria-label={`${Icon === Pause ? "Pause" : "Play"} ${list[index].title}`}
      onClick={() => (active ? s.toggle() : s.select(list, index))}
    >
      <Icon size={16} fill="currentColor" />
      {label && (Icon === Pause ? "Pause track" : "Play track")}
    </button>
  );
}
export function Player() {
  const s = usePlayer(),
    t = s.list[s.idx],
    ref = useRef<HTMLAudioElement>(null),
    [time, T] = useState(0),
    [dur, D] = useState(0),
    [loading, L] = useState(false);
  useEffect(() => {
    const a = ref.current;
    if (!a || !t) return;
    if (s.playing) {
      let live = true;
      a.play().catch((e) => {
        if (live && e.name !== "AbortError") {
          usePlayer.setState({ playing: false });
          toast.error("Unable to play this track. Please try again.");
        }
      });
      return () => {
        live = false;
      };
    } else a.pause();
  }, [t, s.playing]);
  if (!t) return null;
  return (
    <aside className="player" aria-label="Audio player">
      <audio
        ref={ref}
        src={`/api/media/${t.id}`}
        onLoadStart={() => {
          T(0);
          D(0);
          L(true);
        }}
        onCanPlay={() => L(false)}
        onTimeUpdate={(e) => T(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) =>
          D(
            Number.isFinite(e.currentTarget.duration)
              ? e.currentTarget.duration
              : t.duration,
          )
        }
        onEnded={() =>
          s.list.length > 1 ? s.step(1) : usePlayer.setState({ playing: false })
        }
      />
      <img src={t.cover} alt="" />
      <div className="player-name">
        <b>{t.title}</b>
        <small>{loading ? "Loading…" : t.artist}</small>
      </div>
      <button aria-label="Previous track" onClick={() => s.step(-1)}>
        <SkipBack size={16} />
      </button>
      <button
        className="round"
        aria-label={s.playing ? "Pause playback" : "Resume playback"}
        onClick={s.toggle}
      >
        {s.playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button aria-label="Next track" onClick={() => s.step(1)}>
        <SkipForward size={16} />
      </button>
      <small>{clock(time)}</small>
      <input
        className="seek"
        type="range"
        aria-label="Playback position"
        min="0"
        max={dur || t.duration || 1}
        step="0.1"
        value={time}
        onChange={(e) => {
          if (ref.current) ref.current.currentTime = Number(e.target.value);
        }}
      />
      <small>{clock(dur || t.duration)}</small>
      <Volume2 className="vol" size={16} />
      <input
        className="vol"
        aria-label="Volume"
        type="range"
        min="0"
        max="1"
        step="0.01"
        defaultValue="1"
        onChange={(e) => {
          if (ref.current) ref.current.volume = Number(e.target.value);
        }}
      />
      <button
        aria-label="Close player"
        onClick={() => usePlayer.setState({ list: [], playing: false })}
      >
        <X size={18} />
      </button>
    </aside>
  );
}
