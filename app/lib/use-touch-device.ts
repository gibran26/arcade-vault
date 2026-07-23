'use client';

import { useEffect, useState } from 'react';

const TOUCH_QUERY = '(pointer: coarse)';

export function useTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(TOUCH_QUERY);
    setIsTouch(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsTouch(event.matches);
    };

    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  return isTouch;
}
