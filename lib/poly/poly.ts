import * as Util from '../util/all';

import * as PP from './polypack';
import { makeConvexHullGrahamScan } from './graham-scan';

// For incremental poly interface
export interface TickOptions
{
  maxLeafCount?: number;
  maxDepth?: number;
  tickStep?: number;
}

export const DefaultTickOptions = { maxLeafCount: 256, maxDepth: 20, tickStep: 1 };


// Internal utilities

export const EARTH_RADIUS = 6371000; // Radius of earth in meters

export interface PolyOptions
{
  noLatitudeCorrection?: boolean;
}
export const DefaultOptions: PolyOptions = { };

// Return geographic polygon area in meters^2
export function polySimpleArea(b: Float64Array, iOffset: number, n: number): number
{
  let p1x: number;
  let p1y: number;
  let p2x: number;
  let p2y: number;
  let p3x: number;
  let p3y: number;
  let dx: number;
  let l: number;
  let m: number;
  let u: number;
  let i: number;
  let total: number = 0;
  if (n > 2)
  {
    for (i = 0; i < n; i++)
    {
      if (i === n - 2)
      {
          l = n - 2;
          m = n - 1;
          u = 0;
      }
      else if (i === n - 1)
      {
          l = n - 1;
          m = 0;
          u = 1;
      }
      else {
          l = i;
          m = i + 1;
          u = i + 2;
      }
      p1x = b[iOffset+l*2];
      p1y = b[iOffset+l*2+1];
      p2x = b[iOffset+m*2];
      p2y = b[iOffset+m*2+1];
      p3x = b[iOffset+u*2];
      p3y = b[iOffset+u*2+1];
      dx = (Util.deg2rad(p3x) - Util.deg2rad(p1x));
      dx *= Math.sin(Util.deg2rad(p2y));
      total += dx;
    }
    total *= EARTH_RADIUS * EARTH_RADIUS / 2;
  }
  return Math.abs(total);
}

// Allow bare polygon coordinates array or GeoJSON feature.
// Normalize to multipolygon points array.

export function polyNormalize(poly: any): PP.PolyPack
{
  return PP.polyPack(poly);
}

export function polyNull(poly: any): boolean
{
  let pp = PP.polyPack(poly);
  return pp == null || pp.length == 2;
}

// Area of geodesic polygon
export function polyArea(poly: any): number
{
  let pp = polyNormalize(poly);
  let a: number = 0;

  // MultiPolygon is a set of polygons
  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      a += polySimpleArea(b, iOffset, nPoints) * (iRing == 0 ? 1 : -1);
    });

  return a;
}

// NOTE - COMPACTNESS: Added the diameter of the geodesic polygon in meters
export function polyDiameter(poly: any, options?: PolyOptions): number
{
  if (options === undefined) options = DefaultOptions;

  const ch: any  = polyConvexHull(poly);
  const chCircle: Circle = polyToCircle(ch);

  const lon: number = chCircle.x;
  const lat: number = chCircle.y;
  const r: number = chCircle.r;

  const lonDistance: number = haversine(lon - r, lat, lon + r, lat, options);
  const latDistance: number = haversine(lon, lat - r, lon, lat + r, options);

  const diameter: number = Math.max(lonDistance, latDistance);
  
  return diameter;
}

// Return distance in meters given two lat/lon points
function haversine(x1: number, y1: number, x2: number, y2: number, options: PolyOptions): number
{
  let dLat = Util.deg2rad(y2 - y1);
  let dLon = Util.deg2rad(x2 - x1);
  let c: number;

  // Short circuit for using simple cartesian algorithm instead of haversine
  if (options.noLatitudeCorrection)
    c = Math.sqrt((dLat*dLat)+(dLon*dLon));
  else
  {
    let lat1 = Util.deg2rad(y1);
    let lat2 = Util.deg2rad(y2);

    let a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2)
    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }

  return EARTH_RADIUS * c;
}

