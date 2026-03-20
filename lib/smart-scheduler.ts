/**
 * Smart Scheduler
 *
 * Billing-cycle-aware scheduling for Georgian utility balance checks.
 *
 * Rules:
 * - Days 15–end of month (billing window): check every 12 hours
 * - Days 1–14: check every 72 hours (no bills expected)
 * - Balance changed from 0 to non-zero (bill arrived): notify, pause until 15th of next month
 * - Balance has been zero for 5+ consecutive checks: back off to every 120 hours
 * - After a failed check: retry in 6 hours
 */

export interface ScheduleDecision {
  nextCheckAt: Date;
  intervalHours: number;
  shouldNotify: boolean;
  pauseUntil: Date | null;
  newConsecutiveZeroCount: number;
}

export class SmartScheduler {
  /**
   * Calculate the next check time based on current state and billing cycle.
   */
  calculateNextCheck(
    now: Date,
    lastBalance: number | null,
    currentBalance: number,
    checkSuccess: boolean,
    consecutiveZeroCount: number,
  ): ScheduleDecision {
    // Failed check: retry in 6 hours
    if (!checkSuccess) {
      return {
        nextCheckAt: this.addHours(now, 6),
        intervalHours: 6,
        shouldNotify: false,
        pauseUntil: null,
        newConsecutiveZeroCount: consecutiveZeroCount,
      };
    }

    // Bill arrived: balance changed from 0 (or null/first check) to non-zero
    const billArrived = currentBalance > 0 && (lastBalance === null || lastBalance === 0);
    if (billArrived) {
      const pauseUntil = this.getNext15th(now);
      return {
        nextCheckAt: pauseUntil,
        intervalHours: 0,
        shouldNotify: true,
        pauseUntil,
        newConsecutiveZeroCount: 0,
      };
    }

    // Balance is still non-zero (already notified, keep checking daily for payment)
    if (currentBalance > 0) {
      return {
        nextCheckAt: this.addHours(now, 24),
        intervalHours: 24,
        shouldNotify: false,
        pauseUntil: null,
        newConsecutiveZeroCount: 0,
      };
    }

    // Balance is zero
    const newZeroCount = consecutiveZeroCount + 1;

    // Zero for 5+ checks: back off
    if (newZeroCount >= 5) {
      return {
        nextCheckAt: this.addHours(now, 120),
        intervalHours: 120,
        shouldNotify: false,
        pauseUntil: null,
        newConsecutiveZeroCount: newZeroCount,
      };
    }

    // In billing window (15th–end of month): check every 12 hours
    if (this.isInBillingWindow(now)) {
      return {
        nextCheckAt: this.addHours(now, 12),
        intervalHours: 12,
        shouldNotify: false,
        pauseUntil: null,
        newConsecutiveZeroCount: newZeroCount,
      };
    }

    // Outside billing window (1st–14th): check every 72 hours
    return {
      nextCheckAt: this.addHours(now, 72),
      intervalHours: 72,
      shouldNotify: false,
      pauseUntil: null,
      newConsecutiveZeroCount: newZeroCount,
    };
  }

  /**
   * Is the date in the billing window (15th to end of month)?
   */
  isInBillingWindow(date: Date): boolean {
    return date.getDate() >= 15;
  }

  /**
   * Get the 15th of the next month.
   */
  getNext15th(from: Date): Date {
    const year = from.getMonth() === 11 ? from.getFullYear() + 1 : from.getFullYear();
    const month = from.getMonth() === 11 ? 0 : from.getMonth() + 1;
    return new Date(year, month, 15, 8, 0, 0); // 8 AM on the 15th
  }

  private addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }
}
