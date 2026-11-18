type SessionExpiredListener = () => void;

const listeners = new Set<SessionExpiredListener>();

export const onSessionExpired = (listener: SessionExpiredListener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const notifySessionExpired = () => {
  listeners.forEach((listener) => listener());
};