// The perimeter of geodesic polygon in meters
export function polyPerimeter(poly: any, options?: PolyOptions): number
{
  if (options === undefined) options = DefaultOptions;

  let pp = polyNormalize(poly);
  let perimeter: number = 0;

  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      if (iRing > 0) return;  // skip holes
      let iStart = iOffset;
      let iEnd = (iOffset + nPoints * 2) - 2; // index to last point, not past last point
      for (; iOffset < iEnd; iOffset += 2)
        perimeter += haversine(b[iOffset], b[iOffset+1], b[iOffset+2], b[iOffset+3], options);

      // Close ring if necessary
      if (nPoints > 2 && (b[iStart] != b[iEnd] || b[iStart+1] != b[iEnd+1]))
        perimeter += haversine(b[iStart], b[iStart+1], b[iEnd], b[iEnd+1], options);
    });

  return perimeter;
}

class Point {
	public constructor(
		public x: number,
		public y: number) {}
}

export class Circle {
	public constructor(
		public x: number,
		public y: number,
		public r: number) {}
}

//
// Returns the smallest circle that encloses the given polygon.
// Runs in expected O(n) time, randomized.
// Note: If 0 points are given, null is returned.
// If 1 point is given, a circle of radius 0 is returned.
//

export function polyToCircle(poly: any): Circle|null
{
  return makeCircle(polyToExteriorPoints(poly));
}

//
// Returns the circle whose perimeter is equal to the perimeter of the bounding perimeter
// of the polygon. Use binary search to find an approximation.
//

export function polyToPolsbyPopperCircle(poly: any, options?: PolyOptions): Circle|null
{
  let pp = polyNormalize(poly);

  let c = polyToCircle(poly);
  if (c == null) return c;
  let p: number = polyPerimeter(poly, options);
  c.r = (p / (2 * Math.PI)) / 111139;
  return c;
}

function makeCircle(points: Array<Point>): Circle|null
{
  if (points == null) return null;

	// Clone list to preserve the caller's data, do Durstenfeld shuffle
	let shuffled: Array<Point> = points.slice();
	for (let i = points.length - 1; i >= 0; i--) {
		let j = Math.floor(Math.random() * (i + 1));
		j = Math.max(Math.min(j, i), 0);
		const temp: Point = shuffled[i];
		shuffled[i] = shuffled[j];
		shuffled[j] = temp;
	}

	// Progressively add points to circle or recompute circle
	let c: Circle|null = null;
	shuffled.forEach((p: Point, i: number) => {
		if (c === null || !isInCircle(c, p))
			c = makeCircleOnePoint(shuffled.slice(0, i + 1), p);
	});
	return c;
}

// One boundary point known
function makeCircleOnePoint(points: Array<Point>, p: Point): Circle
{
	let c: Circle = new Circle(p.x, p.y, 0);
	points.forEach((q: Point, i: number) => {
		if (!isInCircle(c, q)) {
			if (c.r == 0)
				c = makeDiameter(p, q);
			else
				c = makeCircleTwoPoints(points.slice(0, i + 1), p, q);
		}
	});
	return c;
}

// Two boundary points known
function makeCircleTwoPoints(points: Array<Point>, p: Point, q: Point): Circle
{
	const circ: Circle = makeDiameter(p, q);
	let left : Circle|null = null;
	let right: Circle|null = null;

	// For each point not in the two-point circle
	for (const r of points) {
		if (isInCircle(circ, r))
			continue;

		// Form a circumcircle and classify it on left or right side
		const cross: number = crossProduct(p.x, p.y, q.x, q.y, r.x, r.y);
		const c: Circle|null = makeCircumcircle(p, q, r);
		if (c === null)
			continue;
		else if (cross > 0 && (left === null || crossProduct(p.x, p.y, q.x, q.y, c.x, c.y) > crossProduct(p.x, p.y, q.x, q.y, left.x, left.y)))
			left = c;
		else if (cross < 0 && (right === null || crossProduct(p.x, p.y, q.x, q.y, c.x, c.y) < crossProduct(p.x, p.y, q.x, q.y, right.x, right.y)))
			right = c;
	}

	// Select which circle to return
	if (left === null && right === null)
		return circ;
	else if (left === null && right !== null)
		return right;
	else if (left !== null && right === null)
		return left;
	else if (left !== null && right !== null)
		return left.r <= right.r ? left : right;
	else
		throw "Assertion error";
}

