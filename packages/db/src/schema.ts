import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Note lifecycle while NL extract → preview → graph commit.
 * Notes are free-form NL; song/transition links come from extraction, not FKs.
 */
export const noteStatusEnum = pgEnum("note_status", ["draft", "preview", "committed"]);

/**
 * Single-user MVP Postgres surface.
 *
 * Songs / artists / genres / transitions live in Neo4j (one shared graph = the library).
 * Users, libraries, membership, and live sessions are deferred until multi-tenant / Live Mode needs them.
 */
export const notes = pgTable("notes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  rawText: text("raw_text").notNull(),
  /** Structured NL extraction preview / commit payload (filled by M3). */
  extraction: jsonb("extraction").$type<Record<string, unknown>>(),
  status: noteStatusEnum("status").notNull().default("draft"),
  model: text("model"),
  promptVersion: text("prompt_version"),
  rawResponse: jsonb("raw_response").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type NoteStatus = (typeof noteStatusEnum.enumValues)[number];
