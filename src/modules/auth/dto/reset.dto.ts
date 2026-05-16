import { IsString, MinLength } from 'class-validator';

export class ResetDto {
  @IsString() tempToken: string;
  @IsString() @MinLength(6) newPassword: string;
}
