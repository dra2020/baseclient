type Point = [number, number];

/**
 * Minimal shape this validator needs. A real topology from
 * `topojson-specification` satisfies this. We require both `packed.arcs`
 * (the segment data) and `packed.arcindices` + `objects` (so we can walk
 * only the arcs reachable from the live object set, matching
 * topojson-client's `validateneighbors.js` semantics via `forAllArcPoints`
 * with `onlyOnce: true`).
 */
export interface PackedTopologyLike {
  objects: { [id: string]: PackedObject };
  packed: {
    arcs: Float64Array | number[];
    arcindices: Int32Array | number[];
    /** Per-topology map from object reference to its offset into `packed.arcindices`.
     *  Kept here (not on the object) so the same object can appear in more than one
     *  packed topology — see topojson-client/src/packarcindices.js. */
    objectArcs: WeakMap<object, number>;
  };
}

interface PackedObject {
  type: string;
}

/** A line segment found in more than one arc. Endpoints are reported in their
 *  lexicographic-canonical order (smaller endpoint first). */
export interface DuplicateArcSegment {
  segment: { s: Point; e: Point };
  /** Arc indices (into `topology.packed.arcs`) that contain this segment, ascending. */
  arcs: number[];
}

export interface ValidateArcSegmentsOptions {
  /**
   * Subset of object IDs to validate. If undefined, every object in
   * `topology.objects` is walked (matching `validateneighbors.js` default,
   * which uses `params.topology.objects` when no `objects` field is given).
   *
   * Accepts either a hash whose keys are the object IDs to include (same
   * shape as `topology.objects`), or a Set of IDs.
   */
  objects?: { [id: string]: unknown } | Set<string>;
}

export interface ValidateArcSegmentsResult {
  ok: boolean;
  duplicates: DuplicateArcSegment[];
  /** Number of unique arcs actually inspected (reachable from the object set). */
  arcsInspected: number;
  /** Total (arc, consecutive-point-pair) segments inspected across reachable arcs. */
  totalSegments: number;
}

/**
 * Verify that no two arcs of a packed TopoJSON topology contain the same line
 * segment — i.e. the same pair of consecutive points, in either direction.
 *
 * Semantics mirror topojson-client's `validateneighbors.js`:
 *   - Only arcs **reachable from the current object set** are inspected;
 *     orphaned arcs in the packed buffer are ignored.
 *   - Each reachable arc is visited at most once (the `onlyOnce: true` flag
 *     in the upstream `forAllArcPoints` walker).
 *   - Equality is exact Float64 (no epsilon), matching `splice.js`'s
 *     `dedup`/`equalArcs`. Endpoint order is normalized lexicographically
 *     before keying, so segment `(P→Q)` in one arc and `(Q→P)` in another
 *     are treated as the same segment.
 *   - Within-arc segment repeats (the same arc containing the same segment
 *     twice) are ignored — only cross-arc duplicates are reported.
 *
 * Expected packed layout (same as topojson-client's `forAllArcPoints` / `splice`):
 *   topology.packed.arcs (Float64Array)
 *     [0]              = narcs
 *     [1 + 2*a]        = npoints for arc `a`
 *     [1 + 2*a + 1]    = pointoffset for arc `a` (index into the same buffer)
 *     at pointoffset:  interleaved x, y, x, y, ... (2 floats per point)
 *   topology.packed.arcindices (Int32Array)
 *     starting at object.packedarcs:
 *       Polygon      : [nring][narc][arc...]...
 *       MultiPolygon : [npoly][nring][narc][arc...]...
 *
 * O(total reachable points) time, O(total reachable unique segments) space.
 */
