
// Forked version that supports packing
import * as TopoClient from '@dra2020/topojson-client';
// Forked version that fixes self-looping hole problem
import * as TopoServer from '@dra2020/topojson-server';
// Forked version that fixes performance problem
import * as TopoSimplify from '@dra2020/topojson-simplify';

import * as Util from '../util/all';
import * as FSM from '../fsm/all';
import * as G from '../geo/all';

import * as P from './poly';
import * as Q from './quad';
import * as PP from './polypack';
import * as PL from './polylabel';
import { selfIntersectFast } from './shamos';
import { polyContainsPoint } from './pointinpoly';

export type Topo = any;

function getGEOID(f: any): string
{
  if (f.features && f.features.length)
    f = f.features[0];
  else if (Array.isArray(f))
    f = f[0];
  else
    return '';
  if (f.properties.id !== undefined) return 'id';
  if (f.properties.GEOID !== undefined) return 'GEOID';
  if (f.properties.GEOID10 !== undefined) return 'GEOID10';
  return '';
}

export function topoFromCollection(col: any): Topo
{
  if (col == null) return null;
  let save = PP.featureUnpackTemporarily(col);
  let prop = getGEOID(col);
  let objects: any = {};
  col.features.forEach((f: any) => objects[f.properties[prop]] = f);
  let topo: any;
  if (Util.isEmpty(objects))
    topo = { objects: objects }
  else
    topo = TopoServer.topology(objects);
  PP.featureRepack(col, save);
  if (col.datasets)
    topo.datasets = col.datasets;
  return topo;
}

function ringsCancel(outerPoly: any, innerRing: any): boolean
{
  if (outerPoly.length != 1) return false;
  let outerRing = outerPoly[0];
  if (outerRing.length !== innerRing.length) return false;
  let n = outerRing.length-1;
  let i = 0;
  for (; i <= n; i++, n--)
    if (! Util.shallowEqual(outerRing[i], innerRing[n]))
      return false;
  return true;
}

function correctGeometry(f: any): any
{
  return P.featureRewind(f, { validateHoles: false } );
}

export function topoContiguity(topo: Topo): any
{
  let objects: any[] = Object.values(topo.objects);
  let geoid = getGEOID(objects);
  objects.forEach((o: any) => { o.properties.id = o.properties[geoid] });
  let neighbors = TopoClient.neighbors(topo, objects, true);
  let result: any = {};
  result['OUT_OF_STATE'] = [];
  objects.forEach((o: any, i: number) => {
      result[o.properties.id] = neighbors[i].map((j: any) => {
          if (j >= 0)
            return objects[j].properties.id;
          else
          {
            result['OUT_OF_STATE'].push(o.properties.id);
            return 'OUT_OF_STATE';
          }
        });
    });
  return result;
}

export function topoToFeature(topo: Topo, geoid: string): any
{
  return correctGeometry(TopoClient.feature(topo, topo.objects[geoid]));
}

export type TopoSpliceEntry = { topology: Topo, filterout?: any };

export function topoSplice(topoarray: TopoSpliceEntry[]): Topo
{
  if (topoarray) topoarray.forEach(e => topoPack(e.topology));
  return TopoClient.splice(topoarray);
}

export function topoToCollection(topo: Topo): any
{
  let col: any = { type: 'FeatureCollection', features: [] };
  if (topo)
    Object.keys(topo.objects).forEach((geoid: string) => {
        col.features.push(topoToFeature(topo, geoid));
      });
  if (topo && topo.datasets) col.datasets = topo.datasets;
  return col;
}

function keepArcs(topo: any, arcs: any, keepweight: number): void
{
  arcs.forEach((a: any) => {
      if (Array.isArray(a))
        keepArcs(topo, a, keepweight);
      else
      {
        let arc = topo.arcs[a < 0 ? ~a : a];
        arc.forEach((pt: any) => {
            if (pt[2] >= keepweight)
              pt[2] = Infinity;
          });
      }
    });
}

function fullFidelity(topo: any, arcs: any): boolean
{
  let bFull = true;

  arcs.forEach((a: any) => {
      if (Array.isArray(a))
        bFull = bFull && fullFidelity(topo, a);
      else
      {
        let arc = topo.arcs[a < 0 ? ~a : a];
        arc.forEach((pt: any) => {
            if (bFull && pt[2] !== Infinity)
              bFull = false;
          });
      }
    });
  return bFull;
}

