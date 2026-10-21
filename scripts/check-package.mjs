import assert from "node:assert/strict";
import { runNpm } from "./npm-command.mjs";
import { readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const output = runNpm(
  ["pack", "--dry-run", "--ignore-scripts", "--json"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
// npm 10 can still run prepare with --ignore-scripts; extract its final JSON.
const result = output.match(/(\[\s*\{\s*"id"[\s\S]*\])\s*$/)?.[1];
assert(result, "npm pack did not return a package manifest");
const [pack] = JSON.parse(result);
const paths = pack.files.map((f) => f.path);
for (const file of [
  "lib/index.js",
  "lib/client.js",
  "lib/maintenance.js",
  "bin/qwen-studio-maintain.mjs",
  "scripts/prepare.mjs",
  "scripts/npm-command.mjs",
  "scripts/setup-image-python.py",
  "backend/score_image.py",
  "AGENTS.md",
  "backend/server.py",
  "backend/normalize_image.py",
  "backend/qwen_gateway.py",
  "backend/qwen_workflow.py",
  "backend/comfy_nodes/dsh_qwen/__init__.py",
  "scripts/setup-local.sh",
  "skills/qwen-image/SKILL.md",
  "cordis.patch.yml",
  "LICENSE",
  "NOTICE",
  "README.md",
  "docs/SETUP.md",
]) {
  assert(paths.includes(file), `Missing required package file: ${file}`);
}
for (const path of paths) {
  assert(
    !/(^|\/)(node_modules|state|images|trash|models|__pycache__|venv|\.venv)(\/|$)/.test(
      path,
    ),
    `Runtime/private directory in package: ${path}`,
  );
  assert(
    !/\.(?:png|jpe?g|webp|safetensors|gguf|log|tgz|pyc)$/.test(path),
    `Unexpected data file in package: ${path}`,
  );
  if (/\.(?:js|ts|py|md|json|sh|yml)$/.test(path)) {
    const text = readFileSync(path, "utf8");
    if (path.startsWith("lib/") && path.endsWith(".js")) {
      for(const match of text.matchAll(/(?:from\s*|import\s*\()\s*["'](\.\/[^"']+\.js)["']/g)) {
        assert(paths.includes("lib/"+match[1].slice(2)), `Missing bundle dependency ${path} -> ${match[1]}`);
      }
    }
    assert(
      !/\/Users\/|\/home\/charles|hf_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}/.test(
        text,
      ),
      `Personal path or credential-like string: ${path}`,
    );
  }
}
assert.equal(
  pkg.repository.url,
  "git+https://github.com/kingcharleslzy-ai/dsh-qwen-studio.git",
);
assert(
  !pkg.dependencies?.["dsh-image-gen"],
  "Unexpected legacy runtime dependency",
);
assert(pack.unpackedSize < 5 * 1024 * 1024, "Package unexpectedly large");
console.log(
  `Package OK: ${pack.filename}; ${paths.length} files; ${pack.unpackedSize} bytes`,
);
