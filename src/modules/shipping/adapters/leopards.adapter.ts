import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class LeopardsAdapter {
  private readonly logger = new Logger('LeopardsAdapter');
  constructor(private config: ConfigService) {}

  private hasKey() { return !!this.config.get('LEOPARDS_API_KEY'); }

  async createShipment(order: any) {
    if (!this.hasKey()) {
      return {
        trackingNumber: `LCS${Date.now()}`,
        bookingId: `BK${Math.floor(Math.random() * 1e9)}`,
        status: 'booked',
        raw: { mock: true },
      };
    }
    try {
      const res = await axios.post('https://merchantapi.leopardscourier.com/api/bookPacket/format/json/', {
        api_key: this.config.get('LEOPARDS_API_KEY'),
        api_password: this.config.get('LEOPARDS_API_PASSWORD'),
        booked_packet_weight: order.weight || 500,
        booked_packet_collect_amount: order.totalAmount,
        consignment_name_eng: `${order.address.firstName} ${order.address.lastName}`,
        consignment_email: order.user?.email,
        consignment_phone: order.address.phone,
        consignment_address: order.address.addressLine1,
        consignment_city_name: order.address.city,
      });
      return {
        trackingNumber: res.data.track_number,
        bookingId: res.data.slip_link,
        status: 'booked',
        raw: res.data,
      };
    } catch (e: any) {
      this.logger.warn(`Leopards API failed: ${e?.message}`);
      throw e;
    }
  }

  async trackShipment(trackingNumber: string) {
    if (!this.hasKey()) {
      return { status: 'in_transit', history: [{ status: 'booked', at: new Date() }], raw: { mock: true } };
    }
    const res = await axios.post('https://merchantapi.leopardscourier.com/api/trackBookedPacket/format/json/', {
      api_key: this.config.get('LEOPARDS_API_KEY'),
      api_password: this.config.get('LEOPARDS_API_PASSWORD'),
      track_numbers: trackingNumber,
    });
    return { status: res.data.packet_list?.[0]?.booked_packet_status || 'unknown', history: res.data.packet_list || [], raw: res.data };
  }
}
