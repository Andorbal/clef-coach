import { useEffect } from 'react';

let holders = 0;

/**
 * While a practice screen is open, decorative motion holds still (see
 * `.practicing` in global.css). A background drifting under the frosted
 * (backdrop-filter) cards makes the GPU redo every card's blur on every frame,
 * which on a tablet means heat and battery for nothing while you play.
 */
export function usePracticeFocus(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    holders++;
    document.documentElement.classList.add('practicing');
    return () => {
      if (--holders === 0) document.documentElement.classList.remove('practicing');
    };
  }, []);
}
