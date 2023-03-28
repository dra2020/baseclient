import { polyIntersects } from './union';
import { polyArea } from './poly';

function flattenMultiPoly(polys: any): any
{
  let c: any[] = [];
  polys.forEach((poly: any) => {
      poly.forEach((ring: any) => {
          c.push([ring]);
        });
    });
  return c;
}

// Handed a multipolygon that may not have been properly structured as outer rings and inner holes, fix it up.
// This is relatively expensive since we compute intersection areas to test for holes.
//
export function featureCleanHoles(f: any): any
{
  if (!f
      || f.type !== 'Feature'
      || !f.geometry
      || f.geometry.type !== 'MultiPolygon'
      || !Array.isArray(f.geometry.coordinates))
    return f;

  // Normalize to flattened polygon
  f.geometry.coordinates = flattenMultiPoly(f.geometry.coordinates);

  let polys = f.geometry.coordinates;
  let areas: number[] = polys.map(polyArea);
  // Compute 'top triangle' of overlap grid, then reflect
  let overlaps: boolean[][] = polys.map((p1: any, i: number) => {
      return polys.map((p2: any, j: number) => { return j <= i ? false : polyIntersects(p1, p2) });
    });
  // Now reflect
  let n = polys.length;
  for (let i = 0; i < n-1; i++)
    for (let j = i+1; j < n; j++)
      overlaps[j][i] = overlaps[i][j];

  // The outer polygon is one that
  //  1. Overlaps with this one
  //  2. Has a larger area than this one
  //  3. Has the smallest area of any that overlap
  //  4. There are an odd number of polygons that satisfy 1 and 2.  (This allows nesting of polygons inside holes.)
  //
  function findOuter(i: number): number
  {
    let jOuter = -1;
    let aOuter = 0;
    let nOverlap = 0;

    for (let j = 0; j < n; j++)
      if (overlaps[i][j] && areas[j] > areas[i])
      {
        nOverlap++;
        if (jOuter < 0 || areas[j] < aOuter)
        {
          jOuter = j;
          aOuter = areas[j];
        }
      }
    return (nOverlap % 2) == 1 ? jOuter : -1;
  }

  // Walk through and match up holes with their containers
  for (let i = 0; i < n; i++)
  {
    let j = findOuter(i);
    if (j >= 0)
    {
      polys[j].push(polys[i][0]);
      polys[i] = [];
    }
  }

  // Delete outer shell of hole rings that were moved
  f.geometry.coordinates = polys.filter((p: any[]) => p.length > 0);

  // Degenerate multi-polygon
  if (f.geometry.coordinates.length == 1)
  {
    f.geometry.type = 'Polygon';
    f.geometry.coordinates = f.geometry.coordinates[0];
  }

  return f;
}
