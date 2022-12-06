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

  add(tag: string, bm: BlockMapping): void
  {
    this.entries.forEach(e => { if (e.tag === tag) { e.bm = bm; delete e.rbm; bm = null } });
    if (bm)
      this.entries.push({ tag, bm });
    this.stamp++;
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

  mapmain(blockid: string): string
  {
    return this.entries.length ? this.entries[0].bm[blockid] : undefined;
  }

  rev(geoid: string): string[]
  {
    for (let i = 0; i < this.entries.length; i++)
    {
      let e = this.entries[i];
      if (! e.rbm)
        e.rbm = reverseBlockMapping(e.bm);
      if (e.rbm[geoid])
        return e.rbm[geoid];
    }
    return undefined;
  }

  // Just walks first map
  forEach(cb: (blockid: string) => void): void
  {
    if (this.entries.length)
      Object.keys(this.entries[0].bm).forEach(blockid => cb(blockid));
  }
}
