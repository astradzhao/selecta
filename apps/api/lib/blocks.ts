import { NextResponse } from "next/server";
import {
  isBlockKind,
  isMusicWriteError,
  sequenceMusicWriteStatus,
  type AddSequenceStepInput,
  type CreateSequenceAlternateInput,
  type CreateSequenceInput,
  type CreateSequenceVersionInput,
  type GetSequenceDetailOptions,
  type ListSequencesInput,
  type SequenceDetail,
  type SequenceRecord,
  type SequenceTrailSeed,
  type UpdateSequenceAlternateInput,
  type UpdateSequenceInput,
  type UpdateSequenceStepInput,
  type UpdateSequenceVersionInput,
} from "@selecta/db";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function invalidId(label: string): NextResponse {
  return NextResponse.json(
    { ok: false, error: "invalid_id", message: `${label} is required.` },
    { status: 400 },
  );
}

export function invalidBody(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: "invalid_body", message }, { status: 400 });
}

export function sequenceErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (isMusicWriteError(error)) {
    const body: Record<string, unknown> = {
      ok: false,
      error: error.code,
      message: error.message,
    };
    if (error.code === "conflict" && Array.isArray(error.details?.referrers)) {
      body.referrers = error.details.referrers;
    }
    return NextResponse.json(body, { status: sequenceMusicWriteStatus(error.code) });
  }
  console.error(fallbackMessage, error);
  return NextResponse.json(
    { ok: false, error: "internal_error", message: fallbackMessage },
    { status: 500 },
  );
}

export function serializeSequence(detail: SequenceDetail) {
  return detail;
}

export function serializeSequenceRecord(row: SequenceRecord) {
  return row;
}

function asOptionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }
  return value;
}

function asOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean.`);
  }
  return value;
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be an array of strings.`);
  }
  return value;
}

export function parseExpectedUpdatedAt(value: unknown): Date {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("expectedUpdatedAt is required.");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("expectedUpdatedAt must be a valid ISO date.");
  }
  return date;
}

function parseKind(value: unknown): CreateSequenceInput["kind"] {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !isBlockKind(value)) {
    throw new Error('kind must be "block" or "set".');
  }
  return value;
}

function parseTrail(value: unknown): SequenceTrailSeed[] {
  if (!Array.isArray(value)) {
    throw new Error("seed.trail must be an array.");
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`seed.trail[${index}] must be an object.`);
    }
    if (typeof item.trackId !== "string" || !item.trackId.trim()) {
      throw new Error(`seed.trail[${index}].trackId is required.`);
    }
    const inTransitionId = asOptionalString(
      item.inTransitionId,
      `seed.trail[${index}].inTransitionId`,
    );
    return {
      trackId: item.trackId,
      ...(inTransitionId !== undefined ? { inTransitionId } : {}),
    };
  });
}

function parseSeed(value: unknown): CreateSequenceInput["seed"] {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error("seed must be an object.");
  }
  if ("trackIds" in value) {
    return { trackIds: asStringArray(value.trackIds, "seed.trackIds") };
  }
  if ("trail" in value) {
    return { trail: parseTrail(value.trail) };
  }
  throw new Error("seed must include trackIds or trail.");
}

function parseLimit(raw: string | null): number | undefined {
  if (raw == null || raw === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error("limit must be a number.");
  }
  return value;
}

function parseOffset(raw: string | null): number | undefined {
  if (raw == null || raw === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error("offset must be a number.");
  }
  return value;
}

function parseCompleteParam(raw: string | null): boolean | undefined {
  if (raw == null || raw === "") {
    return undefined;
  }
  if (raw === "1" || raw === "true") {
    return true;
  }
  if (raw === "0" || raw === "false") {
    return false;
  }
  throw new Error("complete must be true or false.");
}

export function parseListQuery(searchParams: URLSearchParams): ListSequencesInput {
  const kindRaw = searchParams.get("kind") ?? undefined;
  const kind = kindRaw === undefined ? undefined : parseKind(kindRaw);
  return {
    kind,
    query: searchParams.get("q") ?? undefined,
    complete: parseCompleteParam(searchParams.get("complete")),
    startTrackId: searchParams.get("startTrack") ?? undefined,
    endTrackId: searchParams.get("endTrack") ?? undefined,
    limit: parseLimit(searchParams.get("limit")),
    offset: parseOffset(searchParams.get("offset")),
  };
}

export function parseDetailQuery(searchParams: URLSearchParams): GetSequenceDetailOptions {
  const expandRaw = searchParams.get("expand");
  const version = searchParams.get("version");
  return {
    expand: expandRaw === "1" || expandRaw === "true",
    versionId: version?.trim() ? version.trim() : null,
  };
}

