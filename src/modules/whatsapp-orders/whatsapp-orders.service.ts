import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWhatsappOrderDto } from './dto/create-whatsapp-order.dto';

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genRefCode(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  return `ABDL-${s}`;
}

const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

@Injectable()
export class WhatsappOrdersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWhatsappOrderDto, userId?: string) {
    const qty = dto.quantity;
    const unit = Number(dto.unitPrice);
    const subtotal = +(unit * qty).toFixed(2);
    const shipping = 0;
    const total = +(subtotal + shipping).toFixed(2);

    let refCode = '';
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate = genRefCode();
      const existing = await (this.prisma as any).whatsappOrder.findUnique({ where: { refCode: candidate } });
      if (!existing) { refCode = candidate; break; }
    }
    if (!refCode) throw new BadRequestException('Could not generate order reference, please retry');

    return (this.prisma as any).whatsappOrder.create({
      data: {
        refCode,
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        email: dto.email?.trim() || null,
        street: dto.street.trim(),
        city: dto.city.trim(),
        country: (dto.country || 'Pakistan').trim(),
        notes: dto.notes?.trim() || null,
        productId: dto.productId || null,
        bookTitle: dto.bookTitle.trim(),
        edition: dto.edition || 'Paperback',
        quantity: qty,
        unitPrice: unit,
        subtotal,
        shipping,
        total,
        userId: userId || null,
        paymentMethod: dto.paymentMethod,
        paymentReceiptUrl: dto.paymentReceiptUrl,
        // Auto-fill the admin's paymentAccount label so they don't have to type
        paymentAccount: dto.paymentMethod === 'JAZZCASH'
          ? 'JazzCash · 0336-3434629 · Syed Shamsul Arifeen'
          : 'Easypaisa · 0303-9555966 · Syed Shamsul Arifeen',
      } as any,
    });
  }

  async list(params: { from?: string; to?: string; status?: string }) {
    const where: any = {};
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) {
        const end = new Date(params.to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    if (params.status && VALID_STATUSES.includes(params.status)) where.status = params.status;
    const rows = await (this.prisma as any).whatsappOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    // Normalise Decimal fields to plain numbers so the frontend never sees NaN
    return (rows as any[]).map(r => ({
      ...r,
      unitPrice: Number(r.unitPrice ?? 0),
      subtotal:  Number(r.subtotal ?? 0),
      shipping:  Number(r.shipping ?? 0),
      total:     Number(r.total ?? 0),
    }));
  }

  async bookTotals(params: { from?: string; to?: string; status?: string }) {
    const orders = await this.list(params);
    const map = new Map<string, { bookTitle: string; quantity: number; orders: number; revenue: number }>();
    for (const o of orders as any[]) {
      const key = o.bookTitle;
      const existing = map.get(key) || { bookTitle: key, quantity: 0, orders: 0, revenue: 0 };
      existing.quantity += o.quantity;
      existing.orders += 1;
      existing.revenue += Number(o.total);
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
  }

  async update(id: string, data: { status?: string; quantity?: number; notes?: string; paymentAccount?: string }) {
    const order = await (this.prisma as any).whatsappOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    const updateData: any = {};
    if (data.status) {
      if (!VALID_STATUSES.includes(data.status)) throw new BadRequestException('Invalid status');
      // Require payment account when moving to CONFIRMED for the first time
      if (data.status === 'CONFIRMED' && !order.approvedAt) {
        // Customer-supplied paymentMethod auto-fills paymentAccount on create,
        // so admin just confirms. Only require manual entry if it's somehow missing.
        const acc = (data.paymentAccount || order.paymentAccount || '').trim();
        if (!acc) throw new BadRequestException('Payment account is required to approve this order');
        if (data.paymentAccount !== undefined) updateData.paymentAccount = acc;
        updateData.paymentReceivedAt = new Date();
        updateData.approvedAt = new Date();
      }
      if (data.status === 'DELIVERED' && !order.deliveredAt) {
        updateData.deliveredAt = new Date();
      }
      updateData.status = data.status;
    }
    if (data.paymentAccount !== undefined && !updateData.paymentAccount) {
      updateData.paymentAccount = data.paymentAccount.trim();
    }
    if (typeof data.quantity === 'number' && data.quantity >= 1) {
      const newQty = Math.floor(data.quantity);
      const unit = Number(order.unitPrice);
      const subtotal = +(unit * newQty).toFixed(2);
      const shipping = Number(order.shipping);
      const total = +(subtotal + shipping).toFixed(2);
      updateData.quantity = newQty;
      updateData.subtotal = subtotal;
      updateData.total = total;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    return (this.prisma as any).whatsappOrder.update({ where: { id }, data: updateData });
  }

  /** Authed: list orders belonging to this user */
  async mine(userId: string) {
    const rows = await (this.prisma as any).whatsappOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return (rows as any[]).map(r => ({
      ...r,
      unitPrice: Number(r.unitPrice ?? 0),
      subtotal:  Number(r.subtotal ?? 0),
      shipping:  Number(r.shipping ?? 0),
      total:     Number(r.total ?? 0),
    }));
  }

    /** Public: get a sanitized view of an order by refCode (for the QR tracking page) */
  async trackByRef(refCode: string) {
    const order = await (this.prisma as any).whatsappOrder.findUnique({ where: { refCode: refCode.toUpperCase() } });
    if (!order) throw new NotFoundException('Order not found');
    return {
      refCode: order.refCode,
      status: order.status,
      bookTitle: order.bookTitle,
      edition: order.edition,
      quantity: order.quantity,
      total: Number(order.total),
      name: order.name,
      city: order.city,
      createdAt: order.createdAt,
      approvedAt: order.approvedAt,
      deliveredAt: order.deliveredAt,
      paymentMethod: order.paymentMethod,
      deliveryConfirmedAt: order.deliveryConfirmedAt,
      canConfirmDelivery: ['CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(order.status) && !order.deliveryConfirmedAt,
    };
  }

  /** Public: customer scans QR + taps confirm. */
  async confirmDeliveryByCustomer(refCode: string) {
    const order = await (this.prisma as any).whatsappOrder.findUnique({ where: { refCode: refCode.toUpperCase() } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.deliveryConfirmedAt) {
      return { ok: true, status: order.status, message: 'Delivery already confirmed' };
    }
    if (!['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
      throw new BadRequestException('Order cannot be marked delivered in its current state');
    }
    const now = new Date();
    const updated = await (this.prisma as any).whatsappOrder.update({
      where: { id: order.id },
      data: {
        status: 'DELIVERED',
        deliveredAt: order.deliveredAt || now,
        deliveryConfirmedAt: now,
      },
    });
    return { ok: true, status: updated.status, deliveryConfirmedAt: updated.deliveryConfirmedAt };
  }

  async exportRows(params: { from?: string; to?: string; status?: string }) {
    const orders = await this.list(params);
    return (orders as any[]).map(o => ({
      refCode: o.refCode,
      createdAt: o.createdAt,
      name: o.name,
      phone: o.phone,
      email: o.email || '',
      street: o.street,
      city: o.city,
      country: o.country,
      bookTitle: o.bookTitle + ' (' + o.edition + ')',
      quantity: o.quantity,
      unitPrice: Number(o.unitPrice),
      subtotal: Number(o.subtotal),
      shipping: Number(o.shipping),
      total: Number(o.total),
      paymentMethod: o.paymentMethod || '',
      paymentReceiptUrl: o.paymentReceiptUrl || '',
      paymentAccount: o.paymentAccount || '',
      notes: o.notes || '',
      status: o.status,
      approvedAt: o.approvedAt,
      deliveredAt: o.deliveredAt,
    }));
  }
}
