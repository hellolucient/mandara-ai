import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { Member } from "./members";
import { navItems } from "./nav";
import { canSeeProspects, ProspectsForbiddenError } from "./prospects-access";
import {
  handleAddNote,
  handleAddSignal,
  handleGetProspect,
  handleImport,
  handleListProspects,
  handleUpdateProspect,
} from "./prospects-api";
import {
  addProspectNote,
  addSignal,
  getProspect,
  importProspects,
  listProspects,
  prospectSummary,
  setProspectStatus,
} from "./prospects-store";
import { atollGroup } from "./prospects-format";
import { scrubContact, timingSortDate, validateProspectImport, validateSignal } from "./prospects-validate";

const STAGE = "prospects-test";
const ROUTES = [
  "src/app/api/prospects/route.ts",
  "src/app/api/prospects/import/route.ts",
  "src/app/api/prospects/[id]/route.ts",
  "src/app/api/prospects/[id]/notes/route.ts",
  "src/app/api/prospects/[id]/signals/route.ts",
];
const person = (role: Member["role"]): Member => ({
  stage: "production",
  sub: `user:${role}`,
  email: `${role}@example.com`,
  name: `Test ${role}`,
  role,
  simulated: false,
});
const admin = { ...person("admin"), stage: STAGE } as unknown as Member;
const manager = { ...person("manager"), stage: STAGE } as unknown as Member;
const staff = { ...person("staff"), stage: STAGE } as unknown as Member;

const sampleFile = {
  kind: "mandara-prospects",
  version: 1,
  prospects: [
    {
      key: "bandos-maldives",
      name: "Bandos Maldives",
      atoll: "Kaafu",
      brandGroup: "Orchid Holdings (owner)",
      priority: "A",
      gmName: "Ismail Rasheed",
      spaManager: "Contact spa@bandos.example or +960 664 0088",
      sources: ["https://bandosmaldives.com/spa/", "javascript:alert(1)"],
    },
    {
      key: "manhattan-grand",
      name: "Manhattan Grand Hotel, Hulhumalé",
      atoll: "Kaafu (Hulhumalé)",
      timing: "Unsigned draft redline received 11 Nov 2026",
      statusOnCreate: "in_talks",
      initialNote: { date: "2026-11-11", body: "Unsigned draft redline received." },
    },
    { key: "vissna-thulusdhoo", name: "VISSNA spa, Thulusdhoo", statusOnCreate: "lost" },
  ],
  signals: [{ prospect: "bandos-maldives", date: "2026-11-16", type: "job_ad", summary: "Spa manager ad", url: "https://job-maldives.com/x" }],
};

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://127.0.0.1:4327${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": "same-origin", ...headers },
    body: JSON.stringify(body),
  });
}

