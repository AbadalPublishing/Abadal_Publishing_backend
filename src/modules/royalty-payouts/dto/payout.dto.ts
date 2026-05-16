import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePayoutDto {
  @IsString() authorId: string;
  @IsNumber() amount: number;
  @IsString() period: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdatePayoutDto {
  @IsOptional() @IsString() bankRef?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}
