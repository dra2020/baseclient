export type BlockMapping = { [blockid: string]: string };
export type ReverseBlockMapping = { [geoid: string]: string[] };

interface Entry
{
  tag: string,
  bm: BlockMapping,
  rbm?: ReverseBlockMapping,
}

export function reverseBlockMapping(bm: BlockMapping): ReverseBlockMapping
{
  let rev: ReverseBlockMapping = {};

  if (bm) Object.keys(bm).forEach(blockid => {
      let geoid = bm[blockid];
      if (! rev[geoid]) rev[geoid] = [];
      rev[geoid].push(blockid);
    });
  Object.values(rev).forEach((a: string[]) => a.sort());
  return rev;
}

// A set of block mappings consulted as one, without copying any of them.
//
// Entries are either independent (e.g. one per state of a multi-state map, whose block ids never
// overlap) or overlapping (a base mapping followed by overrides such as precinct updates). Overlapping
// entries must be added in priority order: map() and rev() walk from the last entry back, so a later
// entry wins.
//
// A full block mapping, and the reverse mapping computed from it, are large (TX has ~670K blocks), so
// combining mappings shares them rather than copying: add() takes an already-computed reverse mapping,
// and addFrom() takes both from another MultiBlockMapping.
export class MultiBlockMapping
{
  entries: Entry[];
  stamp: number;

  constructor(tag?: string, bm?: BlockMapping)
  {
    this.entries = [];
    this.stamp = Math.trunc(Math.random() * Number.MAX_SAFE_INTEGER / 2);
    if (tag && bm)
      this.entries.push({ tag, bm });
  }

  // Adds or replaces the entry for tag. Pass rbm when the reverse mapping of bm is already computed,
  // so it is shared rather than built again.
  add(tag: string, bm: BlockMapping, rbm?: ReverseBlockMapping): void
  {
    let e = this.entries.find(e => e.tag === tag);
    if (e)
    {
      e.bm = bm;
      if (rbm) e.rbm = rbm; else delete e.rbm;
    }
    else
      this.entries.push(rbm ? { tag, bm, rbm } : { tag, bm });
    this.stamp++;
  }

  // Adds the entry for tag from another mapping - or, with no tag, all of its entries in order - sharing
  // both the block mapping and its reverse mapping. The reverse mapping is computed on the source first
  // if need be, so that it is built once, there, and not separately in each mapping that shares it.
  addFrom(src: MultiBlockMapping, tag?: string): void
  {
    src.entries.forEach(e => {
        if (tag === undefined || e.tag === tag)
          this.add(e.tag, e.bm, src.rbmOf(e.tag));
      });
  }

  remove(tag: string): void
  {
    for (let i = this.entries.length-1; i >= 0; i--)
      if (this.entries[i].tag === tag)
      {
        this.stamp++;
        this.entries.splice(i, 1);
      }
  }

  has(tag: string): boolean
  {
    return this.entries.some(e => e.tag === tag);
  }

  map(blockid: string): string
  {
    // Walk backwards to pick up overrides first
    for (let i = this.entries.length-1; i >= 0; i--)
    {
      let e = this.entries[i];
      if (e.bm[blockid])
        return e.bm[blockid];
    }
    return undefined;
  }

  multimap(blockid: string): string[]
  {
    let a: string[] = [];
    this.entries.forEach(e => { if (e.bm[blockid]) a.push(e.bm[blockid]) });
    return a;
  }

  bmOf(tag: string): BlockMapping
  {
    let e = this.entries.find(e => e.tag === tag);
    return e ? e.bm : null;
  }

  // The reverse mapping of the entry for tag, computed on first use.
  rbmOf(tag: string): ReverseBlockMapping
  {
    let e = this.entries.find(e => e.tag === tag);
    if (! e) return null;
    if (! e.rbm) e.rbm = reverseBlockMapping(e.bm);
    return e.rbm;
  }

  // Maps through the first entry only. Meaningful only where that entry is the base mapping and the
  // rest are overrides; for independent entries (a multi-state mapping) use map().
  mapmain(blockid: string): string
  {
    return this.entries.length ? this.entries[0].bm[blockid] : undefined;
  }

  rev(geoid: string): string[]
  {
    for (let i = this.entries.length-1; i >= 0; i--)
    {
      let e = this.entries[i];
      if (! e.rbm)
        e.rbm = reverseBlockMapping(e.bm);
      if (e.rbm[geoid])
        return e.rbm[geoid];
    }
    return undefined;
  }

  // Walks the blocks of one entry: the one for tag, or with no tag the first. This is the right walk
  // over "all blocks" only when that entry is a base mapping covering them and the others are overrides
  // of it - it sees nothing of a multi-state mapping but its first state. See forEachBlock.
  forEachBase(cb: (blockid: string) => void, tag?: string): void
  {
    let e = tag === undefined ? this.entries[0] : this.entries.find(e => e.tag === tag);
    if (e)
      Object.keys(e.bm).forEach(blockid => cb(blockid));
  }

  // Walks the blocks of every entry. A block mapped by several entries (a base and its overrides) is
  // visited once for each of them; independent entries (a multi-state mapping) never repeat a block.
  forEachBlock(cb: (blockid: string) => void): void
  {
    this.entries.forEach(e => Object.keys(e.bm).forEach(blockid => cb(blockid)));
  }

  // Walk maps in reverse order, careful to not invoke on same geoid
  forEachRev(cb: (geoidid: string, blocks: string[]) => void): void
  {
    let seen = new Set<string>();
    for (let i = this.entries.length-1; i >= 0; i--)
    {
      let e = this.entries[i];
      if (! e.rbm) e.rbm = reverseBlockMapping(e.bm);
      Object.keys(e.rbm).forEach(geoid => {
          if (! seen.has(geoid))
          {
            seen.add(geoid);
            cb(geoid, e.rbm[geoid]);
          }
        });
    }
  }
}
