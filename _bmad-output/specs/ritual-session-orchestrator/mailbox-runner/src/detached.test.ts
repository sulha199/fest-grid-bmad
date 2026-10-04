import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SIGNAL, EXIT_MARKER, logPaths, safeLabel, splitComplete } from "./detached.js";

describe("DEFAULT_SIGNAL", () => {
  it("wakes on mailbox requests, resolutions, results and failures", () => {
    for (const line of [
      "[run-ritual] canUseTool: Bash -> writing mailbox request 8d6b475b-a619",
      "[run-ritual] request 8d6b475b-a619 resolved",
      "[run-ritual] final result:",
      "[run-act-with-checks] step 1/2: dispatching",
      "[run-check:test] finished in 60s, exit code 1",
      "[run-ritual] fatal error: Error: boom",
      "apps/web/x.ts(1,2): error TS2345: bad",
      "[exit code 0]",
    ]) {
      assert.ok(DEFAULT_SIGNAL.test(line), line);
    }
  });

  it("stays quiet on ordinary progress and on prose that merely mentions an error", () => {
    for (const line of [
      "[run-ritual] label=\"3.6u/bmad-dev-story\" model=(session default)",
      "[run-ritual] prompt: /bmad-dev-story 3.6u (+12 more lines, 2204 chars)",
      "the previous session died on an AbortError: Stream closed",
      "  at async Test.run (node:internal/test_runner/test:1054:7)",
    ]) {
      assert.equal(DEFAULT_SIGNAL.test(line), false, line);
    }
  });
});

describe("EXIT_MARKER", () => {
  it("matches only a whole exit-code line", () => {
    assert.equal(EXIT_MARKER.exec("[exit code 0]")?.[1], "0");
    assert.equal(EXIT_MARKER.exec("[exit code 143]")?.[1], "143");
    assert.equal(EXIT_MARKER.test("done [exit code 0]"), false);
  });
});

describe("splitComplete", () => {
  it("returns whole lines and holds back an unfinished tail", () => {
    assert.deepEqual(splitComplete("a\nb\npart"), { lines: ["a", "b"], rest: "part" });
    assert.deepEqual(splitComplete("a\nb\n"), { lines: ["a", "b"], rest: "" });
    assert.deepEqual(splitComplete("part"), { lines: [], rest: "part" });
  });
});

describe("logPaths / safeLabel", () => {
  it("keys every file by the sanitized label under <mailbox>/logs", () => {
    assert.equal(safeLabel("3.6u/bmad-dev-story"), "3.6u_bmad-dev-story");
    const p = logPaths("/m", "3.6u/bmad-dev-story");
    assert.equal(p.log, "/m/logs/3.6u_bmad-dev-story.log");
    assert.equal(p.pid, "/m/logs/3.6u_bmad-dev-story.pid");
    assert.equal(p.offset, "/m/logs/3.6u_bmad-dev-story.offset");
  });
});
