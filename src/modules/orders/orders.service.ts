import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/order.dto';
import { KafkaService } from '../kafka/kafka.service';
import { ShippingService } from '../shipping/shipping.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private kafka: KafkaService,
    private shipping: ShippingService,
    private email: EmailService,
  ) {}

  private priceFor(variant: any, priceType: string): number {
    switch (priceType) {
      case 'WHOLESALE': return Number(variant.wholesalePrice);
      case 'STUDENT': return Number(variant.studentPrice);
      default: return Number(variant.retailPrice);
    }
  }

  private async genOrderNumber() {
    const year = new Date().getFullYear();
    const count = await this.prisma.order.count({
      where: { createdAt: { gte: new Date(`${year}-01-01`) } },
    });
    const seq = String(count + 1).padStart(5, '0');
    return `ABD-${year}-${seq}`;
  }

  async create(userId: string, dto: CreateOrderDto) {
    const address = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId } });
    if (!address) throw new BadRequestException('Invalid address');
    const variantIds = dto.items.map(i => i.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: { include: { author: true } } },
    });
    if (variants.length !== variantIds.length) throw new BadRequestException('Invalid variant');

    let subtotal = 0;
    let royalty = 0;
    const orderItems: any[] = [];
    for (const item of dto.items) {
      const v = variants.find(x => x.id === item.variantId)!;
      if (!v.amazonOnly && v.stock < item.quantity) throw new BadRequestException(`Insufficient stock for ${v.product.title}`);
      const price = this.priceFor(v, item.priceType);
      const total = price * item.quantity;
      subtotal += total;
      royalty += (total * Number(v.royaltyPercentage)) / 100;
      orderItems.push({
        productId: v.productId, variantId: v.id, authorId: v.product.authorId,
        title: v.product.title, coverImage: v.product.coverImage,
        variantType: v.type, priceType: item.priceType,
        pricePaid: price, quantity: item.quantity, total,
        royaltyPct: v.royaltyPercentage,
      });
    }

    let settings = await this.prisma.siteSettings.findFirst();
    if (!settings) settings = await this.prisma.siteSettings.create({ data: {} });
    const shippingCost = subtotal >= Number(settings.freeShippingAbove) ? 0 : Number(settings.shippingRate);

    let couponDiscount = 0;
    let couponId: string | null = null;
    if (dto.couponCode) {
      const c = await this.prisma.coupon.findUnique({ where: { code: dto.couponCode } });
      const now = new Date();
      if (c && c.isActive && c.validFrom <= now && c.validUntil >= now &&
          (!c.maxUses || c.usedCount < c.maxUses) &&
          (!c.minOrderValue || subtotal >= Number(c.minOrderValue))) {
        if (c.onePerCustomer) {
          const used = await this.prisma.couponUsage.findFirst({ where: { couponId: c.id, userId } });
          if (used) throw new BadRequestException('Coupon already used');
        }
        couponDiscount = c.type === 'PERCENTAGE'
          ? (subtotal * Number(c.value)) / 100
          : Number(c.value);
        couponId = c.id;
      } else throw new BadRequestException('Invalid coupon');
    }

    const total = subtotal + shippingCost - couponDiscount;
    const orderNumber = await this.genOrderNumber();

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber, userId, addressId: dto.addressId,
          paymentMethod: dto.paymentMethod,
          courier: dto.courier,
          notes: dto.notes,
          subtotal, shippingCost, couponCode: dto.couponCode,
          couponDiscount, totalAmount: total,
          authorRoyaltyAmount: royalty,
          items: { create: orderItems },
          payments: {
            create: {
              method: dto.paymentMethod,
              amount: total,
              status: 'PENDING',
            },
          },
        },
        include: { items: true, payments: true, address: true, user: true },
      });

      for (const item of dto.items) {
        const v = variants.find(x => x.id === item.variantId)!;
        if (!v.amazonOnly) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: { stock: { decrement: item.quantity } },
          });
          await tx.stockMovement.create({
            data: { variantId: v.id, delta: -item.quantity, reason: 'SALE', orderId: created.id },
          });
        }
      }

      if (couponId) {
        await tx.couponUsage.create({ data: { couponId, userId, orderId: created.id } });
        await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
      }

      await tx.cartItem.deleteMany({
        where: { userId, variantId: { in: variantIds } },
      });

      await tx.user.update({
        where: { id: userId },
        data: { totalLifetimeSpend: { increment: total } },
      });

      return created;
    });

    await this.kafka.publish('order.placed', { orderId: order.id, orderNumber });
    this.email.sendOrderConfirmation(order).catch(() => {});
    return order;
  }

  async list(user: any, q: any) {
    const page = Math.max(1, parseInt(q.page || '1'));
    const limit = Math.min(100, parseInt(q.limit || '20'));
    const where: any = { deletedAt: null };
    if (user.role !== 'SUPER_ADMIN') where.userId = user.id;
    if (q.status) where.status = q.status;
    if (q.courier) where.courier = q.courier;
    if (q.paymentMethod) where.paymentMethod = q.paymentMethod;
    if (q.dateFrom || q.dateTo) {
      where.createdAt = {};
      if (q.dateFrom) where.createdAt.gte = new Date(q.dateFrom);
      if (q.dateTo) where.createdAt.lte = new Date(q.dateTo);
    }
    if (q.search) {
      where.OR = [
        { orderNumber: { contains: q.search, mode: 'insensitive' } },
        { user: { email: { contains: q.search, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true, address: true, shipment: true, payments: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async get(id: string, user: any) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true, address: true, shipment: true, payments: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!order) throw new NotFoundException();
    if (user.role !== 'SUPER_ADMIN' && order.userId !== user.id) throw new ForbiddenException();
    return order;
  }

  async updateStatus(id: string, status: any) {
    const order = await this.prisma.order.findUnique({
      where: { id }, include: { user: true, items: true, payments: true },
    });
    if (!order) throw new NotFoundException();
    const data: any = { status };
    if (status === 'DELIVERED') data.deliveredAt = new Date();
    const updated = await this.prisma.order.update({ where: { id }, data, include: { user: true } });

    if (status === 'SHIPPED' && order.courier) {
      try { await this.shipping.bookShipment(id, order.courier); } catch { /* logged */ }
      await this.kafka.publish('shipment.booked', { orderId: id });
    }
    if (status === 'DELIVERED') {
      const codPayment = order.payments.find(p => p.method === 'COD' && p.status === 'PENDING');
      if (codPayment) {
        await this.prisma.payment.update({ where: { id: codPayment.id }, data: { status: 'COMPLETED' } });
      }
      await this.kafka.publish('order.delivered', { orderId: id });
    }
    await this.kafka.publish('order.status.changed', { orderId: id, status });
    this.email.sendOrderStatusUpdate(updated).catch(() => {});
    return updated;
  }

  async cancel(id: string, user: any) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException();
    const allowed = ['PENDING', 'CONFIRMED', 'PROCESSING'];
    if (user.role !== 'SUPER_ADMIN') {
      if (order.userId !== user.id) throw new ForbiddenException();
      if (!allowed.includes(order.status)) throw new BadRequestException('Cannot cancel at this stage');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: user.id },
      });
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
        await tx.stockMovement.create({
          data: { variantId: item.variantId, delta: item.quantity, reason: 'CANCELLED', orderId: id },
        });
      }
    });
    await this.kafka.publish('order.status.changed', { orderId: id, status: 'CANCELLED' });
    return { success: true };
  }

  async refund(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { payments: true } });
    if (!order) throw new NotFoundException();
    await this.prisma.order.update({ where: { id }, data: { status: 'REFUNDED' } });
    for (const p of order.payments) {
      if (p.status === 'COMPLETED') {
        await this.prisma.payment.update({ where: { id: p.id }, data: { status: 'REFUNDED' } });
      }
    }
    return { success: true };
  }
}
