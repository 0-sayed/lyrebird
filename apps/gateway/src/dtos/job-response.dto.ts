import { ApiProperty } from '@nestjs/swagger';
import { JobStatus } from '@app/shared-types';

export class JobResponseDto {
  @ApiProperty({
    description: 'Unique job identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  jobId: string;

  @ApiProperty({
    description: 'Job status',
    example: JobStatus.PENDING,
    enum: JobStatus,
  })
  status: JobStatus;

  @ApiProperty({
    description: 'Job creation timestamp',
    example: '2025-12-23T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Original prompt',
    example: 'iPhone battery life',
  })
  prompt: string;
}
