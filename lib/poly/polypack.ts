// Shared libraries
import * as Util from '../util/all';

// Format for efficient packing of multipolygon coordinates
//
// [n] number of polygons
// [n polygon headers]...
//  [n] number of rings
//    [n]... number of coordinates in ring
//  followed by [x,y]... for all the coordinates

export interface PolyPack
{
  offset: number;
  length: number;
  buffer: any;
}

export function polyPackSize(coords: any): number
{
  // Null feature?
  if (coords == null || (coords.length !== undefined && coords.length == 0)) return 0;

  if (! Array.isArray(coords)) return 0;
  let depth = Util.depthof(coords);
  if (depth == 3) coords = [[ coords ]];
  else if (depth == 4) coords = [ coords ]; // normalize to multipolygon
  let nFloats: number = 2;  // for number of polygons and size of header block
  let i: number, j: number;
  let p: any, r: any;
  for (i = 0; i < coords.length; i++)
  {
    p = coords[i];
    nFloats++;  // For number of rings in this polygon
    for (j = 0; j < p.length; j++)
    {
      nFloats++;  // For number of coordinates in this ring
      r = p[j];
      nFloats += r.length * 2;  // for each x, y pair
    }
  }
  return nFloats;
}

type EachRingCB = (buffer: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => void;
type EachPointCB = (buffer: Float64Array, iPoly: number, iRing: number, iOffset: number) => void;

export function polyPackEachRing(pack: PolyPack, cb: EachRingCB): void
{
  if (pack == null || pack.buffer == null) return;

  if (pack.offset === undefined) throw 'oops: not a PolyPack';

  let b = pack.buffer;
  let iRing: number;
  let iOffset: number = pack.offset;
  let cOffset: number = b[iOffset+1] + pack.offset;

  // Grab number of polygons
  let nPoly: number = b[iOffset++];
  // Move past header length
  iOffset++;
  for (let iPoly: number = 0; iPoly < nPoly; iPoly++)
  {
    // Grab number of rings in this polygon
    let nRing: number = b[iOffset++];
    for (let iRing: number = 0; iRing < nRing; iRing++)
    {
      // Grab number of points in this ring
      let nPoints: number = b[iOffset++];
      cb(b, iPoly, iRing, cOffset, nPoints);
      cOffset += nPoints * 2;
    }
  }
}

export function polyPackEachPoint(pack: PolyPack, cb: EachPointCB): void
{
  polyPackEachRing(pack, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      let iEnd: number = iOffset + (nPoints * 2);
      for (; iOffset < iEnd; iOffset += 2)
        cb(b, iPoly, iRing, iOffset);
    });
}

export function polyPackCountPoints(pack: PolyPack): number
{
  let n = 0;
  polyPackEachRing(pack, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => { n += nPoints });
  return n;
}

export function polyPacked(f: any): boolean
{
  if (f == null) return false;
  if (f.offset !== undefined) return true;
  if (f.geometry !== undefined) return f.geometry.packed !== undefined;
  if (f.type === 'FeatureCollection' && f.features !== undefined && f.features.length > 0)
    return polyPacked(f.features[0]);
  return false;
}

// Convert to multi-polygon format if necessary
export function normalizeArcs(arcs: any): any
{
  let d = Util.depthof(arcs);
  while (d < 4) { arcs = [arcs], d++ }  // note that depth is n-1 compared to coords because leaf is just number, not [x,y]
  return arcs;
}

export function countArcPolygons(arcs: any): number
{
  arcs = normalizeArcs(arcs);
  return arcs.length;
}

export function countArcRings(arcs: any, iPoly?: number): number
{
  arcs = normalizeArcs(arcs);
  let r = 0;
  arcs.forEach((a: any, ip: number) => { if (iPoly === undefined || iPoly === ip) r += a.length })
  return r;
}

export function countOneArcPoints(topo: any, ring: any): number
{
  // for each ring
  let n = 0;
  ring.forEach((i: number, index: number) => {
      // for each arc
      let a = topo.arcs[i < 0 ? ~i : i];
      if (index > 0) n--;
      n += a.length;
    });
  if (n < 4) n = 4;
  return n;
}

