import { useEffect, useRef, useState } from 'react';
import { Keyboard, type ViewInstance } from 'react-native';

/**
 * How much of `containerRef`'s bottom edge the soft keyboard covers.
 * Measured rather than assumed, so it is right whether or not Android resizes the window
 * (with edge-to-edge it usually doesn't). Use it as bottom padding under a footer.
 */
export function useKeyboardInset() {
  const containerRef = useRef<ViewInstance>(null);
  const [inset, setInset] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const keyboardTop = e.endCoordinates.screenY;
      // Let a possible window resize settle before measuring.
      timer = setTimeout(() => {
        containerRef.current?.measureInWindow((_x, y, _w, h) => setInset(Math.max(0, y + h - keyboardTop)));
      }, 50);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      clearTimeout(timer);
      show.remove();
      hide.remove();
    };
  }, []);

  return { containerRef, inset };
}
