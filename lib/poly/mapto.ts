import * as G from '../geo/all';
import * as P from './poly';
import * as PP  from './polypack';
import * as PL from './polylabel';
import * as BB from './boundbox';
import { polyContainsPoint } from './pointinpoly';

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
export function polyMapToByCentroid(districts: G.GeoFeatureCollection, centroids: G.GeoCentroidMap): any
{
  let map: any = {};

  // Cache district boundboxes for quick containment exclusion
  let bbDistricts: BB.BoundBox[] = districts.features.map(f => BB.boundbox(f));

  // Walk over blocks, mapping centroid to district
  Object.keys(centroids).forEach(blockid => {
      let x = centroids[blockid].x;
      let y = centroids[blockid].y;

      let fIn: G.GeoFeature[] = [];
      districts.features.forEach((fDistrict: G.GeoFeature, i: number) => {
          if (BB.boundboxContains(bbDistricts[i], x, y))
            if (polyContainsPoint(fDistrict, x, y))
              fIn.push(fDistrict);
        });

      if (fIn.length == 1)
        map[blockid] = fIn[0].properties.id;
    });

  return map;
}

export function polyMapTo(districts: G.GeoFeatureCollection, blocks: G.GeoFeatureCollection): any
{
  // Cache labelx, labely if necessary
  setLabels(blocks);

  let centroids: G.GeoCentroidMap = {};
  blocks.features.forEach(f => {
    centroids[f.properties.id] = { x: f.properties.labelx, y: f.properties.labely }
    });

  return polyMapToByCentroid(districts, centroids);
}
