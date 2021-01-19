import * as Util from '../util/all';

export type ContextValues = { [key: string]: any };
export interface IContext
{
  setDefaults: (o: ContextValues) => void
  setValues: (o: ContextValues) => void
  xvalue: (prop: string) => any
  xset: (prop: string) => boolean
  xflag: (prop: string) => boolean
  xnumber: (prop: string) => number
  xstring: (prop: string) => string
}

class Context implements IContext
{
  private values: ContextValues;
  private defaults: ContextValues;

  constructor()
  {
    this.values = {};
    this.defaults = {};
  }

  setValues(o: ContextValues): void
  {
    this.values = Util.shallowAssignImmutable(this.values, o);
  }

  setDefaults(o: ContextValues): void
  {
    this.defaults = Util.shallowAssignImmutable(this.defaults, o);
  }

  xvalue(prop: string): any
  {
    let v: any = this.values[prop];
    if (v === undefined && process && process.env)
      v = process.env[prop.toUpperCase()];
    if (v === undefined)
      v = this.defaults[prop];
    return v;
  }

  xset(prop: string): boolean
  {
    let v: any = this.values[prop];
    if (v === undefined && process && process.env)
      v = process.env[prop.toUpperCase()];
    return v !== undefined;
  }

  xflag(prop: string): boolean
  {
    let v: any = this.xvalue(prop);
    if (v === undefined || v === null)
      return false;
    return Number(v) != 0;
  }

  xnumber(prop: string): number
  {
    let v: any = this.xvalue(prop);
    if (v === undefined || v === null)
      return 0;
    return Number(v);
  }

  xstring(prop: string): string
  {
    let v: any = this.xvalue(prop);
    if (v === undefined || v === null)
      return null;
    return String(v);
  }
}

export function create(): IContext
{
  return new Context();
}
