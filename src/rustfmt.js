import { spawnSync, execSync } from "child_process";

const commands = {
  cargo: `${process.env.HOME}/.cargo/bin/cargo`,
  rustfmt: `${process.env.HOME}/.cargo/bin/rustfmt`
};

export const checkRustfmt = () => spawnSync(`${commands.rustfmt} --version`).error;

export const formatCode = text => execSync(commands.rustfmt, { input: text });
export const formatFile = path => execSync(`${commands.rustfmt} ${path}`);
export const formatProject = directory => execSync(`${commands.cargo} fmt`, { cwd: directory });
export const checkProject = directory =>
  spawnSync(commands.cargo, ["fmt", "--", "--check"], { cwd: directory }).status === 0;
