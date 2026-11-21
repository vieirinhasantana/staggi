export interface ShortcutOptions {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  preventDefault?: boolean;
  target?: Window | HTMLElement;
}

export type ClickOutsideCallback = (e: MouseEvent | TouchEvent) => void;
