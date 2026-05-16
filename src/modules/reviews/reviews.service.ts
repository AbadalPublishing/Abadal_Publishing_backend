import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateReviewDto) {
    const purchased = await this.prisma.orderItem.findFirst({
      where: { productId: dto.productId, order: { userId, status: 'DELIVERED' } },
      select: { orderId: true },
    });
    if (!purchased) throw new BadRequestException('You must purchase and receive this product to review');
    return this.prisma.review.upsert({
      where: { userId_productId: { userId, productId: dto.productId } },
      create: {
        userId, productId: dto.productId, orderId: purchased.orderId,
        rating: dto.rating, title: dto.title, body: dto.body, status: 'PENDING',
      },
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
