import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '@app/shared-types';

export class JobResponseDto {
  @ApiProperty({
    description: 'Unique job identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  jobId: string;

  @ApiProperty({
    description: 'Current job status',
    enum: JobStatus,
    example: JobStatus.PENDING,
  })
  status: JobStatus;

  @ApiProperty({
    description: 'Original search prompt',
    example: 'iPhone battery life',
  })
  prompt: string;

  @ApiProperty({
    description: 'Job creation timestamp',
    example: '2025-12-28T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Average sentiment score (-1.0 to +1.0)',
    example: 0.35,
  })
  averageSentiment?: number;

  @ApiPropertyOptional({
    description: 'Number of data points analyzed',
    example: 3,
  })
  dataPointsCount?: number;

  @ApiPropertyOptional({
    description: 'Job completion timestamp',
    example: '2025-12-28T10:01:00.000Z',
  })
  completedAt?: Date;
}
