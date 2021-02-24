import * as geojson from 'geojson';
import * as Util from '../util/all'
import * as Poly from '../poly/all'

export type GeoProperties = geojson.GeoJsonProperties;
export type GeoFeature = geojson.Feature;
export type GeoFeatureArray = GeoFeature[];
export type GeoFeatureCollection = geojson.FeatureCollection;

export function geoCollectionToMap(col: GeoFeatureCollection): GeoFeatureMap
{
  if (col == null) return null;
  let map: GeoFeatureMap = {};
  col.features.forEach((f: GeoFeature) => { map[String(f.properties.id)] = f; });
  return map;
}

export function geoMapToCollection(map: GeoFeatureMap): GeoFeatureCollection
{
  if (map == null || Util.countKeys(map) == 0) return null;
  let col: GeoFeatureCollection = { type: 'FeatureCollection', features: [] };
  Object.keys(map).forEach((geoid: string) => { col.features.push(map[geoid]) });
  return col;
}

export function geoCollectionToTopo(col: GeoFeatureCollection): Poly.Topo
{
  let topo = Poly.topoFromCollection(col);
  Poly.topoPack(topo);
  return topo;
}

export function geoTopoToCollection(topo: Poly.Topo): GeoFeatureCollection
{
  let col = Poly.topoToCollection(topo);
  Poly.featurePack(col);
  return col;
}

export interface GeoFeatureMap
{
  [id: string]: GeoFeature;  // Maps id to GeoFeature
}

export type FeatureFunc = (f: GeoFeature) => void;

interface GeoEntry
{
  tag: string;
  col?: GeoFeatureCollection;
  map?: GeoFeatureMap;
  topo?: Poly.Topo;
}
type GeoEntryMap = { [tag: string]: GeoEntry };

export function geoEqual(m1: GeoMultiCollection, m2: GeoMultiCollection): boolean
{
  let n1 = m1 ? m1.length : 0;
  let n2 = m2 ? m2.length : 0;
  
  if (n1 != n2) return false;
  if (n1 == 0) return true;

  let n = 0;
  let eq = true;
  m1.forEach(f => { if (eq && !m2.find(f.properties.id)) eq = false });
  return eq;
}

export function geoMapEqual(m1: GeoFeatureMap, m2: GeoFeatureMap): boolean
{
  if (m1 == null) return Util.isEmpty(m2);
  if (m2 == null) return Util.isEmpty(m1);
  let p: string;
  for (p in m1) if (m1.hasOwnProperty(p))
    if (m1[p] !== m2[p])
      return false;
  for (p in m2) if (m2.hasOwnProperty(p))
    if (m1[p] === undefined)
      return false;
  return true;
}

export class GeoMultiCollection
{
  entries: GeoEntryMap;
  all: GeoEntry;
  hidden: any;
  stamp: number;

  constructor(tag?: string, topo?: Poly.Topo, col?: GeoFeatureCollection, map?: GeoFeatureMap)
  {
    this.stamp = Math.trunc(Math.random() * Number.MAX_SAFE_INTEGER / 2);
    this.empty();
    if (tag)
      this.add(tag, topo, col, map);
  }

  empty()
  {
    this.entries = {};
    this.hidden = {};
    this._onChange();
  }

  get nEntries(): number { return Util.countKeys(this.entries) }

  nthEntry(n: number): GeoEntry
  {
    return Util.nthProperty(this.entries, n) as GeoEntry;
  }

  add(tag: string, topo: Poly.Topo, col: GeoFeatureCollection, map: GeoFeatureMap): void
  {
    let entry = this.entries[tag];
    if (entry === undefined) entry = { tag: tag }, this.entries[tag] = entry;
    if ((topo && entry.topo !== topo) || (col && entry.col !== col) || (map && entry.map !== map))
    {
      entry.topo = topo;
      entry.col = col;
      entry.map = map;
      this._onChange();
    }
    else if (topo == null && col == null && map == null)
      this.remove(tag);
  }

  addMulti(multi: GeoMultiCollection): void
  {
    multi.forEachEntry(e => {
        this.add(e.tag, e.topo, e.col, e.map);
      });
    for (let p in multi.hidden) if (multi.hidden.hasOwnProperty(p))
    {
      this.hidden[p] = true;
      this._onChange();
    }
  }

