//
// DataFlow: mechanism for setting up a data-flow dependency graph that gets computed on demand.
//
//  Semantics are these:
//    1. The simplest "atomic" DataFlow object just has an id(). The id() is used to check for exact
//       equivalence when determining if any dependents need to be recomputed.
//    2. A DataFlow object can record that it "uses" another DataFlow object. If it does, it can use a set of helper
//       routines to track the state of its dependents. When its dependents are "stale" (have changed) the computation
//       needs to be run.
//
//

export interface IDataFlow
{
  dfid: () => any;
}

interface UseItem
{
  name?: string;
  df: IDataFlow,
  id?: any,
  wasstale?: boolean,
}

export class DataFlow
{
  usesList: UseItem[];

  constructor()
  {
    this.usesList = [];
  }

  // override in subclass
  dfid(): any { return null }

  // override in subclass
  compute(): void
  {
  }

  uses(df: IDataFlow, name?: string): void
  {
    this.usesList.push({ name: name, df: df });
  }

  usesStale(): boolean
  {
    let isstale = false;
    this.usesList.forEach(ui => {
        ui.wasstale = ui.id !== ui.df.dfid();
        if (ui.wasstale) isstale = true;
      });
    return isstale;
  }

  wasStale(name: string): boolean
  {
    let ui: UseItem = this.usesList.find((ui: UseItem) => ui.name === name);
    return ui != null && ui.wasstale;
  }

  usesRemember(): void
  {
    this.usesList.forEach(ui => { ui.id = ui.df.dfid() });
  }

  ifcompute(): void
  {
    if (this.usesStale())
    {
      this.usesRemember();
      this.compute();
    }
  }
}

// Takes callback that, eventually, returns non-null. The return value is both the value and the id.
// Once the value returns non-null, the callback is never called again.
export class DataFlowCallback extends DataFlow
{
  _value: any;
  _cb: () => any;

  constructor(cb: () => any)
  {
    super();
    this._cb = cb;
  }

  dfid(): any { if (!this._value) this._value = this._cb(); return this._value }
}

// Simple helper that maintains a simple monotonically increasing stamp
export class DataFlowStamp extends DataFlow
{
  _stamp: number;

  constructor()
  {
    super();
    this._stamp = 0;
  }

  dfid(): any { return this._stamp }

  stamp(): void { this._stamp++ }
}
