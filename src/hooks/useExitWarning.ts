import { useEffect, useRef } from "react";

/**
 * A custom hook to display a confirmation dialog if the user attempts to exit,
 * reload, or navigate away from the active game.
 * Call bypassWarning() before manual program redirection to prevent the warning.
 */
export function useExitWarning(active: boolean) {
  const isBypassRef = useRef(false);

  const bypassWarning = () => {
    isBypassRef.current = true;
  };

  useEffect(() => {
    if (!active) return;

    // Reset bypass ref whenever active state becomes true
    isBypassRef.current = false;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isBypassRef.current) return;
      e.preventDefault();
      e.returnValue = "Are you sure you want to exit the game?";
      return "Are you sure you want to exit the game?";
    };

    const handlePopState = (e: PopStateEvent) => {
      if (isBypassRef.current) return;

      // React router or history back intercepted
      const confirmExit = window.confirm("Are you sure you want to exit the game?");
      if (!confirmExit) {
        // Push state back to prevent navigation
        window.history.pushState(null, "", window.location.href);
      } else {
        isBypassRef.current = true;
        window.history.back();
      }
    };

    // Push initial history state to intercept the back action
    window.history.pushState(null, "", window.location.href);

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [active]);

  return { bypassWarning };
}