export function validateNoDuplicateArcSegments(
  topology: PackedTopologyLike,
  options: ValidateArcSegmentsOptions = {},
): ValidateArcSegmentsResult {
  const arcs = topology.packed.arcs;
  const arcindices = topology.packed.arcindices;

  // -- Phase 1: walk topology.objects to collect the set of reachable arcs ---
  // Mirrors forAllArcPoints({ topology, objects, onlyOnce: true }) which is
  // what validateneighbors.js uses. We only need each reachable arc once,
  // so dedup with a Set as we go.
  const seen = new Set<number>();

  function walkRing(z: number): number {
    const narc = arcindices[z++];
    for (let i = 0; i < narc; i++, z++)
    {
      let arc = arcindices[z];
      if (arc < 0) arc = ~arc; // negative encodes reversed direction; same arc index after ~
      if (!seen.has(arc)) seen.add(arc);
    }
    return z;
  }

  function walkPolygon(z: number): number {
    const nring = arcindices[z++];
    for (let i = 0; i < nring; i++) z = walkRing(z);
    return z;
  }

  function walkMultiPolygon(z: number): number {
    const npoly = arcindices[z++];
    for (let i = 0; i < npoly; i++) z = walkPolygon(z);
    return z;
  }

  // Resolve the object-id list to walk. A user-supplied Set is converted to
  // an iterable of keys; a user-supplied hash is treated as id→anything (same
  // shape as `topology.objects`); falling back to all of `topology.objects`.
  let objectIds: Iterable<string>;
  if (options.objects instanceof Set) objectIds = options.objects;
  else if (options.objects) objectIds = Object.keys(options.objects);
  else objectIds = Object.keys(topology.objects);

  const objectArcs = topology.packed.objectArcs;
  for (const id of objectIds)
  {
    const obj = topology.objects[id];
    if (!obj) continue;
    const z = objectArcs ? objectArcs.get(obj) : undefined;
    if (z === undefined) continue;
    if (obj.type === "Polygon") walkPolygon(z);
    else if (obj.type === "MultiPolygon") walkMultiPolygon(z);
    // Other geometry types don't contribute polygon arcs; ignore.
  }

  // -- Phase 2: scan segments only on reachable arcs --------------------------

  /** Canonical key for a segment, with endpoints lex-sorted (smaller first).
   *  Number.prototype.toString round-trips finite Float64s reversibly, so
   *  byte-equal floats produce byte-equal strings — same coordinate equality
   *  as `splice.js`'s `equalArcs`. */
  function segKey(p1x: number, p1y: number, p2x: number, p2y: number): string {
    const smallerFirst = p1x < p2x || (p1x === p2x && p1y < p2y);
    return smallerFirst
      ? `${p1x},${p1y};${p2x},${p2y}`
      : `${p2x},${p2y};${p1x},${p1y}`;
  }

  const firstArcByKey = new Map<string, number>();
  const dupByKey = new Map<string, DuplicateArcSegment>();
  let totalSegments = 0;

  seen.forEach((arc) => {
    const hdr = 1 + arc * 2;
    const npoints = arcs[hdr] | 0;
    let zp = arcs[hdr + 1] | 0;
    if (npoints < 2) return;

    let px = arcs[zp++];
    let py = arcs[zp++];
    for (let i = 1; i < npoints; i++)
    {
      const qx = arcs[zp++];
      const qy = arcs[zp++];
      totalSegments++;

      const key = segKey(px, py, qx, qy);
      const firstArc = firstArcByKey.get(key);
      if (firstArc === undefined)
      {
        firstArcByKey.set(key, arc);
      }
      else if (firstArc !== arc)
      {
        let entry = dupByKey.get(key);
        if (!entry)
        {
          const pIsSmaller = px < qx || (px === qx && py < qy);
          const s: Point = pIsSmaller ? [px, py] : [qx, qy];
          const e: Point = pIsSmaller ? [qx, qy] : [px, py];
          entry = { segment: { s, e }, arcs: [firstArc] };
          dupByKey.set(key, entry);
        }
        // Sorted append — `seen.forEach` runs arcs in insertion order
        // (object-walk order), so duplicates land in a useful sequence.
        if (entry.arcs[entry.arcs.length - 1] !== arc) entry.arcs.push(arc);
      }

      px = qx;
      py = qy;
    }
  });

  const duplicates: DuplicateArcSegment[] = [];
  dupByKey.forEach((d) => {
    d.arcs.sort((a, b) => a - b);
    duplicates.push(d);
  });
  duplicates.sort((a, b) => a.arcs[0] - b.arcs[0]);

  return {
    ok: duplicates.length === 0,
    duplicates,
    arcsInspected: seen.size,
    totalSegments,
  };
}

