//
// SOME BASIC MATRIX OPERATIONS FOR MBR
//

/* 

These custom functions are used by minimumBoundingRectangle(), instead of the
same-named mathjs versions. They are tailored specifically for that routine and
are NOT intended for general use.

export declare function matrix(x: Matrix): Matrix;

export declare function multiply(a: Matrix, b: Matrix): Matrix;

export declare function transpose(a: Matrix, b: Matrix): Matrix;

export declare function apply((a: Matrix, over: Dim, cb: applyCB): Vector;

export declare function min(a: Vector): number;

export declare function max(a: Vector): number;

export declare function concat(a: Matrix, b: Matrix, by: Dim): Matrix;

export declare function row(a: Matrix, i: number): Vector;

export declare function subtract(a: Vector, b: Vector): Vector;

export declare function dotMultiply(a: Vector, b: Vector): Vector;

export declare function index(a: Range, b: Range): Index;

export declare function range(start: number, end: number, includeEnd: boolean = false): Vector;

export declare function subset(a: Matrix, select: Index): Matrix;

*/


export type Matrix = number[][];
export type Vector = number[];                // A general vector or a row or a column
export type Range = number[];
export type Index = number[][];
export type applyCB = (v: Vector) => number;

export const enum Dim
{
  Rows,
  Columns
}

export function matrix(a: Matrix): Matrix
{
  return a;
}

export function multiply(a: Matrix, b: Matrix): Matrix
{
  protect((nRows(a) > 0), "In multiply, input matrix 'a' has no rows. ");
  protect((nCols(a) > 0), "In multiply, input matrix 'a' has no columns. ");
  protect((nRows(b) > 0), "In multiply, input matrix 'b' has no rows. ");
  protect((nCols(b) > 0), "In multiply, input matrix 'b' has no columns. ");

  const m = nRows(a);
  const n = nCols(a);
  const p = nRows(b);
  const q = nCols(b);

  protect((p == n), "In multiply, the # rows in matrix 'b' doesn't match the number of columns in matrix 'a'.");

  let c: Matrix = initialize(m, n);

  for (let i = 0; i < m; i++)
  {
    for (let j = 0; j < q; j++)
    {
      const aRow = row(a, i);
      const bCol = column(b, j);

      c[i][j] = dotProduct(aRow, bCol);
    }
  }

  return c;
}

export function transpose(a: Matrix): Matrix
{
  protect((nRows(a) > 0), "In transpose, input matrix has no rows. ");
  protect((nCols(a) > 0), "In transpose, input matrix has no columns. ");

  const j = nRows(a);
  const i = nCols(a);

  let b: Matrix = initialize(i, j);

  for (let m = 0; m < j; m++)
  {
    for (let n = 0; n < i; n++)
    {
      b[n][m] = a[m][n];
    }
  }

  return b;
}

export function apply(a: Matrix, over: Dim, cb: applyCB): Vector
{
  protect((nRows(a) > 0), "In apply, input matrix has no rows. ");
  protect((nCols(a) > 0), "In apply, input matrix has no columns. ");

  let m = nRows(a);
  let n = nCols(a);

  let result: Vector = [];

  const iEnd = (over == Dim.Rows) ? m : n;
  const extractFn = (over == Dim.Rows) ? row : column;

  for (let i = 0; i < iEnd; i++)
  {
    const v: Vector = extractFn(a, i);
    result.push(cb(v));
  }

  return result;
}

export function min(v: Vector): number
{
  return Math.min(...v);
}

export function max(v: Vector): number
{
  return Math.max(...v);
}

