import { active, type Job } from "../shared.js";
export function previewCandidate(
  jobs: Job[],
  selected: string,
  dismissed: ReadonlySet<string>,
  seen: ReadonlySet<string>,
  since = Infinity,
) {
  const running = jobs.filter(
    (j) => active(j) && !j.deleted && !dismissed.has(j.id),
  );
  if (running.some((j) => j.id === selected)) return undefined;
  return running.find((j) => !seen.has(j.id)) ?? jobs.find(
    (j) => j.status === "complete" && !j.deleted && !dismissed.has(j.id)
      && !seen.has(j.id) && j.started_at > since,
  );
}
