import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client.
 *
 * Connection pooling is critical for Railway cost optimisation. We rely on
 * Railway's built-in pgBouncer (or set ?pgbouncer=true&connection_limit=1 on the
 * DATABASE_URL when self-hosted). With ~10k concurrent users on a single
 * backend instance, we want ≤ 10 active DB connections at any time — Prisma
 * handles this with its internal pool when `connection_limit` is unset and
 * Railway proxies it via pgBouncer.
 *
 * Log only errors in production (logging queries is expensive at scale).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  constructor() {
    super({
      log: process.env.NODE_ENV === 'production'
        ? ['error']
        : ['warn', 'error'],
      errorFormat: process.env.NODE_ENV === 'production' ? 'minimal' : 'pretty',
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Helper for soft-delete-aware queries.
   * Use as: prisma.product.findMany({ where: this.prisma.notDeleted({ isActive: true }) })
   */
  notDeleted<T extends Record<string, any>>(where: T = {} as T): T & { deletedAt: null } {
    return { ...where, deletedAt: null };
  }
}
