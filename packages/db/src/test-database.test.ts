import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  databaseNameFromUrl,
  enableDbIntegration,
  isSafeTestDatabaseUrl,
  replaceDatabaseName,
  resolveTestDatabaseUrl,
} from "./test-database";

describe("test database URL helpers", () => {
  it("derives selecta_test from Library DATABASE_URL", () => {
    const env = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5500/selecta",
    };
    assert.equal(
      resolveTestDatabaseUrl(env),
      "postgresql://postgres:postgres@localhost:5500/selecta_test",
    );
  });

  it("prefers explicit DATABASE_URL_TEST", () => {
    const env = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5500/selecta",
      DATABASE_URL_TEST: "postgresql://postgres:postgres@localhost:5500/other_test",
    };
    assert.equal(resolveTestDatabaseUrl(env), env.DATABASE_URL_TEST);
  });

  it("refuses the dogfood Library database name", () => {
    const library = "postgresql://postgres:postgres@localhost:5500/selecta";
    const unsafe = isSafeTestDatabaseUrl(library, library);
    assert.equal(unsafe.ok, false);

    const safe = isSafeTestDatabaseUrl(
      "postgresql://postgres:postgres@localhost:5500/selecta_test",
      library,
    );
    assert.equal(safe.ok, true);
  });

  it("parses and replaces database names in connection URLs", () => {
    const base = "postgresql://postgres:postgres@localhost:5500/selecta";
    assert.equal(databaseNameFromUrl(base), "selecta");
    assert.equal(databaseNameFromUrl(replaceDatabaseName(base, "selecta_test")), "selecta_test");
  });
});

const ENV_KEYS = ["REQUIRE_DB_INTEGRATION", "DATABASE_URL", "DATABASE_URL_TEST"] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
  (typeof ENV_KEYS)[number],
  string | undefined
>;

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("REQUIRE_DB_INTEGRATION", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("skips when the flag is unset and the database name is unsafe", async () => {
    delete process.env.REQUIRE_DB_INTEGRATION;
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:1/selecta";
    process.env.DATABASE_URL_TEST = "postgresql://postgres:postgres@127.0.0.1:1/selecta";
    assert.equal(await enableDbIntegration(), false);
  });

  it("throws when the flag is set and the database is not a dedicated *_test database", async () => {
    process.env.REQUIRE_DB_INTEGRATION = "1";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:1/selecta";
    process.env.DATABASE_URL_TEST = "postgresql://postgres:postgres@127.0.0.1:1/not_safe";
    await assert.rejects(
      () => enableDbIntegration(),
      /Postgres integration tests required: refusing database "not_safe"/,
    );
  });

  it("throws when the flag is set and no database URL is configured", async () => {
    process.env.REQUIRE_DB_INTEGRATION = "1";
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_TEST;
    await assert.rejects(() => enableDbIntegration(), /set DATABASE_URL or DATABASE_URL_TEST/);
  });

  it("throws the connection error when the flag is set and Postgres is unreachable", async () => {
    process.env.REQUIRE_DB_INTEGRATION = "1";
    delete process.env.DATABASE_URL_TEST;
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:1/selecta";
    await assert.rejects(() => enableDbIntegration(), /ECONNREFUSED/);
  });

  it("skips when the flag is unset and Postgres is unreachable", async () => {
    delete process.env.REQUIRE_DB_INTEGRATION;
    delete process.env.DATABASE_URL_TEST;
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:1/selecta";
    assert.equal(await enableDbIntegration(), false);
  });
});
