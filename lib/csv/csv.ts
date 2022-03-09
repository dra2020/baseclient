import * as Util from '../util/all';

// Parse CSV. 
//    Fields are separated by commas or pipe symbol (census uses pipe separators.
//    Quoted fields may contain commas or pipes.
//    Either single quotes or double quotes may be used to surround field value.
//    Spaces at the beginning and end of fields are ignored.
//    Quotes must be the first non-space character in the field (otherwise they are part of the field value).
//

const Space = 32;
const Tab = 9;
const Newline = 10;
const CR = 13;
const Comma = 44;
const SingleQuote = 39;
const DoubleQuote = 34;
const BackSlash = 92;
const Pipe = 124;

function isWhite(c: number): boolean
{
  return c === Space || c === Newline || c === Tab || c == CR;
}

// Keep calling next() to retrieve next parsed line. Returns false when done. Empty lines are ignored.

export class ParseMany
{
  buf: Uint8Array;
  n: number;
  one: ParseOne;

  constructor(coder: Util.Coder, buf: Uint8Array)
  {
    this.buf = buf;
    this.n = 0;
    this.one = new ParseOne(coder);
  }

  get length(): number { return this.one.length }
  get fields(): string[] { return this.one.fields }

  next(): boolean
  {
    // Move past any leading CRLF
    while (this.n < this.buf.length)
    {
      let c = this.buf[this.n];
      if (c == CR || c == Newline)
        this.n++;
      else
        break;
    }

    let s = this.n;
    while (this.n < this.buf.length)
    {
      let c = this.buf[this.n];
      if (c == CR || c == Newline)
        break;
      else
        this.n++;
    }

    if (s != this.n)
    {
      this.one.setBuf(this.buf.subarray(s, this.n));
      return true;
    }
    else
      return false;
  }
}

export class ParseOne
{
  coder: Util.Coder;
  fields: string[]; // output
  buf: Uint8Array;
  n: number;
  tok: Uint8Array;
  toklen: number;
  infield: boolean;
  quote: number;
  nwhite: number;
  force: boolean;

  constructor(coder: Util.Coder, line?: string)
  {
    this.coder = coder;
    if (line)
      this.set(line);
    else
      this.fields = [];
  }

  set(line: string): void
  {
    this.setBuf(Util.s2u8(this.coder, line));
  }

  setBuf(buf: Uint8Array): void
  {
    this.buf = buf;
    this.fields = [];
    if (!this.tok || this.tok.length < this.buf.length)
      this.tok = new Uint8Array(new ArrayBuffer(this.buf.length));
    this.n = 0;
    this.toklen = 0;
    this.infield = false;
    this.nwhite = 0;
    this.quote = 0;
    this.force = false;
    this.parse();
  }

  get length(): number { return this.fields.length }

  pushtok(): void
  {
    // Trim trailing whitespace
    this.toklen -= this.nwhite;

    if (this.toklen || this.force)
    {
      this.fields.push(Util.u82s(this.coder, this.tok, 0, this.toklen));
      this.toklen = 0;
    }
    this.infield = false;
    this.nwhite = 0;
    this.quote = 0;
    this.force = false;
  }

  parse(): void
  {
    while (this.n < this.buf.length)
    {
      let c: number = this.buf[this.n++];
      if (this.quote && c === this.quote)
      {
        this.quote = 0;
        this.nwhite = 0;
      }
      else if (this.quote)
      {
        this.tok[this.toklen++] = c;
      }
      else if (c === Comma || c === Pipe)
      {
        this.force = true;
        this.pushtok();
        this.force = true;
      }
      else if (this.infield)
      {
        this.tok[this.toklen++] = c;
        if (!this.quote && isWhite(c))
          this.nwhite++;
        else
          this.nwhite = 0;
      }
      else if (isWhite(c))
        continue;
      else if (c === SingleQuote || c === DoubleQuote)
      {
        this.quote = c;
        this.infield = true;
        this.force = true;
      }
      else
      {
        this.infield = true;
        this.tok[this.toklen++] = c;
        this.force = true;
      }
    }
    this.pushtok();
  }
}
