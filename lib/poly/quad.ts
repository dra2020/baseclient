// Public libraries
import * as PC from 'polygon-clipping';

// Shared libraries
import * as Util from '../util/all';
import * as FSM from '../fsm/all';

// Local libraries
import * as Poly from './poly';
import * as PP from './polypack';
import * as BB from './boundbox';
import * as PR from './polyround';

let _union: any = undefined;
let anyPC: any = PC;
if (anyPC.union) _union = anyPC.union;
if (anyPC.default && anyPC.default.union) _union = anyPC.default.union;
if (_union === undefined) throw 'Unable to load union function from polygon-clipping';

export interface WrappedPoly { box: BB.BoundBox, p: any };

export interface WorkDone
{
  nUnion: number,
  nDifference: number,
  ms: number,
}

function featureCoords(feature: any): any
{
/*
  if (feature.geometry !== undefined)
  {
    if (feature.geometry.packed !== undefined)
      return PP.polyUnpack(feature.geometry.packed);
    else
      return feature.geometry.coordinates;
  }
  else if (feature.offset !== undefined)
    return PP.polyUnpack(feature);
  else
    return feature;
*/
  if (feature.geometry !== undefined)
  {
    if (feature.geometry.packed !== undefined)
      return feature.geometry.packed;
    else
      return feature.geometry.coordinates;
  }
  else
    return feature;
}

// This function takes an array of packed or unpacked polygon/multipolygons and
// returns an unpacked polygon/multipolygon coordinate array. Returns null if
// handed an empty array.

export function unionPolys(polys: any[]): any
{
  if (polys == null) return null;

  let cleanPolys: any[] = polys.filter((f: any) => f != null);
  if (cleanPolys.length == 0) return null;
  if (cleanPolys.length == 1) return PP.polyUnpack(cleanPolys[0]);
  cleanPolys = cleanPolys.map( (f: any) => PP.polyUnpack(f) );

  let poly: any = cleanPolys.pop();
  return PR.polyRound(_union(poly, ...cleanPolys));
}

export interface QuadOptions
{
  maxLeafCount?: number;
  maxDepth?: number;
  tickStep?: number;
}
export const DefaultQuadOptions: QuadOptions = { maxLeafCount: 20, maxDepth: 20, tickStep: 1 };

export interface TickCounter { ticks: number };

// Use geo orientation for t/b (that is, t > b)
class QuadLevel
{
  options: QuadOptions;
  level: number;
  children: QuadLevel[];
  features: any[];
  box: BB.BoundBox;
  asyncUnion: any;

  constructor(options: QuadOptions, level: number, box: BB.BoundBox, features: WrappedPoly[])
  {
    this.options = options;
    this.level = level;
    this.box = box;
    if (features.length <= options.maxLeafCount || this.level >= options.maxDepth)
    {
      if (this.level >= options.maxDepth)
        throw `QuadTree: maximum depth of ${options.maxDepth} exceeded`;
      this.features = features.map((wp: WrappedPoly) => wp.p);
      this.children = null;
    }
    else
    {
      this.features = null;
      let cx = BB.boundboxCX(box);
      let cy = BB.boundboxCY(box);

      let tl: BB.BoundBox = { left: box.left, top: box.top, right: cx, bottom: cy };
      let tr: BB.BoundBox = { left: cx, top: box.top, right: box.right, bottom: cy };
      let bl: BB.BoundBox = { left: box.left, top: cy, right: cx, bottom: box.bottom };
      let br: BB.BoundBox = { left: cx, top: cy, right: box.right, bottom: box.bottom };
      let tlFeatures = [];
      let trFeatures = [];
      let blFeatures = [];
      let brFeatures = [];

      for (let i: number = 0; i < features.length; i++)
      {
        let f = features[i];

        if (this.featureInBox(tl, f))
          tlFeatures.push(f);
        else if (this.featureInBox(tr, f))
          trFeatures.push(f);
        else if (this.featureInBox(bl, f))
          blFeatures.push(f);
        else if (this.featureInBox(br, f))
          brFeatures.push(f);
      }
      this.children = [];
      this.children.push(new QuadLevel(options, level+1, tl, tlFeatures));
      this.children.push(new QuadLevel(options, level+1, tr, trFeatures));
      this.children.push(new QuadLevel(options, level+1, bl, blFeatures));
      this.children.push(new QuadLevel(options, level+1, br, brFeatures));
      this.asyncUnion = null;
    }
  }

