import api from "./api";

export async function login(email: string, password: string, restaurant?: string) {
  if (restaurant) localStorage.setItem("restaurant", restaurant);
  const { data } = await api.post("/auth/login", {
    email, password, restaurant: restaurant || localStorage.getItem("restaurant"),
  });
  localStorage.setItem("token", data.token);
  return data;
}
export async function me() {
  const { data } = await api.get("/auth/me");
  return data;
}
export async function logout() {
  try { await api.post("/auth/logout"); } catch {}
  localStorage.removeItem("token");
}