// =============================================================================
// Cross-arc interior-point-sharing diagnostic
// =============================================================================

/** One offending point: shared between arcs in a way that violates
 *  `ptsToArcs`'s "interior set once" invariant. */
export interface InteriorPointSharing {
  point: Point;
  /** Arcs in which this point is INTERIOR (not the first or last point). */
  interiorInArcs: number[];
  /** Arcs in which this point is an ENDPOINT (first or last point). */
  endpointInArcs: number[];
}

export interface InteriorPointSharingResult {
  ok: boolean;
  /** Points that, in this single topology, are shared across arcs in a way that
   *  causes `ptsToArcs` (inside topojson-client's splice) to silently overwrite
   *  its `map.set(here, …)` record for that point.
   *
   *  Two failure modes are flagged:
   *
   *    a) **Interior in 2+ arcs.** `ptsToArcs` says "Interior points will by
   *       definition only be set once." If that invariant doesn't hold,
   *       whichever arc walks last wins the `map.set`; the earlier arc's
   *       record at that point is lost. `newJunctions` then can't detect that
   *       the lost arc needed cutting against another topology, so it stays
   *       whole and may produce duplicate segments after splice.
   *
   *    b) **Interior in one arc AND endpoint in another.** The same overwrite
   *       happens regardless of which one walks last:
   *         - If the endpoint write lands last, the interior record is lost
   *           and the interior arc never gets its junction check.
   *         - If the interior write lands last, the endpoint's
   *           junction-forcing role at that point is lost.
   *       The `ptsToArcs` comment says endpoint overwrites are OK "since ANY
   *       endpoint forces a junction" — that only holds when *all* the
   *       overwrites are endpoint-on-endpoint. As soon as an interior is in
   *       the mix, the invariant is broken.
   */
  offenses: InteriorPointSharing[];
  /** Number of unique arcs actually inspected (reachable from objects). */
  arcsInspected: number;
}

/**
 * Diagnose whether a single input topology to `splice` violates the
 * `ptsToArcs` "interior set once" invariant. This is a candidate explanation
 * for the case where the input topologies report no duplicated arc segments
 * (per `validateNoDuplicateArcSegments`) but the spliced output does — i.e.
 * the inputs share an interior point across arcs, so within ONE topology the
 * pointMap built by `ptsToArcs` silently loses the loser of the overwrite,
 * `newJunctions` then can't find every cut it needs, arcs aren't broken at
 * the right places, and `dedup` (which only catches full-arc matches) can't
 * fuse the resulting partial overlaps.
 *
 * Implementation mirrors `validateNoDuplicateArcSegments`: walk reachable
 * arcs only (matching `forAllArcPoints({onlyOnce: true})`), then for each
 * point of each reachable arc classify it as start, interior, or end and
 * accumulate the per-point arc sets.
 *
 * Exact float equality (no epsilon) — same coordinate semantics as
 * `splice.js`'s `equalArcs`/`pointEqual`.
 */
