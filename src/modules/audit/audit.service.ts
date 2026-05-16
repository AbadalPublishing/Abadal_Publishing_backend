import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(adminId: string, action: string, entityType: string, entityId: string, oldValue?: any, newValue?: any, ip?: string) {
    try {
      await this.prisma.auditLog.create({
        data: { adminId, action, entityType, entityId, oldValue, newValue, ip },
      });
    } catch { /* swallow */ }
  }

  async list(q: any) {
    const page = Math.max(1, parseInt(q.page || '1'));
    const limit = Math.min(100, parseInt(q.limit || '50'));
    const where: any = {};
    if (q.adminId) where.adminId = q.adminId;
    if (q.entityType) where.entityType = q.entityType;
    if (q.action) where.action = q.action;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
