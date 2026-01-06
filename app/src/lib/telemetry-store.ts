/**
 * Module-level telemetry ring buffer shared across routes
 * (e.g. /rpl, /observability). Pure pub/sub — no React Query dependency.
 */

import { useEffect, useState } from "react";
import type { TelemetryEvent } from "./rpl-types";

const LIMIT = 50;

let buffer: TelemetryEvent[] = [];
const subs = new Set<(events: TelemetryEvent[]) => void>();

function emit() {
  for (const fn of subs) fn(buffer);
}

export const telemetryStore = {
  push(e: TelemetryEvent) {
    buffer = [e, ...buffer].slice(0, LIMIT);
    emit();
  },
  clear() {
    buffer = [];
    emit();
  },
  get(): TelemetryEvent[] {
    return buffer;
  },
  subscribe(fn: (events: TelemetryEvent[]) => void): () => void {
    subs.add(fn);
    fn(buffer);
    return () => subs.delete(fn);
  },
};

export function useTelemetry(): TelemetryEvent[] {
  const [events, setEvents] = useState<TelemetryEvent[]>(buffer);
  useEffect(() => telemetryStore.subscribe(setEvents), []);
  return events;
}
