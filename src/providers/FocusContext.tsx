import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";

export type FocusMode = "pomodoro" | "deep" | "flow" | "sprint" | "custom";

export interface FocusSessionState {
  isActive: boolean;
  isRunning: boolean;
  mode: FocusMode;
  totalSeconds: number;
  remainingSeconds: number;
  taskTitle: string;
  taskId: number | null;
  objectiveNotes: string;
  isMinimized: boolean;
  checklist: Array<{ id: string; text: string; done: boolean }>;
}

export interface FocusContextType extends FocusSessionState {
  startFocus: (opts?: {
    taskTitle?: string;
    taskId?: number | null;
    durationMinutes?: number;
    mode?: FocusMode;
    objectiveNotes?: string;
    checklist?: Array<{ id: string; text: string; done: boolean }>;
  }) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  resetFocus: () => void;
  completeFocus: () => void;
  minimizeFocus: () => void;
  maximizeFocus: () => void;
  setMode: (mode: FocusMode) => void;
  setDurationMinutes: (minutes: number) => void;
  setObjectiveNotes: (notes: string) => void;
  setTaskTitle: (title: string) => void;
  toggleCheckItem: (id: string) => void;
  addCheckItem: (text: string) => void;
  deleteCheckItem: (id: string) => void;
}

const STORAGE_KEY = "obsidian_focus_session_v1";

const DEFAULT_STATE: FocusSessionState = {
  isActive: false,
  isRunning: false,
  mode: "pomodoro",
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  taskTitle: "Strategic Deep Work",
  taskId: null,
  objectiveNotes: "",
  isMinimized: false,
  checklist: [],
};

const FocusContext = createContext<FocusContextType | null>(null);

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils();
  const logFocus = trpc.focus.log.useMutation({
    onSuccess: () => {
      utils.focus.stats.invalidate();
      utils.tasks.overview.invalidate();
    },
  });

  const [state, setState] = useState<FocusSessionState>(() => {
    if (typeof window === "undefined") return DEFAULT_STATE;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_STATE,
          ...parsed,
          isRunning: false, // Start paused on hard reload
        };
      }
    } catch {
      // fallback
    }
    return DEFAULT_STATE;
  });

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Persist state to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  // Audio completion chime synthesizer
  const playChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.3); // G5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.5); // C6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.2);
    } catch {
      // Audio not permitted
    }
  }, []);

  const completeFocus = useCallback(() => {
    playChime();
    const elapsedMinutes = Math.max(1, Math.round((state.totalSeconds - state.remainingSeconds) / 60));

    logFocus.mutate({
      minutes: elapsedMinutes,
      taskId: state.taskId ?? undefined,
      notes: state.objectiveNotes || state.taskTitle,
    });

    toast.success("Focus block finished!", {
      description: `Logged ${elapsedMinutes}m of deep work: "${state.taskTitle}"`,
    });

    setState((prev) => ({
      ...prev,
      isActive: false,
      isRunning: false,
      remainingSeconds: prev.totalSeconds,
      isMinimized: false,
    }));
  }, [logFocus, playChime, state.objectiveNotes, state.remainingSeconds, state.taskId, state.taskTitle, state.totalSeconds]);

  // Countdown timer loop
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (state.isRunning && state.remainingSeconds > 0) {
      timer = setInterval(() => {
        setState((prev) => {
          if (prev.remainingSeconds <= 1) {
            return {
              ...prev,
              remainingSeconds: 0,
              isRunning: false,
            };
          }
          return {
            ...prev,
            remainingSeconds: prev.remainingSeconds - 1,
          };
        });
      }, 1000);
    } else if (state.remainingSeconds === 0 && state.isActive) {
      completeFocus();
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [state.isRunning, state.remainingSeconds, state.isActive, completeFocus]);

  const startFocus = useCallback(
    (opts?: {
      taskTitle?: string;
      taskId?: number | null;
      durationMinutes?: number;
      mode?: FocusMode;
      objectiveNotes?: string;
      checklist?: Array<{ id: string; text: string; done: boolean }>;
    }) => {
      const mode = opts?.mode || "pomodoro";
      let minutes = opts?.durationMinutes;
      if (!minutes) {
        if (mode === "deep") minutes = 50;
        else if (mode === "flow") minutes = 90;
        else if (mode === "sprint") minutes = 15;
        else minutes = 25;
      }
      const secs = minutes * 60;

      setState({
        isActive: true,
        isRunning: true,
        mode,
        totalSeconds: secs,
        remainingSeconds: secs,
        taskTitle: opts?.taskTitle || "Strategic Deep Work",
        taskId: opts?.taskId ?? null,
        objectiveNotes: opts?.objectiveNotes || "",
        isMinimized: false,
        checklist: opts?.checklist || [],
      });

      toast.success("Focus session started", {
        description: `${minutes}m allocated for "${opts?.taskTitle || "Strategic Deep Work"}"`,
      });
    },
    []
  );

  const pauseFocus = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  const resumeFocus = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: true }));
  }, []);

  const resetFocus = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRunning: false,
      remainingSeconds: prev.totalSeconds,
    }));
  }, []);

  const minimizeFocus = useCallback(() => {
    setState((prev) => ({ ...prev, isMinimized: true }));
  }, []);

  const maximizeFocus = useCallback(() => {
    setState((prev) => ({ ...prev, isMinimized: false }));
  }, []);

  const setMode = useCallback((mode: FocusMode) => {
    let mins = 25;
    if (mode === "deep") mins = 50;
    if (mode === "flow") mins = 90;
    if (mode === "sprint") mins = 15;
    const secs = mins * 60;
    setState((prev) => ({
      ...prev,
      mode,
      totalSeconds: secs,
      remainingSeconds: secs,
      isRunning: false,
    }));
  }, []);

  const setDurationMinutes = useCallback((minutes: number) => {
    const secs = Math.max(60, minutes * 60);
    setState((prev) => ({
      ...prev,
      mode: "custom",
      totalSeconds: secs,
      remainingSeconds: secs,
      isRunning: false,
    }));
  }, []);

  const setObjectiveNotes = useCallback((objectiveNotes: string) => {
    setState((prev) => ({ ...prev, objectiveNotes }));
  }, []);

  const setTaskTitle = useCallback((taskTitle: string) => {
    setState((prev) => ({ ...prev, taskTitle }));
  }, []);

  const toggleCheckItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      ),
    }));
  }, []);

  const addCheckItem = useCallback((text: string) => {
    if (!text.trim()) return;
    setState((prev) => ({
      ...prev,
      checklist: [
        ...prev.checklist,
        { id: `${Date.now()}`, text: text.trim(), done: false },
      ],
    }));
  }, []);

  const deleteCheckItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      checklist: prev.checklist.filter((item) => item.id !== id),
    }));
  }, []);

  return (
    <FocusContext.Provider
      value={{
        ...state,
        startFocus,
        pauseFocus,
        resumeFocus,
        resetFocus,
        completeFocus,
        minimizeFocus,
        maximizeFocus,
        setMode,
        setDurationMinutes,
        setObjectiveNotes,
        setTaskTitle,
        toggleCheckItem,
        addCheckItem,
        deleteCheckItem,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error("useFocus must be used within a FocusProvider");
  }
  return context;
}
