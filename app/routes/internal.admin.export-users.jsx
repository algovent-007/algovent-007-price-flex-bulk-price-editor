import { requireAdmin } from "../services/admin-auth.server";
import { recordAdminAudit } from "../services/admin-audit.server";
import { listAdminShopsForExport } from "../models/admin-shops.server";
import { SHOP_EXPORT_HEADERS, shopsToExportRows, toCsv } from "../utils/admin-csv.server";
import { readAdminListParams } from "../utils/admin-query";

export const loader = async ({ request }) => {
  const admin = await requireAdmin(request);
  const params = readAdminListParams(new URL(request.url));
  const shops = await listAdminShopsForExport({
    query: params.q,
    status: params.status,
    plan: params.plan,
    payment: params.payment,
    review: params.review,
  });

  await recordAdminAudit({
    adminUser: admin,
    action: "admin.export_users",
    success: true,
    details: { count: shops.length },
  });

  return new Response(toCsv(SHOP_EXPORT_HEADERS, shopsToExportRows(shops)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="staging-users.csv"`,
    },
  });
};
