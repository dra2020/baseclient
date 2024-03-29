import * as PP from './polypack';

export function polyContainsPoint(poly: any, x: number, y: number): boolean
{
  let pp = PP.polyPack(poly);
  if (pp == null) return false;
  let bInside = false;
  let iCurPoly = -1;
  let bCurInside = false;

  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      if (iRing == 0)
      {
        if (iCurPoly >= 0 && bCurInside)
          bInside = true;
        iCurPoly = iPoly;
        bCurInside = false;
      }
      let inside = false;
      let iEnd = iOffset + (nPoints - 1) * 2;
      for (let i = iOffset, j = iEnd; i <= iEnd; j = i, i += 2)
      {
        let xi = b[i], yi = b[i+1];
        let xj = b[j], yj = b[j+1];
        let intersect = ((yi > y) !== (yj > y))
                        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      if (inside)
        bCurInside = iRing == 0; // not inside if inside a hole
    });
  if (iCurPoly >= 0 && bCurInside)
    bInside = true;
  return bInside;
}
