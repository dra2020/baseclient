// Shared libraries
import * as Util from '../util/all';

// States (note these are no longer bit flags - most uses create custom values incrementally from CUSTOM1)
export const FSM_STARTING: number = 0;
export const FSM_PENDING: number  = 1<<0;
export const FSM_DONE: number     = 1<<1;
export const FSM_ERROR: number    = 1<<2;
export const FSM_CANCEL: number   = 5;
export const FSM_RELEASED: number = 1<<3;
export const FSM_CUSTOM1: number  = 1<<4;
export const FSM_CUSTOM2: number  = 1<<5;
export const FSM_CUSTOM3: number  = 1<<6;
export const FSM_CUSTOM4: number  = 1<<7;
export const FSM_CUSTOM5: number  = 1<<8;
export const FSM_CUSTOM6: number  = 1<<9;
export const FSM_CUSTOM7: number  = 1<<10;
export const FSM_CUSTOM8: number  = 1<<11;
export const FSM_CUSTOM9: number  = 1<<12;

// polyfill
let doLater: any = global && global.setImmediate ? setImmediate : (cb: any) => { setTimeout(cb, 0) };

function FsmDone(s: number): boolean
{
  return (s === FSM_DONE || s === FSM_ERROR || s === FSM_RELEASED || s === FSM_CANCEL);
}

function FsmStateToString(state: number): string
{
  let a: string[] = [];

  if (state === FSM_STARTING)
    return 'starting';
  else
  {
    if (state === FSM_PENDING) a.push('pending');
    if (state === FSM_DONE) a.push('done');
    if (state === FSM_ERROR) a.push('error');
    if (state === FSM_RELEASED) a.push('released');
    if (state === FSM_CUSTOM1) a.push('custom1');
    if (state === FSM_CUSTOM2) a.push('custom2');
    if (state === FSM_CUSTOM3) a.push('custom3');
    if (state === FSM_CUSTOM4) a.push('custom4');
    if (state === FSM_CUSTOM5) a.push('custom5');
    if (state === FSM_CUSTOM6) a.push('custom6');
    if (state === FSM_CUSTOM7) a.push('custom7');
    if (state === FSM_CUSTOM8) a.push('custom8');
    if (state === FSM_CUSTOM9) a.push('custom9');
    return a.join('|');
  }
}

export type FsmIndex = Set<Fsm>;

export class FsmManager
{
  theId: number;
  theEpoch: number;
  bTickSet: boolean;
  theTickList: FsmIndex;
  theBusyLoopCount: number;

  constructor()
  {
    this.theId = 0;
    this.theEpoch = 0;
    this.bTickSet = false;
    this.theTickList = new Set<Fsm>();
    this.theBusyLoopCount = 0;
    this.doTick = this.doTick.bind(this);
  }

  forceTick(fsm: Fsm): void
  {
    this.theTickList.add(fsm);
    if (! this.bTickSet)
    {
      this.bTickSet = true;
      doLater(this.doTick);
    }
  }

  doTick(): void
  {
    this.bTickSet = false;
    let nLoops = 0;

    while (nLoops < 1 && this.theTickList.size > 0)
    {
      nLoops++;
      let thisTickList = this.theTickList;
      this.theTickList = new Set<Fsm>();

      thisTickList.forEach((f: Fsm) => f.tick());
    }

    if (this.theTickList.size == 0)
      this.theBusyLoopCount = 0;
    else
      this.theBusyLoopCount++;

    this.theEpoch++;
  }
}

export interface FsmEnvironment
{
  fsmManager: FsmManager;
}

export class Fsm
{
  id: number;
  state: number;
  dependentError: boolean;
  epochDone: number;
  _env: FsmEnvironment;
  _waitOn: FsmIndex;
  _waitedOn: FsmIndex;

  constructor(env: FsmEnvironment)
    {
      this._env = env;
      this.id = this.manager.theId++;
      this.state = FSM_STARTING;
      this.dependentError = false;
      this.epochDone = -1;
      this._waitOn = new Set<Fsm>();
      this._waitedOn = new Set<Fsm>();
      this.manager.forceTick(this);
    }

  get env(): FsmEnvironment { return this._env; }
  get manager(): FsmManager { return this.env.fsmManager; }

  get done(): boolean { return FsmDone(this.state) }

  get ready(): boolean { return !this.done && this.nWaitOn == 0 }

  get iserror(): boolean { return this.state === FSM_ERROR || this.state === FSM_CANCEL }

