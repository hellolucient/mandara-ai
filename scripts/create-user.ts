// Creates a Mandara sign-in directly in the database (first administrator, or anyone, from a terminal).
// Usage:
//   DATABASE_URL=... npx tsx scripts/create-user.ts --username trent --name "Trent Munday" --role admin [--email x] [--chat-only | --dashboard] [--sub user:123]
// --sub links the sign-in to an existing member id (for example Trent's Grok-era id) so chats and memories carry over.
// The temporary password is written to a private file (mode 600), never printed. The person changes it at first sign-in.
import { writeFileSync } from "node:fs";
import { createUser, appStage } from "../src/lib/auth-local";
import type { Role } from "../src/lib/membership";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const username = arg("username") ?? "";
  const role = (arg("role") ?? "staff") as Role;
  const result = await createUser(arg("stage") ?? appStage(), {
    username,
    name: arg("name") ?? username,
    email: arg("email"),
    role,
    chatOnly: process.argv.includes("--chat-only"),
    appAccess: process.argv.includes("--dashboard") ? "dashboard" : process.argv.includes("--chat-only") ? "chat" : "full",
    sub: arg("sub"),
  });
  if (!result.ok) {
    console.error(`Not created: ${result.error}`);
    process.exit(1);
  }
  const out = arg("out") ?? `/tmp/mandara-temp-password-${username}.txt`;
  writeFileSync(out, `${result.password}\n`, { mode: 0o600 });
  console.log(`Created ${username} (${role}). Temporary password saved to ${out} (mode 600). They must change it at first sign-in.`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://redacted") : error);
  process.exit(1);
});
