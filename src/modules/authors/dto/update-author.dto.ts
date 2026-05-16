import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAuthorDto {
  @IsOptional() @IsString() penName?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() photo?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() socialLinks?: any;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsArray() languages?: string[];
  @IsOptional() @IsNumber() royaltyPercentage?: number;
}
