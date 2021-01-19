import * as Util from '../util/all';
import * as PP from './polypack';

// Round feature geometry to 6 decimal precision
export function polyRound(o: any): any
{
  if (o)
  {
    if (Array.isArray(o))
    {
      if (o.length && typeof o[0] === 'number')
      {
        for (let i = 0; i < o.length; i++)
          o[i] = Util.precisionRound(o[i], 6);
      }
      else
        o.forEach((e: any) => { polyRound(e) });
    }
    else if (o.features !== undefined && Array.isArray(o.features))
      o.features.forEach((f: any) => { polyRound(f) });
    else if (o.geometry !== undefined && o.geometry.coordinates !== undefined)
      polyRound(o.geometry.coordinates);
    else if (o.geometry !== undefined && o.geometry.packed !== undefined)
      PP.polyPackEachPoint(o.geometry.packed, (b: Float64Array, iPoly: number, iRing: number, iOffset: number) => {
          b[iOffset] = Util.precisionRound(b[iOffset], 6);
          b[iOffset+1] = Util.precisionRound(b[iOffset+1], 6);
        });
  }
  return o;
}