  remove(tag: string): void
  {
    let entry = this.entries[tag];
    if (entry)
    {
      if (entry.topo || entry.col || entry.map)
        this._onChange();
      delete this.entries[tag];
    }
  }

  _onChange(): void
  {
    this.all = { tag: 'all' };
    this.stamp++;
  }

  _col(e: GeoEntry): GeoFeatureCollection
  {
    if (e == null) return null;
    if (! e.col)
    {
      if (e.map)
        e.col = geoMapToCollection(e.map);
      else if (e.topo)
        e.col = geoTopoToCollection(e.topo);
    }
    return e.col;
  }

  _map(e: GeoEntry): GeoFeatureMap
  {
    if (e == null) return null;
    if (! e.map)
    {
      if (e.col)
        e.map = geoCollectionToMap(e.col);
      else if (e.topo)
      {
        e.col = geoTopoToCollection(e.topo);
        e.map = geoCollectionToMap(e.col);
      }
    }
    return e.map;
  }

  _topo(e: GeoEntry): Poly.Topo
  {
    if (e == null) return null;
    if (! e.topo)
    {
      if (e.col)
        e.topo = geoCollectionToTopo(e.col);
      else if (e.map)
      {
        e.col = geoMapToCollection(e.map);
        e.topo = geoCollectionToTopo(e.col);
      }
    }
    return e.topo;
  }

  colOf(tag: string): GeoFeatureCollection { return this._col(this.entries[tag]); }
  mapOf(tag: string): GeoFeatureMap { return this._map(this.entries[tag]); }
  topoOf(tag: string): Poly.Topo { return this._topo(this.entries[tag]); }

  forEachEntry(cb: (e: GeoEntry) => void): void
  {
    Object.values(this.entries).forEach(cb);
  }

  allCol(): GeoFeatureCollection
  {
    if (this.nEntries == 0) return null;
    if (! this.all.col)
    {
      // optimise case where one entry
      let n = this.nEntries;
      if (n == 1)
        this.all.col = this._col(this.nthEntry(0));
      else
      {
        this.all.col = { type: 'FeatureCollection', features: [] };
        this.forEach(f => { this.all.col.features.push(f) });
      }
    }
    return this.all.col;
  }

  allMap(): GeoFeatureMap
  {
    if (this.nEntries == 0) return null;
    if (! this.all.map)
    {
      // optimise case where one entry
      let n = this.nEntries;
      if (n == 1)
        this.all.map = this._map(this.nthEntry(0));
      else
        this.all.map = geoCollectionToMap(this.allCol());
    }
    return this.all.map;
  }

  allTopo(): Poly.Topo
  {
    if (this.nEntries == 0) return null;
    if (! this.all.topo)
    {
      // optimise case where one entry
      let n = this.nEntries;
      if (n == 1)
        this.all.topo = this._topo(this.nthEntry(0));
      else
        this.all.topo = geoCollectionToTopo(this.allCol());
    }
    return this.all.topo;
  }

  hide(id: any): void
  {
    if (id)
    {
      if (typeof id === 'string')
        this.hidden[id] = true;
      else if (Array.isArray(id))
        id.forEach((i: string) => { this.hidden[i] = true })
      else if (typeof id === 'object')
        for (let p in id) if (id.hasOwnProperty(p)) this.hidden[p] = true;
      this._onChange();
    }
  }

  show(id: any): void
  {
    if (id)
    {
      if (typeof id === 'string')
        delete this.hidden[id];
      else if (Array.isArray(id))
        id.forEach((i: string) => { delete this.hidden[i] })
      else if (typeof id === 'object')
        for (let p in id) if (id.hasOwnProperty(p)) delete this.hidden[p];
      this._onChange();
    }
  }

  showAll(): void
  {
    if (! Util.isEmpty(this.hidden))
    {
      this.hidden = {};
      this._onChange();
    }
  }

  get length(): number
  {
    let n = 0;
    this.forEachEntry(e => {
        if (e.col)
          n += e.col.features.length;
        else if (e.map)
          n += Util.countKeys(e.map);
        else if (e.topo)
          n += Util.countKeys(e.topo.objects);
      });
    return n;
  }

