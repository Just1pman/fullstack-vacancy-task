import type { User } from '../shared/user.js';
import type { FieldErrors } from './api.js';

export interface State {
  users: User[];
  isLoading: boolean;
  loadError: string | null;
  actionError: string | null;
  formErrors: FieldErrors;
  isSubmitting: boolean;
  deletingIds: number[];
}

type Listener = (state: State) => void;

let state: State = {
  users: [],
  isLoading: false,
  loadError: null,
  actionError: null,
  formErrors: {},
  isSubmitting: false,
  deletingIds: [],
};

const listeners: Listener[] = [];

export function getState(): State {
  return state;
}

export function setState(
  patch: Partial<State>
): void {
  state = { ...state, ...patch };
  for (const listener of listeners) {
    listener(state);
  }
}

export function subscribe(
  listener: Listener
): void {
  listeners.push(listener);
}
