export function buildAdminHref(pathname, current, overrides = {}) {
  const params = new URLSearchParams();
  const next = { ...current, ...overrides };

  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === null || value === "" || value === false) {
      continue;
    }
    params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function readAdminListParams(url) {
  return {
    q: url.searchParams.get("q") || "",
    status: url.searchParams.get("status") || "",
    plan: url.searchParams.get("plan") || "",
    payment: url.searchParams.get("payment") || "",
    review: url.searchParams.get("review") || "",
    page: url.searchParams.get("page"),
    pageSize: url.searchParams.get("pageSize"),
  };
}