  // Use forEach in preference to iteration using this function
  nthFeature(n: number): GeoFeature
  {
    let found: GeoFeature;

    if (n >= 0)
      this.forEachEntry(e => {
          if (found) return;
          let col = this._col(e);
          if (col)
            if (n > col.features.length)
              n -= col.features.length;
            else
              found = col.features[n];
        });
    return found;
  }

  nthFilteredFeature(n: number, cb: (f: GeoFeature) => boolean)
  {
    let found: GeoFeature;

    this.forEachEntry(e => {
        if (found) return;
        let col = this._col(e);
        if (col)
          for (let i = 0; !found && i < col.features.length; i++)
          {
            let f = col.features[i];
            if (this.hidden[f.properties.id] === undefined && cb(f))
            {
              if (n === 0)
              {
                found = f;
                break;
              }
              n--;
            }
          }
      });
    return found;
  }

  forEach(cb: FeatureFunc): void
  {
    this.forEachEntry(e => {
        let col = this._col(e);
        if (e.col)
          e.col.features.forEach(f => { if (this.hidden[f.properties.id] === undefined) cb(f) })
      });
  }

  map(cb: (f: GeoFeature) => GeoFeature): GeoFeature[]
  {
    let features: GeoFeature[] = [];
    this.forEach((f: GeoFeature) => { features.push(cb(f)) });
    return features;
  }

  isHidden(id: string): boolean
  {
    return this.hidden[id] !== undefined;
  }

  find(id: string): GeoFeature
  {
    if (this.hidden[id] !== undefined)
      return undefined;

    let entries = Object.values(this.entries);
    for (let i = 0; i < entries.length; i++)
    {
      let map = this._map(entries[i]);
      if (map[id])
        return map[id];
    }

    return undefined;
  }

  filter(test: (f: GeoFeature) => boolean): GeoMultiCollection
  {
    let m = new GeoMultiCollection();
    this.forEachEntry(e => {
        let col = this._col(e);
        let features = col ? col.features.filter(test) : null;
        if (features && features.length)
          m.add(e.tag, null, { type: 'FeatureCollection', features: features }, null);
      });
    return m;
  }
}

export enum geoIntersectOptions { Intersects, Bounds, BoundsCenter };

function geoBoxIntersect(x1: Poly.BoundBox, x2: Poly.BoundBox, opt: geoIntersectOptions): boolean
{
  if (x1.left === undefined || x2.left === undefined) return false;

  let l1 = x1.left;
  let l2 = x2.left;
  let r1 = x1.right;
  let r2 = x2.right;
  let b1 = x1.top;  // flip
  let b2 = x2.top;  // flip
  let t1 = x1.bottom;  // flip
  let t2 = x2.bottom;  // flip
  let cx2 = l2 + (r2 - l2) / 2;
  let cy2 = t2 + (b2 - t2) / 2;

  // Note I flipped top and bottom above when extracting,
  // in order to make below logic work for normal y axis alignment (0 at top).
  switch (opt)
  {
    case geoIntersectOptions.Intersects:
      return !(l2 > r1 || r2 < l1 || t2 > b1 || b2 < t1);
    case geoIntersectOptions.Bounds:
      return l1 <= l2 && t1 <= t2 && r1 >= r2 && b1 >= b2;
    case geoIntersectOptions.BoundsCenter:
      return l1 <= cx2 && t1 <= cy2 && r1 >= cx2 && b1 >= cy2;
  }
}

export function geoIntersect(multi: GeoMultiCollection, bbox: Poly.BoundBox, opt: geoIntersectOptions): GeoMultiCollection
{
  let m: GeoFeatureMap = {};
  let bboxPoly = Poly.boundboxPoly(bbox);

  multi.forEach((f: GeoFeature) => {
      let box = Poly.boundbox(f);
      if (geoBoxIntersect(bbox, box, opt))
      {
        if (opt !== geoIntersectOptions.Intersects || Poly.polyIntersects(bboxPoly, f))
          m[f.properties.id] = f;
      }
    });

  let result = new GeoMultiCollection();
  result.add('result', null, null, m);
  return result;
}
