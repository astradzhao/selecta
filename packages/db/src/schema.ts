import { relations, sql } from "drizzle-orm";
import {
  index,
  jsonb,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** Note lifecycle while NL extract → preview → graph commit. */
export const noteStatusEnum = pgEnum("note_status", ["draft", "preview", "committed"]);

/** Live Mode energy filter (ARCHITECTURE §5.8). */
export const energyGoalEnum = pgEnum("energy_goal", ["build", "cool", "maintain"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * App users. Local MVP uses text ids matching `DEV_USER_ID` (auth deferred).
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  ...timestamps,
});

export const libraries = pgTable(
  "libraries",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [index("libraries_owner_user_id_idx").on(table.ownerUserId)],
);

/**
 * Membership: which Neo4j Song ids belong to a library.
 * `song_id` is a Neo4j node id (no cross-store FK).
 */
export const librarySongs = pgTable(
  "library_songs",
  {
    libraryId: text("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    songId: text("song_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.libraryId, table.songId] }),
    index("library_songs_song_id_idx").on(table.songId),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    libraryId: text("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** Optional focus song (Neo4j id) when the note is about one track. */
    songId: text("song_id"),
    rawText: text("raw_text").notNull(),
    /** Structured NL extraction preview / commit payload. */
    extraction: jsonb("extraction").$type<Record<string, unknown>>(),
    status: noteStatusEnum("status").notNull().default("draft"),
    model: text("model"),
    promptVersion: text("prompt_version"),
    rawResponse: jsonb("raw_response").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("notes_library_id_idx").on(table.libraryId),
    index("notes_user_id_idx").on(table.userId),
    index("notes_song_id_idx").on(table.songId),
  ],
);

export const liveSessions = pgTable(
  "live_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    libraryId: text("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    currentSongId: text("current_song_id"),
    currentBar: integer("current_bar"),
    energyGoal: energyGoalEnum("energy_goal"),
    /** Neo4j song ids to avoid immediate repeats. */
    recentSongIds: jsonb("recent_song_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    setId: text("set_id"),
    ...timestamps,
  },
  (table) => [
    index("live_sessions_library_id_idx").on(table.libraryId),
    index("live_sessions_user_id_idx").on(table.userId),
    index("live_sessions_current_song_id_idx").on(table.currentSongId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  libraries: many(libraries),
  notes: many(notes),
  liveSessions: many(liveSessions),
}));

export const librariesRelations = relations(libraries, ({ one, many }) => ({
  owner: one(users, {
    fields: [libraries.ownerUserId],
    references: [users.id],
  }),
  songs: many(librarySongs),
  notes: many(notes),
  liveSessions: many(liveSessions),
}));

export const librarySongsRelations = relations(librarySongs, ({ one }) => ({
  library: one(libraries, {
    fields: [librarySongs.libraryId],
    references: [libraries.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  library: one(libraries, {
    fields: [notes.libraryId],
    references: [libraries.id],
  }),
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
}));

export const liveSessionsRelations = relations(liveSessions, ({ one }) => ({
  library: one(libraries, {
    fields: [liveSessions.libraryId],
    references: [libraries.id],
  }),
  user: one(users, {
    fields: [liveSessions.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Library = typeof libraries.$inferSelect;
export type NewLibrary = typeof libraries.$inferInsert;
export type LibrarySong = typeof librarySongs.$inferSelect;
export type NewLibrarySong = typeof librarySongs.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type LiveSession = typeof liveSessions.$inferSelect;
export type NewLiveSession = typeof liveSessions.$inferInsert;
export type NoteStatus = (typeof noteStatusEnum.enumValues)[number];
export type EnergyGoal = (typeof energyGoalEnum.enumValues)[number];
