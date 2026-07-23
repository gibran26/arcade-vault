'use client';

import { useSyncExternalStore } from 'react';

const TOUCH_QUERY = '(pointer: coarse)';

function subscribe(onChange: () => void) {
  const mediaQueryList = window.matchMedia(TOUCH_QUERY);
  mediaQueryList.addEventListener('change', onChange);
  return () => mediaQueryList.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(TOUCH_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useTouchDevice(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
