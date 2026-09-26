/**
 * Central API client for the Hostify dashboard.
 * Handles auth token refresh automatically on 401.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = await res.json();
  accessToken = data.accessToken;
  return accessToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  // Auto-refresh on 401
  if (res.status === 401 && path !== "/api/auth/refresh") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: "include",
      });
    } else {
      setAccessToken(null);
      throw new Error("UNAUTHORIZED");
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export const auth = {
  register: (data: { email: string; password: string; name?: string }) =>
    request<{ accessToken: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<{ accessToken: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () => request("/api/auth/logout", { method: "POST" }),

  me: () => request<User>("/api/auth/me"),
};

// ─── Projects ──────────────────────────────────────────────────────────────

export const projects = {
  list: () => request<ProjectWithLatestDeploy[]>("/api/projects"),

  get: (id: string) => request<ProjectWithDeployments>(`/api/projects/${id}`),

  create: (data: CreateProjectData) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<CreateProjectData>) =>
    request<Project>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request(`/api/projects/${id}`, { method: "DELETE" }),
};

// ─── Deployments ───────────────────────────────────────────────────────────

export const deployments = {
  list: (projectId: string) =>
    request<Deployment[]>(`/api/projects/${projectId}/deployments`),

  get: (projectId: string, deploymentId: string) =>
    request<Deployment>(`/api/projects/${projectId}/deployments/${deploymentId}`),

  trigger: (projectId: string) =>
    request<Deployment>(`/api/projects/${projectId}/deployments`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  cancel: (projectId: string, deploymentId: string) =>
    request(`/api/projects/${projectId}/deployments/${deploymentId}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  pause: (projectId: string, deploymentId: string) =>
    request(`/api/projects/${projectId}/deployments/${deploymentId}/pause`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  resume: (projectId: string, deploymentId: string) =>
    request<Deployment>(`/api/projects/${projectId}/deployments/${deploymentId}/resume`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  delete: (projectId: string, deploymentId: string) =>
    request(`/api/projects/${projectId}/deployments/${deploymentId}`, { method: "DELETE" }),

  /** Returns an EventSource for live log streaming */
  streamLogs: (deploymentId: string): EventSource => {
    const token = getAccessToken();
    return new EventSource(
      `${API_BASE}/api/projects/deployments/${deploymentId}/logs?token=${token}`
    );
  },
};

// ─── Env Variables ─────────────────────────────────────────────────────────

export const envVars = {
  list: (projectId: string) =>
    request<EnvVariable[]>(`/api/projects/${projectId}/env`),

  set: (projectId: string, data: { key: string; value: string; isSecret?: boolean }) =>
    request(`/api/projects/${projectId}/env`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (projectId: string, key: string) =>
    request(`/api/projects/${projectId}/env/${key}`, { method: "DELETE" }),
};

// ─── Types ─────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: string;
};

export type Project = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  githubRepoUrl: string;
  branch: string;
  buildCommand: string;
  installCommand: string;
  outputDir: string;
  framework: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectWithLatestDeploy = Project & {
  deployments: Deployment[];
};

export type ProjectWithDeployments = Project & {
  deployments: Deployment[];
};

export type Deployment = {
  id: string;
  projectId: string;
  commitHash: string;
  commitMessage?: string;
  branch: string;
  status: "QUEUED" | "BUILDING" | "READY" | "FAILED" | "CANCELLED" | "PAUSED";
  deploymentType?: "STATIC" | "SSR" | "HYBRID";
  url?: string;
  containerPort?: number;
  buildStartedAt?: string;
  buildFinishedAt?: string;
  errorMessage?: string;
  createdAt: string;
};

export type EnvVariable = {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  createdAt: string;
};

export type CreateProjectData = {
  name: string;
  slug: string;
  githubRepoUrl: string;
  branch?: string;
  buildCommand?: string;
  installCommand?: string;
  outputDir?: string;
  framework?: string;
};

// ─── Admin ─────────────────────────────────────────────────────────────────

export const admin = {
  stats: () => request<any>("/api/admin/stats"),
  stopContainer: (deploymentId: string) => request(`/api/admin/deployments/${deploymentId}/stop`, { method: "POST" }),
  deleteDeployment: (deploymentId: string) => request(`/api/admin/deployments/${deploymentId}`, { method: "DELETE" }),
  killContainer: (containerId: string) => request(`/api/admin/containers/${containerId}`, { method: "DELETE" }),
  deleteFile: (path: string) => request(`/api/admin/files/delete`, { method: "POST", body: JSON.stringify({ path }) }),
  getLogs: (service: string, type: string) => request<{logs: string}>(`/api/admin/logs/${service}/${type}`),
  getContainerLogs: (containerId: string) => request<{logs: string}>(`/api/admin/containers/${containerId}/logs`),
  getDatabaseStats: () => request<any>(`/api/admin/database/stats`),
  restartService: (service: string) => request(`/api/admin/restart/${service}`, { method: "POST" }),
};
