/* eslint-disable react/prop-types -- this codebase does not use PropTypes */
import { useCallback, useRef } from "react";
import { useFetcher } from "react-router";

export default function AppNavLink({ href, children }) {
  const fetcher = useFetcher();
  const prefetchedRef = useRef(false);

  const prefetch = useCallback(() => {
    if (prefetchedRef.current || !href) return;
    prefetchedRef.current = true;
    fetcher.load(href);
    if (href === "/app/new") {
      void import("../components/new-task/TaskConfigurationForm");
    }
  }, [fetcher, href]);

  return (
    <s-link href={href} onPointerEnter={prefetch} onFocus={prefetch}>
      {children}
    </s-link>
  );
}
