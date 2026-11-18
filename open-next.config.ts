import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache: every page in Mandara AI is dynamic and per-person.
export default defineCloudflareConfig({});
