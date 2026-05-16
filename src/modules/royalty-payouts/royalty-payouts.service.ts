import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePayoutDto, UpdatePayoutDto } from './dto/payout.dto';

@Injectable()
export class RoyaltyPayoutsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreatePayoutDto) {
    return this.prisma.royaltyPayout.create({ data: dto });
  }

  list(q: any) {
    const where: any = {};
    if (q.authorId) where.authorId = q.authorId;
    if (q.period) where.period = q.period;
    return this.prisma.royaltyPayout.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, penName: true, slug: true } } },
    });
  }

  async update(id: string, dto: UpdatePayoutDto) {
    const exists = await this.prisma.royaltyPayout.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    const data: any = { ...dto };
    if (dto.status === 'PAID') data.paidAt = new Date();
    return this.prisma.royaltyPayout.update({ where: { id }, data });
  }

  async mine(userId: string) {
    const author = await this.prisma.author.findUnique({ where: { userId } });
    if (!author) return [];
    return this.prisma.royaltyPayout.findMany({
      where: { authorId: author.id }, orderBy: { createdAt: 'desc' },
    });
  }
}
