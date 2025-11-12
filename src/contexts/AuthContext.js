import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
} from "amazon-cognito-identity-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cognitoConfig, validateConfig } from "../config/aws-config";
import { registerAuthAccessors } from "../utils/helpers";

const STORAGE_MODE_KEY = "dropify:auth:mode";
const DEFAULT_STORAGE_MODE = "local";
const CONTEXT_DEFAULT = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  signUp: async () => undefined,
  confirmSignUp: async () => undefined,
  resendConfirmationCode: async () => undefined,
  signIn: async () => undefined,
  signOut: () => undefined,
  forgotPassword: async () => undefined,
  confirmPassword: async () => undefined,
  getCurrentUser: () => null,
  getSession: async () => undefined,
  refreshSession: async () => undefined,
};

const isBrowser = typeof window !== "undefined";

const getStorage = (mode) => {
  if (!isBrowser) return undefined;
  return mode === "session" ? window.sessionStorage : window.localStorage;
};

const storeMode = (mode) => {
  if (!isBrowser) return;
  if (mode === "session") {
    window.sessionStorage.setItem(STORAGE_MODE_KEY, mode);
    window.localStorage.removeItem(STORAGE_MODE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_MODE_KEY, mode);
    window.sessionStorage.removeItem(STORAGE_MODE_KEY);
  }
};

const getStoredMode = () => {
  if (!isBrowser) return DEFAULT_STORAGE_MODE;
  return (
    window.sessionStorage.getItem(STORAGE_MODE_KEY) ||
    window.localStorage.getItem(STORAGE_MODE_KEY) ||
    DEFAULT_STORAGE_MODE
  );
};

const createUserPool = (mode = DEFAULT_STORAGE_MODE) => {
  const storage = getStorage(mode);
  return new CognitoUserPool({
    UserPoolId: cognitoConfig.userPoolId ?? "",
    ClientId: cognitoConfig.userPoolWebClientId ?? "",
    Storage: storage,
  });
};

const getUserFromAttributes = (username, attributes = [], session) => {
  const attributeMap = attributes.reduce((acc, attr) => {
    const key = attr.getName();
    acc[key] = attr.getValue();
    return acc;
  }, {});

  return {
    username,
    attributes: attributeMap,
    session: {
      idToken: session?.getIdToken()?.getJwtToken() ?? null,
      accessToken: session?.getAccessToken()?.getJwtToken() ?? null,
      refreshToken: session?.getRefreshToken()?.getToken() ?? null,
      clockDrift: session?.getClockDrift() ?? 0,
    },
  };
};

const getSessionAsync = (cognitoUser) =>
  new Promise((resolve, reject) => {
    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err, session) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(session);
    });
  });

const getAttributesAsync = (cognitoUser) =>
  new Promise((resolve, reject) => {
    if (!cognitoUser) {
      resolve([]);
      return;
    }

    cognitoUser.getUserAttributes((err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result ?? []);
    });
  });

