"use client";

import { apiFetch } from "./api";

export interface AuthUser {
  id: string;
  username: string;
  full_name: string;
  email: string;
  department: string;
  role: string;
  is_active: boolean;
}

export async function login(
  username: string,
  password: string
): Promise<{ access_token: string; refresh_token: string }> {
  const data = await apiFetch<{
    access_token: string;
    refresh_token: string;
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/me");
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  window.location.href = "/login";
}

export function isAuthenticated(): boolean {
  return typeof window !== "undefined" && !!localStorage.getItem("access_token");
}