function makeDiameter(a: Point, b: Point): Circle
{
	const cx: number = (a.x + b.x) / 2;
	const cy: number = (a.y + b.y) / 2;
	const r0: number = Util.distance(cx, cy, a.x, a.y);
	const r1: number = Util.distance(cx, cy, b.x, b.y);
	return new Circle(cx, cy, Math.max(r0, r1));
}

function makeCircumcircle(a: Point, b: Point, c: Point): Circle|null
{
	// Mathematical algorithm from Wikipedia: Circumscribed circle
	const ox: number = (Math.min(a.x, b.x, c.x) + Math.max(a.x, b.x, c.x)) / 2;
	const oy: number = (Math.min(a.y, b.y, c.y) + Math.max(a.y, b.y, c.y)) / 2;
	const ax: number = a.x - ox;  const ay: number = a.y - oy;
	const bx: number = b.x - ox;  const by: number = b.y - oy;
	const cx: number = c.x - ox;  const cy: number = c.y - oy;
	const d: number = (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) * 2;
	if (d == 0)
		return null;
	const x: number = ox + ((ax*ax + ay*ay) * (by - cy) + (bx*bx + by*by) * (cy - ay) + (cx*cx + cy*cy) * (ay - by)) / d;
	const y: number = oy + ((ax*ax + ay*ay) * (cx - bx) + (bx*bx + by*by) * (ax - cx) + (cx*cx + cy*cy) * (bx - ax)) / d;
	const ra: number = Util.distance(x, y, a.x, a.y);
	const rb: number = Util.distance(x, y, b.x, b.y);
	const rc: number = Util.distance(x, y, c.x, c.y);
	return new Circle(x, y, Math.max(ra, rb, rc));
}

/* Simple mathematical functions */

const MULTIPLICATIVE_EPSILON: number = 1 + 1e-14;

function isInCircle(c: Circle|null, p: Point): boolean
{
	return c !== null && Util.distance(p.x, p.y, c.x, c.y) <= c.r * MULTIPLICATIVE_EPSILON;
}

