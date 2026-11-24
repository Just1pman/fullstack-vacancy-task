import type { Notifications } from "./types.js";

const NOTICE_DURATION_MS = 5000;

export function createNotifications(document: Document): Notifications {
  const notice = document.querySelector<HTMLElement>("#notice");
  const message = document.querySelector<HTMLElement>("#notice-message");
  const closeButton =
    document.querySelector<HTMLButtonElement>("#notice-close");
  const icon = notice?.querySelector<HTMLElement>(".toast-icon");
  if (!notice || !message || !closeButton || !icon)
    throw new Error("Не найдены элементы уведомления.");
  let timer: ReturnType<typeof setTimeout> | undefined;

  const hide = (): void => {
    clearTimeout(timer);
    notice.hidden = true;
    message.textContent = "";
  };

  const scheduleDismissal = (): void => {
    clearTimeout(timer);
    if (!notice.matches(":hover") && !notice.contains(document.activeElement)) {
      timer = setTimeout(hide, NOTICE_DURATION_MS);
    }
  };

  const show = (text: string, kind: "success" | "error" = "success"): void => {
    notice.dataset.kind = kind;
    icon.textContent = kind === "error" ? "!" : "✓";
    notice.hidden = false;
    message.textContent = text;
    scheduleDismissal();
  };

  closeButton.addEventListener("click", hide);
  notice.addEventListener("mouseenter", () => clearTimeout(timer));
  notice.addEventListener("mouseleave", scheduleDismissal);
  notice.addEventListener("focusin", () => clearTimeout(timer));
  notice.addEventListener("focusout", scheduleDismissal);
  return { show, hide };
}
