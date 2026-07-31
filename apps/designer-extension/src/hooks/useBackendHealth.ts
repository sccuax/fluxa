import { useEffect, useState } from "react";
import { apiFetch } from "../services/apiClient";

interface BackendHealthState {
  status: "checking" | "ok" | "error";
  error: string | null;
}

export function useBackendHealth() {
  const [state, setState] = useState<BackendHealthState>({
    status: "checking",
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ ok: boolean }>("/health")
      .then(() => {
        if (!cancelled) setState({ status: "ok", error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
