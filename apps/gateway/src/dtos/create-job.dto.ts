import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJobDto {
  @ApiProperty({
    description: 'Search prompt for sentiment analysis',
    example: 'iPhone battery life',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'Prompt is required' })
  @MinLength(3, { message: 'Prompt must be at least 3 characters' })
  @MaxLength(500, { message: 'Prompt cannot exceed 500 characters' })
  prompt: string;
}
