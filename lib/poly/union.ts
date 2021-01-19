import * as PC from 'polygon-clipping';

import * as Util from '../util/all';
import * as FSM from '../fsm/all';

import * as Poly from './poly';
import * as Q from './quad';
import * as PP from './polypack';
import * as PR from './polyround';

// Confusion on how polygon-clipping exposes its interface - be flexible
let _union: any = undefined;
let _difference: any = undefined;
let _intersection: any = undefined;
let anyPC: any = PC;
if (anyPC.union) _union = anyPC.union;
else if (anyPC.default && anyPC.default.union) _union = anyPC.default.union;
if (_union === undefined) throw 'Unable to load union function from polygon-clipping';
if (anyPC.difference) _difference = anyPC.difference;
else if (anyPC.default && anyPC.default.difference) _difference = anyPC.default.difference;
if (_difference === undefined) throw 'Unable to load difference function from polygon-clipping';
if (anyPC.intersection) _intersection = anyPC.intersection;
else if (anyPC.default && anyPC.default.intersection) _intersection = anyPC.default.intersection;
if (_intersection === undefined) throw 'Unable to load intersection function from polygon-clipping';

const FSM_COMPUTING = FSM.FSM_CUSTOM1;

function unpackCoords(buffer: Float64Array, offset: number, nPoints: number): any
{
  let c: any[] = [];

  let end = offset + nPoints*2;
  for (; offset < end; offset += 2)
    c.push([buffer[offset], buffer[offset+1]]);
  return [ c ];
}

export function polyIntersects(p1: any, p2: any): boolean
{
  let pp1 = Poly.polyNormalize(p1);
  let pp2 = Poly.polyNormalize(p2);
  let bIntersects: boolean = false;

  PP.polyPackEachRing(pp1, (buffer1: Float64Array, iPoly1: number, iRing1: number, iOffset1: number, nPoints1: number) => {
      if (iRing1 == 0)
      {
        let c1 = unpackCoords(buffer1, iOffset1, nPoints1);
        PP.polyPackEachRing(pp2, (buffer2: Float64Array, iPoly2: number, iRing2: number, iOffset2: number, nPoints2: number) => {
            if (iRing2 == 0)
            {
              let c2 = unpackCoords(buffer2, iOffset2, nPoints2);
              let result = _intersection(c1, c2);
              if (result && result.length > 0)
                bIntersects = true;  
            }
          });
      }
    });
  return bIntersects;
}

class FsmDifference extends FSM.Fsm
{
  accum: any;
  polys: any[];
  work: Q.WorkDone;

  constructor(env: FSM.FsmEnvironment, accum?: any, polys?: any[])
  {
    super(env);
    this.work = { nUnion: 0, nDifference: 0, ms: 0 };
    this.initialize(accum, polys);
  }

  initialize(accum: any, polys: any[])
  {
    this.accum = accum;
    this.polys = polys;
    if (polys == null || polys.length == 0)
      this.setState(FSM.FSM_DONE);
    else
    {
      this.work.nDifference = polys.length;
      this.setState(FSM.FSM_STARTING);
    }
  }

  cancel(): void
  {
    this.accum = null;
    this.polys = null;
    this.setState(FSM.FSM_DONE);
  }

  get result(): any
  {
    return this.accum;
  }

  tick(): void
  {
    if (this.ready)
    {
      switch (this.state)
      {
        case FSM.FSM_STARTING:
          if (this.polys == null)
            this.setState(FSM.FSM_DONE);
          else
            this.setState(FSM_COMPUTING);
          break;

        case FSM_COMPUTING:
          let elapsed = new Util.Elapsed();
          this.accum = PR.polyRound(_difference(this.accum, this.polys));
          this.work.ms = elapsed.ms();
          this.polys = null;
          this.setState(FSM.FSM_DONE);
          break;
      }
    }
  }
}

const FSM_UNION = FSM.FSM_CUSTOM1;
const FSM_DIFFERENCE = FSM.FSM_CUSTOM2;

function coords(f: any): any
{
  return (f.geometry !== undefined) ? (f.geometry.packed !== undefined ? f.geometry.packed : f.geometry.coordinates) : f;
}

class FsmIncrementalUnion extends FSM.Fsm
{
  options: Poly.TickOptions;
  key: any;
  map: any; // { [geoid: string]: Feature }
  result: any;
  lastCompleteMap: any;
  lastCompleteResult: any;
  toSub: any[];
  fsmUnion: Q.FsmQuadTree;
  fsmDifference: FsmDifference;
  work: Q.WorkDone;

  constructor(env: FSM.FsmEnvironment, options: Poly.TickOptions, key: any, map?: any)
  {
    super(env);
    this.options = options;
    this.key = key;
    this.result = null;
    this.map = null;
    this.lastCompleteResult = null;
    this.lastCompleteMap = null;
    this.toSub = null;
    this.fsmUnion = null;
    this.fsmDifference = null;
    if (map) this.recompute(map);
  }

  matches(key: any): boolean
  {
    return Util.shallowEqual(this.key, key);
  }