export const AuthContext = createContext(CONTEXT_DEFAULT);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      validateConfig();
    } catch (validationError) {
      setError(validationError.message);
    }
  }, []);

  const bootstrapSession = useCallback(async () => {
    if (!isBrowser) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const mode = getStoredMode();
      const pool = createUserPool(mode);
      const currentUser = pool.getCurrentUser();

      if (!currentUser) {
        setUser(null);
        setIsAuthenticated(false);
        return;
      }

      const session = await getSessionAsync(currentUser);
      if (!session || !session.isValid()) {
        currentUser.signOut();
        setUser(null);
        setIsAuthenticated(false);
        return;
      }

      const attributes = await getAttributesAsync(currentUser);
      setUser(
        getUserFromAttributes(currentUser.getUsername(), attributes, session)
      );
      setIsAuthenticated(true);
    } catch (bootstrapError) {
      setError(bootstrapError.message ?? "Failed to restore session");
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrapSession();
  }, [bootstrapSession]);

  const signUp = useCallback(async (email, password, attributes = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const attributeList = Object.entries(attributes)
        .filter(([, value]) => Boolean(value))
        .map(([Name, Value]) => new CognitoUserAttribute({ Name, Value }));

      const pool = createUserPool();

      await new Promise((resolve, reject) => {
        pool.signUp(email, password, attributeList, [], (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        });
      });
    } catch (signUpError) {
      setError(signUpError.message ?? "Failed to sign up");
      throw signUpError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const confirmSignUp = useCallback(async (email, code) => {
    setIsLoading(true);
    setError(null);

    try {
      const pool = createUserPool();
      const user = new CognitoUser({ Username: email, Pool: pool });

      await new Promise((resolve, reject) => {
        user.confirmRegistration(code, true, (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        });
      });
    } catch (confirmError) {
      setError(confirmError.message ?? "Failed to confirm sign up");
      throw confirmError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resendConfirmationCode = useCallback(async (email) => {
    setIsLoading(true);
    setError(null);

    try {
      const pool = createUserPool();
      const user = new CognitoUser({ Username: email, Pool: pool });

      await new Promise((resolve, reject) => {
        user.resendConfirmationCode((err, result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        });
      });
    } catch (resendError) {
      setError(resendError.message ?? "Failed to resend confirmation code");
      throw resendError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email, password, options = {}) => {
    setIsLoading(true);
    setError(null);

    const { remember = true } = options;
    const mode = remember ? "local" : "session";
    const pool = createUserPool(mode);
    const user = new CognitoUser({ Username: email, Pool: pool });
    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    try {
      const session = await new Promise((resolve, reject) => {
        user.authenticateUser(authDetails, {
          onSuccess: (result) => resolve(result),
          onFailure: (authError) => reject(authError),
          newPasswordRequired: () =>
            reject(new Error("Password reset required before login")),
        });
      });

      storeMode(mode);
      const attributes = await getAttributesAsync(user);
      setUser(getUserFromAttributes(email, attributes, session));
      setIsAuthenticated(true);
    } catch (signInError) {
      user.signOut();
      setUser(null);
      setIsAuthenticated(false);
      setError(signInError.message ?? "Failed to sign in");
      throw signInError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    setIsLoading(true);
    setError(null);

    try {
      const modes = ["local", "session"];
      modes.forEach((mode) => {
        const pool = createUserPool(mode);
        const currentUser = pool.getCurrentUser();
        currentUser?.signOut();
        const storage = getStorage(mode);
        storage?.removeItem(`${cognitoConfig.userPoolId}.LastAuthUser`);
      });
      if (isBrowser) {
        window.localStorage.removeItem(STORAGE_MODE_KEY);
        window.sessionStorage.removeItem(STORAGE_MODE_KEY);
      }
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (email) => {
    setIsLoading(true);
    setError(null);

    try {
      const pool = createUserPool();
      const user = new CognitoUser({ Username: email, Pool: pool });

      await new Promise((resolve, reject) => {
        user.forgotPassword({
          onSuccess: () => resolve(true),
          onFailure: (forgotError) => reject(forgotError),
        });
      });
    } catch (forgotError) {
      setError(forgotError.message ?? "Failed to reset password");
      throw forgotError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const confirmPassword = useCallback(async (email, code, newPassword) => {
    setIsLoading(true);
    setError(null);

    try {
      const pool = createUserPool();
      const user = new CognitoUser({ Username: email, Pool: pool });

      await new Promise((resolve, reject) => {
        user.confirmPassword(code, newPassword, {
          onSuccess: () => resolve(true),
          onFailure: (confirmError) => reject(confirmError),
        });
      });
    } catch (confirmError) {
      setError(confirmError.message ?? "Failed to confirm new password");
      throw confirmError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getCurrentUser = useCallback(() => {
    if (!isBrowser) return null;
    const mode = getStoredMode();
    const pool = createUserPool(mode);
    return pool.getCurrentUser();
  }, []);

  const getSession = useCallback(async () => {
    const currentUser = getCurrentUser();
    return getSessionAsync(currentUser);
  }, [getCurrentUser]);

  const refreshSession = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;

    const session = await getSessionAsync(currentUser);
    const refreshToken = session?.getRefreshToken();

    if (!refreshToken) {
      await bootstrapSession();
      return null;
    }

    return new Promise((resolve, reject) => {
      currentUser.refreshSession(refreshToken, (err, newSession) => {
        if (err) {
          setError(err.message ?? "Failed to refresh session");
          reject(err);
          return;
        }
        resolve(newSession);
      });
    });
  }, [bootstrapSession, getCurrentUser]);

  // Register auth accessors early to avoid race conditions with API calls
  useEffect(() => {
    registerAuthAccessors({ getSession, refreshSession });
  }, [getSession, refreshSession]);

  const contextValue = useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      error,
      signUp,
      confirmSignUp,
      resendConfirmationCode,
      signIn,
      signOut,
      forgotPassword,
      confirmPassword,
      getCurrentUser,
      getSession,
      refreshSession,
    }),
    [
      user,
      isAuthenticated,
      isLoading,
      error,
      signUp,
      confirmSignUp,
      resendConfirmationCode,
      signIn,
      signOut,
      forgotPassword,
      confirmPassword,
      getCurrentUser,
      getSession,
      refreshSession,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