describe("prospects: who can see them", () => {
  it("only an administrator can see prospects", () => {
    assert.equal(canSeeProspects("admin"), true);
    assert.equal(canSeeProspects("manager"), false);
    assert.equal(canSeeProspects("staff"), false);
    assert.equal(canSeeProspects(undefined), false);
  });

  it("shows the Prospects menu item to administrators only", () => {
    assert.ok(navItems("admin").some((item) => item.href === "/prospects"));
    assert.ok(!navItems("manager").some((item) => item.href === "/prospects"));
    assert.ok(!navItems("staff").some((item) => item.href === "/prospects"));
  });

  it("refuses managers and staff at the data layer before any read or write", async () => {
    for (const viewer of [manager, staff]) {
      await assert.rejects(() => listProspects(viewer), ProspectsForbiddenError);
      await assert.rejects(() => getProspect(viewer, "x"), ProspectsForbiddenError);
      await assert.rejects(() => prospectSummary(viewer), ProspectsForbiddenError);
      await assert.rejects(() => setProspectStatus(viewer, "x", "won", "2026-11-17"), ProspectsForbiddenError);
      await assert.rejects(() => addProspectNote(viewer, "x", "2026-11-17", "hi"), ProspectsForbiddenError);
      await assert.rejects(
        () => addSignal(viewer, "x", { date: "2026-11-17", type: "news", summary: "s", url: "" }),
        ProspectsForbiddenError,
      );
      await assert.rejects(() => importProspects(viewer, { prospects: [], signals: [], skipped: [] }), ProspectsForbiddenError);
    }
  });

  it("returns 403 with no prospect data from every API for managers and staff", async () => {
    const check = async (response: Response) => {
      assert.equal(response.status, 403);
      const body = (await response.json()) as Record<string, unknown>;
      assert.deepEqual(Object.keys(body), ["error"]);
    };
    for (const viewer of [manager, staff]) {
      await check(await handleListProspects(viewer));
      await check(await handleGetProspect(viewer, "any"));
      await check(await handleUpdateProspect(viewer, post("/api/prospects/x", { status: "won" }), "x"));
      await check(await handleAddNote(viewer, post("/api/prospects/x/notes", { date: "2026-11-17", body: "x" }), "x"));
      await check(await handleAddSignal(viewer, post("/api/prospects/x/signals", { date: "2026-11-17", type: "news", summary: "x" }), "x"));
      await check(await handleImport(viewer, post("/api/prospects/import", sampleFile)));
    }
  });

  it("passes the sign-in refusal through unchanged and refuses cross-site writes", async () => {
    const signedOut = Response.json({ error: "Sign in to use Mandara AI." }, { status: 401 });
    assert.equal((await handleListProspects(signedOut)).status, 401);
    const crossSite = post("/api/prospects/import", sampleFile, { "sec-fetch-site": "cross-site" });
    assert.equal((await handleImport(admin, crossSite)).status, 403);
  });

  it("keeps prospects out of the chat assistant and every other module", () => {
    const allowed = new Set([
      "src/lib/prospects-store.ts",
      "src/lib/prospects-api.ts",
      "src/lib/prospects.test.ts",
      "src/app/(app)/page.tsx",
      "src/app/(app)/prospects/page.tsx",
      "src/app/(app)/prospects/[id]/page.tsx",
      "src/lib/prospects-access.ts",
      ...ROUTES,
    ]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) walk(file);
        else if (/\.(ts|tsx)$/.test(name)) {
          const source = readFileSync(file, "utf8");
          const reads = /prospects-store|prospects-api|\bprospect_(notes|signals)\b|\bfrom\s+prospects\b/.test(source);
          if (reads && !allowed.has(file.split(path.sep).join("/"))) offenders.push(file);
        }
      }
    };
    walk("src");
    assert.deepEqual(offenders, []);
    for (const file of ["src/lib/chat.ts", "src/lib/knowledge.ts", "src/lib/routing.ts", "src/lib/agent.ts", "src/app/api/chat/route.ts"]) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /prospect/i, `${file} must not read prospects`);
    }
  });

  it("sends every prospects API route through an administrator-checked handler", () => {
    const onDisk: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) walk(file);
        else onDisk.push(file.split(path.sep).join("/"));
      }
    };
    walk("src/app/api/prospects");
    assert.deepEqual(onDisk.sort(), [...ROUTES].sort(), "a new prospects route must be added to this test");
    for (const file of ROUTES) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /prospects-store|from "@\/lib\/db"/, `${file} must not read the database directly`);
      const exported = [...source.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)/g)].length;
      const delegated = [...source.matchAll(/return handle\w+\(await requireMember\(request\)/g)].length;
      assert.ok(exported > 0 && exported === delegated, `${file}: each method must call a handle* function`);
    }
  });

  it("guards both prospect pages with the administrator check before loading", () => {
    for (const file of ["src/app/(app)/prospects/page.tsx", "src/app/(app)/prospects/[id]/page.tsx"]) {
      const source = readFileSync(file, "utf8");
      const gate = source.indexOf("if (!canSeeProspects(member.role)) notFound();");
      const load = Math.min(...["listProspects(", "getProspect("].map((f) => source.indexOf(f)).filter((i) => i >= 0));
      assert.ok(gate > 0 && gate < load, `${file} must refuse non-admins before reading`);
    }
    const home = readFileSync("src/app/(app)/page.tsx", "utf8");
    assert.match(home, /canSeeProspects\(member\.role\) \? prospectSummary\(member\) : Promise\.resolve\(null\)/);
  });
});

