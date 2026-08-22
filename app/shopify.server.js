import dotenv from "dotenv";
dotenv.config({ override: true });
import "@shopify/shopify-app-react-router/adapters/node";
import { redirect } from "react-router";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import {
  getSupportAuthDecision,
  isSupportEligiblePath,
} from "./services/admin-support-session.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

async function authenticateAdmin(request, options) {
  const pathname = new URL(request.url).pathname;

  if (isSupportEligiblePath(pathname)) {
    const decision = await getSupportAuthDecision(request);
    if (decision.type === "active") {
      try {
        const result = await shopify.unauthenticated.admin(decision.support.shop);
        return {
          session: result.session,
          admin: result.admin,
          redirect,
        };
      } catch (error) {
        console.error("Admin support session could not load shop:", decision.support.shop, error);
        throw redirect("/admin/users?error=shop_unavailable");
      }
    }
    if (decision.type === "stale") {
      throw redirect("/admin/users?error=support_session_expired");
    }
  }

  return shopify.authenticate.admin(request, options);
}

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = new Proxy(shopify.authenticate, {
  get(target, prop, receiver) {
    if (prop === "admin") {
      return authenticateAdmin;
    }
    const value = Reflect.get(target, prop, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
