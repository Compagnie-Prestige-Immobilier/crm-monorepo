import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthClaims } from '../auth/auth.types';

@Injectable()
export class MarketplaceService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Recherche d'ateliers.
   *
   * `radiusMeters` est facultatif, et c'est le point important : §2.1 distingue
   * deux gestes. Le fil d'accueil montre « les couturiers les plus proches »,
   * donc un rayon ; la barre de recherche cherche « par nom, spécialité ou
   * quartier », et la distance y est un *filtre* que l'on choisit, listé aux
   * côtés du type de vêtement et de la note.
   *
   * Filtrer systématiquement sur un rayon rendait la recherche par nom
   * mensongère : taper le nom exact d'un atelier situé à 20 km ne renvoyait
   * rien, sans jamais dire que la distance était en cause.
   *
   * Les coordonnées sont facultatives. Elles servent à afficher et à ordonner
   * par distance ; les exiger rendait impossible la seule recherche qu'un
   * client sans GPS puisse faire — « les ateliers de ma région » — et forçait
   * l'application à inventer une position, en pratique le centre de Dakar pour
   * tout le pays.
   */
  async search(input: {
    latitude?: number | null;
    longitude?: number | null;
    radiusMeters?: number | null;
    query?: string;
    region?: string;
    specialty?: string;
    limit: number;
    offset: number;
  }) {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT
         a.id,
         a.name,
         a.description,
         -- Selected here as well as in the profile query. Omitting them made
         -- the list and the detail response two different shapes behind one
         -- documented schema, and the client saves a favourite straight from a
         -- list card, so every favourite created from search stored a null
         -- phone and lost its only way to call the atelier back.
         a.phone_e164 AS "phone",
         a.whatsapp_e164 AS "whatsapp",
         a.address_text AS "address",
         a.region AS "region",
         a.opening_hours AS "openingHours",
         a.supported_languages AS "supportedLanguages",
         a.logo_url AS "logoUrl",
         a.cover_url AS "coverUrl",
         -- Le savoir-faire d'un couturier vit sur ses reseaux (§2.2) : sans ces
         -- liens la fiche ne montre que ce qui a ete televerse ici.
         a.tiktok_url AS "tiktokUrl",
         a.instagram_url AS "instagramUrl",
         a.facebook_url AS "facebookUrl",
         -- Necessaires a la carte (§2.1). C'est la zone declaree par
         -- l'atelier, pas un releve GPS : location_precision_m dit deja que le
         -- point est approximatif, et le couturier choisit un quartier.
         ST_Y(a.location::geometry) AS latitude,
         ST_X(a.location::geometry) AS longitude,
         a.specialties,
         a.response_time_minutes AS "responseTimeMinutes",
         a.profile_completeness AS "profileCompleteness",
         a.accepts_new_clients AS "acceptsNewClients",
         a.next_available_at AS "nextAvailableAt",
         COALESCE(
           (
             SELECT jsonb_agg(
               jsonb_build_object(
                 'id', preview.id,
                 'imageUrl', preview.image_url,
                 'title', preview.title,
                 'garmentType', preview.garment_type
               )
               ORDER BY preview.sort_order, preview.created_at DESC
             )
             FROM (
               SELECT p.id, p.image_url, p.title, p.garment_type,
                      p.sort_order, p.created_at
               FROM atelier_portfolio_items p
               WHERE p.atelier_id=a.id AND p.is_published=true
               ORDER BY p.sort_order, p.created_at DESC
               LIMIT 3
             ) preview
           ),
           '[]'::jsonb
         ) AS portfolio,
         ST_Distance(
           a.location,
           ST_SetSRID(ST_MakePoint($1::float8,$2::float8),4326)::geography
         )::integer AS "distanceMeters",
         COALESCE(
           (SELECT AVG(r.rating)
              FROM reviews r
             WHERE r.atelier_id=a.id AND r.status='published'),
           0
         )::numeric(3,2) AS rating,
         (SELECT COUNT(*)::integer
            FROM reviews r
           WHERE r.atelier_id=a.id AND r.status='published') AS "reviewCount"
       FROM ateliers a
       WHERE a.status='verified'
         AND a.location IS NOT NULL
         AND (
           $3::numeric IS NULL
           OR ST_DWithin(
             a.location,
             ST_SetSRID(ST_MakePoint($1::float8,$2::float8),4326)::geography,
             $3
           )
         )
         AND (
           $4::text IS NULL
           OR a.search_document @@ websearch_to_tsquery('french', $4)
           -- Trigram fallback (0008): catches typos and partial names that
           -- stemmed full-text matching above misses (e.g. "Awa" for
           -- "Atelier Awa Couture", or "coutrier" for "couturier"). Uses
           -- word_similarity (the <% operator) rather than plain similarity
           -- (%): an atelier name is several words long, and similarity(x,y)
           -- scores against the whole string, so a short query never scores
           -- highly even on an exact word match. word_similarity compares the
           -- query against the best-matching word/phrase within the name.
           OR $4 <% a.name
         )
         -- Filtres explicites (§2.1) : la région est une valeur, pas une
         -- sous-chaîne d'adresse, et la spécialité est cherchée dans le
         -- tableau plutôt que dans le document plein texte, où « homme »
         -- remonterait aussi « tenue homme » écrit dans une description.
         AND ($7::text IS NULL OR a.region = $7)
         AND ($8::text IS NULL OR a.specialties @> ARRAY[$8]::text[])
       ORDER BY
         a.accepts_new_clients DESC,
         ST_Distance(a.location, ST_SetSRID(ST_MakePoint($1::float8,$2::float8),4326)::geography),
         -- Text relevance only breaks ties within the same distance/capacity
         -- bucket above — it never overrides "closer" or "accepting clients",
         -- it just orders typo/partial matches sensibly among themselves.
         CASE
           WHEN $4::text IS NULL THEN 0
           ELSE GREATEST(
             ts_rank(a.search_document, websearch_to_tsquery('french', $4)),
             word_similarity($4, a.name)
           )
         END DESC,
         rating DESC,
         "reviewCount" DESC,
         a.name ASC
       LIMIT $5 OFFSET $6`,
      [
        input.longitude ?? null,
        input.latitude ?? null,
        input.radiusMeters ?? null,
        input.query?.trim() || null,
        input.limit,
        input.offset,
        input.region?.trim() || null,
        input.specialty?.trim() || null,
      ],
    );
    return rows.map((row) => this.mapAtelier(row));
  }

  /**
   * One atelier's public profile.
   *
   * Takes the caller's position when it has one. Without it the detail screen
   * printed "Distance indisponible" directly under a result card that had just
   * said "951 m" — the same atelier, two answers, because only the list query
   * computed `ST_Distance` and the profile query had no point to measure from.
   * Coordinates stay optional: the profile opens from favourites and from the
   * activity history too, where there is no search origin to pass.
   */
  async profile(
    atelierId: string,
    origin?: { latitude: number; longitude: number },
  ) {
    const row = await this.db.one(
      `SELECT
         a.id,
         a.name,
         a.description,
         a.phone_e164 AS "phone",
         a.whatsapp_e164 AS "whatsapp",
         a.address_text AS "address",
         a.region AS "region",
         a.opening_hours AS "openingHours",
         a.supported_languages AS "supportedLanguages",
         a.logo_url AS "logoUrl",
         a.cover_url AS "coverUrl",
         -- Le savoir-faire d'un couturier vit sur ses reseaux (§2.2) : sans ces
         -- liens la fiche ne montre que ce qui a ete televerse ici.
         a.tiktok_url AS "tiktokUrl",
         a.instagram_url AS "instagramUrl",
         a.facebook_url AS "facebookUrl",
         -- Necessaires a la carte (§2.1). C'est la zone declaree par
         -- l'atelier, pas un releve GPS : location_precision_m dit deja que le
         -- point est approximatif, et le couturier choisit un quartier.
         ST_Y(a.location::geometry) AS latitude,
         ST_X(a.location::geometry) AS longitude,
         a.specialties,
         a.response_time_minutes AS "responseTimeMinutes",
         a.profile_completeness AS "profileCompleteness",
         a.accepts_new_clients AS "acceptsNewClients",
         a.next_available_at AS "nextAvailableAt",
         CASE
           WHEN $2::numeric IS NULL OR a.location IS NULL THEN NULL
           ELSE ST_Distance(
             a.location,
             ST_SetSRID(ST_MakePoint($3,$2),4326)::geography
           )::integer
         END AS "distanceMeters",
         COALESCE(AVG(r.rating) FILTER (WHERE r.status='published'),0)::numeric(3,2) AS rating,
         COUNT(r.id) FILTER (WHERE r.status='published')::integer AS "reviewCount",
         COALESCE(
           (
             SELECT jsonb_agg(
               jsonb_build_object(
                 'id', p.id,
                 'imageUrl', p.image_url,
                 'title', p.title,
                 'garmentType', p.garment_type
               )
               ORDER BY p.sort_order, p.created_at DESC
             )
             FROM atelier_portfolio_items p
             WHERE p.atelier_id=a.id AND p.is_published=true
           ),
           '[]'::jsonb
         ) AS portfolio
       FROM ateliers a
       LEFT JOIN reviews r ON r.atelier_id=a.id
       WHERE a.id=$1 AND a.status='verified'
       GROUP BY a.id`,
      [atelierId, origin?.latitude ?? null, origin?.longitude ?? null],
    );
    if (!row) throw new NotFoundException('Atelier not found');
    return this.mapAtelier(row);
  }

  /**
   * Les mises en avant de l'accueil client.
   *
   * Public : c'est le contenu éditorial de la page d'accueil, pas une donnée de
   * compte. Seules les lignes actives et dans leur fenêtre de diffusion
   * sortent, pour qu'une annonce périmée disparaisse sans intervention.
   */
  async promotions() {
    const rows = await this.db.query<{
      id: string;
      title: string;
      subtitle: string | null;
      image_url: string;
      atelier_id: string | null;
    }>(
      `SELECT id,title,subtitle,image_url,atelier_id
         FROM promotions
        WHERE is_active = true
          AND (starts_at IS NULL OR starts_at <= now())
          AND (ends_at IS NULL OR ends_at > now())
        ORDER BY sort_order ASC, created_at DESC
        LIMIT 10`,
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      imageUrl: row.image_url,
      atelierId: row.atelier_id,
    }));
  }

  /**
   * Le classement des couturiers (§2.4).
   *
   * « Classement général et classement par zone géographique » : la même
   * requête sert les deux, la zone n'étant qu'un rayon autour d'un point.
   *
   * L'ordre n'est pas la note brute. Un atelier noté 5,0 sur un seul avis
   * passerait devant un atelier noté 4,7 sur quarante, ce qui récompense
   * l'absence de recul plutôt que le travail. La moyenne est donc pondérée par
   * le nombre d'avis (moyenne bayésienne) : un atelier peu noté est tiré vers
   * la moyenne générale et remonte à mesure qu'il accumule des avis réels.
   * `PRIOR_WEIGHT` est le nombre d'avis à partir duquel la note propre pèse
   * autant que la moyenne générale.
   *
   * Seuls les avis publiés comptent, comme partout ailleurs.
   */
  async ranking(input: {
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    limit: number;
    offset: number;
  }) {
    const scoped =
      input.latitude != null &&
      input.longitude != null &&
      input.radiusMeters != null;

    const rows = await this.db.query<Record<string, unknown>>(
      `WITH published AS (
         SELECT atelier_id, rating
         FROM reviews
         WHERE status='published'
       ),
       overall AS (
         SELECT COALESCE(AVG(rating), 0)::numeric(4,3) AS mean FROM published
       ),
       scored AS (
         SELECT
           a.id,
           a.name,
           a.address_text AS "address",
           a.logo_url AS "logoUrl",
           a.specialties,
           a.accepts_new_clients AS "acceptsNewClients",
           COUNT(p.rating)::integer AS "reviewCount",
           COALESCE(AVG(p.rating), 0)::numeric(3,2) AS rating,
           -- Moyenne bayesienne : (v*R + m*C) / (v + m).
           (
             (COUNT(p.rating) * COALESCE(AVG(p.rating), 0)
              + $1::numeric * (SELECT mean FROM overall))
             / (COUNT(p.rating) + $1::numeric)
           )::numeric(4,3) AS score,
           CASE
             WHEN $2::numeric IS NULL THEN NULL
             ELSE ST_Distance(
               a.location,
               ST_SetSRID(ST_MakePoint($3,$2),4326)::geography
             )::integer
           END AS "distanceMeters"
         FROM ateliers a
         LEFT JOIN published p ON p.atelier_id=a.id
         WHERE a.status='verified'
           AND a.location IS NOT NULL
           AND (
             $4::numeric IS NULL
             OR ST_DWithin(
               a.location,
               ST_SetSRID(ST_MakePoint($3,$2),4326)::geography,
               $4
             )
           )
         GROUP BY a.id
       )
       SELECT *, ROW_NUMBER() OVER (ORDER BY score DESC, "reviewCount" DESC, name ASC)::integer AS rank
       FROM scored
       ORDER BY rank
       LIMIT $5 OFFSET $6`,
      [
        MarketplaceService.rankingPriorWeight,
        scoped ? input.latitude : null,
        scoped ? input.longitude : null,
        scoped ? input.radiusMeters : null,
        input.limit,
        input.offset,
      ],
    );

    return rows.map((row) => ({
      ...row,
      rank: Number(row.rank),
      rating: Number(row.rating ?? 0),
      score: Number(row.score ?? 0),
      reviewCount: Number(row.reviewCount ?? 0),
      distanceMeters:
        row.distanceMeters == null ? null : Number(row.distanceMeters),
    }));
  }

  /** Nombre d'avis à partir duquel la note propre pèse autant que la moyenne
   *  générale. Bas, parce qu'un marché naissant a peu d'avis par atelier. */
  private static readonly rankingPriorWeight = 5;

  async listContacts(
    user: AuthClaims,
    page: { limit: number; offset: number },
  ) {
    if (user.role !== 'client') {
      throw new ForbiddenException('Client account required');
    }

    return this.db.query<Record<string, unknown>>(
      `SELECT
         c.id,
         c.channel,
         c.status,
         c.created_at AS "createdAt",
         c.completed_at AS "completedAt",
         c.client_confirmed_at AS "clientConfirmedAt",
         c.atelier_confirmed_at AS "atelierConfirmedAt",
         a.id AS "atelierId",
         a.name AS "atelierName",
         a.logo_url AS "atelierLogoUrl",
         a.cover_url AS "atelierCoverUrl",
         a.phone_e164 AS "atelierPhone",
         a.whatsapp_e164 AS "atelierWhatsapp",
         a.address_text AS "atelierAddress",
         EXISTS (
           SELECT 1 FROM reviews r WHERE r.contact_event_id=c.id
         ) AS "hasReview"
       FROM contact_events c
       JOIN ateliers a ON a.id=c.atelier_id
       WHERE c.client_account_id=$1
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.sub, page.limit, page.offset],
    );
  }

  async createContact(
    atelierId: string,
    user: AuthClaims,
    channel: 'phone' | 'whatsapp' | 'sms' | 'appointment',
  ) {
    if (user.role !== 'client') {
      throw new ForbiddenException('Client account required');
    }
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO contact_events (atelier_id,client_account_id,channel)
       SELECT id,$2,$3 FROM ateliers
       WHERE id=$1 AND status='verified' AND accepts_new_clients=true
       RETURNING id`,
      [atelierId, user.sub, channel],
    );
    if (!row) throw new NotFoundException('Atelier not found or unavailable');
    return { contactId: row.id };
  }

  async confirmContact(
    contactId: string,
    user: AuthClaims,
    status: 'accepted' | 'completed' | 'disputed',
  ) {
    if (
      user.role !== 'client' &&
      user.role !== 'atelier_owner' &&
      user.role !== 'atelier_manager'
    ) {
      throw new ForbiddenException('Client or atelier account required');
    }
    const actorCondition =
      user.role === 'client'
        ? 'c.client_account_id=$2'
        : '(a.owner_account_id=$2 OR EXISTS (SELECT 1 FROM atelier_memberships m WHERE m.atelier_id=a.id AND m.account_id=$2))';
    const row = await this.db.one<{ id: string }>(
      `UPDATE contact_events c SET
         client_confirmed_at=CASE WHEN $3='client' THEN COALESCE(c.client_confirmed_at, now()) ELSE c.client_confirmed_at END,
         atelier_confirmed_at=CASE WHEN $3<>'client' THEN COALESCE(c.atelier_confirmed_at, now()) ELSE c.atelier_confirmed_at END,
         status=CASE
           WHEN $4='disputed' THEN 'disputed'::contact_status
           WHEN $4='completed' AND (c.client_confirmed_at IS NOT NULL OR $3='client')
             AND (c.atelier_confirmed_at IS NOT NULL OR $3<>'client') THEN 'completed'::contact_status
           WHEN $4='accepted' THEN 'accepted'::contact_status
           ELSE c.status
         END,
         completed_at=CASE
           WHEN $4='completed' AND (c.client_confirmed_at IS NOT NULL OR $3='client')
             AND (c.atelier_confirmed_at IS NOT NULL OR $3<>'client') THEN COALESCE(c.completed_at, now())
           ELSE c.completed_at
         END
       FROM ateliers a
       WHERE c.id=$1 AND a.id=c.atelier_id AND ${actorCondition}
       -- Qualified. Both contact_events and ateliers carry a "status", so the
       -- bare name was ambiguous and every call to this endpoint failed with
       -- a 500 — which is why no contact could ever reach 'completed', and so
       -- why no review could ever be written.
       RETURNING c.id, c.status`,
      [contactId, user.sub, user.role, status],
    );
    if (!row) throw new NotFoundException('Contact not found or not owned');
    return row;
  }

  async createReview(input: {
    contactId?: string;
    atelierId?: string;
    authorAccountId: string;
    rating: number;
    body?: string;
  }) {
    if (input.contactId) {
      return this.createServiceReview(
        input.contactId,
        input.authorAccountId,
        input.rating,
        input.body,
      );
    }
    return this.createVisitReview(
      input.atelierId!,
      input.authorAccountId,
      input.rating,
      input.body,
    );
  }

  private async createServiceReview(
    contactId: string,
    authorAccountId: string,
    rating: number,
    body?: string,
  ) {
    const contact = await this.db.one<{ atelier_id: string }>(
      `SELECT atelier_id
         FROM contact_events
        WHERE id=$1 AND client_account_id=$2 AND status='completed'`,
      [contactId, authorAccountId],
    );
    if (!contact) throw new NotFoundException('Completed service not found');
    // One review per contact is a unique constraint on `contact_event_id`.
    // Reaching it raised 23505 and surfaced as a 500 — "le service rencontre un
    // problème temporaire", advising a retry that could only fail again — for
    // a client who had simply already left their review. Checked here so the
    // message names what happened; the constraint remains the real guarantee,
    // and `ProblemDetailsFilter` still answers 409 if two taps race.
    const existing = await this.db.one<{ id: string }>(
      'SELECT id FROM reviews WHERE contact_event_id=$1',
      [contactId],
    );
    if (existing) {
      throw new ConflictException('A review has already been left for this service');
    }
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO reviews
         (atelier_id,contact_event_id,author_account_id,rating,body,status,source)
       VALUES ($1,$2,$3,$4,$5,'pending','service')
       RETURNING id`,
      [contact.atelier_id, contactId, authorAccountId, rating, body ?? null],
    );
    return { reviewId: row?.id, status: 'pending' };
  }

  /**
   * The lighter path (§ product decision, migration 0009): a client rates an
   * atelier just from having visited its profile, no confirmed service
   * required. Checked proactively like the service path above, against the
   * partial unique index on (atelier_id, author_account_id) WHERE
   * source='visit' — one visit-review per client per atelier.
   */
  private async createVisitReview(
    atelierId: string,
    authorAccountId: string,
    rating: number,
    body?: string,
  ) {
    const atelier = await this.db.one<{ id: string }>(
      `SELECT id FROM ateliers WHERE id=$1 AND status='verified'`,
      [atelierId],
    );
    if (!atelier) throw new NotFoundException('Atelier not found');
    const existing = await this.db.one<{ id: string }>(
      `SELECT id FROM reviews WHERE atelier_id=$1 AND author_account_id=$2 AND source='visit'`,
      [atelierId, authorAccountId],
    );
    if (existing) {
      throw new ConflictException('A review has already been left for this atelier');
    }
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO reviews
         (atelier_id,author_account_id,rating,body,status,source)
       VALUES ($1,$2,$3,$4,'pending','visit')
       RETURNING id`,
      [atelierId, authorAccountId, rating, body ?? null],
    );
    return { reviewId: row?.id, status: 'pending' };
  }

  private mapAtelier(row: Record<string, unknown>) {
    return {
      ...row,
      rating: Number(row.rating ?? 0),
      reviewCount: Number(row.reviewCount ?? 0),
      distanceMeters: row.distanceMeters == null ? null : Number(row.distanceMeters),
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
      responseTimeMinutes: row.responseTimeMinutes == null ? null : Number(row.responseTimeMinutes),
      profileCompleteness: Number(row.profileCompleteness ?? 0),
    };
  }

}
