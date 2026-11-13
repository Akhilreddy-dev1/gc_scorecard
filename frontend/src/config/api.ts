const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const apiBaseUrl = (configuredApiUrl ?? "").replace(/\/$/, "");
export const backendIsConfigured = Boolean(apiBaseUrl) || !import.meta.env.PROD;

export const websocketBaseUrl = import.meta.env.VITE_WS_URL?.trim()
  ? import.meta.env.VITE_WS_URL.trim().replace(/\/$/, "")
  : apiBaseUrl
    ? apiBaseUrl.replace(/^http/, "ws")
    : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
