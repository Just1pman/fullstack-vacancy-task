export const createToaster =
  (container: HTMLElement, closeIcon: HTMLTemplateElement, onFocusLost: () => void) =>
  (message: string, kind: "success" | "danger" = "success") => {
    const toast = document.createElement("div");
    const text = document.createElement("span");
    const closeButton = document.createElement("button");
    let timer = 0;
    let dismissed = false;
    let hovered = false;

    toast.className = "toast";
    if (kind === "danger") toast.classList.add("toast-danger");
    text.textContent = message;
    closeButton.type = "button";
    closeButton.className = "toast-close";
    closeButton.setAttribute("aria-label", "Закрыть уведомление");
    closeButton.append(closeIcon.content.cloneNode(true));
    toast.replaceChildren(text, closeButton);
    container.append(toast);

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      window.clearTimeout(timer);
      if (toast.contains(document.activeElement)) onFocusLost();
      toast.classList.add("toast-leaving");
      window.setTimeout(() => toast.remove(), 200);
    }

    function pause() {
      window.clearTimeout(timer);
    }

    function resume() {
      if (dismissed || hovered || toast.contains(document.activeElement)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(dismiss, 5000);
    }

    closeButton.addEventListener("click", dismiss);
    toast.addEventListener("mouseenter", () => {
      hovered = true;
      pause();
    });
    toast.addEventListener("mouseleave", () => {
      hovered = false;
      resume();
    });
    toast.addEventListener("focusin", pause);
    toast.addEventListener("focusout", resume);
    timer = window.setTimeout(dismiss, 5000);
  };
