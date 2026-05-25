import { Module } from '@nestjs/common';
import { WhatsappOrdersService } from './whatsapp-orders.service';
import { WhatsappOrdersController } from './whatsapp-orders.controller';

@Module({
  providers: [WhatsappOrdersService],
  controllers: [WhatsappOrdersController],
  exports: [WhatsappOrdersService],
})
export class WhatsappOrdersModule {}
