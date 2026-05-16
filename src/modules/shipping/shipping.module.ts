import { Global, Module } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { TraxAdapter } from './adapters/trax.adapter';
import { LeopardsAdapter } from './adapters/leopards.adapter';

@Global()
@Module({
  providers: [ShippingService, TraxAdapter, LeopardsAdapter],
  controllers: [ShippingController],
  exports: [ShippingService],
})
export class ShippingModule {}
