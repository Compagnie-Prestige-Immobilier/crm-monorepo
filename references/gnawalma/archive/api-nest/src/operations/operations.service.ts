import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AtelierAccessService } from '../atelier/atelier-access.service';
import { AuthClaims } from '../auth/auth.types';
import { normalizePhone } from '../auth/phone';
import { DatabaseService } from '../database/database.service';

type OrderStatus = 'draft' | 'confirmed' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';

interface PageInput {
  q?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class OperationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AtelierAccessService,
  ) {}

  async listAteliers(user: AuthClaims) {
    const rows = await this.db.query<{
      id: string;
      name: string;
      description: string | null;
      phone_e164: string;
      address_text: string | null;
      status: string;
      region: string | null;
      specialties: string[];
      profile_completeness: number;
      membership_role: string;
      version: string;
      latitude: number | null;
      longitude: number | null;
      tiktok_url: string | null;
      instagram_url: string | null;
      facebook_url: string | null;
    }>(
      `SELECT DISTINCT
         a.id,a.name,a.description,a.phone_e164,a.address_text,a.region,a.status::text,
         a.specialties,a.profile_completeness,a.version,
         a.tiktok_url,a.instagram_url,a.facebook_url,
         -- Returned so the app can show and correct a position it is already
         -- allowed to set. POST accepted coordinates while no read exposed
         -- them, which made an atelier's location write-only.
         ST_Y(a.location::geometry) AS latitude,
         ST_X(a.location::geometry) AS longitude,
         CASE WHEN a.owner_account_id=$1 THEN 'atelier_owner' ELSE m.role::text END AS membership_role
       FROM ateliers a
       LEFT JOIN atelier_memberships m
         ON m.atelier_id=a.id AND m.account_id=$1
       WHERE a.owner_account_id=$1 OR m.account_id=$1
       ORDER BY a.name ASC`,
      [user.sub],
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      phone: row.phone_e164,
      address: row.address_text,
      region: row.region,
      status: row.status,
      specialties: row.specialties,
      profileCompleteness: row.profile_completeness,
      membershipRole: row.membership_role,
      version: Number(row.version),
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
      // Relus pour que l'atelier puisse corriger ses liens après coup, et pas
      // seulement pendant la configuration.
      tiktokUrl: row.tiktok_url,
      instagramUrl: row.instagram_url,
      facebookUrl: row.facebook_url,
    }));
  }

  async createAtelier(
    user: AuthClaims,
    input: {
      name: string;
      phone: string;
      address?: string;
      region?: string;
      latitude?: number;
      longitude?: number;
      specialties?: string[];
      tiktokUrl?: string;
      instagramUrl?: string;
      facebookUrl?: string;
    },
  ) {
    if (user.role !== 'atelier_owner') {
      throw new ConflictException('Only atelier owners can create an atelier');
    }
    if ((input.latitude == null) !== (input.longitude == null)) {
      throw new ConflictException('Latitude and longitude must be provided together');
    }

    // Stored in the same E.164 form the accounts table uses. It was written
    // through raw, so an atelier created from the app kept "77 000 00 00" in a
    // column named `phone_e164` — the marketplace hands that string straight to
    // a `tel:` link and to `wa.me/<digits>`, neither of which can dial it.
    const phone = normalizePhone(input.phone);

    const row = await this.db.one<{ id: string; version: string }>(
      `INSERT INTO ateliers
         (owner_account_id,name,phone_e164,address_text,region,location,status,specialties,
          tiktok_url,instagram_url,facebook_url)
       VALUES (
         $1,$2,$3,$4,$11,
         CASE WHEN $5::numeric IS NULL THEN NULL
              ELSE ST_SetSRID(ST_MakePoint($6,$5),4326)::geography END,
         'draft',$7,$8,$9,$10
       )
       RETURNING id,version`,
      [
        user.sub,
        input.name,
        phone,
        input.address ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
        input.specialties ?? [],
        blankToNull(input.tiktokUrl),
        blankToNull(input.instagramUrl),
        blankToNull(input.facebookUrl),
        blankToNull(input.region),
      ],
    );
    if (!row) throw new Error('Atelier creation failed');
    await this.db.query(
      `INSERT INTO atelier_memberships (atelier_id,account_id,role)
       VALUES ($1,$2,$3)
       ON CONFLICT (atelier_id,account_id) DO NOTHING`,
      [row.id, user.sub, 'atelier_owner'],
    );
    return { id: row.id, version: Number(row.version) };
  }

  /**
   * Corrects an atelier's public details.
   *
   * `POST /operations/ateliers` was the only write: an atelier's name, phone,
   * address and — the one that matters — its position were fixed for good at
   * creation. Every atelier created before the wizard asked for a zone therefore
   * has a null `location`, which the marketplace filters out of every search,
   * and its owner had no way to repair that from the app or from anywhere else.
   *
   * Fields left out are left alone; passing `null` for the position clears it.
   */
  async updateAtelier(
    user: AuthClaims,
    atelierId: string,
    input: {
      name?: string;
      phone?: string;
      address?: string;
      region?: string;
      latitude?: number | null;
      longitude?: number | null;
      specialties?: string[];
      tiktokUrl?: string;
      instagramUrl?: string;
      facebookUrl?: string;
    },
  ) {
    await this.access.requireWriteAccess(user, atelierId);
    const setsPosition =
      input.latitude !== undefined || input.longitude !== undefined;
    if (setsPosition && (input.latitude == null) !== (input.longitude == null)) {
      throw new ConflictException('Latitude and longitude must be provided together');
    }

    const phone = input.phone == null ? null : normalizePhone(input.phone);
    const row = await this.db.one<{ id: string; version: string }>(
      `UPDATE ateliers SET
         name=COALESCE($2,name),
         phone_e164=COALESCE($3,phone_e164),
         address_text=COALESCE($4,address_text),
         region=COALESCE($12,region),
         location=CASE
           WHEN $5::boolean IS NOT TRUE THEN location
           WHEN $6::numeric IS NULL THEN NULL
           ELSE ST_SetSRID(ST_MakePoint($7,$6),4326)::geography
         END,
         specialties=COALESCE($8,specialties),
         -- Une chaîne vide efface le lien, une absence le laisse tel quel :
         -- l'écran d'édition envoie ce que contient le champ, et l'utilisateur
         -- qui vide un champ attend qu'il disparaisse de sa fiche.
         tiktok_url=CASE WHEN $9::text IS NULL THEN tiktok_url
                         WHEN $9 = '' THEN NULL ELSE $9 END,
         instagram_url=CASE WHEN $10::text IS NULL THEN instagram_url
                            WHEN $10 = '' THEN NULL ELSE $10 END,
         facebook_url=CASE WHEN $11::text IS NULL THEN facebook_url
                           WHEN $11 = '' THEN NULL ELSE $11 END
       WHERE id=$1
       RETURNING id,version`,
      [
        atelierId,
        input.name ?? null,
        phone,
        input.address ?? null,
        setsPosition,
        input.latitude ?? null,
        input.longitude ?? null,
        input.specialties ?? null,
        input.tiktokUrl ?? null,
        input.instagramUrl ?? null,
        input.facebookUrl ?? null,
        blankToNull(input.region),
      ],
    );
    if (!row) throw new NotFoundException('Atelier not found');
    return { id: row.id, version: Number(row.version) };
  }

  /**
   * Submits an atelier to the platform verification queue.
   *
   * Nothing used to write `atelier_verifications`. The admin back-office reads
   * its queue from that table exclusively, and `ateliers.status` only ever
   * leaves `'draft'` through an admin decision on one of its rows — so an
   * atelier created from the app could never be reviewed, could never become
   * `'verified'`, and `GET /marketplace/ateliers` (which filters on
   * `status='verified'`) could never return it. A client saw an empty
   * marketplace and had nobody to contact. This is the missing half.
   *
   * The two marketplace preconditions are enforced here rather than after
   * approval: search also requires `location IS NOT NULL`, so approving an
   * atelier without coordinates would produce a verified atelier that still
   * appears nowhere — a silent failure one step further down the line.
   *
   * **Verification is automatic, the admin review is remote** — decision D-010
   * in `knowledge-base/DECISIONS.md`, and the reason ADR-004 places the phone
   * check "dans la revue" rather than before it. A complete dossier publishes
   * the atelier immediately and *also* enters the review queue; an
   * administrator confirms, rejects or suspends afterwards, which removes it
   * from search again.
   *
   * The implementation used to gate visibility on that manual decision. That
   * inverted the recorded decision and made the whole marketplace depend on a
   * `platform_admin` account existing and being staffed — with none, every
   * dossier waited forever and clients saw an empty marketplace no matter how
   * many ateliers had signed up.
   */
  async submitForVerification(
    user: AuthClaims,
    atelierId: string,
    input: { idDocumentRef: string; checklist?: Record<string, unknown> },
  ) {
    await this.access.requireWriteAccess(user, atelierId);
    return this.db.transaction(async (client) => {
      const atelier = await this.one<{
        status: string;
        has_location: boolean;
        phone_e164: string | null;
      }>(
        client,
        `SELECT status::text, (location IS NOT NULL) AS has_location, phone_e164
         FROM ateliers WHERE id=$1 FOR UPDATE`,
        [atelierId],
      );
      if (!atelier) throw new NotFoundException('Atelier not found');
      if (atelier.status === 'suspended') {
        throw new ConflictException('A suspended atelier cannot be resubmitted');
      }
      if (!atelier.has_location) {
        throw new ConflictException(
          'Set the atelier position before submitting: the marketplace searches by distance and cannot list an atelier without one',
        );
      }
      if (!atelier.phone_e164) {
        throw new ConflictException('A published atelier needs a phone number');
      }

      // Idempotent, and convergent rather than merely "already done".
      //
      // Tapping "publish" twice, or retrying after a dropped response, must not
      // stack two dossiers in front of the same reviewer — but it must still
      // leave the atelier published. Returning early on the existing dossier
      // alone would strand every row created while publication waited on a
      // manual decision: they carry a pending dossier *and* a `pending_review`
      // status, so nothing would ever move them.
      const pending = await this.one<{ id: string }>(
        client,
        `SELECT id FROM atelier_verifications
         WHERE atelier_id=$1 AND decision='pending'`,
        [atelierId],
      );

      const created = pending
        ? pending
        : await this.one<{ id: string }>(
            client,
            `INSERT INTO atelier_verifications
               (atelier_id,submitted_by,id_document_ref,checklist)
             VALUES ($1,$2,$3,$4) RETURNING id`,
            [
              atelierId,
              user.sub,
              input.idDocumentRef.trim(),
              JSON.stringify(input.checklist ?? {}),
            ],
          );
      if (!created) throw new Error('Verification submission failed');

      // Published now; reviewed after. A `rejected` atelier that resubmits a
      // corrected dossier is republished on the same terms — the review that
      // rejected it is closed, and this is a new one.
      await client.query(
        `UPDATE ateliers SET status='verified', verified_at=now() WHERE id=$1`,
        [atelierId],
      );
      // Recorded as automatic so the audit trail distinguishes it from a
      // decision a human made. Only the first submission is logged; a retry
      // converges silently rather than filling the journal.
      if (!pending) {
        await client.query(
          `INSERT INTO audit_events
             (actor_account_id,atelier_id,action,target_type,target_id,metadata)
           VALUES ($1,$2,'verification.submitted','atelier_verification',$3,$4)`,
          [
            user.sub,
            atelierId,
            created.id,
            JSON.stringify({ autoVerified: true, awaitingRemoteReview: true }),
          ],
        );
      }
      return { verificationId: created.id, status: 'verified' };
    });
  }

  /**
   * The client requests that reached this atelier.
   *
   * `contact_events` had exactly one reader — the client's own history. The
   * atelier it points at could not list them anywhere, so a request sent from
   * the marketplace arrived in a table nobody on the receiving side could see,
   * and the bilateral confirmation the schema models (both sides must confirm
   * before a contact is `completed`, and only a completed contact can be
   * reviewed) had no way to reach its second half.
   */
  async listAtelierContacts(
    user: AuthClaims,
    atelierId: string,
    input: { limit: number; offset: number },
  ) {
    await this.access.requireWriteAccess(user, atelierId);
    const rows = await this.db.query<{
      id: string;
      channel: string;
      status: string;
      created_at: Date;
      completed_at: Date | null;
      client_confirmed_at: Date | null;
      atelier_confirmed_at: Date | null;
      client_account_id: string | null;
      client_name: string | null;
      client_phone: string | null;
    }>(
      `SELECT
         c.id,c.channel::text,c.status::text,c.created_at,c.completed_at,
         c.client_confirmed_at,c.atelier_confirmed_at,c.client_account_id,
         account.display_name AS client_name,
         account.phone_e164 AS client_phone
       FROM contact_events c
       LEFT JOIN accounts account ON account.id=c.client_account_id
       WHERE c.atelier_id=$1
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [atelierId, input.limit, input.offset],
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        channel: row.channel,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        completedAt: row.completed_at?.toISOString() ?? null,
        clientConfirmedAt: row.client_confirmed_at?.toISOString() ?? null,
        atelierConfirmedAt: row.atelier_confirmed_at?.toISOString() ?? null,
        clientAccountId: row.client_account_id,
        clientName: row.client_name,
        clientPhone: row.client_phone,
      })),
      limit: input.limit,
      offset: input.offset,
      hasMore: rows.length === input.limit,
    };
  }

  async dashboard(user: AuthClaims, atelierId: string) {
    await this.access.requireWriteAccess(user, atelierId);
    const row = await this.db.one<{
      active_orders: string;
      ready_orders: string;
      overdue_orders: string;
      unpaid_cfa: string;
      received_today_cfa: string;
      clients_count: string;
      low_stock_count: string;
      next_due_at: Date | null;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE o.status IN ('confirmed','in_progress')) AS active_orders,
         COUNT(*) FILTER (WHERE o.status='ready') AS ready_orders,
         COUNT(*) FILTER (
           WHERE o.status NOT IN ('delivered','cancelled') AND o.due_at < now()
         ) AS overdue_orders,
         COALESCE(SUM(o.total_cfa-o.paid_cfa) FILTER (WHERE o.status<>'cancelled'),0) AS unpaid_cfa,
         COALESCE((
           SELECT SUM(p.amount_cfa)
           FROM payments p
           JOIN orders paid_order ON paid_order.id=p.order_id
           WHERE paid_order.atelier_id=$1
             AND p.created_at >= date_trunc('day', now())
         ),0) AS received_today_cfa,
         (SELECT COUNT(*) FROM clients c WHERE c.atelier_id=$1 AND c.deleted_at IS NULL) AS clients_count,
         (SELECT COUNT(*) FROM inventory_items i WHERE i.atelier_id=$1 AND i.deleted_at IS NULL AND i.quantity <= 1) AS low_stock_count,
         MIN(o.due_at) FILTER (
           WHERE o.status NOT IN ('delivered','cancelled') AND o.due_at >= now()
         ) AS next_due_at
       FROM orders o
       WHERE o.atelier_id=$1`,
      [atelierId],
    );

    return {
      activeOrders: Number(row?.active_orders ?? 0),
      readyOrders: Number(row?.ready_orders ?? 0),
      overdueOrders: Number(row?.overdue_orders ?? 0),
      unpaidCfa: Number(row?.unpaid_cfa ?? 0),
      receivedTodayCfa: Number(row?.received_today_cfa ?? 0),
      clientsCount: Number(row?.clients_count ?? 0),
      lowStockCount: Number(row?.low_stock_count ?? 0),
      nextDueAt: row?.next_due_at?.toISOString() ?? null,
    };
  }

  async listClients(user: AuthClaims, atelierId: string, input: PageInput) {
    await this.access.requireWriteAccess(user, atelierId);
    const query = input.q?.trim() || null;
    const rows = await this.db.query<{
      id: string;
      full_name: string;
      phone_e164: string | null;
      email: string | null;
      notes: string | null;
      version: string;
      created_at: Date;
      updated_at: Date;
      order_count: string;
      total_spent_cfa: string;
      last_order_at: Date | null;
    }>(
      `SELECT
         c.id,c.full_name,c.phone_e164,c.email,c.notes,c.version,c.created_at,c.updated_at,
         COUNT(o.id) FILTER (WHERE o.status<>'cancelled') AS order_count,
         COALESCE(SUM(o.paid_cfa) FILTER (WHERE o.status<>'cancelled'),0) AS total_spent_cfa,
         MAX(o.created_at) FILTER (WHERE o.status<>'cancelled') AS last_order_at
       FROM clients c
       LEFT JOIN orders o ON o.client_id=c.id AND o.atelier_id=c.atelier_id
       WHERE c.atelier_id=$1 AND c.deleted_at IS NULL
         AND ($2::text IS NULL OR c.full_name ILIKE '%' || $2 || '%' OR c.phone_e164 ILIKE '%' || $2 || '%')
       GROUP BY c.id
       ORDER BY c.updated_at DESC,c.id DESC
       LIMIT $3 OFFSET $4`,
      [atelierId, query, input.limit, input.offset],
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        phone: row.phone_e164,
        email: row.email,
        notes: row.notes,
        version: Number(row.version),
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        orderCount: Number(row.order_count),
        totalSpentCfa: Number(row.total_spent_cfa),
        lastOrderAt: row.last_order_at?.toISOString() ?? null,
      })),
      limit: input.limit,
      offset: input.offset,
      hasMore: rows.length === input.limit,
    };
  }

  async upsertClient(
    user: AuthClaims,
    atelierId: string,
    input: {
      id?: string;
      version?: number;
      fullName: string;
      phone?: string;
      email?: string;
      notes?: string;
    },
  ) {
    await this.access.requireWriteAccess(user, atelierId);
    return this.db.transaction(async (client) => {
      let row: Record<string, unknown> | undefined;
      if (!input.id) {
        row = await this.one<Record<string, unknown>>(
          client,
          `INSERT INTO clients (atelier_id,full_name,phone_e164,email,notes)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [
            atelierId,
            input.fullName,
            input.phone ?? null,
            input.email ?? null,
            input.notes ?? null,
          ],
        );
      } else {
        if (input.version == null) {
          throw new ConflictException('Client version is required for an update');
        }
        row = await this.one<Record<string, unknown>>(
          client,
          `UPDATE clients SET full_name=$4,phone_e164=$5,email=$6,notes=$7
           WHERE id=$1 AND atelier_id=$2 AND deleted_at IS NULL AND version=$3
           RETURNING *`,
          [
            input.id,
            atelierId,
            input.version,
            input.fullName,
            input.phone ?? null,
            input.email ?? null,
            input.notes ?? null,
          ],
        );
        if (!row) {
          throw new ConflictException(
            'Client changed on another device; pull and resolve before retrying',
          );
        }
      }
      if (!row) throw new Error('Client write failed');
      const mapped = this.mapClient(row);
      await this.appendChange(
        client,
        atelierId,
        'client',
        String(row.id),
        'upsert',
        Number(row.version),
        mapped,
      );
      return mapped;
    });
  }

  /**
   * Les commandes de tous les ateliers, sans les données de leurs clients.
   *
   * Décision du commanditaire : un atelier voit l'activité des autres. Elle
   * revient sur `REQ-PRIV-001`, et ce qui traverse est donc réduit au strict
   * minimum — la référence, le vêtement, l'état, l'échéance, le nom et la
   * région de l'atelier. Jamais le nom du client, son téléphone, ses mesures,
   * les montants ni les notes : une commande porte le carnet d'adresses privé
   * de l'atelier, et le partager n'a jamais été demandé.
   *
   * Réservé aux comptes atelier : la marketplace cliente n'y accède pas.
   */
  async listSharedOrders(
    user: AuthClaims,
    input: PageInput & { status?: OrderStatus },
  ) {
    if (
      user.role !== 'atelier_owner' &&
      user.role !== 'atelier_manager' &&
      user.role !== 'platform_admin'
    ) {
      throw new ForbiddenException('Atelier accounts only');
    }
    const query = input.q?.trim() || null;
    const rows = await this.db.query<{
      id: string;
      public_reference: string;
      status: OrderStatus;
      due_at: Date | null;
      created_at: Date;
      atelier_id: string;
      atelier_name: string;
      atelier_region: string | null;
      garment_types: string[];
      item_count: string;
    }>(
      `SELECT
         o.id,o.public_reference,o.status,o.due_at,o.created_at,
         o.atelier_id,a.name AS atelier_name,a.region AS atelier_region,
         COALESCE(array_agg(DISTINCT oi.garment_type)
                    FILTER (WHERE oi.garment_type IS NOT NULL),
                  ARRAY[]::text[]) AS garment_types,
         COUNT(oi.id) AS item_count
       FROM orders o
       JOIN ateliers a ON a.id=o.atelier_id
       LEFT JOIN order_items oi ON oi.order_id=o.id
       WHERE ($1::order_status IS NULL OR o.status=$1)
         AND ($2::text IS NULL
              OR a.name ILIKE '%' || $2 || '%'
              OR oi.garment_type ILIKE '%' || $2 || '%')
       GROUP BY o.id,a.name,a.region
       ORDER BY o.created_at DESC,o.id ASC
       LIMIT $3 OFFSET $4`,
      [input.status ?? null, query, input.limit, input.offset],
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        reference: row.public_reference,
        status: row.status,
        dueAt: row.due_at?.toISOString() ?? null,
        createdAt: row.created_at.toISOString(),
        atelierId: row.atelier_id,
        atelierName: row.atelier_name,
        atelierRegion: row.atelier_region,
        garmentTypes: row.garment_types,
        itemCount: Number(row.item_count),
      })),
      limit: input.limit,
      offset: input.offset,
      hasMore: rows.length === input.limit,
    };
  }

  async listOrders(
    user: AuthClaims,
    atelierId: string,
    input: PageInput & { status?: OrderStatus },
  ) {
    await this.access.requireWriteAccess(user, atelierId);
    const query = input.q?.trim() || null;
    const rows = await this.db.query<{
      id: string;
      public_reference: string;
      status: OrderStatus;
      total_cfa: string;
      paid_cfa: string;
      due_at: Date | null;
      notes: string | null;
      version: string;
      created_at: Date;
      updated_at: Date;
      client_id: string;
      client_name: string;
      items: unknown[];
    }>(
      `SELECT
         o.id,o.public_reference,o.status,o.total_cfa,o.paid_cfa,o.due_at,o.notes,
         o.version,o.created_at,o.updated_at,o.client_id,c.full_name AS client_name,
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id',oi.id,
               'garmentType',oi.garment_type,
               'unitPriceCfa',oi.unit_price_cfa,
               'status',oi.status,
               'beneficiaryId',oi.beneficiary_id,
               'measurementVersionId',oi.measurement_version_id
             ) ORDER BY oi.created_at ASC
           ) FILTER (WHERE oi.id IS NOT NULL),
           '[]'::jsonb
         ) AS items
       FROM orders o
       JOIN clients c ON c.id=o.client_id
       LEFT JOIN order_items oi ON oi.order_id=o.id
       WHERE o.atelier_id=$1
         AND ($2::order_status IS NULL OR o.status=$2)
         AND ($3::text IS NULL OR o.public_reference ILIKE '%' || $3 || '%' OR c.full_name ILIKE '%' || $3 || '%')
       GROUP BY o.id,c.full_name
       ORDER BY COALESCE(o.due_at,o.created_at) ASC,o.id ASC
       LIMIT $4 OFFSET $5`,
      [atelierId, input.status ?? null, query, input.limit, input.offset],
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        reference: row.public_reference,
        status: row.status,
        totalCfa: Number(row.total_cfa),
        paidCfa: Number(row.paid_cfa),
        remainingCfa: Number(row.total_cfa) - Number(row.paid_cfa),
        dueAt: row.due_at?.toISOString() ?? null,
        notes: row.notes,
        version: Number(row.version),
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        client: { id: row.client_id, fullName: row.client_name },
        items: (row.items ?? []).map((item) => {
          const value = item as Record<string, unknown>;
          return {
            ...value,
            unitPriceCfa: Number(value.unitPriceCfa ?? 0),
          };
        }),
      })),
      limit: input.limit,
      offset: input.offset,
      hasMore: rows.length === input.limit,
    };
  }

  async createOrder(
    user: AuthClaims,
    atelierId: string,
    input: {
      clientId: string;
      reference: string;
      totalCfa: number;
      dueAt?: string;
      notes?: string;
      items: Array<{
        garmentType: string;
        unitPriceCfa: number;
        beneficiaryId?: string;
        measurementVersionId?: string;
      }>;
    },
  ) {
    await this.access.requireWriteAccess(user, atelierId);
    return this.db.transaction(async (client) => {
      const order = await this.one<{ id: string; version: number }>(
        client,
        `INSERT INTO orders (atelier_id,client_id,public_reference,total_cfa,due_at,notes,status)
         SELECT $1,$2,$3,$4,$5,$6,'confirmed'
         WHERE EXISTS (SELECT 1 FROM clients WHERE id=$2 AND atelier_id=$1 AND deleted_at IS NULL)
         AND NOT EXISTS (
           SELECT 1 FROM unnest($7::uuid[]) AS requested(id)
           WHERE NOT EXISTS (
             SELECT 1 FROM beneficiaries b JOIN clients c ON c.id=b.client_id
             WHERE b.id=requested.id AND c.id=$2 AND b.deleted_at IS NULL AND c.deleted_at IS NULL
           )
         ) RETURNING *`,
        [
          atelierId,
          input.clientId,
          input.reference,
          input.totalCfa,
          input.dueAt ?? null,
          input.notes ?? null,
          input.items.flatMap((item) => item.beneficiaryId ? [item.beneficiaryId] : []),
        ],
      );
      if (!order) throw new NotFoundException('Client not found');
      for (const item of input.items) {
        const itemResult = await client.query(
          `INSERT INTO order_items
             (order_id,beneficiary_id,measurement_version_id,garment_type,unit_price_cfa,status)
           SELECT $1,$2,$3,$4,$5,'confirmed'
           WHERE ($2::uuid IS NULL OR EXISTS (
             SELECT 1 FROM beneficiaries b JOIN clients c ON c.id=b.client_id
             WHERE b.id=$2 AND c.id=$6 AND b.deleted_at IS NULL AND c.deleted_at IS NULL
           ))
           AND ($3::uuid IS NULL OR EXISTS (
             SELECT 1 FROM measurement_versions m
             LEFT JOIN clients direct_client ON direct_client.id=m.client_id
             LEFT JOIN beneficiaries mb ON mb.id=m.beneficiary_id
             LEFT JOIN clients beneficiary_client ON beneficiary_client.id=mb.client_id
             WHERE m.id=$3 AND COALESCE(direct_client.id, beneficiary_client.id)=$6
           ))
           RETURNING id`,
          [
            order.id,
            item.beneficiaryId ?? null,
            item.measurementVersionId ?? null,
            item.garmentType,
            item.unitPriceCfa,
            input.clientId,
          ],
        );
        if (itemResult.rowCount !== 1) {
          throw new ConflictException('Order item references data outside this client');
        }
      }
      await this.appendChange(client, atelierId, 'order', order.id, 'upsert', order.version, order);
      return { id: order.id, version: Number(order.version) };
    });
  }

  async updateOrderStatus(
    user: AuthClaims,
    atelierId: string,
    orderId: string,
    nextStatus: OrderStatus,
  ) {
    await this.access.requireWriteAccess(user, atelierId);
    const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
      draft: ['confirmed', 'cancelled'],
      confirmed: ['in_progress', 'cancelled'],
      in_progress: ['ready', 'cancelled'],
      ready: ['delivered', 'in_progress', 'cancelled'],
      delivered: [],
      cancelled: [],
    };

    return this.db.transaction(async (client) => {
      const current = await this.one<{ status: OrderStatus }>(
        client,
        'SELECT status FROM orders WHERE id=$1 AND atelier_id=$2 FOR UPDATE',
        [orderId, atelierId],
      );
      if (!current) throw new NotFoundException('Order not found');
      if (current.status === nextStatus) return { id: orderId, status: nextStatus };
      if (!transitions[current.status].includes(nextStatus)) {
        throw new ConflictException(`Invalid order transition from ${current.status} to ${nextStatus}`);
      }

      const updated = await this.one<{ id: string; status: OrderStatus; version: number }>(
        client,
        `UPDATE orders SET status=$3
         WHERE id=$1 AND atelier_id=$2
         RETURNING id,status,version`,
        [orderId, atelierId, nextStatus],
      );
      if (!updated) throw new NotFoundException('Order not found');
      await client.query('UPDATE order_items SET status=$2 WHERE order_id=$1', [orderId, nextStatus]);
      await this.appendChange(client, atelierId, 'order', orderId, 'upsert', updated.version, updated);
      return { id: updated.id, status: updated.status, version: Number(updated.version) };
    });
  }

  async recordPayment(
    user: AuthClaims,
    atelierId: string,
    orderId: string,
    input: { amountCfa: number; method: string; idempotencyKey: string; note?: string },
  ) {
    await this.access.requireWriteAccess(user, atelierId);
    return this.db.transaction(async (client) => {
      const order = await this.one<{
        id: string;
        paid_cfa: number;
        total_cfa: number;
        version: number;
      }>(
        client,
        'SELECT id,paid_cfa,total_cfa,version FROM orders WHERE id=$1 AND atelier_id=$2 FOR UPDATE',
        [orderId, atelierId],
      );
      if (!order) throw new NotFoundException('Order not found');
      const existing = await this.one<Record<string, unknown>>(
        client,
        'SELECT * FROM payments WHERE order_id=$1 AND idempotency_key=$2',
        [orderId, input.idempotencyKey],
      );
      if (existing) return this.mapPayment(existing);
      if (Number(order.paid_cfa) + input.amountCfa > Number(order.total_cfa)) {
        throw new ConflictException('Payment exceeds remaining balance');
      }
      const payment = await this.one<Record<string, unknown>>(
        client,
        `INSERT INTO payments
           (order_id,idempotency_key,amount_cfa,method,note,received_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [orderId, input.idempotencyKey, input.amountCfa, input.method, input.note ?? null, user.sub],
      );
      if (!payment) throw new Error('Payment creation failed');
      const updated = await this.one<{ id: string; version: number }>(
        client,
        `UPDATE orders SET paid_cfa=paid_cfa+$3
         WHERE id=$1 AND atelier_id=$2 RETURNING *`,
        [orderId, atelierId, input.amountCfa],
      );
      if (!updated) throw new Error('Order payment update failed');
      await this.appendChange(client, atelierId, 'order', orderId, 'upsert', updated.version, updated);
      await client.query(
        `INSERT INTO audit_events
           (actor_account_id,atelier_id,action,target_type,target_id,metadata)
         VALUES ($1,$2,'payment.recorded','payment',$3,$4)`,
        [user.sub, atelierId, payment.id, JSON.stringify({ orderId, amountCfa: input.amountCfa })],
      );
      return this.mapPayment(payment);
    });
  }

  async listInventory(user: AuthClaims, atelierId: string, input: PageInput) {
    await this.access.requireWriteAccess(user, atelierId);
    const query = input.q?.trim() || null;
    const rows = await this.db.query<{
      id: string;
      kind: string;
      name: string;
      quantity: string;
      unit: string;
      cost_cfa: string | null;
      version: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id,kind,name,quantity,unit,cost_cfa,version,created_at,updated_at
       FROM inventory_items
       WHERE atelier_id=$1 AND deleted_at IS NULL
         AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR kind ILIKE '%' || $2 || '%')
       ORDER BY updated_at DESC,id DESC
       LIMIT $3 OFFSET $4`,
      [atelierId, query, input.limit, input.offset],
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        name: row.name,
        quantity: Number(row.quantity),
        unit: row.unit,
        costCfa: row.cost_cfa == null ? null : Number(row.cost_cfa),
        version: Number(row.version),
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      })),
      limit: input.limit,
      offset: input.offset,
      hasMore: rows.length === input.limit,
    };
  }

  async upsertInventory(
    user: AuthClaims,
    atelierId: string,
    input: {
      id?: string;
      version?: number;
      kind: 'fabric' | 'notion' | 'supply';
      name: string;
      quantity: number;
      unit: string;
      costCfa?: number;
    },
  ) {
    await this.access.requireWriteAccess(user, atelierId);
    return this.db.transaction(async (client) => {
      let row: Record<string, unknown> | undefined;
      if (input.id == null) {
        row = await this.one<Record<string, unknown>>(
          client,
          `INSERT INTO inventory_items
             (atelier_id,kind,name,quantity,unit,cost_cfa)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [atelierId, input.kind, input.name, input.quantity, input.unit, input.costCfa ?? null],
        );
      } else {
        if (input.version == null) {
          throw new ConflictException('Inventory version is required for an update');
        }
        row = await this.one<Record<string, unknown>>(
          client,
          `UPDATE inventory_items
           SET kind=$4,name=$5,quantity=$6,unit=$7,cost_cfa=$8
           WHERE id=$1 AND atelier_id=$2 AND version=$3 AND deleted_at IS NULL
           RETURNING *`,
          [input.id, atelierId, input.version, input.kind, input.name, input.quantity, input.unit, input.costCfa ?? null],
        );
        if (!row) throw new ConflictException('Inventory item changed on another device');
      }
      if (!row) throw new Error('Inventory write failed');
      await this.appendChange(
        client,
        atelierId,
        'inventory_item',
        String(row.id),
        'upsert',
        Number(row.version),
        row,
      );
      return this.mapInventory(row);
    });
  }

  private mapClient(row: Record<string, unknown> | undefined) {
    if (!row) return null;
    return {
      id: row.id,
      fullName: row.full_name,
      phone: row.phone_e164,
      email: row.email,
      notes: row.notes,
      version: Number(row.version),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      // The write response used to stop above this line while the list
      // response carried these three. One documented `Client` schema, two
      // actual shapes — and the mobile client, reading the write response,
      // defaulted the missing counters to zero and displayed "0 commandes ·
      // 0 F" for a client whose history the server had simply not been asked
      // for. A freshly created client genuinely has none of each, so the
      // fallbacks below are facts rather than placeholders.
      orderCount: Number(row.order_count ?? 0),
      totalSpentCfa: Number(row.total_spent_cfa ?? 0),
      lastOrderAt:
        row.last_order_at instanceof Date
          ? row.last_order_at.toISOString()
          : (row.last_order_at ?? null),
    };
  }

  private mapPayment(row: Record<string, unknown>) {
    return {
      id: row.id,
      orderId: row.order_id,
      amountCfa: Number(row.amount_cfa),
      method: row.method,
      note: row.note,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
  }

  private mapInventory(row: Record<string, unknown>) {
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      quantity: Number(row.quantity),
      unit: row.unit,
      costCfa: row.cost_cfa == null ? null : Number(row.cost_cfa),
      version: Number(row.version),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
  }

  private async appendChange(
    client: PoolClient,
    atelierId: string,
    entityType: string,
    entityId: string,
    operation: string,
    version: number,
    payload: unknown,
  ): Promise<void> {
    await client.query(
      `INSERT INTO change_log
         (atelier_id,entity_type,entity_id,operation,version,payload)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [atelierId, entityType, entityId, operation, version, JSON.stringify(payload)],
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

/// Une chaîne vide envoyée à la création vaut « pas de lien ».
///
/// Le champ est facultatif dans l'assistant : le laisser vide doit produire une
/// colonne nulle, pas une chaîne vide que la fiche publique afficherait comme
/// un lien mort.
function blankToNull(value?: string): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