export function countArcPoints(topo: any, arcs: any, iPoly?: number): number
{
  arcs = normalizeArcs(arcs);
  let npoints = 0;
  arcs.forEach((polygon: any, ip: number) => {
      if (iPoly === undefined || iPoly === ip)
        polygon.forEach((ring: any) => { npoints += countOneArcPoints(topo, ring) })
    });
  return npoints;
}

// This packs the TopoJSON arc format into a PolyPack. Basics:
//  1) Negative indices indicate arc should be traversed backward.
//  2) First and last point of sequential arcs are duplicated, so only include one instance. Easiest way
//     of implementing this (to match topojson implementation) is first delete last point.
//  3) If total number of points < 4, duplicate the first point until you get 4 to meet GeoJSON standard.
//  4) Can also request to pack just a single polygon of a multi-polygon
//
export function polyPackTopoArcs(topo: any, arcs: any, iPoly?: number): PolyPack
{
  if (topo == null || arcs == null || arcs.length == 0) return null;
  arcs = normalizeArcs(arcs);
  let nPoints = countArcPoints(topo, arcs, iPoly);
  if (nPoints == 0) return null;
  let nFloats = 2 + (2 * countArcRings(arcs, iPoly)) + (2 * nPoints);
  let ab = new ArrayBuffer(nFloats * 8);
  let prepack: PolyPack = { offset: 0, length: nFloats, buffer: new Float64Array(ab) };
  let af = prepack.buffer as Float64Array;
  let z = 0;
  af[z++] = iPoly === undefined ? countArcPolygons(arcs) : 1;
  z++;  // spot for header size

  // Fill in header - number of rings in each polygon and number of points in each ring
  arcs.forEach((polygon: any, ip: number) => {
      if (iPoly === undefined || iPoly === ip)
      {
        af[z++] = polygon.length;
        polygon.forEach((ring: any) => af[z++] = countOneArcPoints(topo, ring));
      }
    });

  // go back and fill in header size
  af[1] = z;

  // now copy in the points
  arcs.forEach((polygon: any, ip: number) => {
      if (iPoly === undefined || iPoly === ip)
        polygon.forEach((ring: any) => {
            let b = z;
            ring.forEach((i: number, index: number) => {
                let a = topo.arcs[i < 0 ? ~i : i];
                if (index > 0) z -= 2;
                let n = a.length;
                let j;
                if (i < 0)
                  for (j = n-1; j >= 0; j--) { let pt: any = a[j]; af[z++] = pt[0], af[z++] = pt[1] }
                else
                  for (j = 0; j < n; j++) { let pt: any = a[j]; af[z++] = pt[0], af[z++] = pt[1] }
              });
            // need at least 4 points in each ring
            if (z != b)
              while (z < b+8) { af[z++] = af[b], af[z++] = af[b+1] }
          });
    });

  return prepack;
}

