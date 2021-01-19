import * as Util from '../util/all';
import * as PP from './polypack';

// Takes array of polygon or multi-polygon coordinate structures and returns a single multi-polygon
// structure. The coordinates may be passed in using packed format.

export function blend(polys: any[]): any
{
  if (polys == null || polys.length == 0) return null;

  let result: any[] = [];

  for (let i: number = 0; i < polys.length; i++)
  {
    let p = PP.polyUnpack(polys[i]);
    let d = Util.depthof(p);
    if (d === 4)
      result.push(p);
    else if (d === 5)
      for (let j: number = 0; j < p.length; j++)
        result.push(p[j]);
    else if (p.length === undefined || p.length > 0)
      throw new Error('blend expects polygon or multi-polygon coordinates');
  }

  return result;
}
