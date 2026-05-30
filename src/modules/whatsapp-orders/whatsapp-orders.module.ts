import { Module, forwardRef } from '@nestjs/common';
import { WhatsappOrdersService } from './whatsapp-orders.service';
import { WhatsappOrdersController } from './whatsapp-orders.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [WhatsappOrdersService],
  controllers: [WhatsappOrdersController],
  exports: [WhatsappOrdersService],
})
export class WhatsappOrdersModule {}
