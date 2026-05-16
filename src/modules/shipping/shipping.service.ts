import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TraxAdapter } from './adapters/trax.adapter';
import { LeopardsAdapter } from './adapters/leopards.adapter';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class ShippingService {
  constructor(
    private prisma: PrismaService,
    private trax: TraxAdapter,
    private leopards: LeopardsAdapter,
  ) {}

  async getRates(city: string, weight: number, subtotal: number) {
    let settings = await this.prisma.siteSettings.findFirst();
    if (!settings) settings = await this.prisma.siteSettings.create({ data: {} });
    const free = subtotal >= Number(settings.freeShippingAbove);
    return {
      city, weight,
      rate: free ? 0 : Number(settings.shippingRate),
      free,
      estimatedDays: 3,
    };
  }

  async bookShipment(orderId: string, courier: 'TRAX' | 'LEOPARDS') {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { address: true, user: true, items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const adapter = courier === 'TRAX' ? this.trax : this.leopards;
    const result = await adapter.createShipment(order);
    return this.prisma.shipment.upsert({
      where: { orderId },
      create: {
        orderId, courier,
        trackingNumber: result.trackingNumber,
        bookingId: result.bookingId,
        status: result.status,
        rawResponse: result.raw,
        statusHistory: [{ status: result.status, at: new Date() }],
      },
      update: {
        courier, trackingNumber: result.trackingNumber,
        bookingId: result.bookingId, status: result.status, rawResponse: result.raw,
      },
    });
  }

  async trackShipment(orderId: string, user: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }, include: { shipment: true },
    });
    if (!order) throw new NotFoundException();
    if (user.role !== 'SUPER_ADMIN' && order.userId !== user.id) throw new ForbiddenException();
    if (!order.shipment) return { status: 'not_shipped' };
    const adapter = order.shipment.courier === 'TRAX' ? this.trax : this.leopards;
    const result = await adapter.trackShipment(order.shipment.trackingNumber!);
    const prevHistory = Array.isArray(order.shipment.statusHistory) ? order.shipment.statusHistory as any[] : [];
    const newHistory = [...prevHistory, { status: result.status, at: new Date() }];
    await this.prisma.shipment.update({
      where: { orderId },
      data: { status: result.status, statusHistory: newHistory, rawResponse: result.raw },
    });
    return { ...order.shipment, status: result.status, statusHistory: newHistory };
  }

  async waybill(orderId: string): Promise<Buffer> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { address: true, user: true, items: true, shipment: true },
    });
    if (!order) throw new NotFoundException();
    return new Promise((resolve, reject) => {
      const doc: any = new (PDFDocument as any)({ size: 'A5', margin: 30 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(18).text('Abadal Publishing', { align: 'center' });
      doc.moveDown(0.5).fontSize(10).text('info@abadalpublishing.com', { align: 'center' });
      doc.moveDown().fontSize(14).text(`Order: ${order.orderNumber}`);
      doc.fontSize(10).text(`Tracking: ${order.shipment?.trackingNumber || '—'}`);
      doc.text(`Courier: ${order.shipment?.courier || '—'}`);
      doc.moveDown().fontSize(12).text('Deliver to:');
      doc.fontSize(10).text(`${order.address.firstName} ${order.address.lastName}`);
      doc.text(order.address.addressLine1);
      if (order.address.addressLine2) doc.text(order.address.addressLine2);
      doc.text(`${order.address.city}${order.address.state ? ', ' + order.address.state : ''}`);
      doc.text(order.address.country);
      doc.text(`Phone: ${order.address.phone}`);
      doc.moveDown().text(`Total: PKR ${order.totalAmount}`);
      doc.moveDown().text(`Items: ${order.items.length}`);
      doc.end();
    });
  }
}
