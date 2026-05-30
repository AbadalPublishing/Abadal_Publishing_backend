import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  /** Check whether a user is eligible to review a product — they must have a DELIVERED order. */
  async canReview(userId: string, productId: string) {
    if (!userId || !productId) return { eligible: false };
    const regular = await this.prisma.orderItem.findFirst({
      where: { productId, order: { userId, status: 'DELIVERED' } },
      select: { orderId: true },
    });
    if (regular) return { eligible: true, orderId: regular.orderId, source: 'web' as const };
    const wa = await (this.prisma as any).whatsappOrder.findFirst({
      where: { productId, userId, status: 'DELIVERED' },
      select: { id: true },
    });
    if (wa) return { eligible: true, source: 'whatsapp' as const };
    return { eligible: false };
  }

  async create(userId: string, dto: CreateReviewDto) {
    // Accept either a regular Order (DELIVERED) OR a WhatsappOrder (DELIVERED) for this product.
    const regular = await this.prisma.orderItem.findFirst({
      where: { productId: dto.productId, order: { userId, status: 'DELIVERED' } },
      select: { orderId: true },
    });
    let orderId: string | null = regular?.orderId || null;
    if (!orderId) {
      const wa = await (this.prisma as any).whatsappOrder.findFirst({
        where: { productId: dto.productId, userId, status: 'DELIVERED' },
        select: { id: true },
      });
      if (!wa) {
        throw new BadRequestException('You can only review books you have purchased and received');
      }
      // WhatsApp orders don't have an OrderItem.orderId — leave orderId null for them.
      // The Review schema has orderId as optional in this fallback case.
    }
    return this.prisma.review.upsert({
      where: { userId_productId: { userId, productId: dto.productId } },
      create: {
        userId, productId: dto.productId, orderId: orderId || undefined,
        rating: dto.rating, title: dto.title, body: dto.body, status: 'PENDING',
      } as any,
      update: {
        rating: dto.rating, title: dto.title, body: dto.body, status: 'PENDING',
      },
    });
  }

  list(productId?: string) {
    return this.prisma.review.findMany({
      where: { productId, status: 'APPROVED', deletedAt: null },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  pending() {
    return this.prisma.review.findMany({
      where: { status: 'PENDING', deletedAt: null },
      include: { user: { select: { firstName: true, lastName: true, email: true } }, product: { select: { title: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string) {
    const r = await this.prisma.review.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    return this.prisma.review.update({ where: { id }, data: { status: 'APPROVED' } });
  }

  async remove(id: string) {
    await this.prisma.review.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }
}
