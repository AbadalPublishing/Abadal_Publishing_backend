import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

const SAFE_SELECT = {
  id: true, email: true, firstName: true, lastName: true, phone: true, city: true,
  role: true, isActive: true, emailVerified: true, phoneVerified: true,
  totalLifetimeSpend: true, lastLoginAt: true, lastLoginIp: true,
  createdAt: true, updatedAt: true, dateOfBirth: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list(query: { role?: string; search?: string; page?: string; limit?: string }) {
    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(100, parseInt(query.limit || '20'));
    const where: any = { deletedAt: null };
    if (query.role) where.role = query.role;
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where, select: SAFE_SELECT,
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id }, select: { ...SAFE_SELECT, author: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.get(id);
    return this.prisma.user.update({ where: { id }, data: dto, select: SAFE_SELECT });
  }

  async softDelete(id: string) {
    const user = await this.get(id);
    // Free the @unique email slot so the address can be re-registered later.
    // Original email is preserved inside the mangled string for audit.
    const stamp = Date.now();
    const releasedEmail = `deleted_${stamp}_${user.email}`;
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, email: releasedEmail },
    });
    return { success: true };
  }
}
