import { Inject, Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Kafka');
  private connected = false;

  constructor(@Inject('KAFKA_CLIENT') private client: ClientKafka) {}

  async onModuleInit() {
    try {
      await this.client.connect();
      this.connected = true;
    } catch (err: any) {
      this.connected = false;
      this.logger.warn(`Kafka not connected: ${err?.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.connected) await this.client.close();
  }

  async publish(topic: string, payload: any) {
    if (!this.connected) {
      this.logger.log(`[KAFKA] ${topic} ${JSON.stringify(payload)}`);
      return;
    }
    try {
      this.client.emit(topic, payload);
    } catch (err: any) {
      this.logger.warn(`Kafka publish failed: ${err?.message}`);
    }
  }
}
