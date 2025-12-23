import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { JobStatus } from '@app/shared-types';
import { DatabaseService } from '../database.service';
import { jobs, NewJob, Job } from '../schema';

@Injectable()
export class JobsRepository {
  constructor(private databaseService: DatabaseService) {}

  /**
   * Create a new job
   */
  async create(data: Pick<NewJob, 'prompt' | 'status'>): Promise<Job> {
    const [job] = await this.databaseService.db
      .insert(jobs)
      .values(data)
      .returning();
    return job;
  }

  /**
   * Find job by ID
   */
  async findById(jobId: string): Promise<Job | undefined> {
    const [job] = await this.databaseService.db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId));
    return job;
  }

  /**
   * Update job status
   */
  async updateStatus(jobId: string, status: JobStatus): Promise<Job> {
    const [job] = await this.databaseService.db
      .update(jobs)
      .set({ status, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning();
    return job;
  }
}
