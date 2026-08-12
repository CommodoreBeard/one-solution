/**
 * The three lines of DOM plumbing every component here would otherwise repeat.
 *
 * Not a framework and not a barrel: `el` is `document.createElement` with the
 * attributes and children in one call, which is the difference between a
 * component that reads like markup and one that reads like assembly.
 */

type Child = Node | string;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>> = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** The same, for the gallery thumbnails, which are vector rather than canvas. */
export function svg(
  tag: string,
  attributes: Readonly<Record<string, string>> = {},
  children: readonly Element[] = [],
): SVGElement {
  const node = document.createElementNS(SVG_NAMESPACE, tag) as SVGElement;
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  for (const child of children) node.append(child);
  return node;
}

/**
 * Size a canvas to its own CSS box at the device's pixel ratio, and return a
 * context already scaled to CSS pixels. Returns `null` when the canvas has no
 * layout yet or 2D is unavailable, so every caller has to handle it once.
 */
export function fitCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return null;

  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);

  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
}

/** True when the page is being shown in the dark colour scheme. */
export function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Run `redraw` whenever the colour scheme changes under the page. */
export function onSchemeChange(redraw: () => void): void {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
}
