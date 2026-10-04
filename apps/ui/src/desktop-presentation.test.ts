// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { configureDesktopPresentation } from "./desktop-presentation";

describe("desktop glass presentation", () => {
  it("enables only the explicit glass presentation flag", () => {
    const target = document.createElement("div");
    configureDesktopPresentation("?desktop=glass", target);
    expect(target.dataset.desktop).toBe("glass");
    configureDesktopPresentation("?desktop=true", target);
    expect(target.dataset.desktop).toBeUndefined();
  });
  it("keeps ordinary browser rendering unchanged", () => {
    const target = document.createElement("div");
    configureDesktopPresentation("", target);
    expect(target.hasAttribute("data-desktop")).toBe(false);
  });
});
