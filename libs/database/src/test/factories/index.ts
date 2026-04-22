export * from './job.factory';
export * from './sentiment.factory';

import { resetJobFactory } from './job.factory';
import { resetSentimentFactory } from './sentiment.factory';

export function resetAllFactories(): void {
  resetJobFactory();
  resetSentimentFactory();
}
