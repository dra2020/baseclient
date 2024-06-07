//
// FormatDetail will take a pattern that specifies a set of formatted detail lines.
// Given an object with a set of integer properties, it will evaluate the pattern and produce
// an array of { k: string, n: number, v: string } results for displaying the contents of the object.
//
// The formatting string contains a series of statements, separated by newline or semicolon.
// A single statement is of the form:
//    label=expr
// Expr can be an arithmetic expression using +-/*() as operators and variables are the field
// names of properties on the object passed in. The special field name _tot represents the
// total of all properties. The expression may also include double-quoted strings that are
// passed through (e.g. for use as labels = area" sqm")
//

import * as Util from '../util/all';

const reIdentifier = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g;
const reParam = /^__\d+$/

class Evaluator
{
  expr: string;

  constructor(expr: string)
  {
    this.expr = expr;
  }

  eval(o: any): number
  {
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
      safeexpr = safeexpr.replace(reIdentifier, (match) => { return reParam.test(match) ? match : "invalid" });

      // Create a new function that accepts the variables as parameters
      // and evaluates the expression
      const func = new Function(...safenames, `return ${safeexpr};`);

      // Call the function with the variable values
      let r = func(...values);
      return isNaN(r) ? 0 : r;
    }
    catch (err)
    {
      return 0;
    }
  }
}

interface DetailItem
{
  expr?: string,
  text?: string,
}

interface DetailLine
{
  label: string,
  items: DetailItem[],
}

export interface DetailResult
{
  k: string,  // label
  n: number,  // value before formatting
  v: string,  // value
  t?: string, // tooltip
}

const reInvalidChars = /[\.\[\]\\]/;

export class FormatDetail
{
  valid: boolean;
  pattern: string;
  lines: DetailLine[];

  constructor(pattern: string)
  {
    this.valid = true;
    this.pattern = pattern;
    this.lines = [];
    let lines = this.pattern.split(/[;\n]/).map(l => l.trim()).filter(l => !!l);
    lines.forEach(line => {
        let sides = line.split('=').map(l => l.trim()).filter(l => !!l);
        if (sides.length != 2)
          this.valid = false;
        else
        {
          const lhs = sides[0];
          const rhs = sides[1];
          let parse = rhs.split('"');
          let items: DetailItem[] = [];
          let state = 'expr';
          parse.forEach(subexpr => {
              if (state === 'expr')
              {
                if (subexpr.length)
                {
                  // Don't allow unsafe actions
                  if (reInvalidChars.test(subexpr))
                    items.push({ text: subexpr });
                  else
                    items.push({ expr: subexpr });
                }
                state = 'text';
              }
              else  // state === 'text'
              {
                if (subexpr.length)
                  items.push({ text: subexpr });
                state = 'expr';
              }
            });
          this.lines.push( { label: lhs, items } );
        }
      });
  }

  format(o: any): DetailResult[]
  {
    if (!o) return [];
    // Make sure there is a total field
    o = Util.deepCopy(o);
    if (o['Tot'] !== undefined)
      o['_tot'] = o['Tot'];
    else
    {
      let t = 0;
      Object.values(o).forEach((v: any) => {
          if (!isNaN(v) && typeof v === 'number')
            t += v;
        });
      o['_tot'] = t;
    }
    let result: DetailResult[] = [];
    this.lines.forEach(line => {
        let n: number;
        let av = line.items.map(di => {
            if (di.text)
              return di.text;
            else
            {
              let e = new Evaluator(di.expr);
              n = e.eval(o);
              return Util.precisionRound(n, 0).toLocaleString();
            }
          });
        result.push({ k: line.label, n, v: av.join('') });
      });
    return result;
  }
}
