import { Alert, Platform } from 'react-native';

export interface AppAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

/**
 * Cross-platform replacement for Alert.alert. On native this is exactly
 * Alert.alert; on web Alert.alert is a silent no-op, so dialogs are rendered
 * with window.confirm / window.alert instead — every flow that gates on a
 * confirmation (sign out, league actions) would otherwise appear broken in
 * the web preview.
 */
export function appAlert(title: string, message?: string, buttons?: AppAlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length === 0) {
    window.alert(text);
    return;
  }

  if (buttons.length === 1) {
    window.alert(text);
    buttons[0].onPress?.();
    return;
  }

  const confirmed = window.confirm(text);
  if (confirmed) {
    const confirmButton = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];
    confirmButton?.onPress?.();
  } else {
    const cancelButton = buttons.find((b) => b.style === 'cancel');
    cancelButton?.onPress?.();
  }
}
