import { spawnSync, execSync } from "child_process";

export const checkRustfmt = () => spawnSync("rustfmt --version").error;

export const formatCode = text => execSync("rustfmt", { input: text });
export const formatFile = path => execSync(`rustfmt ${path}`);
export const formatProject = directory => execSync("cargo fmt", { cwd: directory });
export const checkProject = directory =>
  spawnSync("cargo", ["fmt", "--", "--check"], { cwd: directory }).status === 0;
