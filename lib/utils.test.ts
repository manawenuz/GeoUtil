/**
 * Basic test to verify Jest setup
 */

describe('Project Setup', () => {
  it('should have Jest configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should support TypeScript', () => {
    const greeting: string = 'Hello, Georgia!';
    expect(greeting).toBe('Hello, Georgia!');
  });
});
