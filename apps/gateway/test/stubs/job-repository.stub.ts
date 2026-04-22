import type { Job, NewJob, JobsRepository } from '@app/database';
import { JobStatus } from '@app/shared-types';

/**
 * Jest-free in-memory stub for JobsRepository
 * Used in E2E tests where we need a standalone NestJS server
 */
export class JobRepositoryStub implements Partial<JobsRepository> {
  private jobs: Map<string, Job> = new Map();

  create(data: Pick<NewJob, 'prompt' | 'status' | 'userId'>): Promise<Job> {
    const job: Job = {
      id: crypto.randomUUID(),
      userId: data.userId ?? null,
      prompt: data.prompt,
      status: data.status ?? JobStatus.PENDING,
      searchStrategy: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };
    this.jobs.set(job.id, job);
    return Promise.resolve(job);
  }

  findById(jobId: string): Promise<Job | undefined> {
    return Promise.resolve(this.jobs.get(jobId));
  }

  findAll(): Promise<Job[]> {
    return Promise.resolve(Array.from(this.jobs.values()));
  }

  updateStatus(jobId: string, status: JobStatus): Promise<Job> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return Promise.reject(new Error(`Job not found: ${jobId}`));
    }
    job.status = status;
    job.updatedAt = new Date();
    if (status === JobStatus.COMPLETED) {
      job.completedAt = new Date();
    }
    return Promise.resolve(job);
  }

  delete(jobId: string): Promise<Job | undefined> {
    const job = this.jobs.get(jobId);
    if (job) {
      this.jobs.delete(jobId);
    }
    return Promise.resolve(job);
  }

  // === User-scoped methods (gateway only) ===

  findAllForUser(userId: string): Promise<Job[]> {
    const userJobs = Array.from(this.jobs.values())
      .filter((job) => job.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.resolve(userJobs);
  }

  findByIdForUser(id: string, userId: string): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (job && job.userId === userId) {
      return Promise.resolve(job);
    }
    return Promise.resolve(undefined);
  }

  deleteForUser(id: string, userId: string): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (job && job.userId === userId) {
      this.jobs.delete(id);
      return Promise.resolve(job);
    }
    return Promise.resolve(undefined);
  }

  // Test helpers
  reset(): void {
    this.jobs.clear();
  }

  seed(jobs: Job[]): void {
    for (const job of jobs) {
      this.jobs.set(job.id, job);
    }
  }

  getAll(): Job[] {
    return Array.from(this.jobs.values());
  }
}
