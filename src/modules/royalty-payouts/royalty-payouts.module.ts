import { Module } from '@nestjs/common';
import { RoyaltyPayoutsService } from './royalty-payouts.service';
import { RoyaltyPayoutsController } from './royalty-payouts.controller';

@Module({
  providers: [RoyaltyPayoutsService],
  controllers: [RoyaltyPayoutsController],
})
export class RoyaltyPayoutsModule {}
