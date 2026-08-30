import { z, type ZodTypeAny } from 'zod';

/**
 * Every request and response shape the HTTP surface accepts or returns.
 *
 * These schemas used to live inline in the controllers, and `openapi.json` was
 * written by hand beside them. The two drifted exactly as you would expect: the
 * committed spec described 22 of 29 routes, omitted the whole `/admin` module,
 * declared `Order` as `{"type":"object","additionalProperties":true}`, and
 * claimed the marketplace list and detail endpoints returned the same object
 * when the list query did not even select `phone`.
 *
 * Defining them once here and generating the document from them (see
 * `generate-openapi.ts`) means the spec cannot describe an endpoint the server
 * does not implement, and a client generated from it cannot be wrong in a way
 * the server would accept.
 */

// ── Primitives ────────────────────────────────────────────────────────────
export const uuid = z.string().uuid();

/** Money is integer CFA everywhere. There are no sub-unit amounts. */
export const cfa = z.number().int().nonnegative().max(10_000_000_000);

export const isoDateTime = z.string().datetime();

export const pageQuery = z.object({
  q: z.string().max(160).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * The envelope every paginated list actually returns.
 *
 * The spec described `/operations/.../clients`, `/orders` and `/inventory` as
 * bare arrays while the service has always answered
 * `{items, limit, offset, hasMore}`. A client generated from that document
 * would have tried to iterate the envelope itself and found no elements — and
 * nothing compared the two, because the pagination fields had no schema at all.
 */
export const page = <T extends ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    limit: z.number().int(),
    offset: z.number().int(),
    hasMore: z.boolean(),
  });

export const orderStatus = z.enum([
  'draft',
  'confirmed',
  'in_progress',
  'ready',
  'delivered',
  'cancelled',
]);

export const paymentMethod = z.enum([
  'cash',
  'mobile_money',
  'bank_transfer',
  'card',
  'other',
]);

export const accountRole = z.enum([
  'platform_admin',
  'atelier_owner',
  'atelier_manager',
  'client',
]);

export const contactChannel = z.enum(['phone', 'whatsapp', 'sms', 'appointment']);
export const contactStatus = z.enum(['accepted', 'completed', 'disputed']);
export const inventoryKind = z.enum(['fabric', 'notion', 'supply']);
export const reviewStatus = z.enum(['published', 'hidden', 'rejected']);

// ── Auth ──────────────────────────────────────────────────────────────────

/**
 * PIN length is stated once. `login` enforced `min(4).max(8)` while `register`
 * accepted a bare string and deferred to a runtime assertion, so the two ends
 * of the same credential disagreed about what was valid.
 */
export const pin = z.string().min(4).max(8);

export const registrationRequest = z
  .object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    pin,
    displayName: z.string().min(1).max(120),
    role: z.enum(['atelier_owner', 'client']),
  })
  .strict();

export const loginRequest = z
  .object({ identifier: z.string().min(3), pin })
  .strict();

export const refreshRequest = z
  .object({ refreshToken: z.string().min(20) })
  .strict();

/** `POST /auth/register` creates the account and returns only its id — the
 *  caller then logs in. The hand-written spec described a full session here,
 *  which a generated client would have believed. */
export const registrationResponse = z.object({ accountId: uuid });

export const sessionResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresInSeconds: z.number().int().positive(),
  sessionId: uuid,
});

export const atelierSummary = z.object({
  id: uuid,
  name: z.string(),
  status: z.string(),
  membershipRole: z.string(),
});

export const meResponse = z.object({
  accountId: uuid,
  displayName: z.string().nullable(),
  role: accountRole,
  phone: z.string().nullable(),
  email: z.string().nullable(),
  ateliers: z.array(atelierSummary),
});

// ── Operations ────────────────────────────────────────────────────────────

