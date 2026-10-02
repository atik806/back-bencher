// Static export for embedding on vibeflow.tech/games/back-bencher/.
// A node wrapper instead of `VAR=x next build` so it works in cmd/PowerShell too.
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_BASE_PATH: "/games/back-bencher" },
});
process.exit(result.status ?? 1);
