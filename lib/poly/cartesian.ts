//
// GEO-FEATURES UTILITIES
//

import * as GeoJSON from 'geojson';
import * as P from './poly';
import * as PP from './polypack';


// HELPER

function bufferToRing(b: Float64Array, s: number, nPoints: number): any
{
  let r: any = [];
  let e = s + nPoints * 2;
  for (; s < e; s += 2)
    r.push([ b[s], b[s+1] ]);
  return r;
}

export function polyParts(poly: any): GeoJSON.FeatureCollection
{
  let pp = P.polyNormalize(poly);

  let parts: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  let af: any = parts.features;
  let f: any;
  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      let r = bufferToRing(b, iOffset, nPoints);
      if (iRing == 0)
      {
        f = { type: 'Feature',
              properties: { id: String(iPoly+1) },
              geometry: { type: 'Polygon', coordinates: [ r ] } };
        af.push(f);
      }
      else
        f.geometry.coordinates.push(r);
    });
  return parts;
}

// CARTESIAN ("FLAT") AREA, PERIMETER, AND DIAMETER

export function polyAreaFlat(poly: any): number
{
  let pp = P.polyNormalize(poly);

  let a: number = 0;
  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      a += polySimpleAreaFlat(b, iOffset, nPoints) * (iRing == 0 ? 1 : -1);
    });
  return a;
}

// Algorithm for the area of a simple/single planar polygon:
// https://algorithmtutor.com/Computational-Geometry/Area-of-a-polygon-given-a-set-of-points/
// https://mathopenref.com/coordpolygonarea2.html
//
// function polygonArea(X, Y, numPoints) 
// { 
//   area = 0;         // Accumulates area in the loop
//   j = numPoints-1;  // The last vertex is the 'previous' one to the first

//   for (i=0; i<numPoints; i++)
//     { area = area +  (X[j]+X[i]) * (Y[j]-Y[i]); 
//       j = i;  //j is previous vertex to i
//     }
//   return area/2;
// }

// Reimplemented to use polygons vs. X & Y vectors
function polySimpleAreaFlat(b: Float64Array, i: number, nPoints: number): number
{
  let a = 0;
  let e = i + nPoints * 2;
  let j = e - 2;         // The last vertex is the 'previous' one to the first

  for (; i < e; i += 2)
  {
    a += (b[j] + b[i]) * (b[j+1] - b[i+1]);
    j = i;
  }
  return Math.abs(a / 2);
}

// You would need to divide by Poly.EARTH_RADIUS to go from the returned units of meters to Lat/Lon “units.”
// NOTE - No conversion of degrees to radians!

export function polyPerimeterFlat(poly: any): number
{
  let pp = P.polyNormalize(poly);

  let perimeter: number = 0;
  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      // Ignore holes so only look at first ring
      if (iRing == 0)
      {
        let s = iOffset;
        let e = s + (nPoints-1) * 2;  // index *at* last point since we look at next point in each iteration
        for (; s < e; s += 2)
          perimeter += _distance(b[s], b[s+1], b[s+2], b[s+3]);
        s = iOffset;
        if (nPoints > 2 && (b[s] != b[e] || b[s+1] != b[e+1]))
          perimeter += _distance(b[s], b[s+1], b[e], b[e+1]);
      }
    });

  return perimeter;
}

function _distance(x1: number, y1: number, x2: number, y2: number): number
{
  const dLat = y2 - y1;
  const dLon = x2 - x1;
  let d: number;

  d = Math.sqrt((dLat * dLat) + (dLon * dLon));

  return d;
}

// The polyCircle code is already just treating the coordinate system as Cartesian.
// So just compute circle and return diameter.

export function polyDiameterFlat(poly: any): number
{
  let circle = P.polyToCircle(poly);
  return circle ? circle.r * 2 : 0;
}
