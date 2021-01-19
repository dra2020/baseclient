//
// MINIMUM BOUNDING RECTANGLE - aka minimum area rectangle -or- smallest enclosing rectangle
//

//
// WHUBER'S ELEGANT, TRIG-FREE SOLUTION IN R
//
// https://gis.stackexchange.com/questions/22895/finding-minimum-area-rectangle-for-given-points
//

/*

MBR <- function(p) {
  # Analyze the convex hull edges     
  a <- chull(p)                                   # Indexes of extremal points
  a <- c(a, a[1])                                 # Close the loop
  e <- p[a[-1],] - p[a[-length(a)], ]             # Edge directions
  norms <- sqrt(rowSums(e^2))                     # Edge lengths
  v <- e / norms                                  # Unit edge directions
  w <- cbind(-v[,2], v[,1])                       # Normal directions to the edges

  # Find the MBR
  vertices <- p[a, ]                              # Convex hull vertices
  x <- apply(vertices %*% t(v), 2, range)         # Extremes along edges
  y <- apply(vertices %*% t(w), 2, range)         # Extremes normal to edges
  areas <- (y[1,]-y[2,])*(x[1,]-x[2,])            # Areas
  k <- which.min(areas)                           # Index of the best edge (smallest area)

  # Form a rectangle from the extremes of the best edge
  cbind(x[c(1,2,2,1,1),k], y[c(1,1,2,2,1),k]) %*% rbind(v[k,], w[k,])
}

*/


//
// THIS RE-IMPLEMENTS THE R IN TYPESCRIPT, USING CUSTOM MATRIX OPERATIONS
//

import { polyConvexHull } from './poly';
import * as M from './matrix';

type Point = [number, number];

// For point addressing
const X = 0, Y = 1;

export function minimumBoundingRectangle(poly: any): any
{
  // Get the convex hull polygon in standard form
  const ch = polyConvexHull(poly); 

  // Select the exterior points (outer ring = 0)
  let chExt: Point[] = ch[0];

  // Close the loop (ring)
  chExt.push(chExt[0]);

  // Edge directions - Note the implict offset array indexing
  const e: Point[] = chExt.slice(1).map((pt, i) => [(pt[X] - chExt[i][X]), (pt[Y] - chExt[i][Y])]);

  // Edge lengths
  const norms: number[] = e.map(pt => Math.sqrt((pt[X] ** 2) + (pt[Y] ** 2)));

  // Unit edge directions
  const v: Point[] = e.map((pt, i) => [(pt[X] / norms[i]), (pt[Y] / norms[i])]);

  // Normal directions to the edges
  const w: Point[] = v.map(pt => [-pt[Y], pt[X]]);

  // FIND THE MBR - Switch to matrix operations

  // Convex hull vertices
  const vertices = M.matrix(chExt);

  const vT = M.transpose(M.matrix(v));
  const wT = M.transpose(M.matrix(w));

  // Extremes along edges
  const temp1 = M.matrix([M.apply(M.multiply(vertices, vT), M.Dim.Columns, M.min)]);
  const temp2 = M.matrix([M.apply(M.multiply(vertices, vT), M.Dim.Columns, M.max)]);
  const x = M.concat(temp1, temp2, M.Dim.Rows);

  // Extremes normal to edges
  const temp3 = M.matrix([M.apply(M.multiply(vertices, wT), M.Dim.Columns, M.min)]);
  const temp4 = M.matrix([M.apply(M.multiply(vertices, wT), M.Dim.Columns, M.max)]);
  const y = M.concat(temp3, temp4, M.Dim.Rows);

  // Areas
  const temp5 = M.subtract(M.row(y, 0), M.row(y, 1));
  const temp6 = M.subtract(M.row(x, 0), M.row(x, 1));
  const areas = M.dotMultiply(temp5, temp6);

  // Index of the best edge (smallest area)
  const smallestArea = Math.min(...areas);
  const k = [ areas.indexOf(smallestArea) ];

  // Form a rectangle from the extremes of the best edge
  const temp7 = M.subset(x, M.index([0, 1, 1, 0, 0], k));
  const temp8 = M.subset(y, M.index([0, 0, 1, 1, 0], k));
  const temp9 = M.subset(v, M.index(k, M.range(0, 1, true)));
  const temp10 = M.subset(w, M.index(k, M.range(0, 1, true)));
  const temp11 = M.concat(temp7, temp8, M.Dim.Columns);
  const temp12 = M.concat(temp9, temp10, M.Dim.Rows);

  const rect = M.multiply(temp11, temp12);

  // Revert back to standard TypeScript arrays
  const points = rect.slice(0, -1);  // Remove the closing point

  // Convert to standard polygon form
  return [ points ];
}


