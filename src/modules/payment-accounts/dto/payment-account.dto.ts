import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreatePaymentAccountDto {
  @IsEnum(['BANK', 'JAZZCASH', 'EASYPAISA', 'NAYAPAY', 'SADAPAY']) type: any;
  @IsString() accountTitle: string;
  @IsString() accountNumber: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isCustomerFacing?: boolean;
}

export class UpdatePaymentAccountDto {
  @IsOptional() @IsString() accountTitle?: string;
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isCustomerFacing?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
