import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: {
        ...dto,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
      },
    });
  }

  list() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async validate(userId: string, code: string, orderTotal: number) {
    const c = await this.prisma.coupon.findUnique({ where: { code } });
    if (!c || !c.isActive) return { valid: false, discountAmount: 0, message: 'Invalid coupon' };
    const now = new Date();
    if (c.validFrom > now || c.validUntil < now) return { valid: false, discountAmount: 0, message: 'Coupon expired' };
    if (c.maxUses && c.usedCount >= c.maxUses) return { valid: false, discountAmount: 0, message: 'Coupon limit reached' };
    if (c.minOrderValue && orderTotal < Number(c.minOrderValue)) {
      return { valid: false, discountAmount: 0, message: `Minimum order PKR ${c.minOrderValue}` };
    }
    if (c.onePerCustomer) {
      const used = await this.prisma.couponUsage.findFirst({ where: { couponId: c.id, userId } });
      if (used) return { valid: false, discountAmount: 0, message: 'Already used' };
    }
    const discountAmount = c.type === 'PERCENTAGE'
      ? (orderTotal * Number(c.value)) / 100
      : Number(c.value);
    return { valid: true, discountAmount, message: 'Coupon applied' };
  }

  async remove(id: string) {
    const exists = await this.prisma.coupon.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    await this.prisma.coupon.delete({ where: { id } });
    return { success: true };
  }
}
