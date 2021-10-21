const BitLookup = [ 1, 2, 4, 8, 16, 32, 64, 128 ];

export interface Converter
{
  atob?: (s: string) => string;
  btoa?: (s: string) => string;
}

// In NodeJS:

// {
//  btoa: (s: string) => { return Buffer.from(s, 'binary').toString('base64') },
//  atob: (s: string) => { return Buffer.from(s, 'base64').toString('binary') },
// }

// In Browser:

// {
//  btoa: window.btoa,
//  atob: window.atob,
// }

export class ListToBitset
{
  list: string[];
  index: { [s: string]: number };
  size: number;
  converter: Converter;

  constructor(list: string[], converter?: Converter)
  {
    this.list = list;
    this.converter = converter;
  }

  toBits(l: string[]): Uint8Array
  {
    if (! this.index)
    {
      this.size = Math.floor((this.list.length+7)/8);
      this.index = {};
      this.list.forEach((s: string, i: number) => { this.index[s] = i });
    }
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

  base64tou8(base64: string): Uint8Array
  {
    let raw = this.converter.atob(base64);
    let rawLength = raw.length;
    let u8 = new Uint8Array(new ArrayBuffer(rawLength));
    for (let i = 0; i < rawLength; i++)
      u8[i] = raw.charCodeAt(i);
    return u8;
  }

  u8ToBase64(u8: Uint8Array): string
  {
    let binary: string[] = [];
    let len = u8.byteLength;
    for (let i = 0; i < len; i++) {
        binary.push(String.fromCharCode(u8[i]));
    }
    return this.converter.btoa(binary.join(''));
}

  fromBitString(base64: string): string[]
  {
    return this.toList(this.base64tou8(base64));
  }

  toBitString(l: string[]): string
  {
    // Note: On server, Buffer.from(this.toBits(l)).toString('base64') probably faster
    return this.u8ToBase64(this.toBits(l));
  }
}