describe("prospects: import and tracking", () => {
  it("imports idempotently and keeps stages, notes and signals an administrator set", async () => {
    const first = (await (await handleImport(admin, post("/api/prospects/import", sampleFile))).json()) as Record<string, number>;
    assert.equal(first.created, 3);
    assert.equal(first.signalsAdded, 1);

    const list = await listProspects(admin);
    const bandos = list.find((p) => p.key === "bandos-maldives");
    const mg = list.find((p) => p.key === "manhattan-grand");
    assert.ok(bandos && mg);
    assert.equal(mg.status, "in_talks");
    assert.equal(mg.timingDate, "2026-11-11");
    assert.equal(list.find((p) => p.key === "vissna-thulusdhoo")?.status, "lost");
    assert.equal(bandos.status, "watching");
    assert.deepEqual(bandos.sources, ["https://bandosmaldives.com/spa/"]);
    assert.doesNotMatch(bandos.spaManager, /@|664 0088/);
    assert.equal(bandos.latestSignal?.type, "job_ad");

    assert.equal(await setProspectStatus(admin, bandos.id, "ready", "2026-11-17"), true);
    assert.equal(await addProspectNote(admin, bandos.id, "2026-11-17", "Call the GM after ITB."), true);

    const again = (await (await handleImport(admin, post("/api/prospects/import", sampleFile))).json()) as Record<string, number>;
    assert.equal(again.created, 0);
    assert.equal(again.updated, 3);
    assert.equal(again.signalsAdded, 0);
    assert.equal(again.signalsDuplicate, 1);

    const detail = await getProspect(admin, bandos.id);
    assert.equal(detail?.prospect.status, "ready");
    assert.equal(detail?.signals.length, 1);
    assert.ok(detail?.notes.some((n) => n.body === "Call the GM after ITB."));
    assert.ok(detail?.notes.some((n) => n.body === "Stage: Watching → Ready to approach"));
    const mgDetail = await getProspect(admin, mg.id);
    assert.equal(mgDetail?.notes.filter((n) => n.body === "Unsigned draft redline received.").length, 1);

    const summary = await prospectSummary(admin);
    assert.equal(summary.total, 3);
    assert.equal(summary.byStatus.ready, 1);
    assert.equal(summary.recentSignals[0]?.prospectName, "Bandos Maldives");
  });

  it("lets an administrator change stage, add a note and add a signal through the API", async () => {
    const [p] = await listProspects(admin);
    const patch = new Request("http://127.0.0.1:4327/api/prospects/x", {
      method: "PATCH",
      headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" },
      body: JSON.stringify({ status: "proposal", date: "2026-11-17" }),
    });
    assert.equal((await handleUpdateProspect(admin, patch, p.id)).status, 200);
    assert.equal((await handleUpdateProspect(admin, post("/x", { status: "signed" }), p.id)).status, 422);
    assert.equal((await handleAddNote(admin, post("/x", { date: "2026-11-17", body: "Sent deck" }), p.id)).status, 200);
    const signal = { date: "2026-11-15", type: "new_gm", summary: "New GM from Cinnamon", url: "https://hoteliermaldives.com/a" };
    assert.equal((await handleAddSignal(admin, post("/x", signal), p.id)).status, 200);
    const dup = (await (await handleAddSignal(admin, post("/x", signal), p.id)).json()) as { duplicate: boolean };
    assert.equal(dup.duplicate, true);
    assert.equal((await handleAddSignal(admin, post("/x", { ...signal, url: "ftp://x" }), p.id)).status, 422);
    assert.equal((await handleGetProspect(admin, "missing")).status, 404);
  });
});

describe("prospects: validation", () => {
  it("removes emails and phone numbers but keeps dates and links", () => {
    assert.equal(scrubContact("Mail gm@resort.mv or call +960 664-0088"), "Mail [email removed] or call [phone removed]");
    assert.equal(scrubContact("Hotline 330 1234."), "Hotline [phone removed].");
    assert.equal(scrubContact("GM since 2026-10-30, see https://x.com/7371452780969934848"), "GM since 2026-10-30, see https://x.com/7371452780969934848");
    assert.equal(scrubContact("Rate 1499-1618 USD, 1999-2014"), "Rate 1499-1618 USD, 1999-2014");
  });

  it("turns free-text timing into a sortable date", () => {
    assert.equal(timingSortDate("Opening: June 2027 (Q2 2027)"), "2027-06-01");
    assert.equal(timingSortDate("Opening: Q1 2027"), "2027-01-01");
    assert.equal(timingSortDate("Opening: Early Q3 2028"), "2028-07-01");
    assert.equal(timingSortDate("Opening: Late 2026 (no month)"), "2026-10-01");
    assert.equal(timingSortDate("Reopening after renovation: 15 November 2026"), "2026-11-15");
    assert.equal(timingSortDate("Opening: 2027"), "2027-07-01");
    assert.equal(timingSortDate("Rebrand: No date announced"), null);
  });

  it("rejects files that are not a prospects import and bad signals", () => {
    assert.equal(validateProspectImport({ businessDate: "2026-11-16", rows: [] }).ok, false);
    assert.equal(validateProspectImport({ kind: "mandara-prospects", prospects: [] }).ok, false);
    const dup = validateProspectImport({ kind: "mandara-prospects", prospects: [{ name: "A" }, { name: "A" }] });
    assert.ok(dup.ok && dup.value.prospects.length === 1 && dup.value.skipped.length === 1);
    assert.equal(validateSignal({ prospect: "a", date: "2026-02-30", type: "news", summary: "x" }).ok, false);
    assert.equal(validateSignal({ prospect: "a", date: "2026-02-03", type: "rumour", summary: "x" }).ok, false);
    assert.equal(validateSignal({ prospect: "a", date: "2026-02-03", type: "news", summary: "x" }).ok, true);
  });

  it("files geographic atoll names under the official atoll", () => {
    assert.equal(atollGroup("Kaafu (Hulhumalé)"), "Kaafu");
    assert.equal(atollGroup("South Malé Atoll, Guraidhoo"), "Kaafu");
    assert.equal(atollGroup("South Ari Atoll, Bodufinolhu"), "Alifu Dhaalu");
    assert.equal(atollGroup("Raa Atoll, Ranfushi"), "Raa");
    assert.equal(atollGroup("Baa"), "Baa");
    assert.equal(atollGroup("Not settled in sources"), "");
  });
});
