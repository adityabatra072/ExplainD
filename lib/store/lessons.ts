import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import type { SceneSpecT, WordTiming } from "@/lib/spec/schema";

export type LessonRow = {
  id: string;
  title: string;
  audience: string;
  prompt: string;
  status: "generating" | "ready" | "error";
  error: string | null;
  outline: OutlineT | null;
  createdAt: number;
};

export type OutlineT = {
  title: string;
  audience: string;
  scenes: { id: string; title: string; goal: string; visualIdea: string }[];
};

export type SceneRow = {
  id: string;
  lessonId: string;
  orderKey: number;
  spec: SceneSpecT;
  wordTimings: WordTiming[];
  audioPath: string | null;
  durationMs: number;
  status: "generating" | "ready" | "error";
  inserted: boolean;
  summary: string | null;
  repairCount: number;
};

export function createLesson(prompt: string, audience: string): LessonRow {
  const id = randomUUID();
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO lessons (id, prompt, audience, created_at) VALUES (?, ?, ?, ?)"
    )
    .run(id, prompt, audience, now);
  return {
    id,
    title: "",
    audience,
    prompt,
    status: "generating",
    error: null,
    outline: null,
    createdAt: now,
  };
}

export function getLesson(id: string): LessonRow | null {
  const row = getDb().prepare("SELECT * FROM lessons WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    title: row.title as string,
    audience: row.audience as string,
    prompt: row.prompt as string,
    status: row.status as LessonRow["status"],
    error: (row.error as string) ?? null,
    outline: row.outline_json ? JSON.parse(row.outline_json as string) : null,
    createdAt: row.created_at as number,
  };
}

export function listLessons(limit = 30): LessonRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM lessons ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    audience: row.audience as string,
    prompt: row.prompt as string,
    status: row.status as LessonRow["status"],
    error: (row.error as string) ?? null,
    outline: row.outline_json ? JSON.parse(row.outline_json as string) : null,
    createdAt: row.created_at as number,
  }));
}

export function updateLesson(
  id: string,
  fields: Partial<{
    title: string;
    audience: string;
    status: LessonRow["status"];
    error: string | null;
    outline: OutlineT;
  }>
): void {
  const db = getDb();
  if (fields.title !== undefined)
    db.prepare("UPDATE lessons SET title = ? WHERE id = ?").run(fields.title, id);
  if (fields.audience !== undefined)
    db.prepare("UPDATE lessons SET audience = ? WHERE id = ?").run(fields.audience, id);
  if (fields.status !== undefined)
    db.prepare("UPDATE lessons SET status = ? WHERE id = ?").run(fields.status, id);
  if (fields.error !== undefined)
    db.prepare("UPDATE lessons SET error = ? WHERE id = ?").run(fields.error, id);
  if (fields.outline !== undefined)
    db.prepare("UPDATE lessons SET outline_json = ? WHERE id = ?").run(
      JSON.stringify(fields.outline),
      id
    );
}

export function deleteLesson(id: string): void {
  getDb().prepare("DELETE FROM lessons WHERE id = ?").run(id);
}

function rowToScene(row: Record<string, unknown>): SceneRow {
  return {
    id: row.id as string,
    lessonId: row.lesson_id as string,
    orderKey: row.order_key as number,
    spec: JSON.parse(row.spec_json as string),
    wordTimings: JSON.parse(row.word_timings_json as string),
    audioPath: (row.audio_path as string) ?? null,
    durationMs: row.duration_ms as number,
    status: row.status as SceneRow["status"],
    inserted: Boolean(row.inserted),
    summary: (row.summary as string) ?? null,
    repairCount: row.repair_count as number,
  };
}

export function getScenes(lessonId: string): SceneRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM scenes WHERE lesson_id = ? ORDER BY order_key")
    .all(lessonId) as Record<string, unknown>[];
  return rows.map(rowToScene);
}

export function addScene(args: {
  lessonId: string;
  orderKey: number;
  spec: SceneSpecT;
  wordTimings: WordTiming[];
  audioPath: string | null;
  durationMs: number;
  inserted?: boolean;
  repairCount?: number;
}): SceneRow {
  const id = args.spec.id;
  getDb()
    .prepare(
      `INSERT INTO scenes (id, lesson_id, order_key, spec_json, word_timings_json, audio_path, duration_ms, status, inserted, repair_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)`
    )
    .run(
      id,
      args.lessonId,
      args.orderKey,
      JSON.stringify(args.spec),
      JSON.stringify(args.wordTimings),
      args.audioPath,
      args.durationMs,
      args.inserted ? 1 : 0,
      args.repairCount ?? 0,
      Date.now()
    );
  return {
    id,
    lessonId: args.lessonId,
    orderKey: args.orderKey,
    spec: args.spec,
    wordTimings: args.wordTimings,
    audioPath: args.audioPath,
    durationMs: args.durationMs,
    status: "ready",
    inserted: Boolean(args.inserted),
    summary: null,
    repairCount: args.repairCount ?? 0,
  };
}

export function getSceneById(
  lessonId: string,
  sceneId: string
): SceneRow | null {
  const row = getDb()
    .prepare("SELECT * FROM scenes WHERE lesson_id = ? AND id = ?")
    .get(lessonId, sceneId) as Record<string, unknown> | undefined;
  return row ? rowToScene(row) : null;
}

export function setSceneSummary(
  lessonId: string,
  sceneId: string,
  summary: string
): void {
  getDb()
    .prepare("UPDATE scenes SET summary = ? WHERE lesson_id = ? AND id = ?")
    .run(summary, lessonId, sceneId);
}

/** orderKey strictly between two neighbors (or at the end). */
export function orderKeyBetween(
  before: number | null,
  after: number | null
): number {
  if (before === null && after === null) return 1;
  if (before === null) return (after as number) - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}

export function addChatMessage(
  lessonId: string,
  role: "user" | "assistant",
  content: string
): void {
  getDb()
    .prepare(
      "INSERT INTO chat_messages (lesson_id, role, content, created_at) VALUES (?, ?, ?, ?)"
    )
    .run(lessonId, role, content, Date.now());
}

export function getChatMessages(
  lessonId: string,
  limit = 40
): { role: "user" | "assistant"; content: string }[] {
  const rows = getDb()
    .prepare(
      "SELECT role, content FROM chat_messages WHERE lesson_id = ? ORDER BY id DESC LIMIT ?"
    )
    .all(lessonId, limit) as { role: "user" | "assistant"; content: string }[];
  return rows.reverse();
}
