/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import { Link } from "react-router";
import { ADMIN_PAGE_SIZES, buildPageItems, getPageRange } from "../../utils/admin-pagination";
import { buildAdminHref } from "../../utils/admin-query";

export default function AdminPagination({ pathname, params, page, pageSize, total }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = buildPageItems(page, totalPages);
  const range = getPageRange({ page, pageSize, total });
  const hrefFor = (nextPage, nextSize = pageSize) =>
    buildAdminHref(pathname, params, { page: nextPage, pageSize: nextSize });

  return (
    <div className="admin-footer">
      <form method="get" className="admin-field">
        {Object.entries(params).map(([key, value]) =>
          value && key !== "page" && key !== "pageSize" ? (
            <input key={key} type="hidden" name={key} value={value} />
          ) : null,
        )}
        <label htmlFor="admin-page-size">Show</label>
        <select
          id="admin-page-size"
          name="pageSize"
          defaultValue={String(pageSize)}
          onChange={(event) => {
            window.location.href = hrefFor(1, event.target.value);
          }}
        >
          {ADMIN_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} entries
            </option>
          ))}
        </select>
      </form>

      <nav className="admin-pages" aria-label="Pagination">
        <Link className="admin-page" to={hrefFor(Math.max(1, page - 1))} aria-label="Previous page">
          ‹
        </Link>
        {items.map((item) =>
          typeof item === "string" ? (
            <span key={item} className="admin-page">
              …
            </span>
          ) : (
            <Link
              key={item}
              className={`admin-page${item === page ? " active" : ""}`}
              to={hrefFor(item)}
            >
              {item}
            </Link>
          ),
        )}
        <Link className="admin-page" to={hrefFor(Math.min(totalPages, page + 1))} aria-label="Next page">
          ›
        </Link>
      </nav>

      <div className="admin-muted">
        Showing {range.from.toLocaleString()} to {range.to.toLocaleString()} of {range.total.toLocaleString()} entries
      </div>
    </div>
  );
}
