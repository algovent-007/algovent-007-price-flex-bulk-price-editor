/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import { Form } from "react-router";
import styles from "./AdminSupportBanner.module.css";

export default function AdminSupportBanner({ shop }) {
  return (
    <div className={styles.banner} role="status">
      <strong>Admin Support Mode — {shop}</strong>
      <Form method="post" action="/admin/exit-support" reloadDocument>
        <button type="submit" className={styles.exit}>
          Exit Support Session
        </button>
      </Form>
    </div>
  );
}
