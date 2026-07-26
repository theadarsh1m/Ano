import { useEffect, useState } from "react";
import { chamberClashPreloader, type PreloadState } from "@/lib/chamberClashPreloader";

export function useChamberClashPreloader(): PreloadState & { retry: () => void } {
  const [state, setState] = useState<PreloadState>(chamberClashPreloader.getState());

  useEffect(() => {
    const unsubscribe = chamberClashPreloader.subscribe((newState) => {
      setState(newState);
    });

    // Start preloading immediately on hook mount
    chamberClashPreloader.startPreload();

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    ...state,
    retry: () => chamberClashPreloader.retry(),
  };
}
