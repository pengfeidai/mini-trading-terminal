import { useState, useEffect } from "react";

/**
 * Hook to detect if the device is desktop (screen width >= 768px)
 * This ensures the draggable window only works on desktop devices
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    // Check on mount
    checkIsDesktop();

    // Listen for resize events
    window.addEventListener("resize", checkIsDesktop);

    return () => {
      window.removeEventListener("resize", checkIsDesktop);
    };
  }, []);

  return isDesktop;
}
