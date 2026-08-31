import dotenv from "dotenv";
dotenv.config();
import "@shopify/shopify-app-react-router/adapters/node";
import { redirect } from "react-router";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma, { ensurePrismaConnected } from "./db.server";
import {
  getSupportAuthDecision,
  isSupportEligiblePath,
} from "./services/admin-support-session.server";
import { cycleAllNonExpiringOfflineTokens, cycleShopOfflineTokenIfNeeded } from "./services/cycle-offline-tokens.server";

function createDeferredSessionStorage() {
  let storage;
  let ready;

  const connect = () => {
    if (storage) return Promise.resolve(storage);
    if (!ready) {
      ready = ensurePrismaConnected()
        .then(() => {
          storage = new PrismaSessionStorage(prisma);
          void cycleAllNonExpiringOfflineTokens().catch((error) => {
            console.error(
              "[auth:offline_token_cycle] startup cycle failed:",
              error?.message || error,
            );
          });
          return storage;
        })
        .catch((error) => {
          ready = undefined;
          throw error;
        });
    }
    return ready;
  };

  const isClosedConnection = (error) => {
    const message = String(error?.message || error);
    return (
      message.includes("Server has closed the connection") ||
      message.includes("Connection terminated") ||
      message.includes("Can't reach database server")
    );
  };

  const call = (method) => async (...args) => {
    const impl = await connect();
    try {
      return await impl[method](...args);
    } catch (error) {
      if (!isClosedConnection(error)) throw error;
      storage = undefined;
      ready = undefined;
      await prisma.$disconnect().catch(() => {});
      const retry = await connect();
      return retry[method](...args);
    }
  };

  return {
    storeSession: call("storeSession"),
    loadSession: call("loadSession"),
    deleteSession: call("deleteSession"),
    deleteSessions: call("deleteSessions"),
    findSessionsByShop: call("findSessionsByShop"),
  };
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: createDeferredSessionStorage(),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

const adminAuthByRequest = new WeakMap();

function shopFromRequest(request) {
  try {
    return new URL(request.url).searchParams.get("shop") || "";
  } catch {
    return "";
  }
}

async function unauthenticatedAdmin(shop, ...rest) {
  await cycleShopOfflineTokenIfNeeded(shop);
  return shopify.unauthenticated.admin(shop, ...rest);
}

async function authenticateAdmin(request, options) {
  const cached = adminAuthByRequest.get(request);
  if (cached) return cached;

  const pending = authenticateAdminUncached(request, options);
  adminAuthByRequest.set(request, pending);
  return pending;
}

async function authenticateAdminUncached(request, options) {
  const pathname = new URL(request.url).pathname;

  if (isSupportEligiblePath(pathname)) {
    const decision = await getSupportAuthDecision(request);
    if (decision.type === "active") {
      try {
        const result = await unauthenticatedAdmin(decision.support.shop);
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

  const shop = shopFromRequest(request);
  if (shop) {
    await cycleShopOfflineTokenIfNeeded(shop);
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
export const unauthenticated = new Proxy(shopify.unauthenticated, {
  get(target, prop, receiver) {
    if (prop === "admin") {
      return unauthenticatedAdmin;
    }
    const value = Reflect.get(target, prop, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
