import { test, expect, vi, afterEach } from "vitest";
import {
  defaultGallery,
  galleryMatches,
  privacyEnabled,
  setPrivacyEnabled,
} from "../src/client/gallery-preferences.js";
import type { Job } from "../src/shared.js";
const job = (patch: Partial<Job> = {}): Job => ({
  id: "test",
  prompt: "Blue cup",
  status: "complete",
  width: 512,
  height: 512,
  steps: 20,
  seed: 1,
  started_at: 1,
  ...patch,
});
afterEach(() => vi.unstubAllGlobals());
test("privacy is opt-out, persists across reads and notifies the current window", () => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
  const dispatchEvent = vi.fn();
  vi.stubGlobal("window", { dispatchEvent });
  expect(privacyEnabled()).toBe(true);
  expect(defaultGallery(privacyEnabled())).toBe("favorites");
  setPrivacyEnabled(false);
  expect(privacyEnabled()).toBe(false);
  expect(defaultGallery(privacyEnabled())).toBe("all");
  setPrivacyEnabled(true);
  expect(privacyEnabled()).toBe(true);
  expect(dispatchEvent).toHaveBeenCalledTimes(2);
});
test("new images and chat-generated images stay out of the default gallery until starred", () => {
  const image = job();
  expect(galleryMatches(image, "favorites", true, "")).toBe(false);
  expect(galleryMatches(image, "all", true, "")).toBe(false);
  expect(galleryMatches(image, "private", true, "cup")).toBe(true);
  image.favorite = true;
  expect(galleryMatches(image, "favorites", true, "blue")).toBe(true);
  expect(galleryMatches(image, "private", true, "")).toBe(false);
  image.favorite = false;
  expect(galleryMatches(image, "private", true, "")).toBe(true);
});
test("disabling privacy restores all works without modifying favorites, archive or trash", () => {
  expect(galleryMatches(job(), "all", false, "")).toBe(true);
  expect(galleryMatches(job({ favorite: true }), "all", false, "")).toBe(true);
  expect(galleryMatches(job({ deleted: true }), "all", false, "")).toBe(false);
  expect(galleryMatches(job({ archived: true }), "all", false, "")).toBe(false);
  expect(galleryMatches(job({ archived: true }), "archived", true, "")).toBe(
    true,
  );
  expect(
    galleryMatches(job({ deleted: true, archived: true }), "trash", true, ""),
  ).toBe(true);
  expect(galleryMatches(job(), "private", false, "missing")).toBe(false);
});
