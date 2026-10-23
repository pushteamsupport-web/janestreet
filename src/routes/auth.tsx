const DEFAULT_APP_ORIGIN = "https://janestreet.vercel.app";

function getAppOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return DEFAULT_APP_ORIGIN;
}

function getAppUrl(pathname: string) {
  const url = new URL(pathname, getAppOrigin());
  return url.toString();
}

export const Route = createFileRoute("/auth")({
