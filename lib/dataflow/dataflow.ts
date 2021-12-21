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
  name: string,
  df: DataFlow,
  id?: any,
}

export class DataFlow
{
  uniquename: number;
  usesList: { [name: string]: UseItem };

  constructor()
  {
    this.usesList = {};
    this.uniquename = 1;
  }

  // override in subclass
  ready(): boolean { return this.usesReady() }
  id(): any { return null }
  value(): any { return null }

  uses(df: DataFlow, name?: string): void
  {
    if (!name) name = `_df_${this.uniquename++}`;
    this.usesList[name] = { name: name, df: df };
  }

  find(name: string): DataFlow
  {
    let ui = this.usesList[name];
    return ui ? ui.df : undefined;
  }

  findValue(name: string): any
  {
    let df = this.find(name);
    return df ? df.value() : undefined;
  }

  usesReady(): boolean
  {
    let isready = true;
    Object.values(this.usesList).forEach((ui: UseItem) => { if (!ui.df.ready()) isready = false });
    return isready;
  }

  usesStale(): boolean
  {
    let isstale = false;
    Object.values(this.usesList).forEach((ui: UseItem) => { if (ui.df.id !== ui.df.id()) isstale = true });
    return isstale;
  }

  usesRemember(): void
  {
    Object.values(this.usesList).forEach((ui: UseItem) => { ui.df.id = ui.df.id() });
  }
}

// Takes callback that, when ready, returns non-null. The return value is both the value and the id.
export class DataFlowNonNull extends DataFlow
{
  _value: any;
  _cb: () => any;

  constructor(cb: () => any)
  {
    super();
    this._cb = cb;
  }

  ready(): boolean
  {
    // Allow chaining
    if (!this.usesReady())
      return false;

    // Real core semantics, with chaining on stale
    if (!this._value || this.usesStale())
    {
      this._value = this._cb();
      if (this._value) this.usesRemember();
    }
    return !!this._value;
  }

  id(): any { return this.ready(), this._value }
  value(): any { return this.ready(), this._value }
}
