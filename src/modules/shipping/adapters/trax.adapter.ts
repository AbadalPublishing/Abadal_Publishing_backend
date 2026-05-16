import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TraxAdapter {
  private readonly logger = new Logger('TraxAdapter');
  constructor(private config: ConfigService) {}

  private hasKey() { return !!this.config.get('TRAX_API_KEY'); }

  async createShipment(order: any) {
    if (!this.hasKey()) {
      return {
        trackingNumber: `TRX${Date.now()}`,
        bookingId: `BK${Math.floor(Math.random() * 1e9)}`,
        status: 'booked',
        raw: { mock: true },
      };
    }
    try {
      const res = await axios.post('https://api.trax.pk/v1/booking', {
        consignee: order.address,
        cod: order.totalAmount,
        orderId: order.orderNumber,
      }, { headers: { Authorization: `Bearer ${this.config.get('TRAX_API_KEY')}` } });
      return {
        trackingNumber: res.data.tracking_number,
        bookingId: res.data.booking_id,
        status: res.data.status || 'booked',
        raw: res.data,
      };
    } catch (e: any) {
      this.logger.warn(`Trax API failed: ${e?.message}`);
      throw e;
    }
  }

  async trackShipment(trackingNumber: string) {
    if (!this.hasKey()) {
      return { status: 'in_transit', history: [{ status: 'booked', at: new Date() }], raw: { mock: true } };
    }
    const res = await axios.get(`https://api.trax.pk/v1/track/${trackingNumber}`, {
      headers: { Authorization: `Bearer ${this.config.get('TRAX_API_KEY')}` },
    });
    return { status: res.data.status, history: res.data.history || [], raw: res.data };
  }
}
