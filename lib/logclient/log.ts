import * as Context from '../context/all';
import * as LogAbstract from '../logabstract/all';
import * as Util from '../util/all';
import * as FSM from '../fsm/all';

export interface LogEnvironment
{
  context: Context.IContext;
}

class LogManager implements LogAbstract.ILog
{
  env: LogEnvironment;
  count: number;

  constructor(env: LogEnvironment)
  {
    this.env = env;
    this.count = 0;
  }

  dump(): FSM.Fsm { return null; }

  print(o: any): void
  {
    let sa: string[] = [];

    if (o._count !== undefined)
      sa.push(String(o._count));
    if (o.kind === 'error')
    {
      sa.push('error');
      sa.push(o.event);
    }
    else if (o.kind !== 'value')
    {
      sa.push('info');
      sa.push(o.event);
    }
    else
    {
      sa.push('value');
      sa.push(o.event);
      sa.push(String(o.value));
    }
    if (o.detail !== undefined)
      sa.push(o.detail);
    console.log(sa.join(': '));
  }

  stamp(o: any): void
  {
    this.log(o);
  }

  log(o: any, verbosity: number = 0): void
  {
    // Show some restraint
    if (verbosity > this.env.context.xnumber('verbosity'))
      return;

    // Inject some standard properties
    o._time = Util.Now();
    o._count = this.count++;
    if (o.kind === undefined)
      o.kind = 'misc';
    this.print(o);
  }


  event(o: any, verbosity: number = 0): void
  {
    if (typeof o === 'string') o = { event: o };
    o.kind = 'event';
    this.log(o, verbosity);
  }

  error(o: any): void
  {
    if (typeof o === 'string') o = { event: o };
    o.kind = 'error';
    this.log(o);
  }

  value(o: any, verbosity: number = 0): void
  {
    o.kind = 'value';
    this.log(o, verbosity);
  }

  chatter(s: string): void
  {
    console.log(s);
  }

  chatters(): string[]
  {
    return null;
  }
}

export function create(env: LogEnvironment): LogAbstract.ILog
{
  return new LogManager(env);
}
