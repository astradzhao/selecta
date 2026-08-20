import assert from "node:assert/strict";
import { afterEach, before, describe, it, mock } from "node:test";
import { createElement } from "react";
import { act, create } from "react-test-renderer";

import { useFilteredList } from "./use-filtered-list";

before(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

type Item = { id: string };

const FILTERS = { q: "" };
const CACHED_ITEMS: Item[] = [{ id: "cached" }];

function previewCached(): Item[] {
  return CACHED_ITEMS;
}

function sameByIdentity(a: Item[], b: Item[]): boolean {
  return a === b;
}

let renderer: ReturnType<typeof create> | undefined;

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = undefined;
});

function Probe({
  fetchPage,
  previewItems,
  sameItems,
  initialItems,
  initialHasFetched,
}: {
  fetchPage: Parameters<typeof useFilteredList<Item, { q: string }>>[0]["fetchPage"];
  previewItems?: (filters: { q: string }) => Item[] | null;
  sameItems?: (a: Item[], b: Item[]) => boolean;
  initialItems?: Item[];
  initialHasFetched?: boolean;
}) {
  const list = useFilteredList({
    filters: FILTERS,
    fetchPage,
    resource: "items",
    previewItems,
    sameItems,
    initialItems,
    initialHasFetched,
  });
  return createElement(
    "span",
    null,
    `${list.hasFetched}:${list.isInitialLoading}:${list.items.map((item) => item.id).join(",")}`,
  );
}

function read(current: ReturnType<typeof create>): string {
  const child = current.root.findByType("span").children[0];
  assert.equal(typeof child, "string");
  return child as string;
}

describe("useFilteredList", () => {
  it("stays in the initial-loading state until the first page resolves", async () => {
    let resolve!: (value: { items: Item[]; hasMore: boolean }) => void;
    const fetchPage = mock.fn(
      () =>
        new Promise<{ items: Item[]; hasMore: boolean }>((next) => {
          resolve = next;
        }),
    );

    await act(async () => {
      renderer = create(createElement(Probe, { fetchPage }));
    });
    assert.equal(read(renderer!), "false:true:");

    await act(async () => {
      resolve({ items: [], hasMore: false });
    });
    assert.equal(read(renderer!), "true:false:");
  });

  it("does not replace items when a matching fingerprint asks to skip", async () => {
    const fetchPage = mock.fn(async () => ({
      items: [{ id: "fresh" }],
      hasMore: false,
      skipReplace: true as const,
    }));

    await act(async () => {
      renderer = create(
        createElement(Probe, {
          fetchPage,
          previewItems: previewCached,
          sameItems: sameByIdentity,
          initialItems: CACHED_ITEMS,
          initialHasFetched: true,
        }),
      );
    });

    assert.equal(read(renderer!), "true:false:cached");
    assert.equal(fetchPage.mock.callCount(), 1);
  });
});
