import { redirect } from "react-router";
import prisma from "../db.server";
import { isShopifyAccessRevoked } from "./admin-shopify-error";

const TOKEN_CYCLE_PARAM = "token_cycle";

export async function retryAfterRevokedShopifyAccess(error, request, shop) {
  if (!isShopifyAccessRevoked(error)) {
    return false;
  }

  const url = new URL(request.url);
  if (url.searchParams.get(TOKEN_CYCLE_PARAM) === "1") {
    return false;
  }

  if (shop) {
    await prisma.session.deleteMany({ where: { shop } });
  }

  url.searchParams.set(TOKEN_CYCLE_PARAM, "1");
  throw redirect(`${url.pathname}${url.search}`);
}
