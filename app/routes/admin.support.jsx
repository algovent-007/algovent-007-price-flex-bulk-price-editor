import { SUPPORT_EMAIL } from "../constants/branding";
import { requireAdmin } from "../services/admin-auth.server";

export const loader = async ({ request }) => {
  await requireAdmin(request);
  return { supportEmail: SUPPORT_EMAIL };
};

export default function AdminSupportCenter() {
  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h2>Support center</h2>
          <p>Use Access Account from the user list to troubleshoot a merchant store.</p>
        </div>
      </div>

      <div className="admin-card">
        <h3>Merchant support session</h3>
        <p>
          Open a store from User list with Access Account. That starts a secure support session for
          exactly one shop and reuses the existing merchant app. The merchant&apos;s own Shopify
          session is not changed.
        </p>
      </div>

      <div className="admin-card">
        <h3>Contact</h3>
        <p>
          Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}
