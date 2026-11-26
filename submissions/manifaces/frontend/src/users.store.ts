import type { CreateUserInput, LoadStatus, UsersState } from "./users.models";
import { ApiError, usersService } from "./users.service";

export class UsersStore extends EventTarget {
  private state: UsersState = {
    users: [],
    loadStatus: null,
    deletingIds: new Set<number>(),
    error: null,
  };

  private searchQuery = "";
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;

  getState(): Readonly<UsersState> {
    return this.state;
  }

  private update(patch: Partial<UsersState>): void {
    this.state = { ...this.state, ...patch };

    this.dispatchEvent(new Event("change"));
  }

  private cancelSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  private cancelLoad(): void {
    const controller = this.abortController;

    this.abortController = null;
    controller?.abort();
  }

  private refresh(): void {
    if (this.searchTimer !== null) return;

    const loadStatus = this.state.loadStatus === "loading" || this.state.error !== null 
      ? "loading"
      : "refreshing";

    void this.load(loadStatus);
  }

  async load(loadStatus: NonNullable<LoadStatus> = "loading"): Promise<void> {
    this.cancelSearchTimer();
    this.cancelLoad();

    const controller = new AbortController();

    this.abortController = controller;

    this.update({ loadStatus, error: null });

    try {
      const users = await usersService.getUsers(this.searchQuery, controller.signal);

      if (this.abortController !== controller) return;

      this.abortController = null;

      this.update({ users, loadStatus: null, error: null });
    } catch (error) {
      if (this.abortController !== controller) return;

      this.abortController = null;

      this.update({
        loadStatus: null,
        error:
          error instanceof ApiError
            ? error.message
            : "Не удалось загрузить пользователей",
      });
    }
  }

  search(value: string): void {
    this.dispatchEvent(new Event("searchchange"));

    const query = value.trim().toLowerCase();

    if (query === this.searchQuery) return;

    this.searchQuery = query;

    this.cancelSearchTimer();
    this.cancelLoad();

    if (!query) {
      void this.load();

      return;
    }

    this.searchTimer = setTimeout(() => {
      void this.load();
    }, 250);

    if (this.state.error !== null) {
      this.update({ loadStatus: "loading", error: null });
    } else if (this.state.loadStatus === "refreshing") {
      this.update({ loadStatus: null });
    }
  }

  async create(data: CreateUserInput): Promise<void> {
    try {
      await usersService.createUser(data);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status >= 500) {
        this.refresh();
      }

      throw error;
    }

    this.refresh();
  }

  async delete(id: number): Promise<void> {
    if (this.state.deletingIds.has(id)) return;

    this.update({ deletingIds: new Set([...this.state.deletingIds, id]) });

    try {
      await usersService.deleteUser(id);

      this.update({ users: this.state.users.filter((user) => user.id !== id) });

      this.refresh();
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        error.status === 404 ||
        error.status >= 500
      ) {
        this.refresh();
      }

      throw error;
    } finally {
      const deletingIds = new Set(this.state.deletingIds);

      deletingIds.delete(id);

      this.update({ deletingIds });
    }
  }
}
