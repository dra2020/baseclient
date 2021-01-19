import * as Util from '../util/all';
import * as FSM from '../fsm/all';

export interface ILog
{
  dump: () => FSM.Fsm;
  stamp: (o: any) => void;
  log: (o: any, verbosity?: number) => void;
  event: (o: any, verbosity?: number) => void;
  error: (o: any) => void;
  value: (o: any, verbosity?: number) => void;
  chatter: (s: string) => void;
  chatters: () => string[];
}

export class Timer
{
  ilog: ILog;
  o: any;
  verbosity: number;
  elapsed: Util.Elapsed;

  constructor(ilog: ILog, kind: string, o: any, verbosity: number = 0)
  {
    this.ilog = ilog;
    if (typeof o === 'string') o = { event: o };
    this.o = o;
    this.o.kind = kind;
    this.verbosity = verbosity;
    this.elapsed = new Util.Elapsed();
  }

  log(): void
  {
    this.elapsed.end();
    this.o.ms = this.elapsed.ms();
    this.ilog.log(this.o, this.verbosity);
  }
}

export class AsyncTimer extends Timer
{
  constructor(ilog: ILog, o: any, verbosity: number = 0)
  {
    super(ilog, 'async', o, verbosity);
  }
}

export class SyncTimer extends Timer
{
  constructor(ilog: ILog, o: any, verbosity: number = 0)
  {
    super(ilog, 'sync', o, verbosity);
  }
}
