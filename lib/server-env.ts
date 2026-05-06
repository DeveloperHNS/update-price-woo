type RequiredEnvKey =
  | "NEXT_PUBLIC_APP_URL"
  | "WOO_URL"
  | "WOO_CONSUMER_KEY"
  | "WOO_CONSUMER_SECRET"
  | "WP_URL"
  | "WP_USERNAME"
  | "WP_APP_PASSWORD";

function required(key: RequiredEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. Add it to .env.local and restart the server.`,
    );
  }
  return value;
}

function sanitizeWpAppPassword(value: string): string {
  return value.replace(/\s+/g, "");
}

function parseServerEnv() {
  const env = {
    NEXT_PUBLIC_APP_URL: required("NEXT_PUBLIC_APP_URL"),
    WOO_URL: required("WOO_URL").replace(/\/+$/, ""),
    WOO_CONSUMER_KEY: required("WOO_CONSUMER_KEY"),
    WOO_CONSUMER_SECRET: required("WOO_CONSUMER_SECRET"),
    WP_URL: required("WP_URL").replace(/\/+$/, ""),
    WP_USERNAME: required("WP_USERNAME"),
    WP_APP_PASSWORD: sanitizeWpAppPassword(required("WP_APP_PASSWORD")),
  };

  if (!env.WP_APP_PASSWORD) {
    throw new Error("WP_APP_PASSWORD is empty after removing whitespace.");
  }

  return env;
}

// Validate eagerly when this module is imported by server routes.
export const serverEnv = parseServerEnv();
