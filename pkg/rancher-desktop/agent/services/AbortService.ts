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
      return;
    }

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
}
