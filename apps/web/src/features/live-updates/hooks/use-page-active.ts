import { useEffect, useState } from "react";

export const usePageActive = (hiddenGraceMs: number) => {
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const update = () => {
      clearTimeout(timer);

      if (document.hidden) {
        timer = setTimeout(() => setIsActive(false), hiddenGraceMs);
      } else {
        setIsActive(true);
      }
    };

    if (document.hidden) {
      timer = setTimeout(() => setIsActive(false), hiddenGraceMs);
    }

    document.addEventListener("visibilitychange", update);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [hiddenGraceMs]);

  return isActive;
};
