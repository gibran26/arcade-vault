import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();

let data;
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const file = data?.tool_input?.file_path || data?.tool_response?.filePath || "";
if (!file) process.exit(0);

const abs = path.resolve(root, file);
const rel = path.relative(root, abs);
if (rel.startsWith("..") || path.isAbsolute(rel)) process.exit(0);
if (/(^|[\\/])(node_modules|\.next|\.git)[\\/]/.test(rel)) process.exit(0);

const ext = path.extname(abs).toLowerCase();
const prettierExts = [".tsx", ".ts", ".jsx", ".js", ".md", ".mdx", ".css"];
const eslintExts = [".tsx", ".ts", ".jsx", ".js"];
if (!prettierExts.includes(ext)) process.exit(0);

const opts = { cwd: root, stdio: "inherit", shell: true };
spawnSync("npx", ["--no-install", "prettier", "--write", "--ignore-unknown", abs], opts);
if (eslintExts.includes(ext)) {
  spawnSync("npx", ["--no-install", "eslint", "--fix", "--no-warn-ignored", abs], opts);
}

process.exit(0);
