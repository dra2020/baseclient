export type DateString = string;
export function Now(): DateString { return (new Date()).toJSON(); }

// polyfill
let hrtime: any = global && global.process && global.process.hrtime ? global.process.hrtime : null;

export class Elapsed
{
  tStart: any;
  tDur: any;

  constructor(bStart: boolean = true)
  {
    this.tStart = undefined;
    this.tDur = undefined;
    if (bStart) this.start();
  }

  start(): void
  {
    if (hrtime)
      this.tStart = hrtime();
    else
      this.tStart = performance.now();
    if (this.tDur) this.tDur = undefined;
  }

  end(): void
  {
    if (this.tStart === undefined) this.start();
    if (hrtime)
      this.tDur = hrtime(this.tStart);
    else
      this.tDur = performance.now() - this.tStart;
  }

  ms(): number
  {
    if (this.tDur === undefined) this.end();
    if (hrtime)
      return Math.round((this.tDur[0]*1000) + (this.tDur[1]/1000000));
    else
      return this.tDur;
  }

  nano(): number
  {
    if (this.tDur === undefined) this.end();
    if (hrtime)
      return (this.tDur[0]*1000000000) + this.tDur[1];
    else
      return this.tDur * 1000000;
  }
}

export class MultiTimer
{
  _overall: Elapsed;
  _segment: Elapsed;
  _msAggregate: number;

  constructor(bStart: boolean = true)
  {
    this._overall = new Elapsed(bStart);
    this._segment = new Elapsed(bStart);
    this._msAggregate = 0;
  }

  start(): void
  {
    this._overall.start();
    this._segment = new Elapsed();
    this._msAggregate = 0;
  }

  end(): number
  {
    this._overall.end();
    this.segend();
    return this._overall.ms();
  }

  segstart(): void
  {
    this._segment = new Elapsed();
  }

  segend(): number
  {
    let ms = 0;
    if (this._segment)
    {
      ms = this._segment.ms();
      this._msAggregate += ms;
      this._segment = null;
    }
    return ms;
  }

  get overall(): number { return this._overall.ms() }
  get aggregate(): number { return this._msAggregate }
}

export class Deadline
{
  msDelta: number;
  elapsed: Elapsed;

  constructor(msDelta: number)
  {
    this.msDelta = msDelta;
    this.elapsed = new Elapsed();
  }

  start(): void
  {
    this.elapsed.start();
  }

  done(): boolean
  {
    this.elapsed.end();
    return this.elapsed.ms() > this.msDelta;
  }
}

