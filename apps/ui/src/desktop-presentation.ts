/** Presentation only: this flag grants no native capabilities or permissions. */
export function configureDesktopPresentation(search: string, target: HTMLElement) {
  if (new URLSearchParams(search).get("desktop") === "glass") {
    target.dataset.desktop = "glass";
  } else {
    delete target.dataset.desktop;
  }
}
