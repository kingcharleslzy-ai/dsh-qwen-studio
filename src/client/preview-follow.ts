import { active, type Job } from "../shared.js";
export function previewCandidate(
  jobs: Job[],
  selected: string,
  dismissed: ReadonlySet<string>,
  seen: ReadonlySet<string>,
) {
  const running = jobs.filter(
    (j) => active(j) && !j.deleted && !dismissed.has(j.id),
  );
  if (running.some((j) => j.id === selected)) return undefined;
  return running.find((j) => !seen.has(j.id));
}
