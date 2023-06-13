import * as geojson from 'geojson';
import * as Util from '../util/all'
import * as Poly from '../poly/all'

export type GeoProperties = geojson.GeoJsonProperties;
export type GeoFeature = geojson.Feature;
export type GeoFeatureArray = GeoFeature[];
export type GeoFeatureCollection = geojson.FeatureCollection;
export type GeoCentroidMap = { [geoid: string]: { x: number, y: number } };
export type HideMap = { [id: string]: boolean };

// Tracing/debugging aid
let metrics: { [action: string]: { count: number, total: number } } = {};

function record(action: string, total: number): void
{
  if (metrics[action] === undefined)
    metrics[action] = { count: 0, total: 0 };
  metrics[action].count++;
  metrics[action].total += total;
}

export function dumpMetrics(): void
{
  Object.keys(metrics).forEach(action => {
      console.log(`G.${action}: count: ${metrics[action].count}, total: ${metrics[action].total}`);
    });
}

export function hidemapConcat(...args: HideMap[]): HideMap
{
  let hm: HideMap = {};

  for (let i = 0; i < args.length; i++)
    if (args[i]) Object.keys(args[i]).forEach(id => hm[id] = true);
  return hm;
}

export interface NormalizeOptions
{
  joinPolygons?: boolean,
  checkRewind?: boolean,
  ensureID?: boolean,
}
const NormalizeAll: NormalizeOptions = { joinPolygons: true, checkRewind: true, ensureID: true };

// set the canonical 'id' property from the best property value.
// if joinPolygons is true, we do not enforce uniqueness.
//

export function geoEnsureID(col: GeoFeatureCollection, options?: NormalizeOptions): void
{
  options = Util.shallowAssignImmutable({}, options);

  let prop: string;
  const props = [ 'id', 'GEOID', 'GEOID10', 'GEOID20', 'GEOID30', 'DISTRICT', 'DISTRICTNO', 'DISTRICTNAME' ];

  if (col && col.features && col.features.length > 0)
  {
    let f = col.features[0];
    if (f.properties.id !== undefined) return;  // short-cut - assume if 'id' is set, we're all good.
    props.forEach(p => {
        if (prop === undefined)
          if (f.properties[p] !== undefined)
            prop = p;
          else
          {
            p = p.toLowerCase();
            if (f.properties[p] !== undefined)
              prop = p
          }
      });
    if (prop)
      col.features.forEach(f => { f.properties.id = f.properties[prop] });
    else
    {
      let n = 1;
      col.features.forEach(f => { f.properties.id = String(n++) });
    }
  }
}

export function geoNormalizeFeature(f: any, options?: NormalizeOptions): GeoFeature
{
  options = Util.shallowAssignImmutable({}, options);

  if (options.checkRewind)
    Poly.featureRewind(f);

  return f;
}

function onlyPolygons(col: GeoFeatureCollection): boolean
{
  if (col && Array.isArray(col.features))
    for (let i = 0; i < col.features.length; i++)
    {
      let f = col.features[i];
      if (f.geometry && f.geometry.type === 'MultiPolygon')
        return false;
    }

  return true;
}

function mergePolygon(f1: any, f2: any): any
{
  if (!f1) return f2;
  if (!f2) return f1;
  if (f1.geometry.type !== 'Polygon' && f1.geometry.type !== 'MultiPolygon')
    return f1;
  if (f2.geometry.type !== 'Polygon' && f2.geometry.type !== 'MultiPolygon')
    return f2;
  if (f1.geometry.type === 'Polygon')
  {
    f1.geometry.type = 'MultiPolygon';
    if (f2.geometry.type === 'Polygon')
      f1.geometry.coordinates = [ f1.geometry.coordinates, f2.geometry.coordinates ];
    else
      f1.geometry.coordinates = [ f1.geometry.coordinates, ...f2.geometry.coordinates ];
  }
  else
  {
    if (f2.geometry.type === 'Polygon')
      f1.geometry.coordinates.push(f2.geometry.coordinates);
    else
      f1.geometry.coordinates = [...f1.geometry.coordinates, ...f2.geometry.coordinates];
  }
  return f1;
}

