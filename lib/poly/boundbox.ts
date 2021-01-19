import * as Util from '../util/all';

import * as P from './poly';
import * as PP from './polypack';

// Note, in Geo format so top > bottom
export interface BoundBox
{
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}

export function boundboxWidth(bb: BoundBox): number { return Math.abs(bb.right - bb.left); }
export function boundboxHeight(bb: BoundBox): number { return Math.abs(bb.bottom - bb.top); }

export function boundboxCX(bb: BoundBox): number { return bb.left + (bb.right - bb.left) / 2; }
export function boundboxCY(bb: BoundBox): number { return bb.top + (bb.bottom - bb.top) / 2; }

export function clipLon(lon: number): number { return lon <= 0 ? lon : -179; }

export function boundboxExtend(bbox: BoundBox, x: number, y: number): void
{
  x = clipLon(x);
  if (bbox.left === undefined || x < bbox.left)
    bbox.left = x;
  if (bbox.right === undefined || x > bbox.right)
    bbox.right = x;
  if (bbox.top === undefined || y > bbox.top)
    bbox.top = y;
  if (bbox.bottom === undefined || y < bbox.bottom)
    bbox.bottom = y;
}

function boundboxExtendPacked(pp: PP.PolyPack, bbox: BoundBox): void
{
  let buffer = pp.buffer as Float64Array;
  let offset = pp.buffer[pp.offset+1] + pp.offset;
  let end = pp.offset + pp.length;
  for (; offset < end; offset += 2)
    boundboxExtend(bbox, buffer[offset], buffer[offset+1]);
}

export function boundbox(poly: any, bbox?: BoundBox): BoundBox
{
  let i: number;

  if (bbox === undefined)
    bbox = { };

  if (poly)
  {
    // Collection
    if (poly.features)
    {
      for (i = 0; i < poly.features.length; i++)
        boundbox(poly.features[i], bbox);
    }

    // feature
    else if (poly.geometry)
    {
      if (poly.geometry.packed)
        boundboxExtendPacked(poly.geometry.packed as PP.PolyPack, bbox);
      else if (poly.geometry.coordinates)
        boundbox(poly.geometry.coordinates, bbox);
    }

    // raw packed buffer
    else if (poly.offset !== undefined)
      boundboxExtendPacked(poly as PP.PolyPack, bbox);

    // array of other things (like raw coordinates, or other aggregates)
    else if (Array.isArray(poly) && typeof poly[0] !== 'number')
    {
      for (i = 0; i < poly.length; i++)
        boundbox(poly[i], bbox);
    }

    // single point
    else
      boundboxExtend(bbox, poly[0], poly[1]);
  }

  return bbox;
}

export function boundboxPoly(bb: BoundBox): any
{
  return [ [ [bb.left, bb.top], [bb.left, bb.bottom], [bb.right, bb.bottom], [bb.right, bb.top], [bb.left, bb.top] ] ];
}

export function boundboxArea(poly: any): number
{
  return P.polyArea(boundboxPoly(boundbox(poly)));
}

export function boundboxIntersects(bb1: BoundBox, bb2: BoundBox): boolean
{
  return !(bb1.left > bb2.right || bb1.right < bb2.left || bb1.top < bb2.bottom || bb1.bottom > bb2.top);
}
