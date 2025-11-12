import { EnvironmentConfig, Stage } from "../types";

const DEFAULT_LOCAL_ORIGINS = [
  "http://localhost:3000",
  "https://localhost:3000",
  "http://localhost:3001",
  "https://localhost:3001",
];

const normalizeOrigin = (value?: string): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      return url.origin;
    }

    const scheme = /localhost|127\.0\.0\.1/i.test(trimmed) ? "http" : "https";
    const url = new URL(`${scheme}://${trimmed}`);
    return url.origin;
  } catch (error) {
    console.warn(
      `Skipping invalid CORS origin value "${trimmed}": ${
        (error as Error).message
      }`
    );
    return null;
  }
};

export const buildAllowedOrigins = (
  config: EnvironmentConfig,
  stage: Stage
): string[] => {
  const origins = new Set<string>();
  const addOrigin = (candidate?: string) => {
    const normalised = normalizeOrigin(candidate);
    if (normalised) {
      origins.add(normalised);
    }
  };

  addOrigin(config.cdnDomain);
  addOrigin(config.apiDomain);

  (config.cognitoConfig?.allowedCallbackUrls ?? []).forEach(addOrigin);

  if (stage === "dev") {
    DEFAULT_LOCAL_ORIGINS.forEach(addOrigin);
  }

  return origins.size ? Array.from(origins) : [...DEFAULT_LOCAL_ORIGINS];
};
