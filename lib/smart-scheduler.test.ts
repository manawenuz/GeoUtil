import { SmartScheduler } from './smart-scheduler';

describe('SmartScheduler', () => {
  let scheduler: SmartScheduler;

  beforeEach(() => {
    scheduler = new SmartScheduler();
  });

  describe('isInBillingWindow', () => {
    it('returns false for day 1', () => {
      expect(scheduler.isInBillingWindow(new Date(2026, 2, 1))).toBe(false);
    });

    it('returns false for day 14', () => {
      expect(scheduler.isInBillingWindow(new Date(2026, 2, 14))).toBe(false);
    });

    it('returns true for day 15', () => {
      expect(scheduler.isInBillingWindow(new Date(2026, 2, 15))).toBe(true);
    });

    it('returns true for day 28', () => {
      expect(scheduler.isInBillingWindow(new Date(2026, 2, 28))).toBe(true);
    });

    it('returns true for day 31', () => {
      expect(scheduler.isInBillingWindow(new Date(2026, 2, 31))).toBe(true);
    });
  });

  describe('getNext15th', () => {
    it('returns 15th of next month', () => {
      const result = scheduler.getNext15th(new Date(2026, 2, 20));
      expect(result.getMonth()).toBe(3); // April
      expect(result.getDate()).toBe(15);
    });

    it('handles December → January rollover', () => {
      const result = scheduler.getNext15th(new Date(2026, 11, 20));
      expect(result.getFullYear()).toBe(2027);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(15);
    });
  });

  describe('calculateNextCheck', () => {
    const now = new Date(2026, 2, 18, 12, 0, 0); // March 18 (billing window)

    describe('failed checks', () => {
      it('retries in 6 hours on failure', () => {
        const result = scheduler.calculateNextCheck(now, 0, 0, false, 0);
        expect(result.intervalHours).toBe(6);
        expect(result.shouldNotify).toBe(false);
        expect(result.newConsecutiveZeroCount).toBe(0);
      });

      it('preserves consecutive zero count on failure', () => {
        const result = scheduler.calculateNextCheck(now, 0, 0, false, 3);
        expect(result.newConsecutiveZeroCount).toBe(3);
      });
    });

    describe('bill arrival (balance changes from 0 to non-zero)', () => {
      it('notifies and pauses until 15th of next month', () => {
        const result = scheduler.calculateNextCheck(now, 0, 73.94, true, 2);
        expect(result.shouldNotify).toBe(true);
        expect(result.pauseUntil).not.toBeNull();
        expect(result.pauseUntil!.getMonth()).toBe(3); // April
        expect(result.pauseUntil!.getDate()).toBe(15);
        expect(result.newConsecutiveZeroCount).toBe(0);
      });

      it('notifies on first check (lastBalance null)', () => {
        const result = scheduler.calculateNextCheck(now, null, 50.0, true, 0);
        expect(result.shouldNotify).toBe(true);
        expect(result.pauseUntil).not.toBeNull();
      });
    });

    describe('balance still non-zero (already notified)', () => {
      it('checks again in 24 hours without notifying', () => {
        const result = scheduler.calculateNextCheck(now, 73.94, 73.94, true, 0);
        expect(result.intervalHours).toBe(24);
        expect(result.shouldNotify).toBe(false);
      });
    });

    describe('zero balance in billing window', () => {
      it('checks every 12 hours', () => {
        const result = scheduler.calculateNextCheck(now, 0, 0, true, 0);
        expect(result.intervalHours).toBe(12);
        expect(result.shouldNotify).toBe(false);
        expect(result.newConsecutiveZeroCount).toBe(1);
      });
    });

    describe('zero balance outside billing window', () => {
      it('checks every 72 hours', () => {
        const earlyMonth = new Date(2026, 2, 5, 12, 0, 0); // March 5
        const result = scheduler.calculateNextCheck(earlyMonth, 0, 0, true, 0);
        expect(result.intervalHours).toBe(72);
        expect(result.shouldNotify).toBe(false);
        expect(result.newConsecutiveZeroCount).toBe(1);
      });
    });

    describe('consecutive zero backoff', () => {
      it('backs off to 120 hours after 5 consecutive zeros', () => {
        const result = scheduler.calculateNextCheck(now, 0, 0, true, 4); // will become 5
        expect(result.intervalHours).toBe(120);
        expect(result.newConsecutiveZeroCount).toBe(5);
      });

      it('stays at 120 hours for 10+ consecutive zeros', () => {
        const result = scheduler.calculateNextCheck(now, 0, 0, true, 9);
        expect(result.intervalHours).toBe(120);
        expect(result.newConsecutiveZeroCount).toBe(10);
      });
    });

    describe('nextCheckAt timing', () => {
      it('sets correct future time for 12-hour interval', () => {
        const result = scheduler.calculateNextCheck(now, 0, 0, true, 0);
        const expectedMs = now.getTime() + 12 * 60 * 60 * 1000;
        expect(result.nextCheckAt.getTime()).toBe(expectedMs);
      });

      it('pauses until 15th of next month for bill arrival', () => {
        const result = scheduler.calculateNextCheck(now, 0, 100, true, 0);
        expect(result.nextCheckAt.getMonth()).toBe(3);
        expect(result.nextCheckAt.getDate()).toBe(15);
      });
    });
  });
});
