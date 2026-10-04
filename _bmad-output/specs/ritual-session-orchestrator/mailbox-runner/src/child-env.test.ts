import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertNotParentSession, childProcessEnv, parentSessionId } from "./child-env.js";

const PARENT = "3dfa7ae0-ca7e-5603-ba40-4ababff4721c";

describe("childProcessEnv", () => {
  it("drops the session-binding variable and keeps everything else", () => {
    const env = childProcessEnv({ CLAUDE_CODE_SESSION_ID: PARENT, PATH: "/bin", HTTPS_PROXY: "http://p" });
    assert.equal("CLAUDE_CODE_SESSION_ID" in env, false);
    assert.equal(env.PATH, "/bin");
    assert.equal(env.HTTPS_PROXY, "http://p");
  });

  it("does not mutate the environment it was given", () => {
    const base = { CLAUDE_CODE_SESSION_ID: PARENT };
    childProcessEnv(base);
    assert.equal(base.CLAUDE_CODE_SESSION_ID, PARENT);
  });
});

describe("parentSessionId", () => {
  it("reads the orchestrator's session id, or undefined outside Claude Code", () => {
    assert.equal(parentSessionId({ CLAUDE_CODE_SESSION_ID: PARENT }), PARENT);
    assert.equal(parentSessionId({}), undefined);
    assert.equal(parentSessionId({ CLAUDE_CODE_SESSION_ID: "" }), undefined);
  });
});

describe("assertNotParentSession", () => {
  it("throws, naming where it noticed, when a child reports the orchestrator's id", () => {
    assert.throws(
      () => assertNotParentSession(PARENT, "init message", { CLAUDE_CODE_SESSION_ID: PARENT }),
      /init message carries the orchestrator's own session id/,
    );
  });

  it("accepts a different session id", () => {
    assert.doesNotThrow(() =>
      assertNotParentSession("11111111-2222-3333-4444-555555555555", "init message", { CLAUDE_CODE_SESSION_ID: PARENT }),
    );
  });

  it("accepts any id when the orchestrator is not a Claude Code session", () => {
    assert.doesNotThrow(() => assertNotParentSession(PARENT, "init message", {}));
  });
});
