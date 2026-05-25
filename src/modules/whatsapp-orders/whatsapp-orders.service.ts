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

  async create(dto: CreateWhatsappOrderDto) {
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
      },
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
    return (this.prisma as any).whatsappOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  /** Admin: per-book quantity totals (across all WhatsApp orders, respecting filters) */
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

  async update(id: string, data: { status?: string; quantity?: number; notes?: string }) {
    const order = await (this.prisma as any).whatsappOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    const updateData: any = {};
    if (data.status) {
      if (!VALID_STATUSES.includes(data.status)) throw new BadRequestException('Invalid status');
      updateData.status = data.status;
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
      notes: o.notes || '',
      status: o.status,
    }));
  }
}
