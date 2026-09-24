export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  window.Telegram?.WebApp.HapticFeedback.impactOccurred(style);
}