export function geoNormalizeCollection(col: GeoFeatureCollection, options?: NormalizeOptions): GeoFeatureCollection
{
  options = Util.shallowAssignImmutable(NormalizeAll, options);

  // Normalize individual features
  if (col && Array.isArray(col.features))
    col.features = col.features.filter((f: any) => f.properties && f.geometry && f.geometry.coordinates);
  if (col && Array.isArray(col.features))
    col.features.forEach((f: GeoFeature) => geoNormalizeFeature(f, options));

  // Ensure ID
  if (options.ensureID)
    geoEnsureID(col, options);

  // Merge polygons into multi-polygons based on id?
  if (options.ensureID && options.joinPolygons && onlyPolygons(col))
  {
    let map: GeoFeatureMap = {};
    col.features.forEach(f => { let id = f.properties.id; map[id] = mergePolygon(map[id], f) });
    col.features = Object.values(map);
  }
  return col;
}

export function geoCollectionToMap(col: GeoFeatureCollection): GeoFeatureMap
{
  if (col == null) return null;
  let map: GeoFeatureMap = {};
  col.features.forEach((f: GeoFeature) => { map[String(f.properties.id)] = f; });
  return map;
}

export function geoMapToCollection(map: GeoFeatureMap): GeoFeatureCollection
{
  if (Util.countKeys(map) == 0) return null;
  return geoMapToCollectionNonNull(map);
}

export function geoMapToCollectionNonNull(map: GeoFeatureMap): GeoFeatureCollection
{
  if (map == null) return null;
  let col: GeoFeatureCollection = { type: 'FeatureCollection', features: [] };
  Object.keys(map).forEach((geoid: string) => { col.features.push(map[geoid]) });
  return col;
}

export function geoCollectionToTopo(col: GeoFeatureCollection): Poly.Topo
{
  let topo = Poly.topoFromCollection(col);
  Poly.topoPack(topo);
  record('coltotopo', col.features.length);
  if ((col as any).datasets) (topo as any).datasets = (col as any).datasets;
  return topo;
}

export function geoCollectionToTopoNonNull(col: GeoFeatureCollection): Poly.Topo
{
  return geoCollectionToTopo(col);
}

export function geoTopoToCollection(topo: Poly.Topo): GeoFeatureCollection
{
  let col = Poly.topoToCollection(topo);
  Poly.featurePack(col);
  record('topotocol', col.features.length);
  if ((topo as any).datasets) (col as any).datasets = (topo as any).datasets;
  return col;
}