export const createAtelierRequest = z
  .object({
    name: z.string().min(2).max(160),
    phone: z.string().min(9),
    address: z.string().max(500).optional(),
    /** Région administrative sénégalaise. Filtre de recherche à part entière :
     *  `address_text` est une chaîne libre, un `ILIKE` dessus confondrait
     *  « Dakar Couture » à Ziguinchor avec un atelier de Dakar. */
    region: z.string().max(80).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    specialties: z.array(z.string().min(1).max(80)).max(20).optional(),
    /**
     * Liens vers les réseaux du couturier (§2.2).
     *
     * Une chaîne vide vaut « retirer le lien » : l'écran d'édition envoie ce
     * que contient le champ, et forcer l'omission pour effacer obligerait
     * l'application à distinguer deux cas là où l'utilisateur n'en voit qu'un.
     */
    tiktokUrl: z.string().max(300).optional(),
    instagramUrl: z.string().max(300).optional(),
    facebookUrl: z.string().max(300).optional(),
  })
  .strict();

export const atelierResponse = z.object({
  id: uuid,
  name: z.string(),
  description: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  region: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  specialties: z.array(z.string()),
  tiktokUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  facebookUrl: z.string().nullable(),
  status: z.string(),
  membershipRole: z.string(),
  profileCompleteness: z.number().int(),
  version: z.number().int(),
});

/** `POST /operations/ateliers` returns the identity of the row it created, not
 *  the full atelier — the spec claimed the latter. */
export const createAtelierResponse = z.object({
  id: uuid,
  version: z.number().int(),
});

/**
 * Corrections to a published profile.
 *
 * Every field is optional and an omitted one is left untouched; the position is
 * the exception that has to be expressible as "clear it", so `latitude` and
 * `longitude` are nullable rather than merely absent.
 */
export const updateAtelierRequest = z
  .object({
    name: z.string().min(2).max(160).optional(),
    phone: z.string().min(9).optional(),
    address: z.string().max(500).optional(),
    region: z.string().max(80).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    specialties: z.array(z.string().min(1).max(80)).max(20).optional(),
    /**
     * Liens vers les réseaux du couturier (§2.2).
     *
     * Une chaîne vide vaut « retirer le lien » : l'écran d'édition envoie ce
     * que contient le champ, et forcer l'omission pour effacer obligerait
     * l'application à distinguer deux cas là où l'utilisateur n'en voit qu'un.
     */
    tiktokUrl: z.string().max(300).optional(),
    instagramUrl: z.string().max(300).optional(),
    facebookUrl: z.string().max(300).optional(),
  })
  .strict();

/**
 * Ce qu'une image téléversée devient sur la fiche publique.
 *
 * Envoyé en champ de formulaire multipart à côté du fichier, donc validé ici
 * plutôt que lu tel quel : `kind` décide dans quelle colonne l'URL atterrit.
 */
export const mediaKind = z.enum(['logo', 'cover', 'portfolio']);

export const mediaResponse = z.object({
  id: uuid,
  kind: mediaKind,
  /** Chemin relatif servi par l'API, jamais une URL externe. */
  url: z.string(),
  contentType: z.string(),
  byteSize: z.number().int(),
});

/**
 * Submitting an atelier to the platform verification queue.
 *
 * `atelier_verifications.id_document_ref` is `NOT NULL` in the schema: the
 * platform reviews a named, checkable document, not a bare request.
 */
export const submitVerificationRequest = z
  .object({
    idDocumentRef: z.string().min(4).max(120),
    checklist: z.record(z.unknown()).optional(),
  })
  .strict();

export const submitVerificationResponse = z.object({
  verificationId: uuid,
  status: z.string(),
});

/** One client request as the receiving atelier sees it. */
export const atelierContact = z.object({
  id: uuid,
  channel: contactChannel,
  status: z.string(),
  createdAt: isoDateTime,
  completedAt: isoDateTime.nullable(),
  clientConfirmedAt: isoDateTime.nullable(),
  atelierConfirmedAt: isoDateTime.nullable(),
  clientAccountId: uuid.nullable(),
  clientName: z.string().nullable(),
  clientPhone: z.string().nullable(),
});

export const upsertClientRequest = z
  .object({
    id: uuid.optional(),
    version: z.number().int().positive().optional(),
    fullName: z.string().min(1).max(160),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    notes: z.string().max(5000).optional(),
  })
  .strict();

/**
 * One client shape for both the list and the write response.
 *
 * `POST` used to return a mapper that omitted `orderCount`, `totalSpentCfa`
 * and `lastOrderAt` while `GET` included them. The mobile client defaulted the
 * missing numbers to zero, so a client created through the API rendered
 * "0 commandes · 0 F" — a statement of fact the server had never made.
 */
