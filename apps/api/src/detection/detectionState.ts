import type { DetectionHistoryItem } from "./detectionTypes.js";

type DetectionMemoryState = {
  running: boolean;
  queueSize: number;
  testingCount: number;
  lastRunAt: string | null;
  lastError: string | null;
  history: DetectionHistoryItem[];
};

const state: DetectionMemoryState = {
  running: false,
  queueSize: 0,
  testingCount: 0,
  lastRunAt: null,
  lastError: null,
  history: []
};

export function getDetectionState(): DetectionMemoryState {
  return {
    ...state,
    history: [...state.history]
  };
}

export function markDetectionStarted(queueSize: number): void {
  state.running = true;
  state.queueSize = queueSize;
  state.testingCount = 0;
  state.lastRunAt = new Date().toISOString();
  state.lastError = null;
}

export function setTestingCount(count: number): void {
  state.testingCount = count;
}

export function markDetectionFinished(): void {
  state.running = false;
  state.queueSize = 0;
  state.testingCount = 0;
}

export function markDetectionError(error: string): void {
  state.lastError = error;
  state.running = false;
  state.queueSize = 0;
  state.testingCount = 0;
}

export function pushDetectionHistory(item: DetectionHistoryItem): void {
  state.history.unshift(item);
  state.history.splice(20);
}
