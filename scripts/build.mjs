import { spawn } from "node:child_process";

const steps = [
  {
    label: "lint",
    cmd: process.platform === "win32" ? "yarn.cmd" : "yarn",
    args: ["lint"],
  },
  {
    label: "typecheck",
    cmd: process.platform === "win32" ? "yarn.cmd" : "yarn",
    args: ["tsc", "-p", "tsconfig.json", "--noEmit"],
  },
  {
    label: "next-compile",
    cmd: process.platform === "win32" ? "yarn.cmd" : "yarn",
    args: ["next", "build", "--experimental-build-mode", "compile", "--no-lint"],
  },
  {
    label: "next-generate",
    cmd: process.platform === "win32" ? "yarn.cmd" : "yarn",
    args: ["next", "build", "--experimental-build-mode", "generate", "--no-lint"],
  },
];

const runStep = (step) =>
  new Promise((resolve, reject) => {
    const child = spawn(step.cmd, step.args, {
      stdio: "inherit",
      env: process.env,
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${step.label} failed with code ${code ?? "null"} and signal ${signal ?? "null"}`
        )
      );
    });
  });

for (const step of steps) {
  // Keep the build phases explicit to avoid the opaque Next.js worker crash
  // seen when using the default combined `next build`.
  console.log(`\n> ${step.label}`);
  await runStep(step);
}
