import { raceCloseFlush, type CloseFlushRaceOptions, type CloseFlushRaceResult } from './close-flush-race';

// #913 follow-up: one native close event drives two independent JS listeners
// (the flush race in App.tsx and the quit/tray decision in
// close-request-handler.ts), and nothing sequences them — a quit path could
// reach quit_app before the flush had even started. Every quit path funnels
// through quitApp(), so gating that single choke point covers all of them
// without needing to coordinate the two listeners directly.
//
// Single-flight: the first close path to ask starts the bounded flush;
// every other path joins the same result instead of starting a second one.
let gate: Promise<CloseFlushRaceResult> | null = null;

export function beginCloseFlush(options: CloseFlushRaceOptions): Promise<CloseFlushRaceResult> {
    if (!gate) gate = raceCloseFlush(options);
    return gate;
}

// Call when a close sequence is abandoned (user cancelled) so the NEXT close
// request flushes again instead of reusing a stale settled result.
// Deliberately not cleared when the flush merely settles — within one close
// sequence, later paths must join the settled result instantly rather than
// start a second flush.
export function resetCloseFlushGate(): void {
    gate = null;
}