//
// THIS RE-IMPLEMENTS THE R IN TYPESCRIPT, USING MATHJS FOR MATRIX OPERATIONS
//

/*

const {
  matrix,
  multiply,
  transpose,
  apply,
  min,
  max,
  concat,
  row,
  subtract,
  dotMultiply,
  index,
  range,
  subset
} = require('mathjs');

type SimplePoint = [number, number];

// For point addressing
const X = 0, Y = 1;
const COLUMNS = 0, ROWS = 1;

export function minimumBoundingRectangle(poly: any): any
{
  // Get the convex hull polygon in standard form
  const ch = polyConvexHull(poly); 

  // Select the exterior points
  let chExt: SimplePoint[] = ch[0];

  // Close the loop (ring)
  chExt.push(chExt[0]);

  // Edge directions - Note the implict offset array indexing
  const e: SimplePoint[] = chExt.slice(1).map((pt, i) => [(pt[X] - chExt[i][X]), (pt[Y] - chExt[i][Y])]);

  // Edge lengths
  const norms: number[] = e.map(pt => Math.sqrt((pt[X] ** 2) + (pt[Y] ** 2)));

  // Unit edge directions
  const v: SimplePoint[] = e.map((pt, i) => [(pt[X] / norms[i]), (pt[Y] / norms[i])]);

  // Normal directions to the edges
  const w: SimplePoint[] = v.map(pt => [-pt[Y], pt[X]]);

  // FIND THE MBR

  // Switch to MathJS matrices for matrix operations

  // Convex hull vertices
  const vertices = matrix(chExt);

  const vT = transpose(matrix(v));
  const wT = transpose(matrix(w));

  // Extremes along edges
  const temp1 = matrix([apply(multiply(vertices, vT), COLUMNS, min)]);
  const temp2 = matrix([apply(multiply(vertices, vT), COLUMNS, max)]);
  const x = concat(temp1, temp2, COLUMNS);

  // Extremes normal to edges
  const temp3 = matrix([apply(multiply(vertices, wT), COLUMNS, min)]);
  const temp4 = matrix([apply(multiply(vertices, wT), COLUMNS, max)]);
  const y = concat(temp3, temp4, COLUMNS);

  // Areas
  const temp5 = subtract(row(y, 0), row(y, 1));
  const temp6 = subtract(row(x, 0), row(x, 1));
  const areas = dotMultiply(temp5, temp6);

  // Index of the best edge (smallest area)
  const areasArr = areas.valueOf()[0];           // Make the 2D matrix a 1D array
  const smallestArea = Math.min( ...areasArr );
  const k = areasArr.indexOf(smallestArea);

  // Form a rectangle from the extremes of the best edge
  const temp7 = subset(x, index([0, 1, 1, 0, 0], k));
  const temp8 = subset(y, index([0, 0, 1, 1, 0], k));
  const temp9 = subset(v, index(k, range(0, 1, true)));
  const temp10 = subset(w, index(k, range(0, 1, true)));
  const rect = multiply(concat(temp7, temp8), concat(temp9, temp10, COLUMNS));

  // Revert back to standard TypeScript arrays
  const points = rect.valueOf().slice(0, -1);  // Remove the closing point

  // Convert to standard polygon form
  return [ points ];
}

*/
