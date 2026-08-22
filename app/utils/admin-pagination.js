export const ADMIN_PAGE_SIZES = [10, 25, 50, 100];

export function parsePage(value, fallback = 1) {
  const page = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(page) && page > 0 ? page : fallback;
}

export function parsePageSize(value, fallback = 10) {
  const size = Number.parseInt(String(value || ""), 10);
  return ADMIN_PAGE_SIZES.includes(size) ? size : fallback;
}

export function buildPageItems(currentPage, totalPages) {
  const last = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, currentPage), last);

  if (last <= 9) {
    return Array.from({ length: last }, (_, index) => index + 1);
  }

  if (current <= 5) {
    return [1, 2, 3, 4, 5, 6, 7, "ellipsis-end", last - 1, last];
  }

  if (current >= last - 4) {
    return [1, 2, "ellipsis-start", last - 6, last - 5, last - 4, last - 3, last - 2, last - 1, last];
  }

  return [1, "ellipsis-start", current - 2, current - 1, current, current + 1, current + 2, "ellipsis-end", last - 1, last];
}

export function getPageRange({ page, pageSize, total }) {
  if (total <= 0) {
    return { from: 0, to: 0, total };
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return { from, to, total };
}
