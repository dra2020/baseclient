export class CountedHash
{
  n: number;
  val: { [id: string]: true|null }; // true === isset, null === indeterminant

  constructor()
  {
    this.n = 0;
    this.val = {};
  }

  get length(): number { return this.n; }

  indeterminate(id: string): boolean
  {
    return id != '' && this.val[id] === null;
  }

  test(id: string): boolean
  {
    return id != '' && this.val[id] !== undefined;
  }

  set(id: string, val: true|null = true): void
  {
    if (id != '')
    {
      if (! this.test(id))
        this.n++;
      this.val[id] = val;
    }
  }

  clear(id: string): void
  {
    if (this.test(id))
    {
      this.n--;
      delete this.val[id];
    }
  }

  apply(vals: { [id: string]: boolean|null }): void
  {
    this.empty();

    if (vals)
      Object.keys(vals).forEach((id) => {
          if (vals[id] !== false)
            this.set(id, vals[id] === true ? true : null);
        });
  }

  empty(): void
  {
    this.n = 0;
    this.val = {};
  }

  asArray(): string[]
  {
    let a: string[] = [];

    this.forEach(id => { a.push(id) });

    return a;
  }

  // This really only useful when length === 0|1
  asString(): string
  {
    for (var id in this.val) if (this.val.hasOwnProperty(id))
      return id;

    return '';
  }

  forEach(f: (id: string) => void): void
  {
    for (var id in this.val) if (this.val.hasOwnProperty(id))
      f(id);
  }
}