export function parseCreateSequenceBody(value: unknown): CreateSequenceInput {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  if (typeof value.title !== "string" || !value.title.trim()) {
    throw new Error("title is required.");
  }
  return {
    kind: parseKind(value.kind),
    title: value.title,
    description: asOptionalString(value.description, "description"),
    seed: parseSeed(value.seed),
  };
}

export function parseUpdateSequenceBody(value: unknown): UpdateSequenceInput {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  const input: UpdateSequenceInput = {
    kind: parseKind(value.kind),
    title: asOptionalString(value.title, "title") ?? undefined,
    description: asOptionalString(value.description, "description"),
    expectedUpdatedAt: parseExpectedUpdatedAt(value.expectedUpdatedAt),
  };
  if (input.kind === undefined && input.title === undefined && input.description === undefined) {
    throw new Error("Provide at least one of kind, title, or description.");
  }
  return input;
}

function parsePosition(value: unknown): number | "append" | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "append") {
    return "append";
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error('position must be an integer or "append".');
  }
  return value;
}

export function parseAddStepBody(value: unknown): AddSequenceStepInput {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  if (typeof value.trackId !== "string" || !value.trackId.trim()) {
    throw new Error("trackId is required.");
  }
  return {
    trackId: value.trackId,
    position: parsePosition(value.position),
    inTransitionId: asOptionalString(value.inTransitionId, "inTransitionId"),
    inBlockId: asOptionalString(value.inBlockId, "inBlockId"),
    isSeam: asOptionalBoolean(value.isSeam, "isSeam"),
    note: asOptionalString(value.note, "note"),
  };
}

export function parseUpdateStepBody(value: unknown): UpdateSequenceStepInput {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  const input: UpdateSequenceStepInput = {
    trackId: asOptionalString(value.trackId, "trackId") ?? undefined,
    inTransitionId: asOptionalString(value.inTransitionId, "inTransitionId"),
    inBlockId: asOptionalString(value.inBlockId, "inBlockId"),
    isSeam: asOptionalBoolean(value.isSeam, "isSeam"),
    note: asOptionalString(value.note, "note"),
  };
  if (Object.values(input).every((field) => field === undefined)) {
    throw new Error("Provide at least one field to update.");
  }
  return input;
}

export function parseReorderBody(value: unknown): { stepIds: string[]; expectedUpdatedAt: Date } {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  return {
    stepIds: asStringArray(value.stepIds, "stepIds"),
    expectedUpdatedAt: parseExpectedUpdatedAt(value.expectedUpdatedAt),
  };
}

export function parseCreateAlternateBody(value: unknown): CreateSequenceAlternateInput {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  if (typeof value.fromStepId !== "string" || !value.fromStepId.trim()) {
    throw new Error("fromStepId is required.");
  }
  if (typeof value.toStepId !== "string" || !value.toStepId.trim()) {
    throw new Error("toStepId is required.");
  }
  return {
    fromStepId: value.fromStepId,
    toStepId: value.toStepId,
    label: asOptionalString(value.label, "label"),
    altTransitionId: asOptionalString(value.altTransitionId, "altTransitionId"),
    altBlockId: asOptionalString(value.altBlockId, "altBlockId"),
  };
}

export function parseUpdateAlternateBody(value: unknown): UpdateSequenceAlternateInput {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  const input: UpdateSequenceAlternateInput = {
    fromStepId: asOptionalString(value.fromStepId, "fromStepId") ?? undefined,
    toStepId: asOptionalString(value.toStepId, "toStepId") ?? undefined,
    label: asOptionalString(value.label, "label"),
    altTransitionId: asOptionalString(value.altTransitionId, "altTransitionId"),
    altBlockId: asOptionalString(value.altBlockId, "altBlockId"),
  };
  if (Object.values(input).every((field) => field === undefined)) {
    throw new Error("Provide at least one field to update.");
  }
  return input;
}

export function parseCreateVersionBody(value: unknown): CreateSequenceVersionInput {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  if (typeof value.name !== "string" || !value.name.trim()) {
    throw new Error("name is required.");
  }
  return {
    name: value.name,
    alternateIds:
      value.alternateIds === undefined ? [] : asStringArray(value.alternateIds, "alternateIds"),
  };
}

export function parseUpdateVersionBody(value: unknown): UpdateSequenceVersionInput {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  const input: UpdateSequenceVersionInput = {
    name: asOptionalString(value.name, "name") ?? undefined,
    alternateIds:
      value.alternateIds === undefined
        ? undefined
        : asStringArray(value.alternateIds, "alternateIds"),
  };
  if (input.name === undefined && input.alternateIds === undefined) {
    throw new Error("Provide at least one of name or alternateIds.");
  }
  return input;
}
