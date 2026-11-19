import type { UserInput } from '../shared/user.js';
import * as api from './api.js';
import { getState, setState } from './store.js';

const SEARCH_DEBOUNCE_MS = 300;

let search = '';
let searchTimer: number | undefined;
let loadController: AbortController | undefined;

export async function loadUsers(): Promise<void> {
  loadController?.abort();
  const controller = new AbortController();
  loadController = controller;
  setState({ isLoading: true, loadError: null });

  try {
    const users = await api.fetchUsers(search, controller.signal);
    setState({ users, isLoading: false });
  } catch (error) {
    if (!controller.signal.aborted) {
      setState({ isLoading: false, loadError: errorMessage(error) });
    }
  }
}

export function setSearch(
  value: string
): void {
  search = value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadUsers, SEARCH_DEBOUNCE_MS);
}

export async function createUser(
  input: UserInput
): Promise<boolean> {
  if (getState().isSubmitting) {
    return false;
  }
  setState({ isSubmitting: true, formErrors: {}, actionError: null });

  try {
    await api.createUser(input);
  } catch (error) {
    if (error instanceof api.ApiError && error.details) {
      setState({ isSubmitting: false, formErrors: error.details });
    } else {
      setState({ isSubmitting: false, actionError: errorMessage(error) });
    }
    return false;
  }

  await loadUsers();
  setState({ isSubmitting: false });
  return true;
}

export async function deleteUser(
  id: number
): Promise<void> {
  const { deletingIds } = getState();
  if (deletingIds.includes(id)) {
    return;
  }
  setState({ deletingIds: [...deletingIds, id], actionError: null });

  try {
    await api.deleteUser(id);
  } catch (error) {
    setState({ deletingIds: withoutDeleting(id), actionError: errorMessage(error) });
    return;
  }

  await loadUsers();
  setState({ deletingIds: withoutDeleting(id) });
}

export function clearFieldError(
  field: keyof UserInput
): void {
  const { formErrors } = getState();
  if (formErrors[field]) {
    setState({ formErrors: { ...formErrors, [field]: undefined } });
  }
}

function withoutDeleting(
  id: number
): number[] {
  return getState().deletingIds.filter((deletingId) => deletingId !== id);
}

function errorMessage(error: unknown): string {
  return error instanceof api.ApiError ? error.message : 'Не удалось связаться с сервером';
}
