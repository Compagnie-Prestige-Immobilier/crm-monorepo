import { createHash } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AtelierAccessService } from '../atelier/atelier-access.service';
import { AuthClaims } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';

type SyncEntityType = 'client' | 'inventory_item';
type SyncMutation = 'upsert' | 'delete';

type ClientOperation = {
  operationId: string;
  entityType: 'client';
  entityId: string;
  baseVersion: number;
  operation: SyncMutation;
  payload: {
    fullName: string;
    phone?: string;
    email?: string;
    notes?: string;
  };
};

type InventoryOperation = {
  operationId: string;
  entityType: 'inventory_item';
  entityId: string;
  baseVersion: number;
  operation: SyncMutation;
  payload: {
    kind: 'fabric' | 'notion' | 'supply';
    name: string;
    quantity: number;
    unit: string;
    costCfa?: number;
  };
};

export type SyncOperation = ClientOperation | InventoryOperation;

interface ChangeRow extends Record<string, unknown> {
  sequence: string;
  entity_type: SyncEntityType;
  entity_id: string;
  operation: SyncMutation;
  version: string;
  payload: unknown;
  occurred_at: Date;
}

interface ClientRow extends Record<string, unknown> {
  id: string;
  atelier_id: string;
  version: string;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  notes: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface InventoryRow extends Record<string, unknown> {
  id: string;
  atelier_id: string;
  kind: 'fabric' | 'notion' | 'supply';
  name: string;
  quantity: string;
  unit: string;
  cost_cfa: string | null;
  version: string;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface StoredOperation extends Record<string, unknown> {
  request_hash: string;
  result: Record<string, unknown>;
}

export interface SyncResult extends Record<string, unknown> {
  operationId: string;
  entityType: SyncEntityType;
  entityId: string;
  status: 'applied' | 'conflict';
  version?: number;
  entity?: Record<string, unknown>;
  code?: string;
  current?: Record<string, unknown> | null;
  replayed?: boolean;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AtelierAccessService,
  ) {}

  async pull(
    user: AuthClaims,
    atelierId: string,
    deviceId: string,
    after: number,
    limit: number,
  ): Promise<{
    cursor: number;
    changes: Array<Record<string, unknown>>;
    hasMore: boolean;
  }> {
    await this.access.requireWriteAccess(user, atelierId);
    const rows = await this.db.query<ChangeRow>(
      `SELECT sequence,entity_type,entity_id,operation,version,payload,occurred_at
       FROM change_log
       WHERE atelier_id=$1 AND sequence>$2
       ORDER BY sequence ASC
       LIMIT $3`,
      [atelierId, after, limit],
    );
    const cursor = rows.length ? Number(rows.at(-1)!.sequence) : after;

    await this.db.query(
      `INSERT INTO device_sync_state
         (device_id,account_id,atelier_id,cursor,last_seen_at)
       VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (device_id,atelier_id)
       DO UPDATE SET
         cursor=EXCLUDED.cursor,
         last_seen_at=now(),
         account_id=EXCLUDED.account_id`,
      [deviceId, user.sub, atelierId, cursor],
    );

    return {
      cursor,
      changes: rows.map((row) => ({
        sequence: Number(row.sequence),
        entityType: row.entity_type,
        entityId: row.entity_id,
        operation: row.operation,
        version: Number(row.version),
        payload: this.normalizePayload(row.entity_type, row.payload),
        occurredAt: row.occurred_at.toISOString(),
      })),
      hasMore: rows.length === limit,
    };
  }

  async push(
    user: AuthClaims,
    atelierId: string,
    deviceId: string,
    operations: SyncOperation[],
  ): Promise<{ results: SyncResult[] }> {
    await this.access.requireWriteAccess(user, atelierId);
    const results: SyncResult[] = [];

    for (const operation of operations) {
      results.push(
        await this.processOperation(
          user,
          atelierId,
          deviceId,
          operation,
        ),
      );
    }

    await this.db.query(
      `INSERT INTO device_sync_state
         (device_id,account_id,atelier_id,cursor,last_seen_at)
       VALUES ($1,$2,$3,0,now())
       ON CONFLICT (device_id,atelier_id)
       DO UPDATE SET last_seen_at=now(),account_id=EXCLUDED.account_id`,
      [deviceId, user.sub, atelierId],
    );

    return { results };
  }

  private async processOperation(
    user: AuthClaims,
    atelierId: string,
    deviceId: string,
    operation: SyncOperation,
  ): Promise<SyncResult> {
    const requestHash = createHash('sha256')
      .update(stableStringify(operation))
      .digest('hex');

    return this.db.transaction(async (client) => {
      const reservation = await client.query(
        `INSERT INTO sync_operations
           (operation_id,device_id,account_id,atelier_id,entity_type,entity_id,request_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (operation_id) DO NOTHING
         RETURNING operation_id`,
        [
          operation.operationId,
          deviceId,
          user.sub,
          atelierId,
          operation.entityType,
          operation.entityId,
          requestHash,
        ],
      );

      if (reservation.rowCount === 0) {
        const stored = await this.one<StoredOperation>(
          client,
          `SELECT request_hash,result
           FROM sync_operations
           WHERE operation_id=$1`,
          [operation.operationId],
        );
        if (!stored || stored.request_hash !== requestHash) {
          throw new ConflictException(
            'The operation identifier was already used for a different mutation',
          );
        }
        return {
          ...(stored.result as SyncResult),
          replayed: true,
        };
      }

      const result = operation.entityType === 'client'
        ? await this.applyClient(client, atelierId, operation)
        : await this.applyInventory(client, atelierId, operation);

      await client.query(
        `UPDATE sync_operations
         SET result=$2,completed_at=now()
         WHERE operation_id=$1`,
        [operation.operationId, JSON.stringify(result)],
      );
      return result;
    });
  }

  private async applyClient(
    client: PoolClient,
    atelierId: string,
    operation: ClientOperation,
  ): Promise<SyncResult> {
    if (operation.operation === 'delete') {
      const deleted = await this.one<ClientRow>(
        client,
        `UPDATE clients
         SET deleted_at=now()
         WHERE id=$1 AND atelier_id=$2 AND version=$3 AND deleted_at IS NULL
         RETURNING *`,
        [operation.entityId, atelierId, operation.baseVersion],
      );
      if (!deleted) {
        return this.clientConflict(client, atelierId, operation);
      }
      const entity = this.mapClient(deleted);
      await this.appendChange(
        client,
        atelierId,
        'client',
        operation.entityId,
        'delete',
        Number(deleted.version),
        entity,
      );
      return this.applied(operation, Number(deleted.version), entity);
    }

    let row: ClientRow | undefined;
    if (operation.baseVersion === 0) {
      row = await this.one<ClientRow>(
        client,
        `INSERT INTO clients
           (id,atelier_id,full_name,phone_e164,email,notes)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING
         RETURNING *`,
        [
          operation.entityId,
          atelierId,
          operation.payload.fullName,
          operation.payload.phone ?? null,
          operation.payload.email ?? null,
          operation.payload.notes ?? null,
        ],
      );
    } else {
      row = await this.one<ClientRow>(
        client,
        `UPDATE clients
         SET full_name=$4,phone_e164=$5,email=$6,notes=$7
         WHERE id=$1 AND atelier_id=$2 AND version=$3 AND deleted_at IS NULL
         RETURNING *`,
        [
          operation.entityId,
          atelierId,
          operation.baseVersion,
          operation.payload.fullName,
          operation.payload.phone ?? null,
          operation.payload.email ?? null,
          operation.payload.notes ?? null,
        ],
      );
    }

    if (!row) return this.clientConflict(client, atelierId, operation);
    const entity = this.mapClient(row);
    await this.appendChange(
      client,
      atelierId,
      'client',
      operation.entityId,
      'upsert',
      Number(row.version),
      entity,
    );
    return this.applied(operation, Number(row.version), entity);
  }

  private async clientConflict(
    client: PoolClient,
    atelierId: string,
    operation: ClientOperation,
  ): Promise<SyncResult> {
    const current = await this.one<ClientRow>(
      client,
      'SELECT * FROM clients WHERE id=$1 AND atelier_id=$2',
      [operation.entityId, atelierId],
    );
    return this.conflict(
      operation,
      current ? 'VERSION_CONFLICT' : 'ENTITY_NOT_FOUND',
      current ? this.mapClient(current) : null,
    );
  }

  private async applyInventory(
    client: PoolClient,
    atelierId: string,
    operation: InventoryOperation,
  ): Promise<SyncResult> {
    if (operation.operation === 'delete') {
      const deleted = await this.one<InventoryRow>(
        client,
        `UPDATE inventory_items
         SET deleted_at=now()
         WHERE id=$1 AND atelier_id=$2 AND version=$3 AND deleted_at IS NULL
         RETURNING *`,
        [operation.entityId, atelierId, operation.baseVersion],
      );
      if (!deleted) {
        return this.inventoryConflict(client, atelierId, operation);
      }
      const entity = this.mapInventory(deleted);
      await this.appendChange(
        client,
        atelierId,
        'inventory_item',
        operation.entityId,
        'delete',
        Number(deleted.version),
        entity,
      );
      return this.applied(operation, Number(deleted.version), entity);
    }

    let row: InventoryRow | undefined;
    if (operation.baseVersion === 0) {
      row = await this.one<InventoryRow>(
        client,
        `INSERT INTO inventory_items
           (id,atelier_id,kind,name,quantity,unit,cost_cfa)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING
         RETURNING *`,
        [
          operation.entityId,
          atelierId,
          operation.payload.kind,
          operation.payload.name,
          operation.payload.quantity,
          operation.payload.unit,
          operation.payload.costCfa ?? null,
        ],
      );
    } else {
      row = await this.one<InventoryRow>(
        client,
        `UPDATE inventory_items
         SET kind=$4,name=$5,quantity=$6,unit=$7,cost_cfa=$8
         WHERE id=$1 AND atelier_id=$2 AND version=$3 AND deleted_at IS NULL
         RETURNING *`,
        [
          operation.entityId,
          atelierId,
          operation.baseVersion,
          operation.payload.kind,
          operation.payload.name,
          operation.payload.quantity,
          operation.payload.unit,
          operation.payload.costCfa ?? null,
        ],
      );
    }

    if (!row) return this.inventoryConflict(client, atelierId, operation);
    const entity = this.mapInventory(row);
    await this.appendChange(
      client,
      atelierId,
      'inventory_item',
      operation.entityId,
      'upsert',
      Number(row.version),
      entity,
    );
    return this.applied(operation, Number(row.version), entity);
  }

  private async inventoryConflict(
    client: PoolClient,
    atelierId: string,
    operation: InventoryOperation,
  ): Promise<SyncResult> {
    const current = await this.one<InventoryRow>(
      client,
      'SELECT * FROM inventory_items WHERE id=$1 AND atelier_id=$2',
      [operation.entityId, atelierId],
    );
    return this.conflict(
      operation,
      current ? 'VERSION_CONFLICT' : 'ENTITY_NOT_FOUND',
      current ? this.mapInventory(current) : null,
    );
  }

  private applied(
    operation: SyncOperation,
    version: number,
    entity: Record<string, unknown>,
  ): SyncResult {
    return {
      operationId: operation.operationId,
      entityType: operation.entityType,
      entityId: operation.entityId,
      status: 'applied',
      version,
      entity,
    };
  }

  private conflict(
    operation: SyncOperation,
    code: string,
    current: Record<string, unknown> | null,
  ): SyncResult {
    return {
      operationId: operation.operationId,
      entityType: operation.entityType,
      entityId: operation.entityId,
      status: 'conflict',
      code,
      current,
    };
  }

  private mapClient(row: ClientRow): Record<string, unknown> {
    return {
      id: row.id,
      fullName: row.full_name,
      phone: row.phone_e164,
      email: row.email,
      notes: row.notes,
      version: Number(row.version),
      deletedAt: row.deleted_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapInventory(row: InventoryRow): Record<string, unknown> {
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      quantity: Number(row.quantity),
      unit: row.unit,
      costCfa: row.cost_cfa == null ? null : Number(row.cost_cfa),
      version: Number(row.version),
      deletedAt: row.deleted_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private normalizePayload(
    entityType: SyncEntityType,
    payload: unknown,
  ): unknown {
    if (!payload || typeof payload !== 'object') return payload;
    const value = payload as Record<string, unknown>;
    if (entityType === 'client') {
      return {
        id: value.id,
        fullName: value.fullName ?? value.full_name,
        phone: value.phone ?? value.phone_e164,
        email: value.email,
        notes: value.notes,
        version: Number(value.version ?? 0),
        deletedAt: toIso(value.deletedAt ?? value.deleted_at),
        createdAt: toIso(value.createdAt ?? value.created_at),
        updatedAt: toIso(value.updatedAt ?? value.updated_at),
      };
    }
    return {
      id: value.id,
      kind: value.kind,
      name: value.name,
      quantity: Number(value.quantity ?? 0),
      unit: value.unit,
      costCfa: value.costCfa == null && value.cost_cfa == null
        ? null
        : Number(value.costCfa ?? value.cost_cfa),
      version: Number(value.version ?? 0),
      deletedAt: toIso(value.deletedAt ?? value.deleted_at),
      createdAt: toIso(value.createdAt ?? value.created_at),
      updatedAt: toIso(value.updatedAt ?? value.updated_at),
    };
  }

  private async appendChange(
    client: PoolClient,
    atelierId: string,
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncMutation,
    version: number,
    payload: unknown,
  ): Promise<void> {
    await client.query(
      `INSERT INTO change_log
         (atelier_id,entity_type,entity_id,operation,version,payload)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        atelierId,
        entityType,
        entityId,
        operation,
        version,
        JSON.stringify(payload),
      ],
    );
  }

  private async one<T extends Record<string, unknown>>(
    client: PoolClient,
    sql: string,
    values: unknown[],
  ): Promise<T | undefined> {
    return (await client.query<T>(sql, values)).rows[0];
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function toIso(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}
