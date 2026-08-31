import { useCallback, useEffect, useRef } from "react";
import { useFetcher, useNavigate, useNavigation } from "react-router";
import { useI18n } from "../i18n/I18nProvider";
import styles from "./HomeCreateTaskCard.module.css";

export default function HomeCreateTaskCard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const prefetchedRef = useRef(false);
  const isOpeningNewTask =
    navigation.state !== "idle" && navigation.location?.pathname === "/app/new";

  const prefetchNewTask = useCallback(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    fetcher.load("/app/new");
  }, [fetcher]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      prefetchNewTask();
    }, 100);
    return () => window.clearTimeout(timer);
    // Warm /app/new once after home paint; do not reset this timer on re-render.
  }, []);

  return (
    <s-section>
      <s-box padding="base" background="base" borderWidth="base" borderRadius="base">
        <div className={styles.content}>
          <s-stack direction="block" gap="base" alignItems="center">
            <s-icon type="product" color="subdued" />
            <s-stack direction="block" gap="small-100" alignItems="center">
              <s-heading>{t("home.createTaskTitle")}</s-heading>
              <s-text color="subdued">{t("home.createTaskBody")}</s-text>
            </s-stack>
            <s-button
              variant="primary"
              icon="plus"
              loading={isOpeningNewTask || undefined}
              disabled={isOpeningNewTask || undefined}
              onPointerEnter={prefetchNewTask}
              onFocus={prefetchNewTask}
              onClick={() => {
                if (!isOpeningNewTask) navigate("/app/new");
              }}
            >
              {t("home.newTaskButton")}
            </s-button>
          </s-stack>
        </div>
      </s-box>
    </s-section>
  );
}
