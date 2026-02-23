import { Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { JobStatus } from '@app/shared-types';
import { DatabaseService } from '../database.service';
import { jobs, NewJob, Job } from '../schema';

@Injectable()
export class JobsRepository {
  constructor(private databaseService: DatabaseService) {}

  /**
   * Create a new job
   */
  async create(
    data: Pick<NewJob, 'prompt' | 'status' | 'userId'>,
  ): Promise<Job> {
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

  /**
   * Find all jobs
   */
  async findAll(): Promise<Job[]> {
    return this.databaseService.db.select().from(jobs);
  }

  /**
   * Delete a job by ID
   * @returns The deleted job, or undefined if not found
   */
  async delete(jobId: string): Promise<Job | undefined> {
    const [deletedJob] = await this.databaseService.db
      .delete(jobs)
      .where(eq(jobs.id, jobId))
      .returning();
    return deletedJob;
  }

  // === User-scoped methods (gateway only) ===

  async findAllForUser(userId: string): Promise<Job[]> {
    return this.databaseService.db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .orderBy(desc(jobs.createdAt));
  }

  async findByIdForUser(id: string, userId: string): Promise<Job | undefined> {
    const [job] = await this.databaseService.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
    return job;
  }

  async deleteForUser(id: string, userId: string): Promise<Job | undefined> {
    const [deletedJob] = await this.databaseService.db
      .delete(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning();
    return deletedJob;
  }
}
