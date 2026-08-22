/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import { useEffect, useState } from "react";
import styles from "./AdminSupportAppBridge.module.css";

function createSupportAppBridge(onToast) {
  return {
    toast: {
      show(message, options = {}) {
        onToast?.({
          message: String(message || ""),
          isError: Boolean(options.isError),
        });
      },
    },
    saveBar: {
      show() {},
      hide() {},
    },
    modal: {},
    open(url) {
      if (url && typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
  };
}

export function installSupportAppBridge(onToast) {
  if (typeof window === "undefined") {
    return;
  }

  window.shopify = createSupportAppBridge(onToast);
}

export default function AdminSupportAppBridge({ children }) {
  const [toast, setToast] = useState(null);

  installSupportAppBridge(setToast);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <>
      {children}
      {toast ? (
        <div className={`${styles.toast}${toast.isError ? ` ${styles.error}` : ""}`} role="status">
          {toast.message}
        </div>
      ) : null}
    </>
  );
}
