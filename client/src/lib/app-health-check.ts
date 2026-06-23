/**
 * App-level health check that runs INSIDE the React app.
 * If the API is unreachable (503, network error), it shows a recovery UI
 * even if the Service Worker didn't catch it (e.g., SW not installed yet,
 * or the request was not a navigation request).
 * 
 * This is a defense-in-depth approach:
 * 1. Service Worker catches 503 on navigation → shows recovery HTML
 * 2. If SW misses it, this module detects API failure → shows in-app recovery
 * 3. LoadingGuard catches timeout → shows retry UI
 */

import { getApiUrl } from "./utils";

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_ALERT = 3;

export async function checkServerHealth(): Promise<{
  healthy: boolean;
  status?: number;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(getApiUrl("/api/health"), {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'X-Health-Check': 'frontend' },
    });
    clearTimeout(timeout);
    
    if (response.ok) {
      consecutiveFailures = 0;
      return { healthy: true, status: response.status };
    }
    
    consecutiveFailures++;
    return { healthy: false, status: response.status };
  } catch (error: any) {
    consecutiveFailures++;
    return { 
      healthy: false, 
      error: error.name === 'AbortError' ? 'timeout' : error.message 
    };
  }
}

/**
 * Start periodic health monitoring.
 * If the server goes down while the user is using the app,
 * this will detect it and can trigger a callback.
 */
export function startHealthMonitor(
  onServerDown: () => void,
  intervalMs: number = 60000 // Check every minute
) {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  healthCheckInterval = setInterval(async () => {
    const result = await checkServerHealth();
    
    if (!result.healthy && consecutiveFailures >= MAX_FAILURES_BEFORE_ALERT) {
      console.error(`[HealthMonitor] Server unreachable after ${consecutiveFailures} checks`);
      onServerDown();
    }
  }, intervalMs);
  
  return () => {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
  };
}
