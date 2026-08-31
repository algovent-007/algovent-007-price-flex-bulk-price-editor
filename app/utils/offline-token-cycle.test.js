import test from "node:test";
import assert from "node:assert/strict";
import { needsOfflineTokenCycle } from "./offline-token-cycle.js";

test("cycles only offline sessions that lack a refresh token", () => {
  assert.equal(
    needsOfflineTokenCycle({
      shop: "example.myshopify.com",
      accessToken: "token",
      isOnline: false,
      refreshToken: null,
    }),
    true,
  );
  assert.equal(
    needsOfflineTokenCycle({
      shop: "example.myshopify.com",
      accessToken: "token",
      isOnline: false,
      refreshToken: "refresh",
    }),
    false,
  );
  assert.equal(
    needsOfflineTokenCycle({
      shop: "example.myshopify.com",
      accessToken: "token",
      isOnline: true,
      refreshToken: null,
    }),
    false,
  );
  assert.equal(needsOfflineTokenCycle(null), false);
});
