import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The bundled DSH skill uses single-line frontmatter; never maintain a second catalog summary. */
export function parseImageSkill(source: string) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
  if (!match) throw Error("qwen-image/SKILL.md 缺少 frontmatter");
  const meta: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/).filter(line => line.trim())) {
    const field = line.match(/^(name|description|whenToUse):\s*(.+)$/);
    if (!field || meta[field[1]!]) throw Error("图像技能 frontmatter 需为不重复的单行 name / description / whenToUse");
    const value = field[2]!.trim();
    if (value === ">" || value === "|") throw Error("图像技能简介请使用单行文本");
    meta[field[1]!] = value;
  }
  if (meta.name !== "qwen-image" || !meta.description || !meta.whenToUse || !match[2]!.trim())
    throw Error("图像技能需要 qwen-image 名称、description、whenToUse 和正文");
  return { name: meta.name, description: meta.description, whenToUse: meta.whenToUse, content: match[2]!.trim() };
}
export function bundledImageSkill() {
  const path = fileURLToPath(new URL("../skills/qwen-image/SKILL.md", import.meta.url));
  return { ...parseImageSkill(readFileSync(path, "utf8")), path, source: "图像", invocation: { modelInvocable: true, userInvocable: true } };
}