  recompute(map: any): void
  {
    // If a computation is in progress, just cancel and restart
    if (this.fsmUnion)
    {
      this.fsmUnion.cancel();
      this.fsmUnion = null;
      this.result = this.lastCompleteResult;
      this.map = this.lastCompleteMap;
    }
    if (this.fsmDifference)
    {
      this.fsmDifference.cancel();
      this.fsmDifference = null;
      this.result = this.lastCompleteResult;
      this.map = this.lastCompleteMap;
    }

    let polys: any[] = [];
    if (this.result == null || Util.isEmpty(map))
    {
      // Starting from scratch
      this.toSub = null;
      for (let id in map) if (map.hasOwnProperty(id))
        polys.push(coords(map[id]));
    }
    else
    {
      // We have the result of a previous computation - compute a difference since we assume
      // that is cheaper (often only one or two polygons added or removed).
      let id: string;

      // To add (polygons in new map did not occur in old map)
      polys.push(this.result);
      this.result = null;
      for (id in map) if (map.hasOwnProperty(id) && this.map[id] === undefined)
        polys.push(coords(map[id]));

      // To sub
      this.toSub = [];
      for (id in this.map) if (this.map.hasOwnProperty(id) && map[id] === undefined)
      {
        let c = PP.polyUnpack(coords(this.map[id]));
        if (Util.depthof(c) === 5)
          for (let i: number = 0; i < c.length; i++)
            this.toSub.push(c[i]);
        else
          this.toSub.push(c);
      }
      if (this.toSub.length == 0)
        this.toSub = null;
    }

    // Short-circuit when no work to be done
    if (polys.length == 1 && this.toSub == null && this.lastCompleteResult)
    {
      this.work = { nUnion: 0, nDifference: 0, ms: 0 };
      this.result = this.lastCompleteResult;
      this.map = this.lastCompleteMap;
      this.setState(FSM.FSM_DONE);
    }
    else
    {
      this.work = { nUnion: polys.length - 1, nDifference: this.toSub ? this.toSub.length : 0, ms: 0 };
      this.fsmUnion = new Q.FsmQuadTree(this.env, this.options, polys);
      this.waitOn(this.fsmUnion);
      this.setState(FSM_UNION);
      this.map = map;
    }
  }

  cancel(): void
  {
    if (this.fsmUnion)
    {
      this.fsmUnion.cancel();
      this.fsmUnion = null;
    }
    if (this.fsmDifference)
    {
      this.fsmDifference.cancel();
      this.fsmDifference = null;
    }
    this.result = null;
    this.map = null;
    this.lastCompleteResult = null;
    this.lastCompleteMap = null;
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

        case FSM_UNION:
          if (this.fsmUnion)
            this.work.ms += this.fsmUnion.work.ms;
          this.fsmDifference = new FsmDifference(this.env, this.fsmUnion.result, this.toSub);
          this.waitOn(this.fsmDifference);
          this.toSub = null;
          this.fsmUnion = null;
          this.setState(FSM_DIFFERENCE);
          break;

        case FSM_DIFFERENCE:
          this.result = this.fsmDifference.result;
          this.work.ms += this.fsmDifference.work.ms;
          this.lastCompleteResult = this.result;
          this.lastCompleteMap = this.map;
          this.fsmDifference = null;
          this.setState(FSM.FSM_DONE);
          break;
      }
    }
  }
}

export interface UnionResult
{
  key: any;
  poly: any;
  work: Q.WorkDone;
}

export class FsmUnion extends FSM.Fsm
{
  options: Poly.TickOptions;
  unions: FsmIncrementalUnion[];
  work: Q.WorkDone;

  constructor(env: FSM.FsmEnvironment, options?: Poly.TickOptions)
  {
    super(env);
    this.options = Util.shallowAssignImmutable(Poly.DefaultTickOptions, options);
    this.unions = [];
    this.work = { nUnion: 0, nDifference: 0, ms: 0 };
  }

  get result(): UnionResult[]
  {
    if (this.unions.length > 0 && this.state === FSM.FSM_DONE)
      return this.unions.map((i: FsmIncrementalUnion) => ({ key: i.key, poly: i.result, work: i.work }) );
    else
      return null;
  }

  cancel(): void
  {
    this.unions.forEach((i: FsmIncrementalUnion) => {
        i.cancel();
      });
    this.unions = [];
    this.setState(FSM.FSM_DONE);
  }

  cancelOne(key: any): void
  {
    for (let i = 0; i < this.unions.length; i++)
    {
      let u = this.unions[i];
      if (u.matches(key))
      {
        u.cancel();
        return;
      }
    }
  }

  recompute(key: any, map: any): void
  {
    let fsm: FsmIncrementalUnion = this.unions.find((i: FsmIncrementalUnion) => i.matches(key));
    if (fsm == null)
    {
      fsm = new FsmIncrementalUnion(this.env, this.options, key, map);
      this.unions.push(fsm);
    }
    else
      fsm.recompute(map);
    this.work = { nUnion: 0, nDifference: 0, ms: 0 };
    this.unions.forEach((u) => { this.work.nUnion += u.work.nUnion; this.work.nDifference += u.work.nDifference });
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
          if (this.unions) this.unions.forEach((u) => { this.work.ms += u.work.ms });
          this.setState(FSM.FSM_DONE);
          break;
      }
    }
  }
}
