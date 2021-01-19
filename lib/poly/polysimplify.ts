import * as Util from '../util/all';

import { simplify } from './simplify';

export function polySimplify(poly: any, tolerance: number = 0.0001): void
{
  if (poly == null) return;
  if (poly.geometry && poly.geometry.coordinates) poly = poly.geometry.coordinates;
  let depth = Util.depthof(poly);
  if (depth == 4)
    poly = [ poly ];
  else if (depth != 5)
    return;

  // Poly is multi-polygon, array of polygons
  for (let i: number = 0; i < poly.length; i++)
  {
    // p is polygon, array of rings, each ring is array of points which is what gets fed to underlying simplify routine.
    let p = poly[i];

    for (let j: number = 0; j < p.length; j++)
      p[j] = simplify(p[j], tolerance, true);
  }
}
