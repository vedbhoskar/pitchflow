import crypto from "node:crypto";

const encoder = new TextEncoder();

function signature(value) {
  return crypto.createHmac("sha256", process.env.AUTH_SECRET).update(value).digest("base64url");
}

export function readCookie(request, name) {
  const cookies = request.headers.cookie?.split(";") ?? [];
  const target = cookies.map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  return target?.slice(name.length + 1) ?? null;
}

export function createSession() {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 12;
  const value = `admin.${expiresAt}`;
  return `${value}.${signature(value)}`;
}

export function isAdmin(request) {
  const token = readCookie(request, "pitchflow_session");
  if (!token || !process.env.AUTH_SECRET) return false;
  const [role, expiresAt, tokenSignature] = token.split(".");
  const value = `${role}.${expiresAt}`;
  return role === "admin" && Number(expiresAt) > Date.now() && tokenSignature === signature(value);
}

export function json(response, status = 200, headers = {}) {
  return { statusCode: status, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(response) };
}
