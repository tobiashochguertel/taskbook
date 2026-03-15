const BASE_URL = "";

export interface MeResponse {
  username: string;
  email: string;
}

export interface EncryptedItemData {
  data: string;
  nonce: string;
}

export type ItemsMap = Record<string, EncryptedItemData>;

export interface ItemsResponse {
  items: ItemsMap;
}

export interface PutItemsRequest {
  items: ItemsMap;
}

export interface HealthResponse {
  status: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  token: string;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new ApiError(response.status, text);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  health: () => request<HealthResponse>("/api/v1/health"),

  me: (token: string) => request<MeResponse>("/api/v1/me", {}, token),

  getItems: (token: string) =>
    request<ItemsResponse>("/api/v1/items", {}, token),

  putItems: (token: string, items: ItemsMap) =>
    request<void>(
      "/api/v1/items",
      {
        method: "PUT",
        body: JSON.stringify({ items }),
      },
      token,
    ),

  getArchive: (token: string) =>
    request<ItemsResponse>("/api/v1/items/archive", {}, token),

  putArchive: (token: string, items: ItemsMap) =>
    request<void>(
      "/api/v1/items/archive",
      {
        method: "PUT",
        body: JSON.stringify({ items }),
      },
      token,
    ),

  login: (body: LoginRequest) =>
    request<LoginResponse>("/api/v1/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  register: (body: RegisterRequest) =>
    request<RegisterResponse>("/api/v1/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  logout: (token: string) =>
    request<void>("/api/v1/logout", { method: "DELETE" }, token),
};