export function polyPack(coords: any, prepack?: PolyPack): PolyPack
{
  // Null feature?
  if (coords == null || (coords.length !== undefined && coords.length == 0)) return null;

  // Null geometry?
  if (coords && coords.type === 'Feature' && coords.geometry == null) return null;

  // Actually already a PolyPack?
  if (coords.offset !== undefined) return coords as PolyPack;

  // Packed feature?
  if (coords && coords.geometry && coords.geometry.packed !== undefined)
    return coords.geometry.packed as PolyPack;

  // Unpacked feature, grab the coordinates array
  if (coords && coords.geometry)
    coords = coords.geometry.coordinates;

  // Transparently handle polygon or multi-polygon
  if (! Array.isArray(coords)) return null;

  let depth = Util.depthof(coords);
  if (depth == 2) coords = [ [ [ coords ] ] ];
  else if (depth == 3) coords = [ [ coords ] ];
  else if (depth == 4) coords = [ coords ];

  let nFloats = polyPackSize(coords);
  let i: number, j: number, k: number;
  let p: any, r: any;

  // Allocate typed buffer if not passed in
  if (prepack === undefined)
  {
    let ab = new ArrayBuffer(nFloats * 8);
    prepack = { offset: 0, length: nFloats, buffer: new Float64Array(ab) };
  }
  else
  {
    prepack = Util.shallowCopy(prepack);
    prepack.length = nFloats;
  }

  let af: Float64Array = prepack.buffer as Float64Array;

  // Fill in header
  let z: number = prepack.offset;
  af[z++] = coords.length;
  z++;  // spot for header size
  for (i = 0; i < coords.length; i++)
  {
    p = coords[i];
    af[z++] = p.length;
    for (j = 0; j < p.length; j++)
      af[z++] = p[j].length;
  }

  // set header size back in header
  af[prepack.offset+1] = z - prepack.offset;

  // Fill in coords
  for (i = 0; i < coords.length; i++)
  {
    p = coords[i];
    for (j = 0; j < p.length; j++)
    {
      r = p[j];
      for (k = 0; k < r.length; k++)
      {
        af[z++] = r[k][0];
        af[z++] = r[k][1];
      }
    }
  }

  return prepack;
}

export function polyPackCopy(coords: any): PolyPack
{
  let pp = polyPack(coords);

  if (pp == null) return null;

  let copy: PolyPack = { offset: 0, length: pp.length, buffer: null };
  let ab = new ArrayBuffer(pp.length * 8);
  let afDst = new Float64Array(ab);
  copy.buffer = afDst;
  let afSrc = pp.buffer as Float64Array;
  for (let i = 0; i < pp.length; i++)
    afDst[i] = afSrc[i+pp.offset];
  return copy;
}

export function polyUnpack(prepack: any): any
{
  // Check if not packed
  if (prepack == null) return [];
  if (prepack.offset === undefined) return prepack;

  let i: number, j: number, k: number;
  let nPolys: number, nRings: number, nCoords: number;
  let p: any, r: any;
  let af: Float64Array = prepack.buffer as Float64Array;
  let coords: any = [];
  let h: number = prepack.offset as number;
  nPolys = af[h++];
  let z = af[h++] + prepack.offset;  // start of coordinates
  for (i = 0; i < nPolys; i++)
  {
    p = [];
    coords[i] = p;
    nRings = af[h++];
    for (j = 0; j < nRings; j++)
    {
      r = [];
      p[j] = r;
      nCoords = af[h++];
      for (k = 0; k < nCoords; k++)
        r[k] = [ af[z++], af[z++] ];
    }
  }

  return coords.length > 1 ? coords : coords[0];
}

export function featurePackSize(f: any): number
{
  if (f && f.geometry && f.geometry.coordinates && f.geometry.type !== 'Point')
    return polyPackSize(f.geometry.coordinates);
  return 0;
}

export function featurePack(f: any, prepack?: PolyPack): any
{
  if (f && f.type === 'Feature')
  {
    if (f.geometry && f.geometry.type === 'Point')
      return prepack ? { offset: prepack.offset, length: 0, buffer: prepack.buffer } : { offset: 0, length: 0, buffer: null };
    else if (f.geometry && f.geometry.coordinates)
    {
      f.geometry.packed = polyPack(f.geometry.coordinates, prepack);
      delete f.geometry.coordinates;
    }
    else if (f.geometry === undefined)
    {
      f.geometry = {}
      f.geometry.packed = prepack ? { offset: prepack.offset, length: 0, buffer: prepack.buffer } : { offset: 0, length: 0, buffer: null };
    }
    return f.geometry.packed;
  }
  else if (f && f.type === 'FeatureCollection' && f.features)
  {
    // Empty?
    if (f.features.length == 0) return f;

    // Already packed or packed incorrectly?
    let ff: any = f.features[0];
    if (ff && ff.geometry && ff.geometry.packed)
    {
      // Already packed
      if (ArrayBuffer.isView(ff.geometry.packed.buffer))
        return f;
      // Improperly packed (buffer converted to object - convert back to buffer
      let o: any = ff.geometry.packed.buffer;
      let b = new Float64Array(Util.countKeys(o));
      for (const i in o) b[Number(i)] = o[i];
      f.features.forEach((ff: any) => ff.geometry.packed.buffer = b);
      return f;
    }

    // Allocate one large buffer
    let nFloats: number = 0;
    let i: number;
    for (i = 0; i < f.features.length; i++)
      nFloats += featurePackSize(f.features[i]);
    let ab = new ArrayBuffer(nFloats * 8);
    prepack = { offset: 0, length: nFloats, buffer: new Float64Array(ab) };

    // Now pack
    for (i = 0; i < f.features.length; i++)
    {
      let postpack = featurePack(f.features[i], prepack);
      prepack.offset += postpack ? postpack.length : 0;
    }
    if (prepack.offset != nFloats)
      throw 'oops, packing bug';
    return prepack;
  }
  return null;
}

