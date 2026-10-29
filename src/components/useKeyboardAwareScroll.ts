import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';

export interface Measurable {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
}

const MARGIN = 24;

/**
 * Keeps the focused input above the soft keyboard inside a ScrollView.
 * Done by hand because KeyboardAvoidingView is unreliable on Android with edge-to-edge
 * (mandatory since SDK 54): the window no longer resizes for the keyboard.
 *
 * Usage: spread `scrollProps` on the ScrollView, add `keyboardHeight` as bottom padding,
 * and call `onInputFocus(ref)` from each input's onFocus.
 */
export function useKeyboardAwareScroll() {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offsetY = useRef(0);
  const focused = useRef<Measurable | null>(null);
  const keyboardTop = useRef<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const ensureVisible = useCallback(() => {
    const target = focused.current;
    const top = keyboardTop.current;
    if (!target || top === null) return;
    target.measureInWindow((_x, y, _w, h) => {
      const overlap = y + h + MARGIN - top;
      if (overlap > 0) scrollRef.current?.scrollTo({ y: offsetY.current + overlap, animated: true });
    });
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKeyboardHeight(e.endCoordinates.height);
      // Wait for the bottom padding to render so there is room to scroll into.
      setTimeout(ensureVisible, 50);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [ensureVisible]);

  const onInputFocus = useCallback(
    (input: Measurable | null) => {
      focused.current = input;
      ensureVisible();
    },
    [ensureVisible],
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetY.current = e.nativeEvent.contentOffset.y;
  }, []);

  return {
    keyboardHeight,
    onInputFocus,
    scrollProps: {
      ref: scrollRef,
      onScroll,
      scrollEventThrottle: 16,
    },
  };
}
