// IntegrationRegistry.ts (keep this separate as proposed earlier)
export class IntegrationRegistry {
  private instances = new Map<string, any>();
  private factories = new Map<string, () => Promise<any>>();

  register<T>(id: string, factory: () => Promise<T>): void {
    this.factories.set(id, factory);
  }

  async get<T>(id: string): Promise<T> {
    if (!this.instances.has(id)) {
      const factory = this.factories.get(id);
      if (!factory) throw new Error(`No factory registered for integration: ${id}`);
      const instance = await factory();
      this.instances.set(id, instance);
      return instance;
    }
    return this.instances.get(id) as T;
  }

  async closeAll(): Promise<void> {
    for (const instance of this.instances.values()) {
      if (typeof instance.close === 'function') {
        await instance.close().catch((err: unknown) => console.error('[Registry] Close error:', err));
      }
    }
  }
}