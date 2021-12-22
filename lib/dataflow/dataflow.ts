//
// DataFlow: mechanism for setting up a data-flow dependency graph that gets computed on demand.
//
//  Semantics are these:
//    1. The simplest "atomic" DataFlow object just has an id() and a value(). The id() is used to check for exact
//       equivalence when determining if any dependents need to be recomputed. id() and value() might be the same
//       for something that just creates a new whole object when recomputed. In other cases, id() might represent a
//       hash or changestamp/timestamp that is distinct from the value(). The value may or may not be "ready" as well.
//       If the value is not "ready", no dependents can be computed.
//    2. A DataFlow object can record that it "uses" another DataFlow object. If it does, it can use a set of helper
//       routines to track the state of its dependents. When its dependents are all ready(), it remembers their ids
//       and can later test if they are stale.
//
//

interface UseItem
{
  df: DataFlow,
  id?: any,
}

export class DataFlow
{
  usesList: UseItem[];

  constructor()
  {
    this.usesList = [];
  }

  // override in subclass
  id(): any { return null }
  value(): any { return null }

  uses(df: DataFlow): void
  {
    this.usesList.push({ df: df });
  }

  usesStale(): boolean
  {
    let isstale = false;
    this.usesList.forEach(ui => { if (ui.id !== ui.df.id()) isstale = true });
    return isstale;
  }

  usesRemember(): void
  {
    this.usesList.forEach(ui => { ui.id = ui.df.id() });
  }

  ifcompute(): void
  {
    if (this.usesStale())
    {
      this.usesRemember();
      this.compute();
    }
  }

  compute(): void
  {
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

  id(): any { if (!this._value) this._value = this._cb(); return this._value }
  value(): any { return this.id() }
}
