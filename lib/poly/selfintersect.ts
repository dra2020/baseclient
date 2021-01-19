import * as Util from '../util/all';

import * as P from './poly';
import * as PP from './polypack';

// Given three colinear points p, q, r, the function checks if
// point q lies on line segment 'pr'
function onSegment(px: number, py: number, qx: number, qy: number, rx: number, ry: number): boolean
{
  if (qx <= Math.max(px, rx) && qx >= Math.min(px, rx) &&
      qy <= Math.max(py, ry) && qy >= Math.min(py, ry))
     return true;

  return false;
}

// To find orientation of ordered triplet (p, q, r).
// The function returns following values
// 0 --> p, q and r are colinear
// 1 --> Clockwise
// 2 --> Counterclockwise
function orientation(px: number, py: number, qx: number, qy: number, rx: number, ry: number): number
{
  // See https://www.geeksforgeeks.org/orientation-3-ordered-points/
  // for details of below formula.
  let val: number = (qy - py) * (rx - qx) -
                    (qx - px) * (ry - qy);

  if (val == 0) return 0;  // colinear

  return (val > 0)? 1: 2; // clock or counterclock wise
}

// The main function that returns true if line segment 'p1q1'
// and 'p2q2' intersect.
function doIntersect(p1x: number, p1y: number, q1x: number, q1y: number, p2x: number, p2y: number, q2x: number, q2y: number): boolean
{
    // closing segment is not intersection
    if (p1x - q2x + p1y - q2y === 0) return false;

    // Find the four orientations needed for general and
    // special cases
    let o1 = orientation(p1x, p1y, q1x, q1y, p2x, p2y);
    let o2 = orientation(p1x, p1y, q1x, q1y, q2x, q2y);
    let o3 = orientation(p2x, p2y, q2x, q2y, p1x, p1y);
    let o4 = orientation(p2x, p2y, q2x, q2y, q1x, q1y);

    // General case
    if (o1 != o2 && o3 != o4)
      return true;

    // Special Cases
    // p1, q1 and p2 are colinear and p2 lies on segment p1q1
    if (o1 == 0 && onSegment(p1x, p1y, p2x, p2y, q1x, q1y)) return true;

    // p1, q1 and q2 are colinear and q2 lies on segment p1q1
    if (o2 == 0 && onSegment(p1x, p1y, q2x, q2y, q1x, q1y)) return true;

    // p2, q2 and p1 are colinear and p1 lies on segment p2q2
    if (o3 == 0 && onSegment(p2x, p2y, p1x, p1y, q2x, q2y)) return true;

     // p2, q2 and q1 are colinear and q1 lies on segment p2q2
    if (o4 == 0 && onSegment(p2x, p2y, q1x, q1y, q2x, q2y)) return true;

    return false; // Doesn't fall in any of the above cases
}

// no extra storage, but brute-force O(N^2) in number of segments. See selfIntersectFast for better approach.
export function selfIntersect(poly: any): boolean
{
  let pp = P.polyNormalize(poly);
  if (pp == null) return false;
  let bIntersect = false;
  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      if (bIntersect) return;
      let iEnd = iOffset + ((nPoints-2) * 2);
      let jEnd = iOffset + ((nPoints-1) * 2);
      for (let i = iOffset; i < iEnd; i += 2)
        for (let j = i + 4; j < jEnd; j += 2)
          if (doIntersect(b[i], b[i+1], b[i+2], b[i+3], b[j], b[j+1], b[j+2], b[j+3]))
          {
            bIntersect = true;
            return;
          }
    });
  return bIntersect;
}
