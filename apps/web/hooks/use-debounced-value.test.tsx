import assert from "node:assert/strict";
import { afterEach, before, describe, it, mock } from "node:test";
import { createElement } from "react";
import { act, create } from "react-test-renderer";

import { DEFAULT_DEBOUNCE_MS, useDebouncedValue } from "./use-debounced-value";

before(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  mock.timers.reset();
});

function Probe({ value, delayMs }: { value: string; delayMs?: number }) {
  const debounced = useDebouncedValue(value, delayMs);
  return createElement("span", null, debounced);
}

function read(renderer: ReturnType<typeof create>): string {
  const child = renderer.root.findByType("span").children[0];
  assert.equal(typeof child, "string");
  return child as string;
}

describe("useDebouncedValue", () => {
  it("emits the first value immediately", () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createElement(Probe, { value: "alpha" }));
    });
    assert.equal(read(renderer), "alpha");
  });

  it("debounces subsequent values", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createElement(Probe, { value: "alpha" }));
    });

    act(() => {
      renderer.update(createElement(Probe, { value: "beta" }));
    });
    assert.equal(read(renderer), "alpha");

    act(() => {
      mock.timers.tick(DEFAULT_DEBOUNCE_MS - 1);
    });
    assert.equal(read(renderer), "alpha");

    act(() => {
      mock.timers.tick(1);
    });
    assert.equal(read(renderer), "beta");
  });

  it("only commits the latest value when updates arrive during the delay", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createElement(Probe, { value: "alpha" }));
    });

    act(() => {
      renderer.update(createElement(Probe, { value: "beta" }));
    });
    act(() => {
      renderer.update(createElement(Probe, { value: "gamma" }));
    });
    assert.equal(read(renderer), "alpha");

    act(() => {
      mock.timers.tick(DEFAULT_DEBOUNCE_MS);
    });
    assert.equal(read(renderer), "gamma");
  });
});

describe("useDebouncedValue delay 0", () => {
  it("updates immediately when delayMs is 0", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createElement(Probe, { value: "alpha", delayMs: 0 }));
    });
    act(() => {
      renderer.update(createElement(Probe, { value: "beta", delayMs: 0 }));
    });
    act(() => {
      mock.timers.tick(0);
    });
    assert.equal(read(renderer), "beta");
  });
});
