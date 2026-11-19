export function findElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Элемент #${id} отсутствует на странице.`);
  return element as T;
}

export function createActionStatus(element: Pick<HTMLElement, 'textContent'>) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return function showStatus(message: string, kind?: 'success') {
    clearTimeout(timer);
    element.textContent = message;
    if (kind === 'success') {
      timer = setTimeout(() => { element.textContent = ''; }, 4000);
    }
  };
}
