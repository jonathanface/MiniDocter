import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

export interface ApiClientConfig {
  baseURL: string;
  withCredentials?: boolean;
  onUnauthorized?: () => void;
  onError?: (error: any) => void;
}

export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const client = axios.create({
    baseURL: config.baseURL,
    withCredentials: config.withCredentials ?? true,
    headers: {
      "Content-Type": "application/json",
    },
    validateStatus: (status) => {
      return status >= 200 && status < 300;
    },
  });

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        config.onUnauthorized?.();
      } else {
        config.onError?.(error);
      }
      return Promise.reject(error);
    },
  );

  return client;
}
