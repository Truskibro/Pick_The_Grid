import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Current keyboard height, 0 when hidden. Use it to pad scroll content inside
 * bottom sheets / modals so items stay reachable above the keyboard on iPhone
 * (KeyboardAvoidingView inside maxHeight-capped bottom sheets is unreliable).
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent as any, (e) => {
      setHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent as any, () => {
      setHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
