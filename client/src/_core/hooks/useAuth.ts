import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, NATIVE_TOKEN_KEY } from "@shared/const";
import { TRPCClientError } from "@trpc/client";
import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    // On native, allow 1 retry for transient network errors post-login.
    // On web, retry:false prevents redirect loops when not authenticated.
    retry: Capacitor.isNativePlatform() ? 1 : false,
    retryDelay: 2000,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = useCallback(async () => {
    try {
      // Clear the tRPC cookie via the tRPC mutation
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        // Already logged out, continue
      } else {
        console.error("[Auth] Logout error:", error);
      }
    } finally {
      localStorage.removeItem(NATIVE_TOKEN_KEY);
      localStorage.removeItem('manus-runtime-user-info'); // prevent hadSession check from triggering on reload
      // Clear local cookie (set on evgreen://localhost, not app.evgreen.lat)
      document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();

      if (Capacitor.isNativePlatform()) {
        // On native, reload resets all JS state — no need to setData/invalidate first.
        // Doing so triggers isAuthenticated=false→doOpenLogin() BEFORE the reload,
        // which opens a zombie SFSafariViewController that corrupts the next login flow.
        sessionStorage.setItem('evgreen_logout', '1');
        history.replaceState(null, '', '/');
        window.location.reload();
      } else {
        // On web: clear cache then go through Auth0 logout to clear the Auth0 session.
        utils.auth.me.setData(undefined, null);
        await utils.auth.me.invalidate();
        window.location.href = `${window.location.origin}/api/auth/logout`;
      }
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  // Refetchear auth.me cuando llega un deep link con la app ya abierta
  useEffect(() => {
    const handler = () => meQuery.refetch();
    window.addEventListener('evgreen-auth-updated', handler);
    return () => window.removeEventListener('evgreen-auth-updated', handler);
  }, [meQuery]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
