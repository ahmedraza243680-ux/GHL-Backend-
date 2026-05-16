import { startDailyPostPublisher } from './dailyPostPublisher.js';

export function startScheduledJobs() {
  startDailyPostPublisher();
}