function misMatchPoly(p1: any, p2: any): boolean
{
  if (p1 == null || p2 == null || p1.length != p2.length) return true;
  for (let i = 0; i < p1.length; i++)
    if (p1[i] == null || p2[i] == null) return true;
  return false;
}

function misMatchMulti(m1: any, m2: any): boolean
{
  if (m1 == null || m2 == null || m1.length != m2.length) return true;
  for (let i = 0; i < m1.length; i++)
    if (misMatchPoly(m1[i], m2[i])) return true;
  return false;
}

function misMatchObject(o1: any, o2: any): boolean
{
  if (o1 == null || o2 == null || o1.type !== o2.type) return true;
  return (o1.type === 'MultiPolygon') ? misMatchMulti(o1.arcs, o2.arcs) : misMatchPoly(o1.arcs, o2.arcs);
}

const MAX_TRIES = 30;

function bigTimeString(ms: number): string
{
  let seconds = Math.trunc(ms / 1000);
  let minutes = Math.trunc(seconds / 60);
  seconds -= minutes * 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function intpt(f: any): { x: number, y: number }
{
  let x = 0, y = 0;
  for (let p of ['INTPTLON20','INTPTLON10','INTPTLON','labelx'])
    if (f.properties[p] && !isNaN(Number(f.properties[p])))
    {
      x = Number(f.properties[p]);
      break;
    }
  for (let p of ['INTPTLAT20','INTPTLAT10','INTPTLAT','labely'])
    if (f.properties[p] && !isNaN(Number(f.properties[p])))
    {
      y = Number(f.properties[p]);
      break;
    }
  return {x: x, y: y};
}

export interface SimplifyOptions
{
  minArea?: number,
  log?: boolean,
}

const DefaultSimplifyOptions: SimplifyOptions = { minArea: 500 };

function log(emitlog: boolean, s: string): void
{
  if (emitlog) console.log(s);
}

//
// topoSimplifyCollection:
//    This implements our simplification strategy for block/precinct level shapes. The basic idea is to
//    ensure that all shapes generated at the block level have non-zero area and do not introduce self-crossing
//    edges. Since topological simplification happens at the edge level, self-crossing is a risk when opposite
//    edges make simplification decisions that cause the edges to cross. Crossing edges result in visual anomalies.
//    In addition, our basic strategy is that if we have well-formed block shapes, all other shape processing
//    (virtual features, precincts, counties, districts) can be done by fast merges that generate well-formed
//    shapes without holes, overlaps or crossing edges.
//    The strategy here is to first just do topological simplification at the default simplification level. We then
//    scan for problematic shapes (zero area, too thin and narrow or self-crossing) and keep additional points on
//    the edges (arcs) for those shapes, adding additional points on each iteration step until we have a good set.
//    For tiny shapes (zero area or short and thin) we just immediately say keep all points since these are mostly 
//    shapes with a small number of points anyway.
//

export function topoSimplifyCollection(col: any, options?: SimplifyOptions): any
{
  options = Util.shallowAssignImmutable(DefaultSimplifyOptions, options);

  if (col == null) return null;
  let elapsedTotal = new Util.Elapsed();
  let elapsed = new Util.Elapsed();
  let topo = topoFromCollection(col);
  log(options.log, `topoSimplifyCollection: fromCollection: ${Math.round(elapsed.ms())}ms`);
  elapsed.start();
  topo = TopoSimplify.presimplify(topo, TopoSimplify['sphericalTriangleArea']);
  log(options.log, `topoSimplifyCollection: presimplify: ${Math.round(elapsed.ms())}ms`);
  elapsed.start();

  // Keep iterating on removing simplification from degenerate shapes
  let nTries = 1;
  let nBadLast = Number.MAX_VALUE;
  let keepweight = 1E-11;
  let nLabelTolerance = 1E-4;
  let minArea = options.minArea;
  let keepTiny = new WeakMap<any, any>();
  while (true)
  {
    let testtopo = TopoSimplify.simplify(topo, 1E-10);
    elapsed.start();
    let nBad = 0;
    let nTiny = 0;
    col.features.forEach((f: any) => {
        let oOld: any = topo.objects[f.properties.id];
        let oNew: any = testtopo.objects[f.properties.id];

        // Ignore points
        if (f.geometry && f.geometry.type === 'Point')
          keepTiny.set(f, f);

        if (! keepTiny.has(f))
        {
          // Walk through each polygon of a multipolygon separately since I may have a large non-degenerate
          // shape combined with degenerate smaller shapes that I want to identify. I do not examine holes
          // separately under the assumption that holes will have matching polygons that would be identified
          // and would cause those shared edges (between the hole and the filling polygon) to be preserved if necessary.
          //
          // I do make a final pass of testing for self-intersection that looks at both polygon and hole edges.
          //
          let arcs = PP.normalizeArcs(oNew.arcs);
          let npoly = PP.countArcPolygons(arcs);
          let bDecided = false;
          let iPoly = 0;
          for (; !bDecided && iPoly < npoly; iPoly++)
          {
            let pp = PP.polyPackTopoArcs(testtopo, arcs, iPoly);
            P.polyRewindRings(pp);
            let a = P.polyArea(pp);
            if (a <= 0)
            {
              keepTiny.set(f, f);
              keepArcs(topo, oOld.arcs, 0); // keeps all points to avoid reprocessing these tiny shapes
              nBad++, nTiny++, bDecided = true;
            }
            else if (a < minArea)
            {
              let d = PL.polyLabel(pp);
              if (d.d < nLabelTolerance)
              {
                keepTiny.set(f, f);
                keepArcs(topo, oOld.arcs, 0); // keeps all points to avoid reprocessing these tiny shapes
                nBad++, nTiny++, bDecided = true;
              }
            }
          }
          if (! bDecided)
          {
            let pp = PP.polyPackTopoArcs(testtopo, arcs);
            P.polyRewindRings(pp);
            if (selfIntersectFast(pp))
            {
              keepArcs(topo, oOld.arcs, keepweight);
              nBad++;
            }
            else
            {
              let {x,y} = intpt(f);
              let d = PL.polyDistance(pp, x, y);
              if (d < 0.00001)  // d is negative if outside the polygon, so that qualifies here
              {
                keepTiny.set(f, f);
                keepArcs(topo, oOld.arcs, 0); // keeps all points to avoid reprocessing these tiny shapes
                nBad++, nTiny++;
                log(options.log, `topoSimplifyCollection: ${f.properties.id}: increasing feature fidelity because intpt dist is ${d}`);
              }
            }
          }
        }
      });
    log(options.log, `topoSimplifyCollection: pass ${nTries}: ${nBad} (${nTiny} tiny) of ${col.features.length} features are degenerate`);

    // If not making progress, keep more points
    if (nBad >= nBadLast)
    {
      keepweight /= 10;
      log(options.log, `topoSimplifyCollection: pass ${nTries}: reducing weight limit to ${keepweight}`);
    }
    nBadLast = nBad;

    if (nBad && nTries > MAX_TRIES)
      console.error(`topoSimplifyCollection: failed to finalize simplify down to zero degenerate features`);
    // If no bad block shapes, or finished trying, just return result
    if (nBad == 0 || nTries > MAX_TRIES)
    {
      col = topoToCollection(testtopo);
      break;
    }

    nTries++;
  }

  log(options.log, `topoSimplifyCollection: total elapsed time: ${bigTimeString(elapsedTotal.ms())}`);

  return col;
}

export function topoMerge(topo: Topo, geoids: string[]): any
{
  if (geoids == null || geoids.length == 0) return null;
  let objects: any[] = [];
  geoids.forEach((geoid) => objects.push(topo.objects[geoid]));
  return correctGeometry({ type: 'Feature', properties: {}, geometry: TopoClient.merge(topo, objects) });
}

export function topoMergeFeatures(topo: Topo, features: any[]): any
{
  if (features == null || features.length == 0) return null;
  let prop = getGEOID(features);
  return topoMerge(topo, features.map(f => f.properties[prop]));
}

let UniqueState = FSM.FSM_CUSTOM1;
let FSM_COMPUTING = UniqueState++;

class FsmIncrementalUnion extends FSM.Fsm
{
  options: P.TickOptions;
  key: number;
  multi: G.GeoMultiCollection;
  map: any; // { [geoid: string]: Feature }
  result: any;
  work: Q.WorkDone;

  constructor(env: FSM.FsmEnvironment, options: P.TickOptions, multi: G.GeoMultiCollection, key: number, map?: any)
  {
    super(env);
    this.options = options;
    this.multi = multi;
    this.key = key;
    this.result = null;
    this.map = null;
    if (map) this.recompute(map);
  }

  recompute(map: any): void
  {
    if (this.map != null && map != null && Util.shallowEqual(map, this.map))
    {
      this.work = { nUnion: 0, nDifference: 0, ms: 0 };
    }
    else if (map == null || Util.isEmpty(map))
    {
      this.work = { nUnion: 0, nDifference: 0, ms: 0 };
      this.result = null;
      this.map = map;
    }
    else
    {
      let values = Object.values(map);
      this.work = { nUnion: values.length, nDifference: 0, ms: 0 };
      let elapsed = new Util.Elapsed();
      this.result = topoMergeFeatures(this.multi.allTopo(), values);
      this.work.ms = elapsed.ms();
      this.map = map;
    }
    this.setState(FSM.FSM_DONE);
  }

  cancel(): void
  {
    this.result = null;
    this.map = null;
    this.setState(FSM.FSM_DONE);
  }

  tick(): void
  {
    if (this.ready)
    {
      switch (this.state)
      {
        case FSM.FSM_STARTING:
          // never initialized to do work (see recompute())
          this.setState(FSM.FSM_DONE);
          break;
      }
    }
  }
}

export interface TopoUnionResult
{
  key: number;
  poly: any;
  work: Q.WorkDone;
}

export class FsmTopoUnion extends FSM.Fsm
{
  options: P.TickOptions;
  unions: { [index: number]: FsmIncrementalUnion };
  work: Q.WorkDone;

  constructor(env: FSM.FsmEnvironment, options?: P.TickOptions)
  {
    super(env);
    this.options = Util.shallowAssignImmutable(P.DefaultTickOptions, options);
    this.unions = {};
    this.work = { nUnion: 0, nDifference: 0, ms: 0 };
  }

  get result(): TopoUnionResult[]
  {
    if (Util.countKeys(this.unions) > 0 && this.state === FSM.FSM_DONE)
      return Object.values(this.unions).map((i: FsmIncrementalUnion) => ({ key: i.key, poly: i.result, work: i.work }) );
    else
      return null;
  }

  cancel(): void
  {
    Object.values(this.unions).forEach((i: FsmIncrementalUnion) => {
        i.cancel();
      });
    this.unions = {};
    this.setState(FSM.FSM_DONE);
  }

  cancelOne(key: number): void
  {
    let u = this.unions[key];
    if (u) u.cancel();
  }

  recompute(multi: G.GeoMultiCollection, key: number, map: any): void
  {
    let fsm = this.unions[key];
    if (fsm == null || fsm.multi !== multi)
    {
      fsm = new FsmIncrementalUnion(this.env, this.options, multi, key, map);
      this.unions[key] = fsm;
    }
    else
      fsm.recompute(map);
    this.work = { nUnion: 0, nDifference: 0, ms: 0 };
    this.waitOn(fsm);
    this.setState(FSM_COMPUTING);
  }

  tick(): void
  {
    if (this.ready)
    {
      switch (this.state)
      {
        case FSM.FSM_STARTING:
        case FSM_COMPUTING:
          this.work = { nUnion: 0, nDifference: 0, ms: 0 };
          if (this.unions) Object.values(this.unions).forEach((i: FsmIncrementalUnion) => {
              this.work.ms += i.work.ms;
              this.work.nUnion += i.work.nUnion;
              this.work.nDifference += i.work.nDifference;
            });
          this.setState(FSM.FSM_DONE);
          break;
      }
    }
  }
}

export function topoPacked(topo: any): boolean
{
  return topo.packed !== undefined;
}

export function topoPack(topo: any): any
{
  let tc = TopoClient;
  TopoClient.packArcs(topo);
  TopoClient.packArcIndices(topo);
  return topo;
}

export function topoUnpack(topo: any): any
{
  TopoClient.unpackArcs(topo);
  TopoClient.unpackArcIndices(topo);
  return topo;
}
