import { useState, useEffect } from 'react';
import { onlineManager } from '@tanstack/react-query';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? window.navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateStatus = () => {
      const online = window.navigator.onLine;
      setIsOnline(online);
      onlineManager.setOnline(online);
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return { isOnline };
}
