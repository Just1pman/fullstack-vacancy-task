export function findElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Элемент #${id} отсутствует на странице.`);
  return element as T;
}
