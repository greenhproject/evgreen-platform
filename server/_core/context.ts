import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { resolveTenantContext, type TenantContext } from "../organizations/tenant-middleware";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  tenant?: TenantContext;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  let tenant: TenantContext | undefined;
  if (user) {
    const header = opts.req.headers["x-organization-id"];
    const headerOrgId = Array.isArray(header) ? header[0] : header;
    tenant = await resolveTenantContext(user.id, user.openId, headerOrgId, user.role);
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    tenant,
  };
}