  get isDependentError(): boolean { return this.dependentError }

  // Override if you need to do more than marking complete
  cancel(): void { this.setState(FSM_CANCEL) }

  setDependentError(): void { this.dependentError = true }

  clearDependentError(): void { this.dependentError = false }

  get ticked(): boolean { return this.done && this.manager.theEpoch > this.epochDone }

  get nWaitOn(): number { return this._waitOn.size }

  get nWaitedOn(): number { return this._waitedOn.size }

  waitOn(fsm: Fsm | Fsm[]): Fsm
  {
    if (fsm == null)
      return this;
    else if (Array.isArray(fsm))
    {
      fsm.forEach((f: Fsm) => this.waitOn(f));
    }
    else
    {
      if (fsm.done)
      {
        // If dependency is already done, don't add to waitOn list but ensure that
        // this Fsm gets ticked during next epoch. This is because the dependent tick
        // only happens when the dependency state is changed.
        this.manager.forceTick(this);
        if (fsm.iserror)
          this.setDependentError();
      }
      else
      {
        this._waitOn.add(fsm);
        fsm._waitedOn.add(this);
      }
    }
    return this;
  }

  setState(state: number): void
  {
    this.state = state;
    if (this.done)
    {
      // Loop because completion might add more to wait list
      while (this.nWaitedOn)
      {
        let waitedOn = this._waitedOn;
        this._waitedOn = new Set<Fsm>();
        waitedOn.forEach((f: Fsm) => { f._completed(this); this.manager.forceTick(f) });
      }

      this.epochDone = this.manager.theEpoch;
    }
    this.manager.forceTick(this);
  }

  // Can override if need to do more here
  end(state: number = FSM_DONE): void
  {
    this.setState(state);
  }

  // Override if subclass needs to respond to individual items completing rather than waiting
  // in tick. Useful to avoid O(n^2) if waiting on lots of items and not wanting to do a linear
  // scan for completed FSMs. Or to not require separate bookkeeping for list of dependents.
  waitOnCompleted(f: Fsm): void { }

  _completed(f: Fsm): void
  {
    if (f.iserror) this.setDependentError();
    if (f.done && this._waitOn.has(f))
    {
      this._waitOn.delete(f);
      this.waitOnCompleted(f);
    }
  }

  tick(): void
  {
  }
}

// Launches callback provided when the associated Fsm (or Fsm array) completes.
export class FsmOnDone extends Fsm
{
  cb: any;
  fsm: Fsm | Fsm[];

  constructor(env: FsmEnvironment, fsm: Fsm | Fsm[], cb: any)
    {
      super(env);
      this.waitOn(fsm);
      this.fsm = fsm;
      this.cb = cb;
    }

  tick(): void
    {
      if (this.ready && this.state == FSM_STARTING)
      {
        this.setState(this.isDependentError ? FSM_ERROR : FSM_DONE);
        this.cb(this.fsm);
      }
    }
}

export class FsmSleep extends Fsm
{
  delay: number;
  timeoutHandle: any;

  constructor(env: FsmEnvironment, delay: number)
    {
      super(env);
      this.delay = delay;
    }

  tick(): void
    {
      // This allows canceling by simply setting state to done
      if (this.done && this.timeoutHandle !== undefined)
      {
        clearTimeout(this.timeoutHandle);
        delete this.timeoutHandle;
      }
      else if (this.ready && this.state === FSM_STARTING)
      {
        this.setState(FSM_PENDING);
        this.timeoutHandle = setTimeout(() => {
            delete this.timeoutHandle;
            this.setState(FSM_DONE)
          }, this.delay);
      }
    }
}

export type SerializerIndex = { [key: string]: Fsm };

export class FsmSerializer extends Fsm
{
  index: SerializerIndex;

  constructor(env: FsmEnvironment)
    {
      super(env);
      this.index = {};
    }

  serialize(id: string, fsm?: Fsm): Fsm
    {
      let prev = this.index[id];
      if (prev && !fsm) return prev;
      if (prev !== undefined)
        fsm.waitOn(prev);
      this.index[id] = fsm;
      if (this.done)
        this.setState(FSM_STARTING);
      this.waitOn(fsm);
      return prev;
    }

  tick(): void
    {
      // If fully quiescent, take advantage to clear the waiting cache.
      if (this.ready && this.state == FSM_STARTING)
      {
        this.index = {};
        this.setState(FSM_DONE);
      }
    }
}

