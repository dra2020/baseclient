import * as G from '../geo/all';
import * as P from './poly';
import * as PP  from './polypack';
import * as PL from './polylabel';
import * as BB from './boundbox';
import { polyContainsPoint } from './pointinpoly';
import { Control } from '../control/all';

function setLabels(c: G.GeoFeatureCollection): void
{
  c.features.forEach(f => {
      if (f.properties.labelx === undefined)
      {
        let {x,y} = PL.polyLabel(f);
        f.properties.labelx = x;
        f.properties.labely = y;
      }
    });
}

// polyMapTo:
//
//  Given a set of underlying blocks (or precincts), map them to the district (or any other feature)
//  they are contained in.
//
//  If a block maps to multiple districts or no district, it is left out of the result.
//
//  Note that the algorithm is to see where the centroid of the block overlaps. So a block
//  could potentially overlap multiple districts and this would return only the one containing
//  the centroid.
//
//  The thinking is that if you want fine granularity, use real blocks as the base collection.
//  If you provide precincts, you will get a result on precinct granularity.
//
//  The return value is an object that maps the block feature ids to the district feature id.
//
export function polyMapToByCentroid(districts: G.GeoFeatureCollection, centroids: G.GeoCentroidMap, control?: Control): any
{
  let map: any = {};

  // Cache district boundboxes for quick containment exclusion
  let fs: G.GeoFeature[] = districts.features;
  let bbDistricts: BB.BoundBox[] = fs.map(f => BB.boundbox(f));
  let aDistricts: number[] = fs.map(f => P.polyArea(f));

  // Walk over blocks, mapping centroid to district
  let canceled = false;
  let keys = Object.keys(centroids);
  keys.forEach((blockid: string, k: number) => {
      canceled = canceled || control?.isCanceled();
      if (canceled) return;
      let x = centroids[blockid].x;
      let y = centroids[blockid].y;

      let fIn: number[] = [];
      fs.forEach((fDistrict: G.GeoFeature, i: number) => {
          if (BB.boundboxContains(bbDistricts[i], x, y))
            if (polyContainsPoint(fDistrict, x, y))
              fIn.push(i);
        });

      if (fIn.length == 1)
        map[blockid] = fs[fIn[0]].properties.id;
      else if (fIn.length > 1)
      {
        // Pick district with smallest area since some times we get malformed content that doesn't
        // reflect holes in districts when one is nested in another. So theory is smaller district
        // is a hole in containing larger one(s).
        let iLow = fIn[0];
        for (let i = 1; i < fIn.length; i++)
          if (aDistricts[fIn[i]] < aDistricts[iLow])
            iLow = fIn[i];
        map[blockid] = fs[iLow].properties.id;
      }

      if (control) control.statusUpdate(k, keys.length);
    });

  return canceled ? undefined : map;
}

export function polyMapTo(districts: G.GeoFeatureCollection, blocks: G.GeoFeatureCollection, control?: Control): any
{
  // Cache labelx, labely if necessary
  setLabels(blocks);

  let centroids: G.GeoCentroidMap = {};
  blocks.features.forEach(f => {
    centroids[f.properties.id] = { x: f.properties.labelx, y: f.properties.labely }
    });

  return polyMapToByCentroid(districts, centroids, control);
}
