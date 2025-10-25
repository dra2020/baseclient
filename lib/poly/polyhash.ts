import * as P from './poly';
import * as PP from './polypack';

// Hash coordinates to 32 bit number in order to produce a fast (and a little sloppy) equivalence test.
// Note that this depends on ordering, so an equivalent polygon with different coordinate ordering would
// not test as equivalent. As a 32 bit number, you can expect collisions when used for large numbers of
// polygons (e.g. a 700k block set might expect ~57 collisions - TX at 660K gets 62 collisions, e.g.).
//
export function polyHash32(poly: any, seed = 0): number
{
  let pp = P.polyNormalize(poly);
  if (!pp) return 0;

  let h = (seed | 0) ^ 0x9e3779b9;
  const buf = new ArrayBuffer(8);
  const dv  = new DataView(buf);

  function mix32(x: number): number
  {
    x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
    x ^= x >>> 16;
    return x | 0;
  }

  let l = 0;
  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      let iEnd = iOffset + (nPoints*2);
      for (; iOffset < iEnd; iOffset++)
      {
        const x = b[iOffset];
        if (Number.isNaN(x))
        {
          dv.setUint32(0, 0x7ff80001, true);
          dv.setUint32(4, 0, true);
        }
        else
          dv.setFloat64(0, x, true);
        const lo = dv.getUint32(0, true) | 0;
        const hi = dv.getUint32(4, true) | 0;

        let z = mix32(lo ^ Math.imul(hi, 0x9e3779b9) ^ Math.imul(l + 1, 0x85ebca6b));
        h ^= z;
        h  = mix32(h);
        l++;
      }
    });
  h ^= l | 0;
  h  = mix32(h);
  // return as unsigned 32-bit in a JS number
  return h >>> 0;
}
