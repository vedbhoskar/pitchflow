import { createSession, json } from "./_auth.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const { username, password } = request.body ?? {};
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.AUTH_SECRET) {
    return response.status(503).json({ error: "Admin login has not been configured." });
  }
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return response.status(401).json({ error: "Incorrect username or password." });
  }
  response.setHeader("Set-Cookie", `pitchflow_session=${createSession()}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=43200`);
  return response.status(200).json({ ok: true });
}
