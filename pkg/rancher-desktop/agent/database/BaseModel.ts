// src/database/BaseModel.ts

import { postgresClient } from './PostgresClient';
import type { QueryResultRow } from 'pg';

type WhereClause = Record<string, any>;

interface ModelAttributes {
  [key: string]: any;
}

export abstract class BaseModel<T extends ModelAttributes = ModelAttributes> {
  protected abstract tableName: string;
  protected abstract primaryKey: string; // usually 'id'
  protected fillable: string[] = [];     // fields allowed for mass assignment
  protected guarded: string[] = ['*'];   // protect all except fillable

  public attributes: Partial<T> = {};
  protected original: Partial<T> = {};
  protected exists = false;

  constructor(attributes: Partial<T> = {}) {
  }

  protected fill(attributes: Partial<T>) {
    // Get fillable from the instance prototype to handle minification
    const instance = this as any;
    const instanceFillable = instance.fillable || [];
    const instanceGuarded = instance.guarded || ['*'];
    
    if (instanceGuarded.includes('*') && instanceFillable.length === 0) {
      throw new Error('Model has no fillable fields defined');
    }

    for (const [key, value] of Object.entries(attributes)) {
      if (instanceFillable.includes(key) || !instanceGuarded.includes('*')) {
        (this.attributes as any)[key] = value;
      }
    }
  }

  // Public method to update attributes
  public updateAttributes(attributes: Partial<T>): void {
    this.fill(attributes);
  }

  // ────────────────────────────────────────────────
  // Static query builders
  // ────────────────────────────────────────────────

  static async find<T extends BaseModel>(this: new (...args: any[]) => T, id: string | number): Promise<T | null> {
    const model = new this();
    const result = await postgresClient.queryOne(
      `SELECT * FROM ${model.tableName} WHERE ${model.primaryKey} = $1 LIMIT 1`,
      [id]
    );

    if (!result) return null;

    const instance = new this(result);
    instance.exists = true;
    instance.original = { ...result };
    return instance;
  }

  static async all<T extends BaseModel>(this: new (...args: any[]) => T): Promise<T[]> {
    const model = new (this as any)();
    const rows = await postgresClient.queryAll(
      `SELECT * FROM ${model.tableName} ORDER BY ${model.primaryKey} ASC`
    );

    return rows.map(row => {
      const instance = new (this as any)(row);
      instance.exists = true;
      instance.original = { ...row };
      return instance;
    });
  }

  static async where<T extends BaseModel>(
    this: new (...args: any[]) => T,
    conditions: WhereClause | string,
    value?: any
  ): Promise<T[]> {
    const model = new (this as any)();
    let query = `SELECT * FROM ${model.tableName}`;
    const params: any[] = [];

    if (typeof conditions === 'string') {
      query += ` WHERE ${conditions}`;
      if (value !== undefined) params.push(value);
    } else {
      const clauses = Object.entries(conditions).map(([k], i) => {
        params.push(conditions[k]);
        return `${k} = $${i + 1}`;
      });
      query += ` WHERE ${clauses.join(' AND ')}`;
    }

    const rows = await postgresClient.queryAll(query, params);

    return rows.map(row => {
      const instance = new (this as any)(row);
      instance.exists = true;
      instance.original = { ...row };
      return instance;
    });
  }

  static async create<T extends BaseModel>(
    this: new () => T,
    attributes: Partial<ModelAttributes>
  ): Promise<T> {
    const model = new this();
    model.fill(attributes);
    return model.save();
  }

  // ────────────────────────────────────────────────
  // Instance methods
  // ────────────────────────────────────────────────

  async save(): Promise<this> {
    // Ensure fillable is properly initialized from instance
    const instanceFillable = this.fillable || [];
    const instanceGuarded = this.guarded || ['*'];
    
    if (this.exists) {
      // Update
      const changes = Object.entries(this.attributes)
        .filter(([k, v]) => this.original[k] !== v)
        .filter(([k]) => instanceFillable.includes(k) || !instanceGuarded.includes('*'));

      if (changes.length === 0) return this;

      const sets = changes.map(([k], i) => `${k} = $${i + 1}`).join(', ');
      const values = changes.map(([, v]) => v);
      values.push(this.attributes[this.primaryKey]);

      await postgresClient.query(
        `UPDATE ${this.tableName} SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE ${this.primaryKey} = $${values.length}`,
        values
      );
    } else {
      // Insert
      const keys = Object.keys(this.attributes).filter(k => instanceFillable.includes(k) || !instanceGuarded.includes('*'));
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = keys.map(k => this.attributes[k]);

      const result = await postgresClient.query(
        `INSERT INTO ${this.tableName} (${keys.join(', ')}, created_at, updated_at) 
         VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        values
      );

      if (result.rows[0]) {
        this.attributes = result.rows[0];
        this.exists = true;
        this.original = { ...this.attributes };
      }
    }

    return this;
  }

  async delete(): Promise<boolean> {
    if (!this.exists) return false;

    const result = await postgresClient.query(
      `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1`,
      [this.attributes[this.primaryKey]]
    );

    this.exists = false;
    return (result.rowCount ?? 0) > 0;
  }

  // ────────────────────────────────────────────────
  // Getters / helpers
  // ────────────────────────────────────────────────

  get id(): any {
    return this.attributes[this.primaryKey];
  }

  get attributesSnapshot(): Readonly<Partial<T>> {
    return { ...this.attributes };
  }
}