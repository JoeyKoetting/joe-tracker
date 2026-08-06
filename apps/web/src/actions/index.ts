import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { getDb } from "../lib/db";
import { countMarks, setMark, updateMarkNote } from "@joe/db";

export const server = {
  setMark: defineAction({
    accept: "form",
    input: z.object({
      jpId: z.coerce.number().int().positive(),
      // An empty form value arrives as undefined, which means "clear the mark".
      state: z
        .enum(["interested", "not_interested"])
        .nullish()
        .transform((v) => v ?? null),
    }),
    async handler({ jpId, state }) {
      const db = getDb();
      await setMark(db, jpId, state);
      // Counts come back so the nav badges can update without a reload.
      return { jpId, state, counts: await countMarks(db) };
    },
  }),

  updateNote: defineAction({
    accept: "form",
    input: z.object({
      jpId: z.coerce.number().int().positive(),
      note: z.string().max(5000).nullable().optional(),
    }),
    async handler({ jpId, note }) {
      const db = getDb();
      await updateMarkNote(db, jpId, note ?? null);
      return { jpId, note: note ?? null };
    },
  }),
};
