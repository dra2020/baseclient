import TinyQueue from 'tinyqueue';
import * as Util from '../util/all';
import * as P from './poly';
import * as PP from './polypack';
import * as BB from './boundbox';

interface PolyLabelResult
{
  x: number;
  y: number;
  d: number;
}

//
// polyDistance: return (smallest) distance to polygon edge.
//    Positive value indicates point is in poly, negative indicates point is outside.
//

export function polyDistance(poly: any, x: number, y: number): number
{
  let pp = P.polyNormalize(poly);
  if (pp == null) return 0;

  // First find if it is contained in one of the outer polygons, or outside all outer polygons
  let iContaining = -1;
  let maxOutside = - Infinity;
  let minInside = Infinity;
  let noholes = true;
  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      // If we have determined we are inside this polygon, keep track of whether it has holes
      if (iContaining == iPoly && iRing > 0)
        noholes = false;
      // Don't process rings
      if (iRing > 0) return;
      // OK, get distance
      let forEachPointPair = (iter: any) => {
          PP.polyPackEachRing(pp, (b: Float64Array, iInteriorPoly: number, iRing: number, iOffset: number, nPoints: number) => {
              if (iRing || iInteriorPoly != iPoly) return;
              let iFirst = iOffset;
              let iLast = iOffset + nPoints * 2;
              let iSecond = iLast - 2;
              for (; iFirst < iLast; iSecond = iFirst, iFirst += 2)
                iter(b[iFirst], b[iFirst+1], b[iSecond], b[iSecond+1]);
            });
        };
      let dist = pointToPolygonDist(x, y, forEachPointPair);
      // If inside, is it closest inside (deal with multipolygons that self-contain - think filled donut)
      if (dist > 0 && dist < minInside)
      {
        iContaining = iPoly;
        minInside = dist;
        noholes = true;
      }
      else if (dist < 0)
        maxOutside = Math.max(maxOutside, dist);
    });
  if (iContaining < 0)
    return maxOutside;
  if (noholes)
    return minInside;

  // OK, now need to worry about holes in the polygon it is contained in
  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      // Only want to look at the holes for the containing polygon
      if (iPoly != iContaining || iRing == 0) return;
      // Compute distance to those holes
      let forEachPointPair = (iter: any) => {
          PP.polyPackEachRing(pp, (b: Float64Array, iInteriorPoly: number, iRing: number, iOffset: number, nPoints: number) => {
              if (iInteriorPoly != iContaining || iRing == 0) return;
              let iFirst = iOffset;
              let iLast = iOffset + nPoints * 2;
              let iSecond = iLast - 2;
              for (; iFirst < iLast; iSecond = iFirst, iFirst += 2)
                iter(b[iFirst], b[iFirst+1], b[iSecond], b[iSecond+1]);
            });
        };
      // Negate distance since dealing with holes
      let dist = - pointToPolygonDist(x, y, forEachPointPair);
      // We take the min to either get a negative value (inside hole) or a smaller positive value
      // (outside hole but close to hole boundary).
      minInside = Math.min(minInside, dist);
    });
  return minInside;
}

//
// polyLabel: given polygon, return contained point furthest from any edge, and that distance
//