// Returns twice the signed area of the triangle defined by (x0, y0), (x1, y1), (x2, y2).
function crossProduct(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): number
{
	return (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
}

// cache x,y circle offsets for one quadrant indexed by number of segments
let circleOffsets: any = {};

function getCircleOffsets(n: number): any
{
  if (circleOffsets[n] === undefined)
  {
    let a: number[] = [];
    let incr = (Math.PI / 2) / n;
    let theta: number = 0;
    let i: number, j: number;

    // Compute NE quadrant
    for (i = 0; i < n; i++, theta += incr)
    {
      a.push(Math.sin(theta));
      a.push(Math.cos(theta));
    }
    // Add top of circle
    a.push(0);
    a.push(1);
    // Now flip X and replicate to NW quadrant
    for (i = 0; i < n; i++)
    {
      j = (n-i)*2;
      a.push(- a[j-1]);
      a.push(a[j-2]);
    }
    // Now flip X and Y and replicate to SW quadrant
    for (i = 0; i < n; i++)
    {
      j = (n-i)*2;
      a.push(- a[j-1]);
      a.push(- a[j-2]);
    }
    // Add bottom of circle
    a.push(0);
    a.push(-1);
    // Now flip Y and replicate to SE quadrant
    for (i = 0; i < n; i++)
    {
      j = (n-i)*2;
      a.push(a[j-1]);
      a.push(- a[j-2]);
    }
    // Duplicate final point per GeoJSON spec
    a.push(a[0]);
    a.push(a[1]);

    circleOffsets[n] = a;
  }

  return circleOffsets[n];
}

// Note that this is essentially an inversion of polyToCircle which computes a mathematical
// circle given the point values, ignoring latitude correction. This inversion also
// ignores that correction which means when plotted on a 2D map looks circular but the edge of
// the circle is not a fixed distance (in physical units, e.g. meters) from the center.
//

export function polyFromCircle(c: Circle, nSegments?: number): any
{
  if (c === null || c.r == 0) return null;
  if (!nSegments || nSegments < 8) nSegments = 8;
  let poly: any = [];

  let offsets: any = getCircleOffsets(nSegments);
  const n: number = offsets.length;

  for (let i: number = 0; i < n; i += 2)
    poly.push([ c.x + (c.r * offsets[i]), c.y + (c.r * offsets[i+1]) ]);

  // return multi-polygon
  return [ [ poly ] ];
}

// isLeft(): tests if a point is Left|On|Right of an infinite line.
//    Input:  three points P0, P1, and P2
//    Return: >0 for P2 left of the line through P0 and P1
//            =0 for P2 on the line
//            <0 for P2 right of the line

function sortPointX(a: Point, b: Point): number { return a.x - b.x; }
function sortPointY(a: Point, b: Point): number { return a.y - b.y; }
function sortPoint(a: Point, b: Point): number { return a.x === b.x ? a.y - b.y : a.x - b.x; }
function isLeft(p0: Point, p1: Point, p2: Point): number { return (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y); }

function pointsToPoly(points: Point[]): any
{
  let p: any = [];

  for (let i: number = 0; i < points.length; i++)
    p.push( [ points[i].x, points[i].y ] );
  
  return [ p ];
}

export function polyToExteriorPoints(poly: any): any
{
  let pp = polyNormalize(poly);
  if (pp == null) return null;

  let points: Point[] = [];

  PP.polyPackEachPoint(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number) => {
      if (iRing > 0) return;  // skip holes
      points.push(new Point(b[iOffset], b[iOffset+1]));
    });

  return points.length > 0 ? points : null;
}

//
// polyConvexHull() - Two algorithms:
// * Gram Scan (default) - in graham-scan.ts
// * A.M.Andrew's monotone chain 2D convex hull algorithm - below
//

export function polyConvexHull(poly: any, altAlgorithm?: any): any
{
  if (altAlgorithm !== undefined)
    return makeConvexHullMonotoneChain2D(poly);
  
  return makeConvexHullGrahamScan(poly);
}

export function makeConvexHullMonotoneChain2D(poly: any): any
{
  // Normalize input
  let points = polyToExteriorPoints(poly);
  if (points == null) return null;

  points.sort(sortPoint);

  let H: Point[] = [];

  // the output array H[] will be used as the stack
  let n: number = points.length;
  let i: number;
  let bot: number = 0;
  let top: number = -1; // indices for bottom and top of the stack

  // Get the indices of points with min x-coord and min|max y-coord
  let minmin: number = 0, minmax: number;

  let xmin = points[0].x;
  for (i = 1; i < n; i++)
    if (points[i].x != xmin)
      break;

  minmax = i - 1;
  if (minmax == n - 1) // degenerate case: all x-coords == xmin
  {
    H[++top] = points[minmin];
    if (points[minmax].y != points[minmin].y) // a nontrivial segment
        H[++top] = points[minmax];
    H[++top] = points[minmin]; // add polygon endpoint
    return pointsToPoly(H);
  }

  // Get the indices of points with max x-coord and min|max y-coord
  let maxmin: number, maxmax: number = n - 1;
  let xmax: number = points[n - 1].x;
  for (i = n - 2; i >= 0; i--)
    if (points[i].x != xmax)
      break;
  maxmin = i + 1;

  // Compute the lower hull on the stack H
  H[++top] = points[minmin]; // push minmin point onto stack
  i = minmax;
  while (++i <= maxmin)
  {
    // the lower line joins points[minmin] with points[maxmin]
    if (isLeft(points[minmin], points[maxmin], points[i]) >= 0 && i < maxmin)
      continue; // ignore points[i] above or on the lower line

    while (top > 0) // there are at least 2 points on the stack
    {
      // test if points[i] is left of the line at the stack top
      if (isLeft(H[top - 1], H[top], points[i]) > 0)
        break; // points[i] is a new hull vertex
      else
        top--; // pop top point off stack
    }

    H[++top] = points[i]; // push points[i] onto stack
  }

  // Next, compute the upper hull on the stack H above the bottom hull
  if (maxmax != maxmin) // if distinct xmax points
    H[++top] = points[maxmax]; // push maxmax point onto stack

  bot = top; // the bottom point of the upper hull stack
  i = maxmin;
  while (--i >= minmax)
  {
    // the upper line joins points[maxmax] with points[minmax]
    if (isLeft(points[maxmax], points[minmax], points[i]) >= 0 && i > minmax)
      continue; // ignore points[i] below or on the upper line

    while (top > bot) // at least 2 points on the upper stack
    {
      // test if points[i] is left of the line at the stack top
      if (isLeft(H[top - 1], H[top], points[i]) > 0)
        break;  // points[i] is a new hull vertex
      else
        top--; // pop top point off stack
    }

    if (points[i].x == H[0].x && points[i].y == H[0].y)
      return pointsToPoly(H); // special case (mgomes)

    H[++top] = points[i]; // push points[i] onto stack
  }

  if (minmax != minmin)
    H[++top] = points[minmin]; // push joining endpoint onto stack

  return pointsToPoly(H);
}

