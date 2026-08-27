import { isAdmin } from "./_auth.js";
import { readState, saveState } from "./_store.js";

export default async function handler(request, response) {
  try {
    if (request.method === "GET") return response.status(200).json(await readState());
    if (request.method !== "PUT") return response.status(405).json({ error: "Method not allowed" });
    if (!isAdmin(request)) return response.status(401).json({ error: "Please log in again." });
    return response.status(200).json(await saveState(request.body));
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