  private featureInBox(box: BB.BoundBox, f: WrappedPoly): boolean
  {
    return BB.boundboxIntersects(box, f.box);
  }

  union(): any
  {
    if (this.asyncUnion == null)
    {
      if (this.children == null)
        this.asyncUnion = unionPolys(this.features);
      else
        this.asyncUnion = unionPolys(this.children.map((q: QuadLevel) => q.union()));
    }
    return this.asyncUnion;
  }

  get isempty(): boolean
  {
    return this.children == null && this.features.length == 0;
  }

  tickUnion(tickCounter: TickCounter): void
  {
    if (!this.isempty && this.asyncUnion == null)
    {
      if (this.children == null)
      {
        if (tickCounter.ticks != 0)
        {
          this.union();
          tickCounter.ticks--;
        }
      }
      else
      {
        for (let i: number = 0; i < this.children.length && tickCounter.ticks != 0; i++)
          this.children[i].tickUnion(tickCounter);

        // If tickCounter hasn't gone to zero, we fully computed children, go ahead and compute union here.
        if (tickCounter.ticks != 0)
        {
          this.union();
          tickCounter.ticks--;
        }
      }
    }
  }
}

export class FsmQuadTree extends FSM.Fsm
{
  quad: QuadLevel;
  asyncUnion: any;
  isempty: boolean;
  options: Poly.TickOptions;
  work: WorkDone;

  constructor(env: FSM.FsmEnvironment, options?: Poly.TickOptions, col?: any)
  {
    super(env);
    this.options = Util.shallowAssignImmutable(Poly.DefaultTickOptions, options);
    this.work = { nUnion: 0, nDifference: 0, ms: 0 };
    this.initialize(col);
  }

  initialize(col: any): void
  {
    this.quad = null;
    this.asyncUnion = undefined;
    this.isempty = true;

    if (col != null)
    {
      let features: any = col.features ? col.features : col;
      this.work.nUnion = features.length;
      this.isempty = features.length == 0;

      // Compute BoundBox for each feature
      let wrapped: WrappedPoly[] = features.map((f: any) => { return { box: BB.boundbox(f), p: featureCoords(f) } });

      let box = BB.boundbox(col);
      this.quad = new QuadLevel(this.options, 0, box, wrapped);
    }

    this.setState(this.isempty ? FSM.FSM_DONE : FSM.FSM_STARTING);
  }

  cancel(): any
  {
    this.quad = null;
    this.asyncUnion = undefined;
    this.isempty = true;
    this.setState(FSM.FSM_DONE);
  }

  get result(): any
  {
    if (this.asyncUnion === undefined && this.quad)
      this.asyncUnion = this.quad.union();
    return this.asyncUnion;
  }

  tick(): void
  {
    if (this.ready)
    {
      switch (this.state)
      {
        case FSM.FSM_STARTING:
          this.setState(FSM.FSM_PENDING);
          break;

        case FSM.FSM_PENDING:
          let tickCounter: TickCounter = { ticks: this.options.tickStep }
          let elapsed = new Util.Elapsed();
          if (!this.isempty && this.asyncUnion === undefined)
          {
            this.quad.tickUnion(tickCounter);
            if (tickCounter.ticks != 0)
              this.result;
          }
          this.work.ms += elapsed.ms();
          if (this.asyncUnion !== undefined)
            this.setState(FSM.FSM_DONE);
          else
            this.setState(FSM.FSM_PENDING);
          break;
      }
    }
  }
}
