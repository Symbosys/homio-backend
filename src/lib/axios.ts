import axios, { type AxiosInstance, AxiosError } from "axios";

/**
 * Reusable, central Axios HTTP client for backend external API requests.
 * Note: baseURL is omitted intentionally so this client can be dynamically utilized
 * across multiple external providers (Meta Graph API, Ola Maps, Payment Gateways, Webhooks, etc.)
 */
export const axiosClient: AxiosInstance = axios.create({
  timeout: 30000,
  headers: {
    Accept: "application/json",
  },
});

export const httpClient = axiosClient;
export { AxiosError };
export default axiosClient;