export function featureUnpack(f: any): any
{
  if (f && f.geometry && f.geometry.packed !== undefined)
  {
    f.geometry.coordinates = polyUnpack(f.geometry.packed);
    let depth = Util.depthof(f.geometry.coordinates);
    // Check for oops, optimized away the multipolygon in polyUnpack
    if (f.geometry.type === 'MultiPolygon' && depth === 4)
      f.geometry.coordinates = [ f.geometry.coordinates ];
    else if (f.geometry.type === 'Point' && depth != 2)
    {
      while (depth > 2)
      {
        f.geometry.coordinates = f.geometry.coordinates[0];
        depth = Util.depthof(f.geometry.coordinates);
      }
    }
    delete f.geometry.packed;
  }
  else if (f.type && f.type === 'FeatureCollection' && f.features)
  {
    for (let i: number = 0; i < f.features.length; i++)
      featureUnpack(f.features[i]);
  }
  return f;
}

export type SavePack = WeakMap<any,any>;

export function featureUnpackTemporarily(f: any, save?: SavePack): SavePack
{
  if (save === undefined) save = new WeakMap<any,any>();

  if (f && f.type === 'Feature')
  {
    if (f.geometry && f.geometry.packed)
    {
      save.set(f, f.geometry.packed);
      featureUnpack(f);
    }
  }
  else if (f.type && f.type === 'FeatureCollection' && f.features)
  {
    f.features.forEach((ff: any) => {
        if (ff.geometry && ff.geometry.packed)
          save.set(ff, ff.geometry.packed);
      });
    featureUnpack(f);
  }
  return save;
}

export function featureRepack(f: any, save: SavePack): any
{
  if (f && f.type === 'Feature')
  {
    if (f.geometry)
    {
      let packed = save.get(f);
      if (packed)
      {
        f.geometry.packed = packed;
        delete f.geometry.coordinates;
      }
    }
  }
  else if (f.type && f.type === 'FeatureCollection' && f.features)
  {
    f.features.forEach((ff: any) => featureRepack(ff, save));
  }
  return f;
}

export function featurePackString(f: any): string
{
  let packed = f.offset ? f : (f.geometry.packed ? f.geometry.packed : polyPack(f.geometry.coordinates));
  let af = packed.buffer as Float64Array;
  let a: string[] = [];
  for (let i: number = 0; i < packed.length; i++)
    a.push(String(af[i]));
  return a.join(' ');
}

export function featureUnpackString(s: string): any
{
  let a = s.split(' ');
  let ab = new ArrayBuffer(a.length * 8);
  let af = new Float64Array(ab);
  let i: number = 0;
  a.forEach((n: string) => { af[i++] = Number(n) });
  let f: any = { type: 'Feature', geometry: {type: 'Polygon', packed: { offset: 0, length: a.length, buffer: af } } };
  f = featureUnpack(f);
  if (Util.depthof(f.geometry.coordinates) === 5)
    f.geometry.type = 'MultiPolygon';
  return f;
}