export function polyLabel(poly: any, precision?: number, debug?: boolean): PolyLabelResult
{
  let pp = P.polyNormalize(poly);
  if (pp == null) return { x: 0, y: 0, d: 0 };

  // For multi-polygon, pick largest polygon
  let iLargest: number;
  let nLargestArea: number;
  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      if (iRing) return;
      let nArea = P.polySimpleArea(b, iOffset, nPoints);
      if (iLargest === undefined || nArea > nLargestArea) { iLargest = iPoly, nLargestArea = nArea }
    });

  if (iLargest === undefined)
    return { x: 0, y: 0, d: 0 };

  precision = precision || 0.00001;

  let forEachPoint = (iter: any) => {
      PP.polyPackEachPoint(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number) => {
          if (iPoly != iLargest || iRing) return;
          iter(b[iOffset], b[iOffset+1]);
        });
    };
  let forEachPointPair = (iter: any) => {
      PP.polyPackEachRing(pp, (b: Float64Array, iPoly, iRing: number, iOffset: number, nPoints: number) => {
          if (iPoly != iLargest || iRing) return;
          let iFirst = iOffset;
          let iLast = iOffset + nPoints * 2;
          let iSecond = iLast - 2;
          for (; iFirst < iLast; iSecond = iFirst, iFirst += 2)
            iter(b[iFirst], b[iFirst+1], b[iSecond], b[iSecond+1]);
        });
    };

  // find the bounding box of the outer ring
  let minX: number, minY: number, maxX: number, maxY: number;
  forEachPoint((x: number, y: number) => {
      if (minX === undefined || x < minX) minX = x;
      if (minY === undefined || y < minY) minY = y;
      if (maxX === undefined || x > maxX) maxX = x;
      if (maxY === undefined || y > maxY) maxY = y;
    });

  let width: number = maxX - minX;
  let height: number = maxY - minY;
  let cellSize: number = Math.min(width, height);
  let h: number = cellSize / 2;

  if (cellSize === 0) return { x: minX, y: minY, d: 0 };

  // a priority queue of cells in order of their "potential" (max distance to polygon)
  let cellQueue = new TinyQueue<Cell>(undefined, compareMax);

  // cover polygon with initial cells
  for (let x: number = minX; x < maxX; x += cellSize)
  {
    for (let y: number = minY; y < maxY; y += cellSize)
      cellQueue.push(new Cell(x + h, y + h, h, forEachPointPair));
  }

  // take centroid as the first best guess
  let bestCell: any = getCentroidCell(forEachPointPair);

  // special case for rectangular polygons
  let bboxCell: Cell = new Cell(minX + width / 2, minY + height / 2, 0, forEachPointPair);
  if (bboxCell.d > bestCell.d) bestCell = bboxCell;

  let numProbes = cellQueue.length;

  while (cellQueue.length)
  {
    // pick the most promising cell from the queue
    let cell = cellQueue.pop();

    // update the best cell if we found a better one
    if (cell.d > bestCell.d)
    {
      bestCell = cell;
      if (debug) console.log('found best %d after %d probes', Math.round(1e4 * cell.d) / 1e4, numProbes);
    }

    // do not drill down further if there's no chance of a better solution
    if (cell.max - bestCell.d <= precision) continue;

    // split the cell into four cells
    h = cell.h / 2;
    cellQueue.push(new Cell(cell.x - h, cell.y - h, h, forEachPointPair));
    cellQueue.push(new Cell(cell.x + h, cell.y - h, h, forEachPointPair));
    cellQueue.push(new Cell(cell.x - h, cell.y + h, h, forEachPointPair));
    cellQueue.push(new Cell(cell.x + h, cell.y + h, h, forEachPointPair));
    numProbes += 4;
  }

  if (debug)
  {
    console.log('num probes: ' + numProbes);
    console.log('best distance: ' + bestCell.d);
  }

  return { x: bestCell.x, y: bestCell.y, d: bestCell.d };
}

function compareMax(a: Cell, b: Cell) { return b.max - a.max; }

class Cell
{
  x: number;
  y: number;
  h: number;
  d: number;
  max: number;

  constructor(x: number, y: number, h: number, forEachPointPair: any)
  {
    this.x = x; // cell center x
    this.y = y; // cell center y
    this.h = h; // half the cell size
    this.d = pointToPolygonDist(x, y, forEachPointPair); // distance from cell center to polygon
    this.max = this.d + this.h * Math.SQRT2; // max distance to polygon within a cell
  }
}

// signed distance from point to polygon outline (negative if point is outside)
function pointToPolygonDist(x: number, y: number, forEachPointPair: any): number
{
  let inside = false;
  let minDistSq = Infinity;

  forEachPointPair((ax: number, ay: number, bx: number, by: number) => {
      if ((ay > y !== by > y) && (x < (bx - ax) * (y - ay) / (by - ay) + ax))
        inside = !inside;

      minDistSq = Math.min(minDistSq, getSegDistSq(x, y, ax, ay, bx, by));
    });

  return (inside ? 1 : -1) * Math.sqrt(minDistSq);
}

// get polygon centroid
function getCentroidCell(forEachPointPair: any): Cell
{
  let area = 0;
  let x = 0;
  let y = 0;
  let fx: number;
  let fy: number;

  forEachPointPair((ax: number, ay: number, bx: number, by: number) => {
      if (fx === undefined) fx = ax, fy = ay;
      let f: number = ax * by - bx * ay;
      x += (ax + bx) * f;
      y += (ay + by) * f;
      area += f * 3;
    });
  if (area === 0) return new Cell(fx, fy, 0, forEachPointPair);
  return new Cell(x / area, y / area, 0, forEachPointPair);
}

// get squared distance from a point to a segment
function getSegDistSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number
{
  let dx = bx - ax;
  let dy = by - ay;

  if (dx !== 0 || dy !== 0)
  {
    let t: number = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);

    if (t > 1)
    {
      ax = bx;
      ay = by;
    }
    else if (t > 0)
    {
      ax += dx * t;
      ay += dy * t;
    }
  }

  dx = px - ax;
  dy = py - ay;

  return dx * dx + dy * dy;
}
