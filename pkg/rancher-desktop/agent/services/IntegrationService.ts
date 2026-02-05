// IntegrationService - PostgreSQL-backed integration configuration management
// Provides CRUD operations for integration connection properties

import pg from 'pg';

const POSTGRES_URL = 'postgresql://sulla:sulla_dev_password@127.0.0.1:30116/sulla';

export interface IntegrationValue {
  value_id: number;
  integration_id: string;
  property: string;
  value: string;
  created_at: Date;
  updated_at: Date;
}

export interface IntegrationValueInput {
  integration_id: string;
  property: string;
  value: string;
}

export interface IntegrationConnectionStatus {
  integration_id: string;
  connected: boolean;
  connected_at?: Date;
  last_sync_at?: Date;
}

// Special properties that are not shown in forms
const SYSTEM_PROPERTIES = ['connection_status', 'connected_at', 'last_sync_at'];

type IntegrationValueCallback = (value: IntegrationValue, action: 'created' | 'updated' | 'deleted') => void;

let integrationServiceInstance: IntegrationService | null = null;

export function getIntegrationService(): IntegrationService {
  if (!integrationServiceInstance) {
    integrationServiceInstance = new IntegrationService();
  }
  return integrationServiceInstance;
}

export class IntegrationService {
  private initialized = false;
  private valueCallbacks: IntegrationValueCallback[] = [];

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[IntegrationService] Initializing...');
    await this.ensureTables();
    this.initialized = true;
    console.log('[IntegrationService] Initialized');
  }

  onValueChange(callback: IntegrationValueCallback): void {
    this.valueCallbacks.push(callback);
  }

  private notifyValueChange(value: IntegrationValue, action: 'created' | 'updated' | 'deleted'): void {
    for (const callback of this.valueCallbacks) {
      try {
        callback(value, action);
      } catch (err) {
        console.warn('[IntegrationService] Value callback error:', err);
      }
    }
  }

  private async ensureTables(): Promise<void> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS integration_values (
          value_id SERIAL PRIMARY KEY,
          integration_id VARCHAR(100) NOT NULL,
          property VARCHAR(100) NOT NULL,
          value TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(integration_id, property)
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_integration_values_integration_id ON integration_values(integration_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_integration_values_property ON integration_values(property)
      `);

      console.log('[IntegrationService] Tables ensured');
    } finally {
      await client.end();
    }
  }

  async setIntegrationValue(input: IntegrationValueInput): Promise<IntegrationValue> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      // Check if value already exists
      const existingResult = await client.query(
        'SELECT value_id FROM integration_values WHERE integration_id = $1 AND property = $2',
        [input.integration_id, input.property]
      );

      let result;
      
      if (existingResult.rows.length > 0) {
        // Update existing value
        const valueId = existingResult.rows[0].value_id;
        result = await client.query(
          `
          UPDATE integration_values
          SET value = $1, updated_at = CURRENT_TIMESTAMP
          WHERE integration_id = $2 AND property = $3
          RETURNING value_id, integration_id, property, value, created_at, updated_at
          `,
          [input.value, input.integration_id, input.property]
        );
        console.log(`[IntegrationService] Updated value: ${input.integration_id}.${input.property}`);
      } else {
        // Create new value
        result = await client.query(
          `
          INSERT INTO integration_values (integration_id, property, value)
          VALUES ($1, $2, $3)
          RETURNING value_id, integration_id, property, value, created_at, updated_at
          `,
          [input.integration_id, input.property, input.value]
        );
        console.log(`[IntegrationService] Created value: ${input.integration_id}.${input.property}`);
      }

      const row = result.rows[0];
      const value = this.rowToValue(row);
      this.notifyValueChange(value, existingResult.rows.length > 0 ? 'updated' : 'created');
      return value;
    } finally {
      await client.end();
    }
  }

  async setMultipleValues(inputs: IntegrationValueInput[]): Promise<IntegrationValue[]> {
    const values: IntegrationValue[] = [];
    
    for (const input of inputs) {
      const value = await this.setIntegrationValue(input);
      values.push(value);
    }
    
    return values;
  }

  // Connection status methods
  async setConnectionStatus(integrationId: string, connected: boolean): Promise<void> {
    await this.setIntegrationValue({
      integration_id: integrationId,
      property: 'connection_status',
      value: connected.toString()
    });

    // Set connected_at timestamp when connecting
    if (connected) {
      await this.setIntegrationValue({
        integration_id: integrationId,
        property: 'connected_at',
        value: new Date().toISOString()
      });
    }

    // Update last_sync_at
    await this.setIntegrationValue({
      integration_id: integrationId,
      property: 'last_sync_at',
      value: new Date().toISOString()
    });
  }

  async getConnectionStatus(integrationId: string): Promise<IntegrationConnectionStatus> {
    const statusValue = await this.getIntegrationValue(integrationId, 'connection_status');
    const connectedAtValue = await this.getIntegrationValue(integrationId, 'connected_at');
    const lastSyncValue = await this.getIntegrationValue(integrationId, 'last_sync_at');

    return {
      integration_id: integrationId,
      connected: statusValue?.value === 'true',
      connected_at: connectedAtValue ? new Date(connectedAtValue.value) : undefined,
      last_sync_at: lastSyncValue ? new Date(lastSyncValue.value) : undefined
    };
  }

  // Form-specific methods (exclude system properties)
  async getFormValues(integrationId: string): Promise<IntegrationValue[]> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      const placeholders = SYSTEM_PROPERTIES.map((_, index) => `$${index + 2}`).join(', ');
      
      const result = await client.query(
        `
        SELECT value_id, integration_id, property, value, created_at, updated_at
        FROM integration_values
        WHERE integration_id = $1 AND property NOT IN (${placeholders})
        ORDER BY property ASC
        `,
        [integrationId, ...SYSTEM_PROPERTIES],
      );

      console.log(`[IntegrationService] Fetched ${result.rows.length} form values for ${integrationId}`);
      return result.rows.map(row => this.rowToValue(row));
    } finally {
      await client.end();
    }
  }

  async setFormValues(inputs: IntegrationValueInput[]): Promise<IntegrationValue[]> {
    // Filter out system properties
    const filteredInputs = inputs.filter(input => !SYSTEM_PROPERTIES.includes(input.property));
    return this.setMultipleValues(filteredInputs);
  }

  async getIntegrationValue(integrationId: string, property: string): Promise<IntegrationValue | null> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      const result = await client.query(
        `
        SELECT value_id, integration_id, property, value, created_at, updated_at
        FROM integration_values
        WHERE integration_id = $1 AND property = $2
        `,
        [integrationId, property],
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToValue(result.rows[0]);
    } finally {
      await client.end();
    }
  }

  async getIntegrationValues(integrationId: string): Promise<IntegrationValue[]> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      const result = await client.query(
        `
        SELECT value_id, integration_id, property, value, created_at, updated_at
        FROM integration_values
        WHERE integration_id = $1
        ORDER BY property ASC
        `,
        [integrationId],
      );

      console.log(`[IntegrationService] Fetched ${result.rows.length} values for ${integrationId}`);
      return result.rows.map(row => this.rowToValue(row));
    } finally {
      await client.end();
    }
  }

  async getAllIntegrationValues(): Promise<IntegrationValue[]> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      const result = await client.query(
        `
        SELECT value_id, integration_id, property, value, created_at, updated_at
        FROM integration_values
        ORDER BY integration_id ASC, property ASC
        `
      );

      console.log(`[IntegrationService] Fetched ${result.rows.length} total values`);
      return result.rows.map(row => this.rowToValue(row));
    } finally {
      await client.end();
    }
  }

  async deleteIntegrationValue(integrationId: string, property: string): Promise<boolean> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      // Get value before deleting for notification
      const valueToDelete = await this.getIntegrationValue(integrationId, property);

      const result = await client.query(
        'DELETE FROM integration_values WHERE integration_id = $1 AND property = $2',
        [integrationId, property],
      );

      const deleted = result.rowCount !== null && result.rowCount > 0;
      if (deleted) {
        console.log(`[IntegrationService] Deleted value: ${integrationId}.${property}`);
        if (valueToDelete) {
          this.notifyValueChange(valueToDelete, 'deleted');
        }
      }
      return deleted;
    } finally {
      await client.end();
    }
  }

  async deleteIntegrationValues(integrationId: string): Promise<boolean> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      // Get all values before deleting for notifications
      const valuesToDelete = await this.getIntegrationValues(integrationId);

      const result = await client.query(
        'DELETE FROM integration_values WHERE integration_id = $1',
        [integrationId],
      );

      const deleted = result.rowCount !== null && result.rowCount > 0;
      if (deleted) {
        console.log(`[IntegrationService] Deleted ${valuesToDelete.length} values for ${integrationId}`);
        for (const value of valuesToDelete) {
          this.notifyValueChange(value, 'deleted');
        }
      }
      return deleted;
    } finally {
      await client.end();
    }
  }

  private rowToValue(row: Record<string, unknown>): IntegrationValue {
    return {
      value_id: row.value_id as number,
      integration_id: row.integration_id as string,
      property: row.property as string,
      value: row.value as string,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }
}
