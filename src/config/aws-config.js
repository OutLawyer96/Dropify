import { API } from "../utils/constants";

const getEnv = (key) => {
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : undefined;
};

const requiredKeys = [
  { key: "REACT_APP_COGNITO_REGION", label: "Cognito region" },
  { key: "REACT_APP_COGNITO_USER_POOL_ID", label: "Cognito User Pool ID" },
  { key: "REACT_APP_COGNITO_CLIENT_ID", label: "Cognito App Client ID" },
  {
    key: "REACT_APP_COGNITO_IDENTITY_POOL_ID",
    label: "Cognito Identity Pool ID",
  },
  { key: "REACT_APP_COGNITO_DOMAIN", label: "Cognito domain" },
];

export const cognitoConfig = {
  region: getEnv("REACT_APP_COGNITO_REGION"),
  userPoolId: getEnv("REACT_APP_COGNITO_USER_POOL_ID"),
  userPoolWebClientId: getEnv("REACT_APP_COGNITO_CLIENT_ID"),
  identityPoolId: getEnv("REACT_APP_COGNITO_IDENTITY_POOL_ID"),
  domain: getEnv("REACT_APP_COGNITO_DOMAIN"),
};

export const apiConfig = {
  baseURL: getEnv("REACT_APP_API_URL") || API.BASE_URL,
  timeout: API.TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
};

export const validateConfig = () => {
  const missing = requiredKeys
    .map(({ key, label }) => ({ key, label, value: getEnv(key) }))
    .filter(({ value }) => !value);

  if (missing.length > 0) {
    const labels = missing
      .map(({ label, key }) => `${label} (${key})`)
      .join(", ");
    throw new Error(`Missing required AWS configuration values: ${labels}`);
  }

  if (!apiConfig.baseURL) {
    throw new Error("Missing API base URL configuration (REACT_APP_API_URL)");
  }

  return true;
};