export function geoTopoToCollectionNonNull(topo: Poly.Topo): GeoFeatureCollection
{
  return geoTopoToCollection(topo);
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
  hidden: HideMap;
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
    this.all = { tag: 'all' };
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

  // Add the "all" collection from the passed in multi, but do not force compute of any things not computed yet.
  addAll(tag: string, multi: GeoMultiCollection): void
  {
    if (multi == null || Util.isEmpty(multi.entries))
      this.remove(tag);
    else
    {
      let nEntries = Util.countKeys(multi.entries);
      if (nEntries)
      {
        // Make sure all collection is created
        if (!multi.all.topo && !multi.all.col && !multi.all.map)
        {
          // Create cheapest one (collection if I need to create, otherwise copy from single entry)
          if (nEntries > 1)
            multi.allCol();
          else
          {
            let e = multi.nthEntry(0);
            multi.all.topo = e.topo;
            multi.all.col = e.col;
            multi.all.map = e.map;
          }
        }
        this.add(tag, multi.all.topo, multi.all.col, multi.all.map);
      }
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
    if (this.all.topo || this.all.col || this.all.map)
      this.all = { tag: 'all' };
    this.stamp++;
  }

  _col(e: GeoEntry): GeoFeatureCollection
  {
    if (e == null) return null;
    if (! e.col)
    {
      if (e.map)
        e.col = geoMapToCollectionNonNull(e.map);
      else if (e.topo)
        e.col = geoTopoToCollectionNonNull(e.topo);
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
        e.col = geoTopoToCollectionNonNull(e.topo);
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
        e.topo = geoCollectionToTopoNonNull(e.col);
      else if (e.map)
      {
        e.col = geoMapToCollectionNonNull(e.map);
        e.topo = geoCollectionToTopoNonNull(e.col);
      }
    }
    return e.topo;
  }

  _length(e: GeoEntry): number
  {
    if (e == null) return 0;
    return  e.col ? e.col.features.length
          : e.map ? Util.countKeys(e.map)
          : e.topo ? Util.countKeys(e.topo.objects)
          : 0;
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
      {
        let e = this.nthEntry(0);
        this.all.col = this._col(e);
        this.all.topo = this.all.topo || e.topo;
        this.all.map = this.all.map || e.map;
      }
      else
      {
        // Going from map to collection guarantees that any duplicates are removed
        this.all.col = geoMapToCollectionNonNull(this.allMap());
        this.forEachEntry(e => {
            if (e.col && (e.col as any).datasets)
              (this.all.col as any).datasets = (e.col as any).datasets;
            if (e.topo && (e.topo as any).datasets)
              (this.all.col as any).datasets = (e.topo as any).datasets;
          });
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
      {
        let e = this.nthEntry(0);
        this.all.map = this._map(e);
        this.all.topo = this.all.topo || e.topo;
        this.all.col = this.all.col || e.col;
      }
      else
      {
        let map: GeoFeatureMap = {};
        this.all.map = map;
        this.forEachEntry(e => {
            let col = this._col(e); // convert feature geometry from topo to polygon
            col.features.forEach(f => {
                let id = f.properties.id;
                if (! this.hidden[id])
                  map[id] = f;
              });
          });
      }
    }
    return this.all.map;
  }

  allTopo(): Poly.Topo
  {
    // Note that you can't actually switch between allNewTopo and allOldTopo
    // without calling _onChange between the calls to reset the 'all' tag.
    return this.allNewTopo();
  }

  allOldTopo(): Poly.Topo
  {
    if (this.nEntries == 0) return null;
    if (! this.all.topo)
    {
      // optimise case where one entry
      let n = this.nEntries;
      if (n == 1)
      {
        let e = this.nthEntry(0);
        this.all.topo = this._topo(e);
        this.all.col = this.all.col || e.col;
        this.all.map = this.all.map || e.map;
      }
      else
      {
        // Old-style, goes through map (to filter hidden) and then collection
        this.all.topo = geoCollectionToTopoNonNull(this.allCol());
      }
    }
    return this.all.topo;
  }

  allNewTopo(): Poly.Topo
  {
    if (this.nEntries == 0) return null;
    if (! this.all.topo)
    {
      // optimise case where one entry
      let n = this.nEntries;
      if (n == 1)
      {
        let e = this.nthEntry(0);
        this.all.topo = this._topo(e);
        this.all.col = this.all.col || e.col;
        this.all.map = this.all.map || e.map;
      }
      else
      {
        // Old-style, goes through map (to filter hidden) and then collection
        // this.all.topo = geoCollectionToTopoNonNull(this.allCol());
        // New style, use splice on packed topologies
        let topoarray = Object.values(this.entries).filter((e: GeoEntry) => this._length(e) > 0)
          .map((e: GeoEntry) => { return { topology: this._topo(e), filterout: this.hidden } });
        this.all.topo = topoarray.length == 0 ? null : topoarray.length == 1 ? topoarray[0].topology : Poly.topoSplice(topoarray);
      }
    }
    return this.all.topo;
  }

  hideSetAll(hm: HideMap): void
  {
    // Prevents onChange when resetting to same value
    if (! Util.shallowEqual(this.hidden, hm))
    {
      this.showAll();
      this.hide(hm);
    }
  }

  hide(id: any): void
  {
    if (id)
    {
      if (typeof id === 'string')
      {
        if (! this.hidden[id])
        {
          this.hidden[id] = true;
          this._onChange();
        }
      }
      else if (Array.isArray(id))
        id.forEach((i: any) => this.hide(i));
      else if (typeof id === 'object')
        for (let p in id) if (id.hasOwnProperty(p)) this.hide(p);
    }
  }

  show(id: any): void
  {
    if (id)
    {
      if (typeof id === 'string')
      {
        if (this.hidden[id])
        {
          delete this.hidden[id];
          this._onChange();
        }
      }
      else if (Array.isArray(id))
        id.forEach((i: any) => this.show(i))
      else if (typeof id === 'object')
        for (let p in id) if (id.hasOwnProperty(p)) this.show(p);
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
    this.forEachEntry(e => n += this._length(e));
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
        if (e.col)
          e.col.features.forEach(f => { if (! this.hidden[f.properties.id]) cb(f) })
        else if (e.topo)
          Object.values(e.topo.objects).forEach((f: GeoFeature) => { if (! this.hidden[f.properties.id]) cb(f) });
        else if (e.map)
          Object.values(e.map).forEach(f => { if (! this.hidden[f.properties.id]) cb(f) });
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

  findNoHide(id: string): GeoFeature
  {
    let entries = Object.values(this.entries);
    for (let i = 0; i < entries.length; i++)
    {
      let map = this._map(entries[i]);
      if (map[id])
        return map[id];
    }
    return undefined;
  }

  find(id: string): GeoFeature
  {
    if (this.hidden[id] !== undefined)
      return undefined;

    return this.findNoHide(id);
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