export const clientResponse = z.object({
  id: uuid,
  fullName: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  version: z.number().int(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  orderCount: z.number().int(),
  totalSpentCfa: cfa,
  lastOrderAt: isoDateTime.nullable(),
});

export const orderItemRequest = z
  .object({
    garmentType: z.string().min(1).max(80),
    unitPriceCfa: cfa,
    beneficiaryId: uuid.optional(),
    measurementVersionId: uuid.optional(),
  })
  .strict();

export const createOrderRequest = z
  .object({
    clientId: uuid,
    reference: z.string().min(1).max(80),
    totalCfa: cfa,
    dueAt: isoDateTime.optional(),
    notes: z.string().max(5000).optional(),
    items: z.array(orderItemRequest).min(1),
  })
  .strict();

/**
 * Une commande vue depuis un autre atelier.
 *
 * Décision du commanditaire : l'activité des ateliers est partagée. Ce qui
 * traverse est délibérément amputé — ni client, ni téléphone, ni mesure, ni
 * montant, ni note. Le contraire exposerait le répertoire privé de chaque
 * atelier à tous les autres.
 */
export const sharedOrderResponse = z.object({
  id: uuid,
  reference: z.string(),
  status: orderStatus,
  dueAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  atelierId: uuid,
  atelierName: z.string(),
  atelierRegion: z.string().nullable(),
  garmentTypes: z.array(z.string()),
  itemCount: z.number().int(),
});

export const sharedOrderPage = z.object({
  items: z.array(sharedOrderResponse),
  limit: z.number().int(),
  offset: z.number().int(),
  hasMore: z.boolean(),
});

export const orderItemResponse = z.object({
  id: uuid,
  garmentType: z.string(),
  unitPriceCfa: cfa,
  beneficiaryId: uuid.nullable(),
  measurementVersionId: uuid.nullable(),
});

export const orderResponse = z.object({
  id: uuid,
  reference: z.string(),
  status: orderStatus,
  totalCfa: cfa,
  paidCfa: cfa,
  remainingCfa: cfa,
  dueAt: isoDateTime.nullable(),
  notes: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  version: z.number().int(),
  client: z.object({ id: uuid, fullName: z.string() }),
  items: z.array(orderItemResponse),
});

/** `POST .../orders` returns the created row's identity, not the whole order. */
export const createOrderResponse = z.object({
  id: uuid,
  version: z.number().int(),
});

export const updateOrderStatusRequest = z
  .object({ status: orderStatus })
  .strict();

/** `PATCH .../orders/:id/status` answers with the new state only. */
export const updateOrderStatusResponse = z.object({
  id: uuid,
  status: orderStatus,
  version: z.number().int().optional(),
});

export const recordPaymentRequest = z
  .object({
    amountCfa: z.number().int().positive(),
    method: paymentMethod,
    idempotencyKey: uuid,
    note: z.string().max(1000).optional(),
  })
  .strict();

export const paymentResponse = z.object({
  id: uuid,
  orderId: uuid,
  amountCfa: cfa,
  method: paymentMethod,
  note: z.string().nullable(),
  createdAt: isoDateTime,
});

export const upsertInventoryRequest = z
  .object({
    id: uuid.optional(),
    version: z.number().int().positive().optional(),
    kind: inventoryKind,
    name: z.string().min(1).max(160),
    quantity: z.number().nonnegative().max(1_000_000),
    unit: z.string().min(1).max(40),
    costCfa: cfa.optional(),
  })
  .strict();

export const inventoryResponse = z.object({
  id: uuid,
  kind: inventoryKind,
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  costCfa: cfa.nullable(),
  version: z.number().int(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

/**
 * The daily summary as `OperationsService.dashboard` actually returns it.
 *
 * The spec described seven other field names — `ordersInProgress`,
 * `clientCount`, `revenueCfa`, an `atelierId` echo — none of which the server
 * has ever sent. The Flutter client reads the real names, so the document was
 * the only thing that was wrong, and it was wrong in the way that matters: a
 * generated client would have rendered a dashboard of zeros.
 */
export const dashboardResponse = z.object({
  activeOrders: z.number().int(),
  readyOrders: z.number().int(),
  overdueOrders: z.number().int(),
  unpaidCfa: cfa,
  receivedTodayCfa: cfa,
  clientsCount: z.number().int(),
  lowStockCount: z.number().int(),
  nextDueAt: isoDateTime.nullable(),
});

export const orderListQuery = pageQuery.extend({
  status: orderStatus.optional(),
});

// The paginated envelopes the list endpoints return.
export const clientPage = page(clientResponse);
export const orderPage = page(orderResponse);
export const inventoryPage = page(inventoryResponse);
export const atelierContactPage = page(atelierContact);

// ── Marketplace ───────────────────────────────────────────────────────────

export const marketplaceSearchQuery = z.object({
  /**
   * Position facultative. Sans elle la recherche reste possible — par région,
   * par spécialité ou par nom — et les résultats n'annoncent simplement aucune
   * distance. Les rendre obligatoires forçait l'application à envoyer une
   * position inventée quand l'utilisateur n'en avait pas partagé.
   */
  latitude: z.coerce.number().finite().min(-90).max(90).optional(),
  longitude: z.coerce.number().finite().min(-180).max(180).optional(),
  q: z.string().max(160).optional(),
  region: z.string().max(80).optional(),
  specialty: z.string().max(80).optional(),
  /**
   * Facultatif : sans rayon, la recherche porte sur tout le pays.
   *
   * §2.1 traite la distance comme un filtre, aux côtés du type de vêtement et
   * de la note, et non comme une contrainte implicite. Un rayon par défaut
   * faisait mentir la recherche par nom — l'atelier existait, était vérifié, et
   * ne sortait pas parce qu'il était à 20 km.
   */
  radius: z.coerce.number().int().min(500).max(100_000).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Optional position for `GET /marketplace/ateliers/{id}`.
 *
 * Supplied, the profile carries `distanceMeters` like the list does; omitted,
 * the field is null and the screen says so instead of contradicting the card
 * the reader just tapped.
 */
export const atelierProfileQuery = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90).optional(),
  longitude: z.coerce.number().finite().min(-180).max(180).optional(),
});

export const portfolioItem = z.object({
  id: uuid,
  imageUrl: z.string(),
  title: z.string().nullable(),
  garmentType: z.string().nullable(),
});

/**
 * One shape for both `GET /marketplace/ateliers` and
 * `GET /marketplace/ateliers/:id`.
 *
 * The old spec declared a single `PublicAtelier` for both, including `phone`
 * and `whatsapp` — but the list query never selected them, so the documented
 * field was always null there. The client saved favourites straight from list
 * cards and therefore stored a null phone every time. Both queries select them
 * now, which is what makes this single schema honest.
 */
export const publicAtelier = z.object({
  id: uuid,
  name: z.string(),
  description: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  address: z.string().nullable(),
  /** Région administrative déclarée. Filtre de recherche et repère de fiche. */
  region: z.string().nullable(),
  openingHours: z.record(z.unknown()),
  supportedLanguages: z.array(z.string()),
  logoUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
  /** §2.2 : les réalisations d'un couturier vivent surtout sur ses réseaux. */
  tiktokUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  facebookUrl: z.string().nullable(),
  specialties: z.array(z.string()),
  responseTimeMinutes: z.number().int().nullable(),
  profileCompleteness: z.number().int(),
  acceptsNewClients: z.boolean(),
  nextAvailableAt: isoDateTime.nullable(),
  distanceMeters: z.number().int().nullable(),
  /** Zone declaree, pour la carte (§2.1). */
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  rating: z.number(),
  reviewCount: z.number().int(),
  portfolio: z.array(portfolioItem),
});

/**
 * Le classement (§2.4) : general par defaut, par zone si un point et un rayon
 * sont fournis.
 */
export const rankingQuery = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90).optional(),
  longitude: z.coerce.number().finite().min(-180).max(180).optional(),
  radius: z.coerce.number().int().min(500).max(100_000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const rankedAtelier = z.object({
  id: uuid,
  rank: z.number().int(),
  name: z.string(),
  address: z.string().nullable(),
  logoUrl: z.string().nullable(),
  specialties: z.array(z.string()),
  acceptsNewClients: z.boolean(),
  rating: z.number(),
  reviewCount: z.number().int(),
  /** Moyenne ponderee par le nombre d'avis : c'est elle qui ordonne. */
  score: z.number(),
  distanceMeters: z.number().int().nullable(),
});

/**
 * Une mise en avant sur l'accueil client.
 *
 * L'accueil ne montrait que des résultats de recherche ; il n'existait aucun
 * emplacement éditorial, et donc aucun moyen d'annoncer quoi que ce soit sans
 * publier une version de l'application.
 */
export const promotion = z.object({
  id: uuid,
  title: z.string(),
  subtitle: z.string().nullable(),
  imageUrl: z.string(),
  atelierId: uuid.nullable(),
});

export const createPromotionRequest = z
  .object({
    title: z.string().min(2).max(120),
    subtitle: z.string().max(240).optional(),
    imageUrl: z.string().min(1).max(500),
    atelierId: uuid.optional(),
    startsAt: isoDateTime.optional(),
    endsAt: isoDateTime.optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
  })
  .strict();

export const adminPromotion = promotion.extend({
  startsAt: isoDateTime.nullable(),
  endsAt: isoDateTime.nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  createdAt: isoDateTime,
});

export const createContactRequest = z
  .object({ channel: contactChannel })
  .strict();

export const confirmContactRequest = z
  .object({ status: contactStatus })
  .strict();

/**
 * The client's own contact history.
 *
 * The documented shape stopped at `hasReview` while the query has always also
 * selected the two confirmation timestamps and the atelier's contact details.
 * `clientConfirmedAt` is not cosmetic: it is the field the app reads to decide
 * whether the "J'ai été servi" action is still open, so a client generated from
 * the old document could not have implemented confirmation at all.
 */
export const contactEvent = z.object({
  id: uuid,
  atelierId: uuid,
  atelierName: z.string().nullable(),
  atelierLogoUrl: z.string().nullable(),
  atelierCoverUrl: z.string().nullable(),
  atelierPhone: z.string().nullable(),
  atelierWhatsapp: z.string().nullable(),
  atelierAddress: z.string().nullable(),
  channel: contactChannel,
  status: z.string(),
  createdAt: isoDateTime,
  completedAt: isoDateTime.nullable(),
  clientConfirmedAt: isoDateTime.nullable(),
  atelierConfirmedAt: isoDateTime.nullable(),
  hasReview: z.boolean(),
});

/** `POST /marketplace/ateliers/:id/contacts` answers with the new row's id. */
export const createContactResponse = z.object({ contactId: uuid });

/** `POST /marketplace/contacts/:id/confirm` answers with the resulting state. */
export const confirmContactResponse = z.object({
  id: uuid,
  status: z.string(),
});

// A review comes from one of two paths: `contactId` after a bilateral-confirmed
// completed service ('service'), or `atelierId` from a client who visited the
// profile and confirmed they know the place ('visit') — see migration 0009.
// Exactly one of the two must be present.
export const createReviewRequest = z
  .object({
    contactId: uuid.optional(),
    atelierId: uuid.optional(),
    rating: z.number().int().min(1).max(5),
    body: z.string().max(200).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.contactId) !== Boolean(value.atelierId), {
    message: 'Provide exactly one of contactId or atelierId',
  });

export const createReviewResponse = z.object({
  reviewId: uuid.optional(),
  status: z.string(),
});

// ── Sync ──────────────────────────────────────────────────────────────────

export const syncEntityType = z.enum(['client', 'inventory_item']);
export const syncMutation = z.enum(['upsert', 'delete']);

const baseSyncOperation = z.object({
  operationId: uuid,
  entityId: uuid,
  baseVersion: z.number().int().nonnegative(),
  operation: syncMutation.default('upsert'),
});

export const clientSyncOperation = baseSyncOperation
  .extend({
    entityType: z.literal('client'),
    payload: z
      .object({
        fullName: z.string().min(1).max(160),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        notes: z.string().max(5000).optional(),
      })
      .strict(),
  })
  .strict();

export const inventorySyncOperation = baseSyncOperation
  .extend({
    entityType: z.literal('inventory_item'),
    payload: z
      .object({
        kind: inventoryKind,
        name: z.string().min(1).max(160),
        quantity: z.number().nonnegative().max(1_000_000),
        unit: z.string().min(1).max(40),
        costCfa: cfa.optional(),
      })
      .strict(),
  })
  .strict();

export const syncPushRequest = z
  .object({
    deviceId: uuid,
    operations: z
      .array(
        z.discriminatedUnion('entityType', [
          clientSyncOperation,
          inventorySyncOperation,
        ]),
      )
      .min(1)
      .max(100),
  })
  .strict();

/**
 * One push result, as `SyncService` builds it.
 *
 * The spec declared a `duplicate`/`rejected` status the server never emits and
 * a `reason` field it never sets, while omitting `entityType`, the applied
 * `entity`, the conflict `code`, the server's `current` copy of a conflicting
 * row and the `replayed` marker — that is, every field a client needs in order
 * to resolve a conflict. Replay is signalled by `replayed`, not by a status.
 */
export const syncPushResult = z.object({
  operationId: uuid,
  entityType: syncEntityType,
  entityId: uuid,
  status: z.enum(['applied', 'conflict']),
  version: z.number().int().optional(),
  entity: z.record(z.unknown()).optional(),
  code: z.string().optional(),
  current: z.record(z.unknown()).nullable().optional(),
  replayed: z.boolean().optional(),
});

export const syncPushResponse = z.object({
  results: z.array(syncPushResult),
});

export const syncPullQuery = z.object({
  deviceId: uuid,
  after: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const syncChange = z.object({
  sequence: z.number().int(),
  entityType: syncEntityType,
  entityId: uuid,
  operation: syncMutation,
  version: z.number().int(),
  payload: z.record(z.unknown()),
  occurredAt: isoDateTime,
});

export const syncPullResponse = z.object({
  changes: z.array(syncChange),
  cursor: z.number().int(),
  // Sent on every pull and undocumented: a caller that stops at the first page
  // because the spec never told it there were more silently loses changes.
  hasMore: z.boolean(),
});

// ── Admin ─────────────────────────────────────────────────────────────────

export const verificationDecisionRequest = z
  .object({ approved: z.boolean(), reason: z.string().max(1000).optional() })
  .strict();

export const reviewModerationRequest = z
  .object({ status: reviewStatus, reason: z.string().max(1000).optional() })
  .strict();

/** A review awaiting a moderation decision, with the context needed to make it. */
export const reviewSource = z.enum(['service', 'visit']);

export const pendingReview = z.object({
  id: uuid,
  rating: z.number().int(),
  body: z.string().nullable(),
  // 'service' comes from a bilateral-confirmed completed contact; 'visit'
  // just from the client having opened the atelier's profile and answered
  // that they know the place. No confirmed transaction behind the second
  // kind — moderators should weigh the two differently.
  source: reviewSource,
  submitted_at: isoDateTime,
  atelier_id: uuid,
  atelier_name: z.string(),
  author_name: z.string().nullable(),
});

/**
 * A row of the verification queue.
 *
 * `AdminService.pendingAteliers` selects `a.*` joined to the verification, so
 * the wire shape is the atelier's own snake_case columns plus three fields from
 * `atelier_verifications`. The spec invented a camelCase four-field object that
 * shares only `id` and `name` with what is actually sent — and the back-office,
 * which reads `verification_id`, `phone_e164`, `checklist` and `submitted_at`,
 * is the proof of which of the two was right.
 */
export const pendingAtelier = z
  .object({
    id: uuid,
    verification_id: uuid,
    name: z.string(),
    phone_e164: z.string(),
    address_text: z.string().nullable(),
    status: z.string(),
    specialties: z.array(z.string()),
    /** The document the reviewer is asked to check. */
    id_document_ref: z.string(),
    phone_verified_at: isoDateTime.nullable(),
    checklist: z.record(z.unknown()),
    submitted_at: isoDateTime,
    created_at: isoDateTime,
  })
  .passthrough();

// ── Errors ────────────────────────────────────────────────────────────────

/** RFC 7807, matching `ProblemDetailsFilter`. */
export const problemDetails = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  requestId: z.string().optional(),
  fieldErrors: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
});

// ── Health ────────────────────────────────────────────────────────────────

export const healthResponse = z.object({ status: z.string() });
export const readinessResponse = z.object({
  status: z.string(),
  database: z.string().optional(),
});
