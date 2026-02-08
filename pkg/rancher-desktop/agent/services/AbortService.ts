export type AbortCallback = () => void | Promise<void>;

export class AbortService {
  private controller: AbortController;
  private callbacks: AbortCallback[] = [];

  constructor() {
    this.controller = new AbortController();
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get aborted(): boolean {
    return this.controller.signal.aborted;
  }

  /**
   * Register cleanup logic to be executed when abort() is called.
   * Returns an unregister function.
   */
  onAbort(cb: AbortCallback): () => void {
    this.callbacks.push(cb);
    return () => {
      const idx = this.callbacks.indexOf(cb);
      if (idx >= 0) {
        this.callbacks.splice(idx, 1);
      }
    };
  }

  /**
   * Abort the run and fan-out to all registered callbacks.
   */
  abort(): void {
    if (this.controller.signal.aborted) {
      console.log('[AbortService] Abort already called, ignoring');
      return;
    }

    console.log('[AbortService] Abort called - stopping execution');
    try {
      this.controller.abort();
    } catch {
      // ignore
    }

    const cbs = [...this.callbacks];
    this.callbacks = [];

    for (const cb of cbs) {
      try {
        void cb();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Pause the current graph run and signal that we're waiting for user input.
   * Use this when the agent has completed a cycle and wants to stop.
   */
  pauseForUserInput(reason: string = 'Cycle complete - waiting for user input'): void {
    console.log(`[AbortService] Pausing for user: ${reason}`);
    
    // Optional: you can emit a special message here if you want
    // this.emitPauseMessage?.(reason); // if you add a callback

    this.abort(); // This will trigger throwIfAborted in the graph
  }
}

/**
 * Portable function to check if abort signal was received.
 * Can be called from anywhere in the codebase.
 * 
 * @param signal AbortSignal to check (optional, defaults to checking if any signal is aborted)
 * @returns true if abort was triggered, false otherwise
 */
export function abortIfSignalReceived(signal?: AbortSignal): boolean {
  // If no signal provided, check if we can detect any abort
  if (!signal) {
    return false;
  }
  
  if (signal.aborted) {
    console.log('[AbortService] Abort signal received - operation should stop');
    return true;
  }
  
  return false;
}

/**
 * Portable function to check abort signal and throw AbortError if triggered.
 * Use this to immediately stop execution when abort is detected.
 * 
 * @param stateOrSignal State object (with metadata.__abort) or AbortSignal to check
 * @param message Optional error message
 * @throws AbortError if signal was aborted
 */
export function throwIfAborted(stateOrSignal?: any | AbortSignal, message?: string): void {
  let signal: AbortSignal | undefined;
  
  // If it's a state object, extract the abort signal
  if (stateOrSignal && typeof stateOrSignal === 'object' && stateOrSignal.metadata) {
    signal = stateOrSignal.metadata?.__abort?.signal;
  } else {
    // Assume it's already an AbortSignal
    signal = stateOrSignal;
  }
  
  if (signal?.aborted) {
    throw new DOMException(message || 'Operation aborted', 'AbortError');
  }
}
