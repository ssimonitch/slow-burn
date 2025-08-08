/**
 * Hook to monitor network status and provide feedback
 *
 * This hook monitors the browser's online/offline status and shows
 * appropriate toast notifications when the connection state changes.
 */

import { useEffect, useState } from 'react';

import { createRateLimiter } from '@/lib/rateLimiter';
import { networkToast } from '@/lib/toast';

/**
 * Network Information API types (experimental browser API)
 */
interface NetworkInformation {
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  downlink?: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

/**
 * Extended Navigator interface with Network Information API
 */
interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

/**
 * Create a rate limiter for slow connection toasts
 * Using 30 second cooldown to prevent spam
 */
const slowConnectionRateLimiter = createRateLimiter(30000);

/**
 * Network status hook
 *
 * @returns Object containing online status and connection type (if available)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOnline, isSlowConnection } = useNetworkStatus();
 *
 *   if (!isOnline) {
 *     return <OfflineMessage />;
 *   }
 *
 *   if (isSlowConnection) {
 *     return <SlowConnectionWarning />;
 *   }
 *
 *   return <OnlineContent />;
 * }
 * ```
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    // Check connection speed (if available)
    const checkConnectionSpeed = () => {
      const nav = navigator as NavigatorWithConnection;
      const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;

      if (connection) {
        // Check for slow connection types
        const slowTypes: NetworkInformation['effectiveType'][] = ['slow-2g', '2g', '3g'];
        const effectiveType = connection.effectiveType;

        if (effectiveType && slowTypes.includes(effectiveType)) {
          setIsSlowConnection(true);
          // Only show toast if rate limiter allows
          if (slowConnectionRateLimiter.canShow('slow-connection')) {
            networkToast.slowConnection();
          }
        } else if (connection.downlink !== undefined && connection.downlink < 1) {
          // Also check downlink speed (in Mbps)
          setIsSlowConnection(true);
          if (isOnline && slowConnectionRateLimiter.canShow('slow-connection')) {
            networkToast.slowConnection();
          }
        } else {
          // Connection is good now
          setIsSlowConnection((prevSlow) => {
            // Reset rate limiter when connection improves from slow to fast
            if (prevSlow) {
              slowConnectionRateLimiter.reset('slow-connection');
            }
            return false;
          });
        }
      }
    };

    const handleOnline = () => {
      setIsOnline(true);

      // Only show the "back online" toast if we were previously offline
      if (wasOffline) {
        networkToast.online();
        setWasOffline(false);
      }

      // Check connection speed when coming online
      checkConnectionSpeed();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      networkToast.offline();
    };

    // Set up event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connection on mount
    if (!navigator.onLine) {
      handleOffline();
    } else {
      checkConnectionSpeed();
    }

    // Listen for connection changes (if supported)
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    if (connection?.addEventListener && connection?.removeEventListener) {
      const handleConnectionChange = () => {
        checkConnectionSpeed();
      };
      connection.addEventListener('change', handleConnectionChange);

      // Cleanup connection listener
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener?.('change', handleConnectionChange);
      };
    }

    // Cleanup without connection API
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline, isOnline]);

  return {
    isOnline,
    isSlowConnection,
  };
}
