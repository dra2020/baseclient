export class Emit
{
  onList: any;

  constructor()
  {
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

  emit(eventName: string, arg1?: any, arg2?: any, arg3?: any): void
  {
    let aCB: any[] = this.onList[eventName];
    if (aCB !== undefined)
      for (let i: number = 0; i < aCB.length; i++)
        (aCB[i])(arg1, arg2, arg3);
  }

  off(eventName: string, cb: any): void
  {
    let aCB: any = this.onList[eventName];
    if (aCB !== undefined)
      for (let i: number = 0; i < aCB.length; i++)
        if (aCB[i] === cb)
        {
          aCB.splice(i, 1);
          break;
        }
  }
}