// The FsmTracker class provides a mechanism for serializing a set of finite state
// machines identified by a consistent unique identifier. A finite state machine is
// "tracked" until completion. If any other finite state machine calls "maybeWait"
// while any other are tracked and pending, that FSM will wait for the others to
// complete.
//

class FsmTrackerWrap extends Fsm
{
  index: FsmTracker;
  uid: string;
  fsm: Fsm;

  constructor(env: FsmEnvironment, index: FsmTracker, uid: string, fsm: Fsm)
    {
      super(env);
      this.index = index;
      this.uid = uid;
      this.fsm = fsm;
      index._track(uid, fsm);
      this.waitOn(fsm);
    }

  tick(): void
    {
      if (this.ready && this.state == FSM_STARTING)
      {
        this.index._untrack(this.uid, this.fsm);
        this.setState(FSM_DONE);
      }
    }
}

type FsmArrayMap = { [key: string]: Fsm[] };

export class FsmTracker
{
  env: FsmEnvironment;
  map: FsmArrayMap;

  constructor(env: FsmEnvironment)
    {
      this.env = env;
      this.map = {};
    }

  _track(uid: string, fsm: Fsm): void
    {
      let a = this.map[uid];
      if (a === undefined)
      {
        a = [];
        this.map[uid] = a;
      }
      a.push(fsm);
    }

  _untrack(uid: string, fsm: Fsm): void
    {
      let a = this.map[uid];
      if (a)
      {
        for (let i: number = 0; i < a.length; i++)
          if (a[i] === fsm)
          {
            if (a.length == 1)
              delete this.map[uid];
            else
              a.splice(i, 1);
            break;
          }
      }
    }

  track(uid: string, fsm: Fsm): Fsm
    {
      return new FsmTrackerWrap(this.env, this, uid, fsm);
    }

  maybeWait(uid: string, fsm: Fsm): void
    {
      fsm.waitOn(this.map[uid]);
    }
}


// FsmLoop: repeat the Fsm passed in (resetting to STARTING state after finished) at some minimum interval.
//  Assumes that the Fsm can be correctly reset and restarted by setting the state.
//

export interface LoopOptions
{
  minRepeatInterval?: number;
  exitOnError?: boolean;
}

export const DefaultLoopOptions = { minRepeatInterval: 0, exitOnError: true };

const FSM_DELAYING = FSM_CUSTOM1;

export class FsmLoop extends Fsm
{
  fsm: Fsm;
  options: LoopOptions;
  elapsed: Util.Elapsed;

  constructor(env: FsmEnvironment, fsm: Fsm, options?: LoopOptions)
  {
    super(env);
    this.fsm = fsm;
    this.elapsed = new Util.Elapsed();
    this.options = Util.shallowAssignImmutable(DefaultLoopOptions, options);
    this.waitOn(fsm);
  }

  tick(): void
  {
    if (this.ready && this.isDependentError)
    {
      if (this.options.exitOnError)
        this.setState(FSM_ERROR);
      else
        this.clearDependentError();
        // Fall through
    }

    if (this.ready)
    {
      switch (this.state)
      {
        case FSM_STARTING:
          let msLeft = this.options.minRepeatInterval - this.elapsed.ms();
          if (msLeft > 0)
            this.waitOn(new FsmSleep(this.env, msLeft));
          this.setState(FSM_DELAYING);
          break;

        case FSM_DELAYING:
          this.elapsed.start();
          this.fsm.setState(FSM_STARTING);
          this.waitOn(this.fsm);
          this.setState(FSM_STARTING);
          break;
      }
    }
  }
}

export interface ISet
{
  test: (o: any) => boolean;
  reset: () => void;
}

export class FsmArray extends Fsm
{
  a: any[];
  iset: ISet;

  constructor(env: FsmEnvironment, iset?: ISet)
  {
    super(env);
    this.iset = iset;
    this.a = [];
  }

  push(o: any): void
  {
    if (this.iset == null || !this.iset.test(o))
    {
      if (! this.done) this.setState(FSM_DONE);
      this.a.push(o);
    }
  }

  concat(a: any[]): void
  {
    if (a)
    {
      for (let i: number = 0; i < a.length; i++)
        this.push(a[i]);
    }
  }

  splice(i?: number, n?: number): void
  {
    if (i === undefined)
      this.reset();
    else
    {
      this.a.splice(i, n);
      if (this.a.length == 0)
        this.reset();
    }
  }

  reset(): void
  {
    this.a = [];
    if (this.iset) this.iset.reset();
    this.setState(FSM_STARTING);
  }
}