export function concat(a: Matrix, b: Matrix, by: Dim): Matrix
{
  protect((nRows(a) > 0), "In concat, input matrix 'a' has no rows. ");
  protect((nCols(a) > 0), "In concat, input matrix 'a' has no columns. ");
  protect((nRows(b) > 0), "In concat, input matrix 'b' has no rows. ");
  protect((nCols(b) > 0), "In concat, input matrix 'b' has no columns. ");

  let m = nRows(a);
  let n = nCols(a);
  const p = nRows(b);
  const q = nCols(b);

  const {i, j} = (by == Dim.Columns) ? {i: m, j: n + q} : {i: m + p, j: n};
  let c: Matrix = initialize(i, j);

  if (by == Dim.Rows)
    protect((n == q), "In concat, concatenating rows but the # of columns don't match. ");
  else // (by == Dim.Columns)
    protect((m == p), "In concat, concatenating columns but the # of rows don't match. ");

  // Copy the first array
  for (let i = 0; i < m; i++)
  {
    for (let j = 0; j < n; j++)
    {
      c[i][j] = a[i][j];
    }
  }

  m = (by == Dim.Rows) ? m : 0;
  n = (by == Dim.Columns) ? n : 0;

  // Copy the second array to the right (by columns) or below (by rows)
  for (let i = 0; i < p; i++)
  {
    for (let j = 0; j < q; j++)
    {
      c[i+m][j+n] = b[i][j];
    }
  }

  return c;
}

export function row(a: Matrix, i: number): Vector
{
  protect((nRows(a) > 0), "In row, input matrix has no rows. ");
  protect((nCols(a) > 0), "In row, input matrix has no columns. ");
  protect((i >= 0), "In row, invalid row index.");

  return a[i];
}

export function column(a: Matrix, j: number): Vector
{
  protect((nRows(a) > 0), "In column, input matrix has no rows. ");
  protect((nCols(a) > 0), "In column, input matrix has no columns. ");
  protect((j >= 0), "In row, invalid column index.");

  let v: any = [];

  for (let i = 0; i < nRows(a); i++)
  {
    v.push(a[i][j]);
  }

  return v;
}

export function subtract(a: Vector, b: Vector): Vector
{
  protect((a.length == b.length), "In subtract, the input vectors have different lengths.");

  let c: Vector = [];

  for (let i = 0; i < a.length; i++)
  {
    c.push(a[i] - b[i]);
  }

  return c;
}

export function dotMultiply(a: Vector, b: Vector): Vector
{
  protect((a.length > 0) && (a.length == b.length), "In dotMultiply, the vectors aren't the same length. ");

  let c: Vector = [];

  for (let i = 0; i < a.length; i++)
  {
    c.push(a[i] * b[i]);
  }

  return c;
}

export function index(a: Range, b: Range): Index
{
  return [a, b];
}

export function range(start: number, end: number, includeEnd: boolean = false): Vector
{
  let r: Vector = [];

  end += includeEnd ? 1 : 0;
  for (let i = start; i < end; i++)
  {
    r.push(i);
  }
  
  return r;
}

export function subset(a: Matrix, select: Index): Matrix
{
  protect((nRows(a) > 0), "In subset, input matrix has no rows. ");
  protect((nCols(a) > 0), "In subset, input matrix has no columns. ");

  protect((nRows(select) > 0), "In subset, input matrix has no rows. ");
  protect((nCols(select) > 0), "In subset, input matrix has no columns. ");

  const m = nRows(a);
  const n = nCols(a);

  const rowRange = row(select, 0) as Range;
  const colRange = row(select, 1) as Range;
  const p = rowRange.length;
  const q = colRange.length;

  let b: Matrix = initialize(p, q);

  for (let i = 0; i < p; i++)
  {
    for (let j = 0; j < q; j++)
    {
      b[i][j] = a[rowRange[i]][colRange[j]];
    }
  }

  return b;
}


// HELPERS

function initialize(rows: number, cols: number): Matrix
{
  protect(((rows > 0) || (cols > 0)), "In initialize, the # of rows or columns is not positive. ");

  return [...Array(rows)].fill(0).map(() => [...Array(cols)].fill(0));
};

const nRows = (a: Matrix | Index) => a.length;
const nCols = (a: Matrix | Index) => (a.length > 0) ? a[0].length : 0;

export function dotProduct(a: Vector, b: Vector): number
{
  protect((a.length > 0) && (a.length == b.length), "In dotProduct, the vectors aren't the same length. ");

  return a.map((value, i) => value * b[i]).reduce((acc, val) => acc + val, 0);
};


function protect(condition: boolean, message: string): void
{
  if (!condition)
    throw new Error(message);
}