// NOTE - COMPACTNESS: Removed all the compactness notes.

// TODO - COMPACTNESS: Ultimately remove this interface & polyCompactness(),
//   when dra-client no longer uses them.
export interface CompactnessDescription
{
  value: number,
  reock: number,
  polsby_popper: number,
  convex_hull: number,
  schwartzberg: number,
}

export function polyCompactness(poly: any, options?: PolyOptions): CompactnessDescription
{
  if (options === undefined) options = DefaultOptions;

  let pp = polyNormalize(poly);

  let area: number = polyArea(pp);
  let perimeter: number = polyPerimeter(pp, options);

  let circle: Circle = polyToCircle(pp);
  let circleArea: number = polyArea(polyFromCircle(circle));
  let ppcircleArea: number = polyArea(polyFromCircle(polyToPolsbyPopperCircle(poly)));
  let hullArea: number = polyArea(polyConvexHull(pp));

  let result: CompactnessDescription = { value: 0, reock: 0, polsby_popper: 0, convex_hull: 0, schwartzberg: 0 };
  if (area == 0 || circle == null || circle.r == 0) return result;

  result.reock = area / circleArea;
  result.polsby_popper = area / ppcircleArea;
  result.convex_hull = area / hullArea;
  result.schwartzberg = ((2 * Math.PI) * Math.sqrt(area / Math.PI)) / perimeter;

  // Weight Reock and Polsby-Popper equally, normalize in 0-100 range
  result.value = Math.trunc(((result.reock + result.polsby_popper) / 2) * 100);
  return result;
}


export interface PolyDescription
{
  npoly: number,
  nhole: number,
  npoint: number
}

const EmptyPolyDescription = { npoly: 0, nhole: 0, npoint: 0 };

export function polyDescribe(poly: any): PolyDescription
{
  let pp = polyNormalize(poly);
  let d = Util.shallowCopy(EmptyPolyDescription);

  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      d.npoint += nPoints;
      if (iRing == 0)
        d.npoly++;
      else
        d.nhole++;
    });

  return d;
}

export function npoints(poly: any): number
{
  let d = polyDescribe(poly);
  return d.npoint;
}

// 
// polyTransform: transform each point. Called for all polygons and all rings.
//    point, by point. Returns a packed structure.
//
export function polyTransform(poly: any, transformFn: any): any
{
  // Get all the points -- DON'T skip holes -- and transform them.
  // Don't alter input structure so copy if polyNormalize did not.
  let pp = polyNormalize(poly);
  if (! PP.polyPacked(poly))
    pp = PP.polyPackCopy(pp);

  PP.polyPackEachPoint(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number) =>
  {
    const [newX, newY] = transformFn([b[iOffset], b[iOffset+1]]);
    b[iOffset] = newX;
    b[iOffset+1] = newY;
  });

  return pp;
}

