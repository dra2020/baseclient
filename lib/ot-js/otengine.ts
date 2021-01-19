import * as LogAbstract from "../logabstract/all";

import * as OT from "./ottypes";
import * as OTC from "./otcomposite";

export interface IOTEngine
{
  cid(): string;
  rid(): string;

  toPartialValue(resourceName: string): any;

  startLocalEdit(): OTC.OTCompositeResource;
  addLocalEdit(e: OTC.OTCompositeResource): void;
}

export class OTEngine implements IOTEngine
{
  ilog: LogAbstract.ILog;
  onList: any;

	// Constructor
	constructor(ilog: LogAbstract.ILog)
		{
      this.ilog = ilog;
      this.onList = {};
		}

  on(eventName: string, cb: any): void
    {
      let aCB: any = this.onList[eventName];
      if (aCB === undefined)
      {
        aCB = [];
        this.onList[eventName] = aCB;
      }
      aCB.push(cb);
    }

  off(eventName: string, cb: any): void
    {
      let aCB: any = this.onList[eventName];
      if (aCB !== undefined)
      {
        for (let i: number = 0; i < aCB.length; i++)
        {
          if (aCB[i] === cb)
          {
            aCB.splice(i, 1);
            break;
          }
        }
      }
    }

  emit(eventName: string): void
    {
      let aCB: any[] = this.onList[eventName];
      if (aCB !== undefined)
        for (let i: number = 0; i < aCB.length; i++)
          (aCB[i])();
    }

  cid(): string { return ''; }
  rid(): string { return ''; }

  toPartialValue(resourceName: string): any { return null; }

  startLocalEdit(): OTC.OTCompositeResource { return null; }
  addLocalEdit(e: OTC.OTCompositeResource): void { }
}
