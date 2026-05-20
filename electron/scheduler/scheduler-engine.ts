/**
 * Scheduler Engine
 * 
 * Checks schedule entries every 60 seconds and applies/removes speed limits
 * based on the current day-of-week and time-of-day.
 */

import * as db from '../db/store';
import { getTorrentManager } from '../torrent';
import { logger } from '../utils';

const log = logger.child('SchedulerEngine');

export class SchedulerEngine {
  private interval: NodeJS.Timeout | null = null;
  private isLimited = false; // Whether a schedule limit is currently applied

  /**
   * Start the scheduler engine — checks every 60 seconds
   */
  start(): void {
    if (this.interval) return;
    log.info('Scheduler engine started');

    // Check immediately on start
    this.tick();

    // Then every 60 seconds
    this.interval = setInterval(() => this.tick(), 60_000);
  }

  /**
   * Stop the scheduler engine
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    log.info('Scheduler engine stopped');
  }

  /**
   * Single tick — check if any schedule matches now
   */
  private async tick(): Promise<void> {
    try {
      const schedulerConfig = await db.getScheduler();

      if (!schedulerConfig.enabled || schedulerConfig.schedules.length === 0) {
        // Scheduler disabled — if we were limiting, restore defaults
        if (this.isLimited) {
          await this.removeLimits();
        }
        return;
      }

      const now = new Date();
      const currentDay = now.getDay(); // 0=Sun ... 6=Sat
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Find a matching schedule
      const matchingSchedule = schedulerConfig.schedules.find(schedule => {
        if (!schedule.days.includes(currentDay)) return false;
        return currentTime >= schedule.startTime && currentTime < schedule.endTime;
      });

      if (matchingSchedule) {
        // We are inside a schedule window
        if (matchingSchedule.speedLimit && matchingSchedule.speedLimit > 0) {
          // Apply the speed limit (KB/s)
          const manager = getTorrentManager();
          await manager.updateSettings({
            maxDownKbps: matchingSchedule.speedLimit,
            maxUpKbps: matchingSchedule.speedLimit,
          });
          this.isLimited = true;
          log.debug('Schedule speed limit applied', {
            limit: matchingSchedule.speedLimit,
            schedule: matchingSchedule.id,
          });
        }
      } else {
        // No schedule matches — remove limit if previously applied
        if (this.isLimited) {
          await this.removeLimits();
        }
      }
    } catch (error) {
      log.error('Scheduler tick error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Restore speed settings to the user's saved defaults
   */
  private async removeLimits(): Promise<void> {
    try {
      const settings = await db.getSettings();
      const manager = getTorrentManager();
      await manager.updateSettings({
        maxDownKbps: settings.maxDownKbps,
        maxUpKbps: settings.maxUpKbps,
      });
      this.isLimited = false;
      log.debug('Schedule speed limits removed, restored user defaults');
    } catch (error) {
      log.error('Failed to remove schedule limits', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  destroy(): void {
    this.stop();
  }
}

let schedulerInstance: SchedulerEngine | null = null;

export function getSchedulerEngine(): SchedulerEngine {
  if (!schedulerInstance) {
    schedulerInstance = new SchedulerEngine();
  }
  return schedulerInstance;
}
