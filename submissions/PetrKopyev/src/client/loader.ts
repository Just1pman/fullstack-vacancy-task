import type { User } from "./api.js";

export type LoaderState =
  | { kind: "loading" }
  | { kind: "ready"; name: string; users: User[] }
  | { kind: "error"; error: unknown };

export const createLoader = (
  fetchUsers: (name: string, signal: AbortSignal) => Promise<User[]>,
  onState: (state: LoaderState) => void,
) => {
  let controller: AbortController | null = null;

  return {
    async load(name: string): Promise<void> {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      onState({ kind: "loading" });

      try {
        const users = await fetchUsers(name, current.signal);
        if (current !== controller) return;
        onState({ kind: "ready", name, users });
      } catch (error) {
        if (current !== controller) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        onState({ kind: "error", error });
      }
    },
  };
};
