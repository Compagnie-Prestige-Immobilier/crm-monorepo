import type { PrismaService } from '../../prisma/prisma.service.js';

interface AppSettingRow {
  key: string;
  value: string;
  updatedById: string | null;
  updatedAt: Date;
}

interface LayoutRow {
  userId: string;
  ecran: string;
  layout: unknown;
  updatedAt: Date;
}

type Cle = { userId: string; ecran: string };

/** Le strict nécessaire pour éprouver la cascade « la sienne, celle par défaut, celle d'usine ». */
export class FakeDashboardsPrisma {
  appSettings: AppSettingRow[] = [];
  layouts: LayoutRow[] = [];

  readonly dashboardLayout = {
    findUnique: ({ where }: { where: { userId_ecran: Cle } }): Promise<LayoutRow | null> =>
      Promise.resolve(
        this.layouts.find(
          (row) =>
            row.userId === where.userId_ecran.userId && row.ecran === where.userId_ecran.ecran,
        ) ?? null,
      ),

    upsert: ({
      where,
      create,
      update,
    }: {
      where: { userId_ecran: Cle };
      create: { userId: string; ecran: string; layout: unknown };
      update: { layout: unknown };
    }): Promise<LayoutRow> => {
      const existing = this.layouts.find(
        (row) => row.userId === where.userId_ecran.userId && row.ecran === where.userId_ecran.ecran,
      );
      if (existing) {
        existing.layout = update.layout;
        existing.updatedAt = new Date();
        return Promise.resolve(existing);
      }
      const row: LayoutRow = { ...create, updatedAt: new Date() };
      this.layouts.push(row);
      return Promise.resolve(row);
    },

    deleteMany: ({ where }: { where: Cle }): Promise<{ count: number }> => {
      const before = this.layouts.length;
      this.layouts = this.layouts.filter(
        (row) => row.userId !== where.userId || row.ecran !== where.ecran,
      );
      return Promise.resolve({ count: before - this.layouts.length });
    },
  };

  readonly appSetting = {
    findUnique: ({ where }: { where: { key: string } }): Promise<AppSettingRow | null> =>
      Promise.resolve(this.appSettings.find((row) => row.key === where.key) ?? null),

    upsert: ({
      where,
      create,
      update,
    }: {
      where: { key: string };
      create: { key: string; value: string; updatedById?: string | null };
      update: { value: string; updatedById?: string | null };
    }): Promise<AppSettingRow> => {
      const existing = this.appSettings.find((row) => row.key === where.key);
      if (existing) {
        existing.value = update.value;
        existing.updatedById = update.updatedById ?? null;
        existing.updatedAt = new Date();
        return Promise.resolve(existing);
      }
      const row: AppSettingRow = {
        key: create.key,
        value: create.value,
        updatedById: create.updatedById ?? null,
        updatedAt: new Date(),
      };
      this.appSettings.push(row);
      return Promise.resolve(row);
    },
  };

  asPrisma(): PrismaService {
    return this as unknown as PrismaService;
  }
}
