import { useEffect, useCallback, useRef } from "react";
import { OVERVIEW_ID } from "../constants";

/**
 * useRoute — syncs the browser URL path with the active spark ID.
 *
 * URL scheme:
 *   /             → Overview
 *   /spark/:id    → Spark detail page
 *
 * Call `navigate(id)` to switch views — it updates both the URL and
 * the internal activeId state. Back/forward buttons work via popstate.
 */
export function useRoute(
  setActiveId: (id: string | null) => void
): (id: string | null) => void {
  // Read initial activeId from the URL on mount
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    const path = window.location.pathname;
    const match = path.match(/^\/spark\/([^/]+)/);
    if (match) {
      setActiveId(match[1]);
    } else if (path !== "/spark") {
      setActiveId(OVERVIEW_ID);
    }
  }, [setActiveId]);

  // Sync back/forward navigation
  useEffect(() => {
    const handler = () => {
      const path = window.location.pathname;
      const match = path.match(/^\/spark\/([^/]+)/);
      setActiveId(match ? match[1] : OVERVIEW_ID);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [setActiveId]);

  // Wrapped navigate function — updates URL + internal state
  const navigate = useCallback(
    (id: string | null) => {
      const url = id && id !== OVERVIEW_ID ? `/spark/${encodeURIComponent(id)}` : "/";
      window.history.pushState(null, "", url);
      setActiveId(id);
    },
    [setActiveId]
  );

  return navigate;
}
