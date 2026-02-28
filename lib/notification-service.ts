import axios from 'axios';

/**
 * Notification payload for ntfy.sh
 */
export interface NotificationPayload {
  topic: string; // ntfy.sh topic from user config
  title: string;
  message: string;
  priority: 'default' | 'high' | 'urgent';
  tags: string[];
  serverUrl: string; // configurable ntfy.sh server
}

/**
 * NotificationService handles sending notifications via ntfy.sh
 * 
 * Requirements:
 * - 8.1: Send notifications for non-zero balances
 * - 8.2: Include provider name, account number, and balance in notifications
 * - 8.3: Format balance with ₾ symbol
 * - 8.4: Use normal priority for new non-zero balances
 * - 9.1: Use high priority for 8-14 days overdue
 * - 9.2: Use urgent priority for 15+ days overdue
 * - 9.4: Include overdue days in escalated notifications
 * - 25.1, 25.2, 25.3: Use configurable ntfy.sh server URL
 */
export class NotificationService {
  private defaultServerUrl: string;

  constructor(defaultServerUrl?: string) {
    this.defaultServerUrl = defaultServerUrl || process.env.NTFY_SERVER_URL || 'https://ntfy.sh';
  }

  /**
   * Send a notification via ntfy.sh
   * 
   * @param notification - The notification payload
   * @returns Promise<boolean> - true if notification was sent successfully
   */
  async sendNotification(notification: NotificationPayload): Promise<boolean> {
    try {
      const url = `${notification.serverUrl}/${notification.topic}`;
      
      await axios.post(url, notification.message, {
        headers: {
          'Title': notification.title,
          'Priority': notification.priority,
          'Tags': notification.tags.join(','),
        },
        timeout: 10000, // 10 second timeout
      });

      return true;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  /**
   * Determine notification priority based on overdue days
   * 
   * Requirements:
   * - 8.4: 0-7 days: default priority
   * - 9.1: 8-14 days: high priority
   * - 9.2: 15+ days: urgent priority
   * 
   * @param overdueDays - Number of days the balance has been non-zero
   * @returns Priority level for the notification
   */
  determinePriority(overdueDays: number): 'default' | 'high' | 'urgent' {
    if (overdueDays >= 15) {
      return 'urgent';
    } else if (overdueDays >= 8) {
      return 'high';
    } else {
      return 'default';
    }
  }

  /**
   * Format a balance notification message
   * 
   * Requirements:
   * - 8.2: Include provider name, account number, and balance
   * - 8.3: Format balance with ₾ symbol
   * - 9.4: Include overdue days in escalated notifications
   * 
   * @param providerName - Name of the utility provider
   * @param accountNumber - Account number (will be masked)
   * @param balance - Balance amount in Georgian Lari
   * @param overdueDays - Number of days overdue (optional)
   * @returns Formatted notification message
   */
  formatBalanceMessage(
    providerName: string,
    accountNumber: string,
    balance: number,
    overdueDays?: number
  ): string {
    // Mask account number (show last 4 digits)
    const maskedAccount = this.maskAccountNumber(accountNumber);
    
    // Format balance with ₾ symbol
    const formattedBalance = `${balance.toFixed(2)} ₾`;
    
    // Build message
    let message = `${providerName} - Account ${maskedAccount}\nBalance: ${formattedBalance}`;
    
    // Add overdue information if applicable
    if (overdueDays !== undefined && overdueDays > 0) {
      message += `\nOverdue: ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
    }
    
    return message;
  }

  /**
   * Mask account number for privacy (show last 4 digits)
   * 
   * @param accountNumber - Full account number
   * @returns Masked account number
   */
  private maskAccountNumber(accountNumber: string): string {
    if (accountNumber.length <= 4) {
      return accountNumber;
    }
    
    const lastFour = accountNumber.slice(-4);
    const masked = '*'.repeat(Math.min(accountNumber.length - 4, 8));
    return `${masked}${lastFour}`;
  }

  /**
   * Get the default server URL
   */
  getDefaultServerUrl(): string {
    return this.defaultServerUrl;
  }
}
