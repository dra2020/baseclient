//
// FormatDetail will take an expression that specifies a format detail lines.
// Given an object with a set of integer properties, it will evaluate the expression and produce
// a result { k: string, n: number, v: string } results for displaying the contents of the object.
//
// The formatting string is a statement of the form:
//    =expr
// Expr can be an arithmetic expression using +-/*()?: as operators and variables are the field
// names of properties on the object passed in. The special field name Tot represents the
// total of all properties. The expression may also include double-quoted strings that are
// passed through (e.g. for use as labels = area" sqm")
//

import * as Util from '../util/all';

const reIdentifier = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g;
const reParam = /^__\d+$/

// Number format: (locale|general|integer|currency).precision

function formatNumber(n: number, format: string): string
{
  if (!format) format = 'locale.0';
  let parts = format.split('.');
  let fmt = parts[0];
  let precision = Number(parts[1] || '0');
  // Only have implementation for 'locale'
  return n.toLocaleString(undefined, { maximumFractionDigits: precision, minimumFractionDigits: precision } );
}

export interface DetailOptions
{
  numberFormat?: string,
}

const DefaultDetailOptions: DetailOptions = { numberFormat: 'locale.0' };

class Evaluator
{
  expr: string;
  _error: boolean;

  constructor(expr: string)
  {
    this.expr = expr;
    this._error = false;
  }

  get error(): boolean { return this._error }

  eval(o: any): number
  {
    this._error = false;
    try
    {
      // Convert property names to valid Javascript to ensure expression safety
      o = Util.shallowCopy(o);
      let namemap: any = {};
      Object.keys(o).forEach((n: string, i: number) => {
          namemap[n] = `__${i}`;
        });

      // Extract variable names and values from the object
      let names = Object.keys(o);
      let values = Object.values(o);
      let safeexpr = this.expr;
      let safenames = names.map(n => namemap[n]);
      // replace longest field names first in case they contain substrings of short field names
      names.sort((n1: string, n2: string) => n2.length - n1.length);
      names.forEach((n: string, i: number) => {
          while (safeexpr.indexOf(n) >= 0)
            safeexpr = safeexpr.replace(n, namemap[n]);
        });

      // Remove any identifiers that aren't the simple parameters to prevent out-of-sandbox execution
      safeexpr = safeexpr.replace(reIdentifier,
                                  (match) => {
                                      let valid = reParam.test(match);
                                      if (valid)
                                        return match;
                                      else
                                      {
                                        this._error = true;
                                        return 'invalid';
                                      }
                                    });

      // Create a new function that accepts the variables as parameters
      // and evaluates the expression
      const func = new Function(...safenames, `return ${safeexpr};`);

      // Call the function with the variable values
      let r = func(...values);
      return isNaN(r) ? 0 : r;
    }
    catch (err)
    {
      this._error = true;
      return 0;
    }
  }
}

interface DetailItem
{
  expr?: string,
  text?: string,
}

export interface DetailResult
{
  n: number,  // value before formatting
  v: string,  // value
}

const reInvalidChars = /[\.\[\]\\]/;
const reExpr = /^=(.*)$/

export class FormatDetail
{
  pattern: string;
  items: DetailItem[];
  _error: boolean;
  options: DetailOptions;

  constructor(pattern: string, options?: DetailOptions)
  {
    this.options = Util.shallowAssignImmutable(DefaultDetailOptions, options);
    this._error = false;
    this.pattern = pattern.trim();
    let a = reExpr.exec(pattern);
    if (a && a.length == 2)
    {
      this.items = [];
      const expr = a[1];
      const parse = expr.split('"');
      let state = 'expr';
      parse.forEach(subexpr => {
          if (state === 'expr')
          {
            if (subexpr.length)
            {
              // Don't allow unsafe actions
              if (reInvalidChars.test(subexpr))
                this.items.push({ text: subexpr });
              else
                this.items.push({ expr: subexpr });
            }
            state = 'text';
          }
          else  // state === 'text'
          {
            if (subexpr.length)
              this.items.push({ text: subexpr });
            state = 'expr';
          }
        });
    }
    else
    {
      this._error = true;
      this.items = [ { text: 'invalid' } ];
    }
  }

  get error(): boolean { return this._error }

  static prepare(o: any): any
  {
    if (o && o.Tot === undefined && o.Total === undefined)
    {
      // Add a total field
      let t = 0;
      Object.keys(o).forEach((k: string) => {
          let v: any = o[k];
          if (!isNaN(v) && typeof v === 'number')
            t += v;
        });

      o = Util.deepCopy(o);
      o.Tot = t;
      o.Total = t;
    }
    return o;
  }

  format(o: any): DetailResult
  {
    if (!o)
    {
      this._error = true;
      return { n: 0, v: '' };
    }
    let n: number;
    let av = this.items.map(di => {
        if (di.text)
          return di.text;
        else
        {
          let e = new Evaluator(di.expr);
          n = e.eval(o);
          if (! this._error)
            this._error = e.error;
          return formatNumber(n, this.options.numberFormat);
        }
      });
    return { n, v: av.join('') }
  }
}
