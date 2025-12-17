import * as Util from '../util/all';
import * as PP from './polypack';

export type PointConverter = (pt: [number, number]) => [number, number]

// Convert geometry given point conversion function. Takes any form of feature, collection or coordinate array(s)
export function polyConvert(o: any, cvt: PointConverter): any
{
  if (o)
  {
    if (Array.isArray(o))
    {
      if (o.length && typeof o[0] === 'number')
      {
        for (let i = 0; i < o.length; i += 2)
        {
          const p = cvt([o[i], o[i+1]]);
          o[i] = p[0];
          o[i+1] = p[1];
        }
      }
      else
        o.forEach((e: any) => { polyConvert(e, cvt) });
    }
    else if (o.features !== undefined && Array.isArray(o.features))
      o.features.forEach((f: any) => { polyConvert(f, cvt) });
    else if (o.geometry !== undefined && o.geometry.coordinates !== undefined)
      polyConvert(o.geometry.coordinates, cvt);
    else if (o.geometry !== undefined && o.geometry.packed !== undefined)
      PP.polyPackEachPoint(o.geometry.packed, (b: Float64Array, iPoly: number, iRing: number, iOffset: number) => {
          const p = cvt([b[iOffset], b[iOffset+1]]);
          b[iOffset] = p[0];
          b[iOffset+1] = p[1];
        });
  }
  return o;
}

export function polyFrom32614(o: any): any
{
  return polyConvert(o, utm14ToLonLat);
}

// If coordinates in 32614 format, convert to WGS84 (GeoJSON standard format)
//
export function colValidateCRS(o: any): any
{
  // "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:EPSG::32614" } },

  if (o?.crs?.properties?.name === 'urn:ogc:def:crs:EPSG::32614')
  {
    delete o.crs;
    return polyFrom32614(o);
  }
  return o
}

/**
 * Convert UTM Zone 14N (EPSG:32614) coordinates to WGS84 lon/lat.
 * Input:  [easting, northing] in meters
 * Output: [longitude, latitude] in degrees
 */
export function utm14ToLonLat([E, N]: [number, number]): [number, number] {
  // WGS84 parameters
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;

  const e = Math.sqrt(f * (2 - f));   // eccentricity
  const e1sq = e * e / (1 - e * e);

  // UTM zone parameters
  const zone = 14;
  const lonOrigin = (zone - 1) * 6 - 180 + 3; // central meridian
  const falseEasting = 500000;

  // Remove false northing for northern hemisphere (EPSG:326xx always north)
  const x = E - falseEasting;
  const y = N;

  // Footpoint latitude
  const M = y / k0;
  const mu = M / (a * (1 - e*e/4 - 3*e**4/64 - 5*e**6/256));

  const e1 = (1 - Math.sqrt(1 - e*e)) / (1 + Math.sqrt(1 - e*e));

  const J1 = (3 * e1 / 2 - 27 * e1**3 / 32);
  const J2 = (21 * e1**2 / 16 - 55 * e1**4 / 32);
  const J3 = (151 * e1**3 / 96);
  const J4 = (1097 * e1**4 / 512);

  const fp = mu
    + J1 * Math.sin(2 * mu)
    + J2 * Math.sin(4 * mu)
    + J3 * Math.sin(6 * mu)
    + J4 * Math.sin(8 * mu);

  // Precompute trig functions
  const sinfp = Math.sin(fp);
  const cosfp = Math.cos(fp);
  const tanfp = Math.tan(fp);

  const C1 = e1sq * cosfp**2;
  const T1 = tanfp**2;
  const R1 = a * (1 - e*e) / Math.pow(1 - e*e * sinfp**2, 3/2);
  const N1 = a / Math.sqrt(1 - e*e * sinfp**2);
  const D = x / (N1 * k0);

  // Latitude (φ)
  const lat =
    fp
    - (N1 * tanfp / R1) *
      (D**2 / 2
      - (5 + 3*T1 + 10*C1 - 4*C1**2 - 9*e1sq) * D**4 / 24
      + (61 + 90*T1 + 298*C1 + 45*T1**2 - 252*e1sq - 3*C1**2) * D**6 / 720);

  // Longitude (λ)
  const lon =
    (D
      - (1 + 2*T1 + C1) * D**3 / 6
      + (5 - 2*C1 + 28*T1 - 3*C1**2 + 8*e1sq + 24*T1**2) * D**5 / 120) / cosfp;

  // Convert to degrees and apply central meridian offset
  const latitude = lat * (180 / Math.PI);
  const longitude = lonOrigin + lon * (180 / Math.PI);

  return [longitude, latitude];
}
