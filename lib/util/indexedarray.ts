export class IndexedArray
{
  o: any;
  a: any[];

  constructor()
  {
    this.o = {};
    this.a = null;
  }

  ensure(): void
  {
    if (this.a === null)
    {
      this.a = [];
      for (let p in this.o) if (this.o.hasOwnProperty(p))
        this.a.push(p);
      this.a.sort((a: string, b: string) => { a = a.toUpperCase(); b = b.toUpperCase(); return a < b ? -1 : (a > b ? 1 : 0); });
    }
  }

  asArray(): any[]
  {
    this.ensure();
    return this.a;
  }

  get length(): number { this.ensure(); return this.a.length; }

  test(s: string): boolean
  {
    return !!s && this.o[s] !== undefined;
  }

  set(s: string): void
  {
    if (!!s && !this.test(s))
    {
      this.o[s] = true;
      this.a = null;
    }
  }

  setAll(a: string[]): void
  {
    if (a && a.length)
      for (let i: number = 0; i < a.length; i++)
        this.set(a[i]);
  }

  clear(s: string): void
  {
    if (this.test(s))
    {
      delete this.o[s];
      this.a = null;
    }
  }

  at(i: number): string
  {
    this.ensure();
    if (i < 0 || i >= this.a.length)
      return undefined;
    return this.a[i];
  }

  empty(): void
  {
    this.o = {};
    this.a = null;
  }

  forEach(f: (s: string) => void): void
  {
    for (var s in this.o) if (this.o.hasOwnProperty(s))
      f(s);
  }
}
