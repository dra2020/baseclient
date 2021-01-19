import objectHash from 'object-hash';

export function qhash(o: any, keys?: any): any
{
  // Copy only specified keys into temp object if subset provided.
  if (keys !== undefined)
  {
    let tmpO: any = {};
    for (let p in keys) if (keys.hasOwnProperty(p))
      tmpO[p] = o[p];
    o = tmpO;
  }

  return objectHash(o, { unorderedArrays: true, unorderedSets: true, });
}
