import type { Job, NewJob, JobsRepository } from '@app/database';
import { JobStatus } from '@app/shared-types';

/**
 * Jest-free in-memory stub for JobsRepository
 * Used in E2E tests where we need a standalone NestJS server
 */
export class JobRepositoryStub implements Partial<JobsRepository> {
  private jobs: Map<string, Job> = new Map();

  create(data: Pick<NewJob, 'prompt' | 'status'>): Promise<Job> {
    const job: Job = {
      id: crypto.randomUUID(),
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

  // Test helpers
  reset(): void {
    this.jobs.clear();
  }

  seed(jobs: Job[]): void {
    jobs.forEach((job) => this.jobs.set(job.id, job));
  }

  getAll(): Job[] {
    return Array.from(this.jobs.values());
  }
}
