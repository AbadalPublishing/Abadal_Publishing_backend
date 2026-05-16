import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartDto, MergeCartDto } from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.cartItem.findMany({
      where: { userId },
      include: { variant: { include: { product: true } } },
      orderBy: { addedAt: 'desc' },
    });
  }

  private priceFor(variant: any, priceType: string): number {
    switch (priceType) {
      case 'WHOLESALE': return Number(variant.wholesalePrice);
      case 'STUDENT': return Number(variant.studentPrice);
      default: return Number(variant.retailPrice);
    }
  }

  async add(userId: string, dto: AddCartDto) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: dto.variantId } });
    if (!variant) throw new NotFoundException('Variant not found');
    const savedPrice = this.priceFor(variant, dto.priceType);
    return this.prisma.cartItem.upsert({
      where: { userId_variantId: { userId, variantId: dto.variantId } },
      create: {
        userId, variantId: dto.variantId,
        quantity: dto.quantity, priceType: dto.priceType, savedPrice,
      },
      update: {
        quantity: { increment: dto.quantity },
        priceType: dto.priceType, savedPrice,
      },
      include: { variant: { include: { product: true } } },
    });
  }

  async updateQty(userId: string, itemId: string, quantity: number) {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, userId } });
    if (!item) throw new NotFoundException();
    return this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  }

  async remove(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, userId } });
    if (!item) throw new NotFoundException();
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return { success: true };
  }

  async clear(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return { success: true };
  }

  async merge(userId: string, dto: MergeCartDto) {
    for (const item of dto.items) {
      try {
        await this.add(userId, item);
      } catch (e: any) {
        if (e instanceof NotFoundException) continue;
        throw e;
      }
    }
    return this.list(userId);
  }
}
