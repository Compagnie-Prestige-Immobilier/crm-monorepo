import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthClaims } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}
  private admin(user: AuthClaims): void { if (user.role !== 'platform_admin') throw new ForbiddenException('Platform administrator required'); }
  /**
   * The verification queue.
   *
   * `id_document_ref` is selected because it is the thing being verified: the
   * reviewer's job is to check a named identity or trade-register document
   * against the declared atelier. The query returned the checklist and the
   * submission date but not the document number, so the back-office asked for
   * a decision while withholding the only evidence the decision rests on.
   */
  async pendingAteliers(user: AuthClaims) {
    this.admin(user);
    return this.db.query(
      `SELECT
         a.*,
         v.id AS verification_id,
         v.id_document_ref,
         v.phone_verified_at,
         v.checklist,
         v.created_at AS submitted_at
       FROM ateliers a
       JOIN atelier_verifications v ON v.atelier_id=a.id
       WHERE v.decision='pending'
       ORDER BY v.created_at ASC`,
    );
  }
  /**
   * Les mises en avant, actives ou non.
   *
   * Séparé de la lecture publique : celle-ci ne renvoie que ce qui est en
   * cours de diffusion, et un administrateur doit voir aussi ce qui est
   * archivé ou programmé pour comprendre l'état de la page d'accueil.
   */
  async promotions(user: AuthClaims) {
    this.admin(user);
    const rows = await this.db.query<{
      id: string;
      title: string;
      subtitle: string | null;
      image_url: string;
      atelier_id: string | null;
      starts_at: Date | null;
      ends_at: Date | null;
      sort_order: number;
      is_active: boolean;
      created_at: Date;
    }>(
      `SELECT id,title,subtitle,image_url,atelier_id,starts_at,ends_at,
              sort_order,is_active,created_at
         FROM promotions
        ORDER BY is_active DESC, sort_order ASC, created_at DESC
        LIMIT 100`,
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      imageUrl: row.image_url,
      atelierId: row.atelier_id,
      startsAt: row.starts_at?.toISOString() ?? null,
      endsAt: row.ends_at?.toISOString() ?? null,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async createPromotion(
    user: AuthClaims,
    input: {
      title: string;
      subtitle?: string;
      imageUrl: string;
      atelierId?: string;
      startsAt?: string;
      endsAt?: string;
      sortOrder?: number;
    },
  ) {
    this.admin(user);
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO promotions
         (title,subtitle,image_url,atelier_id,starts_at,ends_at,sort_order,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        input.title,
        input.subtitle ?? null,
        input.imageUrl,
        input.atelierId ?? null,
        input.startsAt ?? null,
        input.endsAt ?? null,
        input.sortOrder ?? 0,
        user.sub,
      ],
    );
    if (!row) throw new Error('Promotion insert failed');
    return { id: row.id };
  }

  /** Retire une mise en avant de l'accueil sans détruire la ligne. */
  async archivePromotion(user: AuthClaims, promotionId: string) {
    this.admin(user);
    const row = await this.db.one<{ id: string }>(
      'UPDATE promotions SET is_active=false, updated_at=now() WHERE id=$1 RETURNING id',
      [promotionId],
    );
    if (!row) throw new NotFoundException('Promotion not found');
    return { id: row.id, isActive: false };
  }

  async decideVerification(user: AuthClaims, verificationId: string, approved: boolean, reason?: string) {
    this.admin(user);
    return this.db.transaction(async (client) => {
      const verification = await client.query<{ atelier_id: string }>('SELECT atelier_id FROM atelier_verifications WHERE id=$1 AND decision=\'pending\' FOR UPDATE', [verificationId]);
      const row = verification.rows[0];
      if (!row) throw new NotFoundException('Pending verification not found');
      const decision = approved ? 'approved' : 'rejected';
      await client.query('UPDATE atelier_verifications SET decision=$2,reason=$3,reviewer_account_id=$4,decided_at=now() WHERE id=$1', [verificationId,decision,reason ?? null,user.sub]);
      // `approved` is its own parameter, and the status is cast explicitly.
      // The previous form used $2 twice — once assigned to an `atelier_status`
      // column and once compared to a text literal — so Postgres deduced two
      // different types for one parameter and refused the statement outright
      // with "inconsistent types deduced for parameter $2". Every approval and
      // every rejection failed with a 500, which is why an atelier could not be
      // verified even once its dossier reached the queue.
      await client.query(
        `UPDATE ateliers SET
           status=$2::atelier_status,
           verified_at=CASE WHEN $3 THEN now() ELSE NULL END
         WHERE id=$1`,
        [row.atelier_id, approved ? 'verified' : 'rejected', approved],
      );
      await client.query(`INSERT INTO audit_events (actor_account_id,atelier_id,action,target_type,target_id,metadata) VALUES ($1,$2,'verification.${decision}','atelier_verification',$3,$4)`, [user.sub,row.atelier_id,verificationId,JSON.stringify({ reason: reason ?? null })]);
      return { atelierId: row.atelier_id, decision };
    });
  }
  /**
   * Reviews waiting on a moderation decision.
   *
   * `POST /marketplace/reviews` writes every review at `'pending'`, and the
   * marketplace averages and counts `'published'` ones only. Moderation existed
   * as an endpoint but nothing listed what there was to moderate, so a review a
   * client took the trouble to write went into the table and stayed invisible
   * to everyone including the moderator — and no rating in the app could ever
   * have come from a real client.
   */
  async pendingReviews(user: AuthClaims, page: { limit: number; offset: number }) {
    this.admin(user);
    return this.db.query(
      `SELECT
         r.id,
         r.rating,
         r.body,
         r.source,
         r.created_at AS submitted_at,
         a.id AS atelier_id,
         a.name AS atelier_name,
         account.display_name AS author_name
       FROM reviews r
       JOIN ateliers a ON a.id=r.atelier_id
       LEFT JOIN accounts account ON account.id=r.author_account_id
       WHERE r.status='pending'
       ORDER BY r.created_at ASC
       LIMIT $1 OFFSET $2`,
      [page.limit, page.offset],
    );
  }
  async moderateReview(user: AuthClaims, reviewId: string, status: 'published' | 'hidden' | 'rejected', reason?: string) {
    this.admin(user);
    const review = await this.db.one<{ id: string; atelier_id: string }>('UPDATE reviews SET status=$2 WHERE id=$1 RETURNING id,atelier_id', [reviewId,status]);
    if (!review) throw new NotFoundException('Review not found');
    await this.db.query(`INSERT INTO audit_events (actor_account_id,atelier_id,action,target_type,target_id,metadata) VALUES ($1,$2,$3,'review',$4,$5)`, [user.sub,review.atelier_id,`review.${status}`,reviewId,JSON.stringify({ reason: reason ?? null })]);
    return review;
  }
}
