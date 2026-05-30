import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { stringify } from 'csv-stringify/sync';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async recordEvents(events: any | any[], userId?: string) {
    const arr = Array.isArray(events) ? events : [events];
    const data = arr.map(e => ({
      eventType: e.eventType,
      sessionId: e.sessionId,
      userId: userId || e.userId,
      productId: e.productId,
      pageUrl: e.pageUrl,
      referrer: e.referrer,
      city: e.city,
      country: e.country,
      deviceType: e.deviceType,
      metadata: e.metadata,
    }));
    await this.prisma.analyticsEvent.createMany({ data });
    const sessionIds = [...new Set(arr.map(e => e.sessionId).filter(Boolean))];
    for (const sid of sessionIds) {
      const ev = arr.find(e => e.sessionId === sid);
      await this.prisma.activeSession.upsert({
        where: { sessionId: sid },
        create: {
          sessionId: sid, userId: userId || ev?.userId,
          city: ev?.city, country: ev?.country, deviceType: ev?.deviceType,
        },
        update: { lastSeen: new Date(), userId: userId || ev?.userId },
      });
    }
    return { success: true, count: data.length };
  }

  private rangeDays(range?: string) {
    if (range === '90d') return 90;
    if (range === '30d') return 30;
    return 7;
  }

  async dashboard(range?: string) {
    const days = this.rangeDays(range);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [orders, totalRevenue, uniqueSessionRows, newUsers, allEvents,
           customers, pendingWebOrders, pendingWaOrders, waRevenueAgg] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: since }, deletedAt: null, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true },
      }),
      this.prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: since } }, distinct: ['sessionId'], select: { sessionId: true },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, eventType: true },
      }),
      // All-time customers (not deleted) — what the dashboard card actually wants
      this.prisma.user.count({ where: { role: { in: ['CUSTOMER', 'AUTHOR'] }, deletedAt: null } }),
      // Pending across both order types
      this.prisma.order.count({ where: { status: 'PENDING', deletedAt: null } }),
      (this.prisma as any).whatsappOrder.count({ where: { status: 'PENDING' } }),
      // WhatsApp revenue (not cancelled) within the range, to add to totals.revenue
      (this.prisma as any).whatsappOrder.aggregate({
        where: { createdAt: { gte: since }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
    ]);

    // Daily bucketing
    const dailyMap: Record<string, any> = {};
    const eventCounts: Record<string, number> = {};
    for (const e of allEvents) {
      const k = e.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[k]) dailyMap[k] = { date: k, pageViews: 0, events: 0, visitors: 0 };
      dailyMap[k].events++;
      if (e.eventType === 'PAGE_VIEW') { dailyMap[k].pageViews++; dailyMap[k].visitors++; }
      eventCounts[e.eventType] = (eventCounts[e.eventType] || 0) + 1;
    }

    const waRevenue = Number(waRevenueAgg?._sum?.total || 0);
    return {
      totals: {
        orders,
        revenue: Number(totalRevenue._sum.totalAmount || 0) + waRevenue,
        visitors: eventCounts['PAGE_VIEW'] || 0,
        uniqueSessions: uniqueSessionRows.length,
        newUsers,
        customers,
        pending: pendingWebOrders + pendingWaOrders,
      },
      eventCounts,
      daily: Object.values(dailyMap).sort((a: any, b: any) => a.date.localeCompare(b.date)),
    };
  }

  async liveVisitors() {
    const since = new Date(Date.now() - 90 * 1000);
    const count = await this.prisma.activeSession.count({ where: { lastSeen: { gte: since } } });
    return { count };
  }

  async topProducts(range?: string) {
    const days = this.rangeDays(range);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const views = await this.prisma.analyticsEvent.groupBy({
      by: ['productId'],
      where: { eventType: 'BOOK_CLICK', createdAt: { gte: since }, productId: { not: null } },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 10,
    });
    const productIds = views.map(v => v.productId!).filter(Boolean);
    const [products, orderCounts] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, title: true, slug: true, coverImage: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds }, order: { createdAt: { gte: since } } },
        _sum: { quantity: true },
      }),
    ]);
    return views.map(v => ({
      product: products.find(p => p.id === v.productId),
      views: v._count.productId,
      sales: orderCounts.find(o => o.productId === v.productId)?._sum.quantity || 0,
    }));
  }

  async bookEngagement(range?: string) {
    const days = this.rangeDays(range);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // All tracked event types per product
    const eventTypes = ['BOOK_CLICK', 'WHATSAPP_CLICK', 'AMAZON_CLICK', 'ADD_TO_CART'];
    const eventRows = await (this.prisma.analyticsEvent.groupBy as any)({
      by: ['productId', 'eventType'],
      where: { productId: { not: null }, createdAt: { gte: since }, eventType: { in: eventTypes } },
      _count: { eventType: true },
    }) as Array<{ productId: string; eventType: string; _count: { eventType: number } }>;

    const productIds = [...new Set(eventRows.map(r => r.productId!).filter(Boolean))];

    const [products, orderCounts] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        include: {
          author: { select: { penName: true, slug: true } },
          _count: { select: { orderItems: { where: { order: { createdAt: { gte: since } } } } } },
        },
      }),
      (this.prisma.orderItem.groupBy as any)({
        by: ['productId'],
        where: { productId: { in: productIds }, order: { createdAt: { gte: since } } },
        _sum: { quantity: true, price: true },
      }) as Promise<Array<{ productId: string; _sum: { quantity: number; price: number } }>>,
    ]);

    return products.map(p => {
      const pEvents = eventRows.filter(r => r.productId === p.id);
      const get = (type: string) => pEvents.find(r => r.eventType === type)?._count.eventType || 0;
      const views = get('BOOK_CLICK');
      const whatsapp = get('WHATSAPP_CLICK');
      const amazon = get('AMAZON_CLICK');
      const cart = get('ADD_TO_CART');
      const orders = orderCounts.find(o => o.productId === p.id)?._sum.quantity || 0;
      const revenue = Number(orderCounts.find(o => o.productId === p.id)?._sum.price || 0);

      // Conversion metrics
      const conversionRate = views > 0 ? Math.round((Number(orders) / views) * 100) : 0;
      const whatsappRate = views > 0 ? Math.round((whatsapp / views) * 100) : 0;
      const amazonRate = views > 0 ? Math.round((amazon / views) * 100) : 0;

      // Decision insight
      let insight = '';
      if (views > 50 && conversionRate < 5 && whatsappRate < 10 && amazonRate < 10) insight = 'High traffic, low intent — review description or pricing';
      else if (whatsapp > amazon && whatsapp > cart) insight = 'WhatsApp is primary channel — promote it';
      else if (amazon > whatsapp && amazon > cart) insight = 'Amazon leads — consider Kindle exclusivity';
      else if (cart > 0 && conversionRate > 15) insight = 'Strong direct conversion — increase stock';
      else if (views < 10) insight = 'Low traffic — needs promotion';
      else insight = 'Performing normally';

      return {
        product: { id: p.id, title: p.title, slug: p.slug, coverImage: p.coverImage, author: p.author },
        views, whatsapp, amazon, cart, orders: Number(orders), revenue, conversionRate, whatsappRate, amazonRate, insight,
      };
    }).sort((a, b) => b.views - a.views);
  }

  async geography() {
    const orders = await this.prisma.order.findMany({
      where: { deletedAt: null },
      include: { address: { select: { city: true } } },
    });
    const map: Record<string, { orders: number; revenue: number }> = {};
    for (const o of orders) {
      const c = (o as any).address?.city || 'Unknown';
      if (!map[c]) map[c] = { orders: 0, revenue: 0 };
      map[c].orders++;
      map[c].revenue += Number((o as any).totalAmount || 0);
    }
    return Object.entries(map).map(([city, data]) => ({ city, ...data }))
      .sort((a, b) => b.orders - a.orders);
  }

  async export(type: string): Promise<{ filename: string; csv: string }> {
    let rows: any[] = [];
    if (type === 'orders') {
      const orders = await this.prisma.order.findMany({
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
      });
      rows = orders.map(o => ({
        orderNumber: o.orderNumber, email: o.user.email, status: o.status,
        total: Number(o.totalAmount), createdAt: o.createdAt.toISOString(),
      }));
    } else if (type === 'revenue') {
      const orders = await this.prisma.order.findMany({
        where: { status: { not: 'CANCELLED' } },
        select: { createdAt: true, totalAmount: true },
      });
      const map: Record<string, number> = {};
      for (const o of orders) {
        const k = o.createdAt.toISOString().slice(0, 10);
        map[k] = (map[k] || 0) + Number(o.totalAmount);
      }
      rows = Object.entries(map).map(([date, total]) => ({ date, total }));
    } else if (type === 'customers') {
      const users = await this.prisma.user.findMany({
        where: { role: 'CUSTOMER' },
        select: { email: true, firstName: true, lastName: true, phone: true, city: true, totalLifetimeSpend: true, createdAt: true },
      });
      rows = users.map(u => ({ ...u, totalLifetimeSpend: Number(u.totalLifetimeSpend), createdAt: u.createdAt.toISOString() }));
    } else if (type === 'events') {
      const events = await this.prisma.analyticsEvent.findMany({
        orderBy: { createdAt: 'desc' }, take: 10000,
      });
      rows = events.map(e => ({
        eventType: e.eventType, sessionId: e.sessionId, userId: e.userId, productId: e.productId,
        pageUrl: e.pageUrl, city: e.city, createdAt: e.createdAt.toISOString(),
      }));
    }
    const csv = stringify(rows, { header: true });
    return { filename: `${type}-${Date.now()}.csv`, csv };
  }
}
