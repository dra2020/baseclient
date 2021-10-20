const BitLookup = [ 1, 2, 4, 8, 16, 32, 64, 128 ];

export class ListToBitset
{
  list: string[];
  index: { [s: string]: number };
  size: number;

  constructor(list: string[])
  {
    this.list = list;
    this.index = {};
    this.size = Math.floor((this.list.length+7)/8);
    this.list.forEach((s: string, i: number) => { this.index[s] = i });
  }

  toBits(l: string[]): Uint8Array
  {
    let ab = new ArrayBuffer(this.size);
    let u8 = new Uint8Array(ab);
    if (l) l.forEach(s => {
        let n = this.index[s];
        let i = Math.floor(n/8);
        u8[i] |= BitLookup[n % 8];
      });
    return u8;
  }

  toList(u8: Uint8Array): string[]
  {
    let list: string[] = [];
    for (let i = 0; i < u8.length; i++)
    {
      let u = u8[i];
      if (u)
      {
        if (u & 1) list.push(this.list[i*8+0]);
        if (u & 2) list.push(this.list[i*8+1]);
        if (u & 4) list.push(this.list[i*8+2]);
        if (u & 8) list.push(this.list[i*8+3]);
        if (u & 16) list.push(this.list[i*8+4]);
        if (u & 32) list.push(this.list[i*8+5]);
        if (u & 64) list.push(this.list[i*8+6]);
        if (u & 128) list.push(this.list[i*8+7]);
      }
    }
    return list;
  }
}
