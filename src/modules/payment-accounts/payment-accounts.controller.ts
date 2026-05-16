import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { PaymentAccountsService } from './payment-accounts.service';
import { CreatePaymentAccountDto, UpdatePaymentAccountDto } from './dto/payment-account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('payment-accounts')
@UseGuards(JwtAuthGuard)
export class PaymentAccountsController {
  constructor(private accounts: PaymentAccountsService) {}

  @Get()
  list(@CurrentUser() user: any) { return this.accounts.list(user); }

  @Public() @Get('customer-facing')
  customerFacing() { return this.accounts.customerFacing(); }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreatePaymentAccountDto) {
    return this.accounts.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePaymentAccountDto) {
    return this.accounts.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.remove(user, id);
  }

  @Patch(':id/default')
  setDefault(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.setDefault(user, id);
  }
}
