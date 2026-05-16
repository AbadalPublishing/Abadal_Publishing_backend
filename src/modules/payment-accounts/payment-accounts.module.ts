import { Module } from '@nestjs/common';
import { PaymentAccountsService } from './payment-accounts.service';
import { PaymentAccountsController } from './payment-accounts.controller';

@Module({
  providers: [PaymentAccountsService],
  controllers: [PaymentAccountsController],
})
export class PaymentAccountsModule {}