export function createGuid(): string
{
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

export function createKeyedGuid(key: string): string
{
    return `xxxxxxxx-xxxx-${key}xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

export function guidKey(guid: string): string
{
  return guid.substr(14, 1);  // See above
}

type LoopTest = WeakMap<any,boolean>;

function _sizeof(a: any, loops: LoopTest): number
{
  if (a === null || a === undefined) return 0;

  switch (typeof a)
  {
    default:        return 0;
    case 'number':  return 8;
    case 'boolean': return 4;
    case 'string':  return a.length * 2;

    case 'object':
      {
        if (loops.has(a))
          return 0;
        else
          loops.set(a, true);

        let t: number = 0;
        if (Array.isArray(a))
        {
          for (let i: number = 0; i < a.length; i++)
            t += _sizeof(a[i], loops);
          t += 8; // length
        }
        else if (Buffer && Buffer.isBuffer(a))
        {
          t = a.length;
        }
        else if (a.hasOwnProperty === undefined)
          return t;
        else
        {
          for (var key in a) if (a.hasOwnProperty && a.hasOwnProperty(key))
          {
            t += _sizeof(key, loops); // this is a good estimate of download size, but poor estimate of internal size
                              // because of JS object templating vs. naive hashtables
            t += _sizeof(a[key], loops);
          }
        }
        return t;
      }
  }
}

export function sizeof(a: any): number
{
  let loops: LoopTest = new WeakMap();
  let n: number = _sizeof(a, loops);
  return n;
}

export function depthof(a: any): number
{
  if (a === null || a === undefined) return 1;

  switch (typeof a)
  {
    default:        return 1;
    case 'number':  return 1;
    case 'boolean': return 1;
    case 'string':  return 1;

    case 'object':
      {
        let d: number = 0;
        if (Array.isArray(a))
          return a.length > 0 ? (1 + depthof(a[0])) : 2;    // still return 2 for empty array
        else if (Buffer && Buffer.isBuffer(a))
          return 2;
        else if (a.hasOwnProperty === undefined)
          return 1;
        else
        {
          for (var key in a) if (a.hasOwnProperty(key))
            return 1 + depthof(a[key]);
          return 2; // or 2 for empty object
        }
      }
  }
}
export function isEmpty(o: any): boolean
{
  if (o === null || o === undefined) return true;
  for (var p in o) if (o.hasOwnProperty(p)) return false;
  return true;
}

export function countKeys(o: any): number
{
  if (o === undefined || typeof o !== 'object') return -1;

  let count: number = 0;
  for (let p in o) if (o.hasOwnProperty(p))
    count++;
  return count;
}

export function nthProperty(o: any, n: number = 0): any
{
  for (let p in o) if (o.hasOwnProperty(p))
  {
    if (n <= 0) return o[p];
    n--;
  }
  return undefined;
}

export function nthKey(o: any, n: number = 0): any
{
  for (let p in o) if (o.hasOwnProperty(p))
  {
    if (n <= 0) return p;
    n--;
  }
  return undefined;
}

export function partialEqual(o: any, subset: any): boolean
{
  for (let p in subset) if (subset.hasOwnProperty(p))
    if (o[p] !== subset[p])
      return false;
  return true;
}

export interface EqOptions
{
  omitKey?: { [key: string]: boolean },
  unorderedArrays?: boolean,
  emptyStringIsNull?: boolean,
  epsilon?: number,
}

function exactEqual(o1: any, o2: any, options?: EqOptions): boolean
{
  if (o1 === o2) return true;
  if (options && options.epsilon && typeof o1 === 'number' && typeof o2 === 'number' && Math.abs(o1-o2) < options.epsilon) return true;
  if (options && options.emptyStringIsNull)
    if ((o1 == null && o2 == '') || (o2 == null && o1 == ''))
      return true;
  return false;
}

export function deepEqual(o1: any, o2: any, options?: EqOptions): boolean
{
  // fast exit
  if (exactEqual(o1, o2, options)) return true;

  // must be same types
  if (typeof o1 !== typeof o2) return false;

  // Already tested for exact primitive equality so if not objects, not equal
  if (typeof o1 !== 'object' || o1 == null) return false;
  if (typeof o2 !== 'object' || o2 == null) return false;

  // Special case array
  if (Array.isArray(o1))
  {
    if (! Array.isArray(o2)) return false;
    if (o1.length != o2.length) return false;
    if (options && options.unorderedArrays)
    {
      o1 = o1.sort();
      o2 = o2.sort();
    }
    for (let i: number = 0; i < o1.length; i++)
      if (! deepEqual(o1[i], o2[i], options))
        return false;
    return true;
  }

  // Special case object
  if (o1.hasOwnProperty === undefined || o2.hasOwnProperty === undefined)
    return exactEqual(o1, o2, options);

  for (let p in o1) if (o1.hasOwnProperty(p))
  {
    if (options && options.omitKey && options.omitKey[p])
      continue;
    if (o2[p] === undefined)
      return false;
    if (! deepEqual(o1[p], o2[p], options))
      return false;
  }
  // If any properties in o2 aren't in o1, not equal
  for (let p in o2) if (o2.hasOwnProperty(p))
  {
    if (options && options.omitKey && options.omitKey[p])
      continue;
    if (o1[p] === undefined)
      return false;
  }

  return true;
}

const Months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];

export function prettyDate(d: Date): string
{
  if (d == null) return 'unknown';

  let mmm = Months[d.getMonth()];
  let dd = d.getDate();
  let yyyy = d.getFullYear();
  let hh = d.getHours();
  let m = d.getMinutes();
  let mm = m < 10 ? `0${m}` : String(m);
  let ampm = hh >= 12 ? 'PM' : 'AM';
  if (hh > 12) hh -= 12;

  return `${mmm} ${dd}, ${yyyy} at ${hh}:${mm} ${ampm}`;
}

export function relativeDate(d: Date): string
{
  if (d == null) return 'unknown';
  let now = new Date();
  let yyyyNow = now.getFullYear();
  let mmmNow = Months[now.getMonth()];
  let ddNow = now.getDate();

  let mmm = Months[d.getMonth()];
  let dd = d.getDate();
  let yyyy = d.getFullYear();
  let hh = d.getHours();
  let m = d.getMinutes();
  let mm = m < 10 ? `0${m}` : String(m);
  let ampm = hh >= 12 ? 'PM' : 'AM';
  if (hh > 12) hh -= 12;

  if (yyyyNow === yyyy && mmmNow === mmm && ddNow === dd)
    return `Today at ${hh}:${mm} ${ampm}`;
  else if (yyyyNow === yyyy)
    return `${mmm} ${dd}`;
  else
    return `${mmm} ${dd}, ${yyyy}`;
}

const OneMinute = 1000 * 60;
const OneHour = OneMinute * 60;
const OneDay = OneHour * 24;

export function recentDate(d: Date): string
{
  if (d == null) return 'u';
  let now = new Date();
  let msNow = now.getTime();
  let msThen = d.getTime();
  let msDelta = msNow - msThen;

  // Within the hour, display in minutes
  if (msDelta < OneHour)
    return `${Math.round(msDelta/OneMinute)+1}m`;

  // Within the day, display in hours
  else if (msDelta < OneDay)
    return `${Math.round(msDelta/OneHour)+1}h`;

  // Otherwise, display using relativeDate
  else
    return relativeDate(d);
}

export function textToHtml(sText: string): string
{
  let lines: string[] = sText.split('\n');
  let aHtml: string[] = [];
  let inTable: boolean = false;
  aHtml.push('<body>');
  for (let i: number = 0; i < lines.length; i++)
  {
    let line = lines[i];
    let isRow: boolean = line.indexOf('|') === 0;
    if (inTable && !isRow)
    {
      aHtml.push('</tbody></table>');
      inTable = false;
    }
    if (isRow && !inTable)
    {
      inTable = true;
      aHtml.push('<table border="1" cellspacing="0" cellpadding="2"><tbody>');
    }
    if (isRow)
    {
      let cells = line.split('|');
      if (cells.length > 2)
      {
        aHtml.push('<tr>');
        for (let j: number = 1; j < cells.length-1; j++)
          aHtml.push(`<td>${cells[j]}</td>`);
        aHtml.push('</tr>');
      }
    }
    else
      aHtml.push(`<div>${line}&nbsp;</div>`);
  }
  if (inTable)
    aHtml.push('</tbody></table>');
  aHtml.push('</body>');
  return aHtml.join('');
}

export function shallowCopy(src: any): any
{
  if (src === null || src === undefined) return src;

  switch (typeof src)
  {
    case 'boolean':
    case 'number':
    case 'string':
    case 'symbol':
    case 'function':
    default:
      return src;

    case 'object':
      if (Array.isArray(src))
        return src.slice();
      else
      {
        let copy: any = {};

        for (var p in src) if (src.hasOwnProperty(p))
          copy[p] = src[p];
        return copy;
      }
  }
}

export function shallowAssign(o1: any, o2: any): any
{
  if (o1 === null || o1 === undefined) o1 = {};
  if (o2 === null || o2 === undefined) return o1;
  if (typeof o2 !== 'object' || typeof o1 !== 'object') return o1;

  for (var p in o2) if (o2.hasOwnProperty(p))
    o1[p] = o2[p];
  return o1;
}

export function shallowDelete(o1: any, o2: any): any
{
  if (o1 == null || o2 == null) return o1;
  if (typeof o2 !== 'object' || typeof o1 !== 'object') return o1;

  for (var p in o2) if (o2.hasOwnProperty(p))
    delete o1[p];
  return o1;
}

export function shallowAssignImmutable(o1: any, o2: any): any
{
  if (o1 === null || o1 === undefined) o1 = {};
  if (o2 === null || o2 === undefined) return o1;
  if (typeof o2 !== 'object' || typeof o1 !== 'object') return o1;

  // First determine whether o2 changes any properties, if it has, make new instance
  let oNew: any = o1;
  for (let p in o2) if (o2.hasOwnProperty(p))
  {
    if (o1[p] != o2[p])
    {
      oNew = shallowCopy(o1);
      break;
    }
  }
  if (oNew !== o1)
    shallowAssign(oNew, o2);
  return oNew;
}

export function shallowEqual(o1: any, o2: any): boolean
{
  if (o1 === undefined || o2 === undefined || typeof o1 !== 'object' || typeof o2 !== 'object')
    return o1 === o2;

  if (Array.isArray(o1) && Array.isArray(o2))
  {
    if (o1.length != o2.length) return false;
    for (let i: number = 0; i < o1.length; i++)
      if (o1[i] !== o2[i]) return false;
    return true;
  }
  else
  {
    let p: any;

    for (p in o1) if (o1.hasOwnProperty(p))
      if (o1[p] !== o2[p]) return false;
    for (p in o2) if (o2.hasOwnProperty(p))
      if (o1[p] === undefined) return false;
    return true;
  }
}

export function deepCopy(src: any): any
{
  // Beware typeof oddities
  if (src === null || src === undefined) return src;

  if (typeof src === 'object')
  {
    if (Array.isArray(src))
    {
      let dst: any[] = [];

      for (let i: number = 0; i < src.length; i++)
        dst.push(deepCopy(src[i]));
      return dst;
    }
    else
    {
      if (src.hasOwnProperty === undefined)
        return src;

      let dst: any = {};
      for (var p in src) if (src.hasOwnProperty(p))
        dst[p] = deepCopy(src[p]);
      return dst;
    }
  }
  else
    return src;
}

export function deepAccum(accum: any, o: any): any
{
  if (accum == null) accum = {};
  if (o == null) return accum;
  for (let p in o) if (o.hasOwnProperty(p))
  {
    let vs: any = o[p];
    let vd: any = accum[p];
    let ts = typeof vs;
    if (ts === 'number')
    {
      if (vd !== undefined && typeof vd !== 'number')
        throw 'deepAccum: unexpected type mismatch';
      if (p === 'min')
        accum[p] = vd === undefined ? vs : Math.min(vd, vs);
      else if (p === 'max')
        accum[p] = vd === undefined ? vs : Math.max(vd, vs);
      else
        accum[p] = (vd === undefined ? 0 : vd) + vs;
    }
    else if (vs == null || ts === 'string' || ts === 'boolean')
      accum[p] = vs;
    else if (ts === 'object')
    {
      if (vd === undefined)
      {
        vd = {};
        accum[p] = vd;
      }
      else if (typeof vd !== 'object')
        throw 'deepAccum: unexpected type mismatch';
      deepAccum(vd, vs);
    }
  }
  return accum;
}

export function precisionRound(n: number, p: number): number
{
  let f: number = Math.pow(10, p);
  return Math.round(n * f) / f;
}

export function percentString(num: number, den: number, precision: number = 0): string
{
  if (den == 0)
    return '(-)';

  let p: number = precisionRound((num/den) * 100, precision);

  return String(p) + '%';
}

export function hash(s: string): number
{
  let hash: number = 5381;
  let i: number = s.length;

  while (i)
    hash = (hash * 33) ^ s.charCodeAt(--i);

  /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
   * integers. Since we want the results to be always positive, convert the
   * signed int to an unsigned by doing an unsigned bitshift. */
  return hash >>> 0;
}

export function hashObject(o: any): number
{
  return hash(o ? JSON.stringify(o) : '');
}

const HexTable: string[] = [ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f' ];
export function toHex(n: number): string
{
  if (n < 0 || n > 255) throw('only 0 to 255 supported now');
  n = Math.floor(n);
  return HexTable[n >> 4] + HexTable[n & 15];
}

export function toRGBA(color: string, alpha: number): string
{
  // Allow passing rgba in rather than only '#ffffff' form
  if (color.indexOf('rgba') === 0)
    return color;

  let r: number;
  let g: number;
  let b: number;

  switch (color)
  {
    case 'white':
      r = 255; g = 255; b = 255;
      break;

    case 'black':
      r = 0; g = 0; b = 0;
      break;

    default:
      r = parseInt(color.substr(1, 2), 16);
      g = parseInt(color.substr(3, 2), 16);
      b = parseInt(color.substr(5, 2), 16);
      break;
  }

  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}

export function toRGBAIntensity(color: string, intensity: number, alpha: number): string
{
  // for now assume color is black
  let g: number = precisionRound(255 * intensity, 0);
  return `rgba(${String(g)}, ${String(g)}, ${String(g)}, ${String(alpha)})`;
}

// Geo functions
export function distance(x0: number, y0: number, x1: number, y1: number): number
{
  return Math.hypot(x0 - x1, y0 - y1);
}

export function deg2rad(num: number): number { return num * Math.PI / 180; }
export function rad2deg(num: number): number { return num / Math.PI * 180; }

// Restricts lon to range [-180..180]
export function wrapLon(lon: number): number
{
  let worlds = Math.floor((lon + 180) / 360);
  return lon - (worlds * 360);
}