export function findCrossArcInteriorPointSharing(
  topology: PackedTopologyLike,
  options: ValidateArcSegmentsOptions = {},
): InteriorPointSharingResult {
  const arcs = topology.packed.arcs;
  const arcindices = topology.packed.arcindices;

  // -- Phase 1: walk objects → reachable arcs (identical to the segment validator).
  const seen = new Set<number>();

  function walkRing(z: number): number {
    const narc = arcindices[z++];
    for (let i = 0; i < narc; i++, z++)
    {
      let arc = arcindices[z];
      if (arc < 0) arc = ~arc;
      if (!seen.has(arc)) seen.add(arc);
    }
    return z;
  }
  function walkPolygon(z: number): number {
    const nring = arcindices[z++];
    for (let i = 0; i < nring; i++) z = walkRing(z);
    return z;
  }
  function walkMultiPolygon(z: number): number {
    const npoly = arcindices[z++];
    for (let i = 0; i < npoly; i++) z = walkPolygon(z);
    return z;
  }

  let objectIds: Iterable<string>;
  if (options.objects instanceof Set) objectIds = options.objects;
  else if (options.objects) objectIds = Object.keys(options.objects);
  else objectIds = Object.keys(topology.objects);

  const objectArcs2 = topology.packed.objectArcs;
  for (const id of objectIds)
  {
    const obj = topology.objects[id];
    if (!obj) continue;
    const z = objectArcs2 ? objectArcs2.get(obj) : undefined;
    if (z === undefined) continue;
    if (obj.type === "Polygon") walkPolygon(z);
    else if (obj.type === "MultiPolygon") walkMultiPolygon(z);
  }

  // -- Phase 2: classify each point of each reachable arc as endpoint or interior,
  //             accumulate per-point arc sets. Exact float equality via string key.
  function ptKey(x: number, y: number): string { return `${x},${y}`; }

  const interiorByKey = new Map<string, Set<number>>();
  const endpointByKey = new Map<string, Set<number>>();
  const pointByKey = new Map<string, Point>();

  seen.forEach((arc) => {
    const hdr = 1 + arc * 2;
    const npoints = arcs[hdr] | 0;
    let zp = arcs[hdr + 1] | 0;
    if (npoints < 1) return;
    const lastIdx = npoints - 1;
    for (let i = 0; i < npoints; i++)
    {
      const x = arcs[zp++];
      const y = arcs[zp++];
      const k = ptKey(x, y);
      if (!pointByKey.has(k)) pointByKey.set(k, [x, y]);
      const isEndpoint = (i === 0 || i === lastIdx);
      const bucket = isEndpoint ? endpointByKey : interiorByKey;
      let s = bucket.get(k);
      if (!s) { s = new Set<number>(); bucket.set(k, s); }
      s.add(arc);
    }
  });

  // -- Phase 3: flag any point that's interior in 2+ arcs, OR interior in one
  //             arc AND endpoint in another arc. Either case breaks the
  //             ptsToArcs "interior set once" invariant.
  const offenses: InteriorPointSharing[] = [];
  interiorByKey.forEach((interiorArcs, key) => {
    const endpointArcs = endpointByKey.get(key);
    const interiorCount = interiorArcs.size;
    const endpointCount = endpointArcs ? endpointArcs.size : 0;
    if (interiorCount >= 2 || (interiorCount >= 1 && endpointCount >= 1))
    {
      // For the endpoint set, exclude any arc that's *also* interior at this
      // point (would be a self-touching arc — same arc appearing in both
      // buckets is a degenerate within-arc issue, not the cross-arc problem
      // we're hunting).
      const endpointArcsOther: number[] = endpointArcs
        ? Array.from(endpointArcs).filter(a => !interiorArcs.has(a)).sort((a, b) => a - b)
        : [];
      // Re-check the condition after filtering — if interior is just 1 and
      // the only endpoint occurrences were the same arc self-touching, drop
      // this as a false positive.
      if (interiorCount >= 2 || (interiorCount >= 1 && endpointArcsOther.length >= 1))
      {
        offenses.push({
          point: pointByKey.get(key)!,
          interiorInArcs: Array.from(interiorArcs).sort((a, b) => a - b),
          endpointInArcs: endpointArcsOther,
        });
      }
    }
  });

  return {
    ok: offenses.length === 0,
    offenses,
    arcsInspected: seen.size,
  };
}
