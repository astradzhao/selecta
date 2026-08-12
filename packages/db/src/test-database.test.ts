import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  databaseNameFromUrl,
  isSafeTestDatabaseUrl,
  replaceDatabaseName,
  resolveTestDatabaseUrl,
} from "./test-database";

describe("test database URL helpers", () => {
  it("derives selecta_test from Library DATABASE_URL", () => {
    const env = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/selecta",
    };
    assert.equal(
      resolveTestDatabaseUrl(env),
      "postgresql://postgres:postgres@localhost:5433/selecta_test",
    );
  });

  it("prefers explicit DATABASE_URL_TEST", () => {
    const env = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/selecta",
      DATABASE_URL_TEST: "postgresql://postgres:postgres@localhost:5433/other_test",
    };
    assert.equal(resolveTestDatabaseUrl(env), env.DATABASE_URL_TEST);
  });

  it("refuses the dogfood Library database name", () => {
    const library = "postgresql://postgres:postgres@localhost:5433/selecta";
    const unsafe = isSafeTestDatabaseUrl(library, library);
    assert.equal(unsafe.ok, false);

    const safe = isSafeTestDatabaseUrl(
      "postgresql://postgres:postgres@localhost:5433/selecta_test",
      library,
    );
    assert.equal(safe.ok, true);
  });

  it("parses and replaces database names in connection URLs", () => {
    const base = "postgresql://postgres:postgres@localhost:5433/selecta";
    assert.equal(databaseNameFromUrl(base), "selecta");
    assert.equal(databaseNameFromUrl(replaceDatabaseName(base, "selecta_test")), "selecta_test");
  });
});