function identityTransform(pt: number[]): number[]
{
  return [pt[0], pt[1]];
}

function closeRing(ring: any): any
{
  if (ring.length > 1)
  {
    let p1 = ring[0];
    let p2 = ring[ring.length-1];
    if (p1[0] !== p2[0] || p1[1] !== p2[1])
      ring.push(p1);
  }
  return ring;
}

function closePoly(poly: any): any
{
  poly.forEach(closeRing);
  return poly;
}

// This mutates the passed in feature to ensure it is correctly wound
// For convenience, passed back the value provided.
export function featureRewind(poly: any): any
{
  let pp = polyNormalize(poly);
  if (pp == null) return null;
  polyRewindRings(pp);
  if (poly.type === 'Feature')
  {
    if (poly.geometry.packed !== pp)
    {
      poly.geometry.coordinates = PP.polyUnpack(pp);
      // Also make sure first === last coordinate
      let d = Util.depthof(poly.geometry.coordinates);
      if (d === 4) closePoly(poly.geometry.coordinates);
      else if (d === 5) poly.geometry.coordinates.forEach(closePoly);
      poly.geometry.type = d === 4 ? 'Polygon' : 'MultiPolygon';
    }
    return poly;
  }
  else if (poly === pp)
    return pp;
  else
    return PP.polyUnpack(pp);
}

//
// polyRewindRings: Check the winding order of the polygon's ring. Rewind them,
//  if necessary. Return a packed polygon.
//
export function polyRewindRings(pp: any, bLog: boolean = false): any
{
  if (pp == null || pp.buffer == null) return;

  if (pp.offset === undefined) throw 'oops: not a PolyPack';

  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) =>
  {
    const iStart = iOffset;
    const iEnd = iStart + (nPoints * 2) - 2;

    // Determine the winding order of the ring
    let direction = 0;

    // Start at the second point
    iOffset += 2;
    for (; iOffset <= iEnd; iOffset += 2)
    {
      // The previous point
      let jOffset = iOffset - 2;

      // Sum over the edges
      direction += twoTimesArea(b[iOffset], b[jOffset], b[iOffset+1], b[jOffset+1]);
    }
    
    // Implicitly close the ring, if necessary
    if (nPoints > 2 && (b[iStart] != b[iEnd] || b[iStart + 1] != b[iEnd + 1]))
    {
      if (bLog) console.log(`Implicitly closing polygon ${iPoly}, ring ${iRing}.`);

      direction += twoTimesArea(b[iStart], b[iEnd], b[iStart + 1], b[iEnd + 1]);
    }

    // If the winding order is wrong, reverse it
    if (((iRing == 0) && (direction > 0)) || ((iRing > 0) && (direction < 0)))
    {
      if (bLog) console.log(`Rewinding polygon ${iPoly}, ring ${iRing}.`);

      let iFront = iStart;
      let iBack = iEnd;
      for (; iFront < iBack; iFront += 2, iBack -= 2)
      {
        let tmpX = b[iFront];
        let tmpY = b[iFront+1];
        b[iFront] = b[iBack];
        b[iFront+1] = b[iBack+1];
        b[iBack] = tmpX;
        b[iBack+1] = tmpY;
      }
    }
  });

  return pp;
}

//
// To figure out which way a ring is wound:
//
// Sum over the edges, (x2 − x1) (y2 + y1). If the result is positive the curve
// is clockwise, if it's negative the curve is counterclockwise. (The result is 
// twice the enclosed area, with a + /- convention.)
//
// Source: https://stackoverflow.com/questions/1165647/how-to-determine-if-a-list-of-polygon-points-are-in-clockwise-order#1165943
//
function twoTimesArea(x2: number, x1: number, y2: number, y1: number): number
{
  return (x2 - x1) * (y2 + y1);
}

