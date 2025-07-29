import * as geojson from 'geojson';
import * as Util from '../util/all'
import * as Poly from '../poly/all'
import * as G from './geo'

function oneNumberOf(f: G.GeoFeature, props: string[]): number
{
  for (let i = 0; i < props.length; i++)
    if (f.properties[props[i]])
      return Number(f.properties[props[i]]);
  return 0;
}

export function ensureCentroidInFeature(f: G.GeoFeature): void
{
  if (f.geometry && f.properties.labelx === undefined)
  {
    f.properties.labelx = oneNumberOf(f, ['INTPTLON30', 'INTPTLON20','INTPTLON10','INTPTLON']);
    f.properties.labely = oneNumberOf(f, ['INTPTLAT30', 'INTPTLAT20','INTPTLAT10','INTPTLAT']);
    if (f.properties.labelx && f.properties.labely)
      if (! Poly.polyContainsPoint(f, f.properties.labelx, f.properties.labely))
      {
        delete f.properties.labelx;
        delete f.properties.labely;
      }

    // If internal point not specified, compute it
    if (!f.properties.labelx || !f.properties.labely)
    {
      let result = Poly.polyLabel(f);
      f.properties.labelx = Util.precisionRound(result.x, 6);
      f.properties.labely = Util.precisionRound(result.y, 6);
    }

    delete f.properties.INTPTLAT30;
    delete f.properties.INTPTLON30;
    delete f.properties.INTPTLAT20;
    delete f.properties.INTPTLON20;
    delete f.properties.INTPTLAT10;
    delete f.properties.INTPTLON10;
    delete f.properties.INTPTLAT;
    delete f.properties.INTPTLON;
  }
}

export function ensureCentroidInCollection(col: G.GeoFeatureCollection): void
{
  col.features.forEach(ensureCentroidInFeature);
}
