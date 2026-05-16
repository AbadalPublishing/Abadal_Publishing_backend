import { IsString } from 'class-validator';

export class ForgotDto {
  @IsString() phone: string;
}
