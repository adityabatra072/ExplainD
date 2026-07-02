import { SceneSpec, type SceneSpecT, type ElementT } from "./schema";

export type SpecIssue = { path: string; message: string };

/**
 * Collect every sub-target an element exposes ("elId.subId" addressing).
 */
function subIds(el: ElementT): string[] {
  switch (el.type) {
    case "math":
      return (el.parts ?? []).map((p) => p.id);
    case "code":
      return (el.highlights ?? []).map((h) => h.id);
    case "plot":
      return [
        ...el.fns.map((f) => f.id),
        ...(el.points ?? []).map((p) => p.id),
        ...(el.lines ?? []).map((l) => l.id),
      ];
    case "numberline":
      return el.marks.map((m) => m.id);
    default:
      return [];
  }
}

/**
 * Semantic validation beyond zod's structural pass. Returns issues; empty = valid.
 */
export function lintScene(scene: SceneSpecT): SpecIssue[] {
  const issues: SpecIssue[] = [];
  const elIds = new Set(scene.elements.map((e) => e.id));

  const dupes = scene.elements
    .map((e) => e.id)
    .filter((id, i, a) => a.indexOf(id) !== i);
  for (const d of new Set(dupes)) {
    issues.push({ path: `elements`, message: `duplicate element id "${d}"` });
  }

  const targets = new Set<string>();
  for (const el of scene.elements) {
    targets.add(el.id);
    for (const sub of subIds(el)) targets.add(`${el.id}.${sub}`);
  }

  scene.beats.forEach((beat, i) => {
    if (!targets.has(beat.target)) {
      issues.push({
        path: `beats[${i}].target`,
        message: `target "${beat.target}" does not match any element id or "elementId.subId" in this scene. Valid targets: ${[...targets].join(", ")}`,
      });
    }
    if (beat.atWord) {
      const words = scene.narration.toLowerCase().split(/\s+/);
      const needle = beat.atWord.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      const found = words.some(
        (w) => w.replace(/[^\p{L}\p{N}]/gu, "") === needle
      );
      if (!found) {
        issues.push({
          path: `beats[${i}].atWord`,
          message: `word "${beat.atWord}" does not appear in the narration`,
        });
      }
    }
  });

  for (const el of scene.elements) {
    if (el.type === "arrow") {
      for (const end of [el.from, el.to] as const) {
        if (!elIds.has(end)) {
          issues.push({
            path: `elements(${el.id})`,
            message: `arrow endpoint "${end}" is not an element id in this scene`,
          });
        }
      }
    }
    if (el.type === "diagram") {
      const nodeIds = new Set(el.nodes.map((n) => n.id));
      for (const edge of el.edges) {
        if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
          issues.push({
            path: `elements(${el.id}).edges`,
            message: `edge ${edge.from}->${edge.to} references a missing node`,
          });
        }
      }
    }
    if (el.region) {
      if (el.region.col + el.region.colSpan > 12) {
        issues.push({
          path: `elements(${el.id}).region`,
          message: `region overflows grid horizontally (col ${el.region.col} + span ${el.region.colSpan} > 12)`,
        });
      }
      if (el.region.row + el.region.rowSpan > 8) {
        issues.push({
          path: `elements(${el.id}).region`,
          message: `region overflows grid vertically (row ${el.region.row} + span ${el.region.rowSpan} > 8)`,
        });
      }
    }
  }

  return issues;
}

/**
 * Deterministic salvage: make a structurally-valid scene playable by dropping
 * broken beats and clamping bad regions. Never throws. Used after the repair
 * loop gives up — a weak scene still plays; a lesson never dies for one scene.
 */
export function salvageScene(scene: SceneSpecT): SceneSpecT {
  const targets = new Set<string>();
  for (const el of scene.elements) {
    targets.add(el.id);
    for (const sub of subIds(el)) targets.add(`${el.id}.${sub}`);
  }
  const elIds = new Set(scene.elements.map((e) => e.id));

  return {
    ...scene,
    elements: scene.elements
      .filter(
        (el) =>
          el.type !== "arrow" || (elIds.has(el.from) && elIds.has(el.to))
      )
      .map((el) => {
        if (!el.region) return el;
        const colSpan = Math.min(el.region.colSpan, 12 - el.region.col);
        const rowSpan = Math.min(el.region.rowSpan, 8 - el.region.row);
        return {
          ...el,
          region: {
            ...el.region,
            colSpan: Math.max(1, colSpan),
            rowSpan: Math.max(1, rowSpan),
          },
        };
      }),
    beats: scene.beats.filter((b) => targets.has(b.target)),
  };
}

export type ParseResult =
  | { ok: true; scene: SceneSpecT }
  | { ok: false; issues: SpecIssue[] };

/** Full parse: zod structural pass + semantic lint. */
export function parseScene(raw: unknown): ParseResult {
  const parsed = SceneSpec.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }
  const issues = lintScene(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, scene: parsed.data };
}
