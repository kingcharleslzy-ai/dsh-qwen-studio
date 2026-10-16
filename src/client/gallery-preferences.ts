import { useSyncExternalStore } from "react";
import type { Job } from "../shared.js";

const KEY = "qwen-studio-private-gallery-v1";
const EVENT = "qwen-studio-gallery-preference";
export function privacyEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "false";
  } catch {
    return true;
  }
}
export function setPrivacyEnabled(enabled: boolean) {
  localStorage.setItem(KEY, String(enabled));
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener();
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", storage);
  };
}
export function usePrivacyGallery() {
  return useSyncExternalStore(subscribe, privacyEnabled, () => true);
}
export function defaultGallery(privacy: boolean) {
  return privacy ? "favorites" : "all";
}
export function galleryMatches(
  job: Job,
  filter: string,
  privacy: boolean,
  query: string,
) {
  const effective =
    privacy && filter === "all"
      ? "favorites"
      : !privacy && filter === "private"
        ? "all"
        : filter;
  if (effective === "trash" ? !job.deleted : job.deleted) return false;
  if (
    effective === "archived"
      ? !job.archived
      : effective !== "trash" && job.archived
  )
    return false;
  if (effective === "favorites" && !job.favorite) return false;
  if (effective === "private" && job.favorite) return false;
  return job.prompt.toLowerCase().includes(query.toLowerCase());
}
