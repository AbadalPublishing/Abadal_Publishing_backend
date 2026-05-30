import { IsString, IsOptional, IsArray, IsUrl, Length, MaxLength, IsObject } from 'class-validator';

export class UpgradeToAuthorDto {
  @IsString() @Length(2, 80)   penName!: string;
  @IsString() @Length(20, 2000) bio!: string;
  @IsArray() @IsString({ each: true }) languages!: string[];
  @IsOptional() @IsString() @IsUrl() photo?: string;
  @IsOptional() @IsString() @IsUrl() website?: string;
  @IsOptional() @IsString() @MaxLength(60) nationality?: string;
  @IsOptional() @IsObject() socialLinks?: Record<string, string>;
}
