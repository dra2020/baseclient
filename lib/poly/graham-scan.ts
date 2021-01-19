//
// CONVEX HULL USING GRAHAM SCAN ALGORITHM
//
/* Resources:
 * https://en.wikipedia.org/wiki/Graham_scan
 * https://www.tutorialspoint.com/Graham-Scan-Algorithm <<< pseudo code
 * http://brian3kb.github.io/graham_scan_js/ <<< basis for this implementation
 */

import {polyNormalize, PolyOptions} from './poly';
import * as PP from './polypack';

type SimplePoint = [number, number];


export function makeConvexHullGrahamScan(poly: any, options?: PolyOptions): any
{
  let points = getExteriorPoints(poly);
  if (points == null) return null;

  let scanner = new GrahamScanner();

  for (let pt of points) {
    scanner.addPoint(pt);
  }

  const ch: SimplePoint[] = scanner.getHull();

  return [ ch ];
}

// NOTE - This finds the exterior points of a polygon in standard form and returns
//   it as an array if [x, y] points, in contrast to polyToExteriorPoints() which
//   uses the packed format and the poly.ts-private point form.
function getExteriorPoints(poly: any): SimplePoint[]
{
  let pp = polyNormalize(poly);
  if (pp == null) return null;

  let points: SimplePoint[] = [];

  PP.polyPackEachPoint(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number) => {
      if (iRing > 0) return;  // skip holes
      points.push([b[iOffset], b[iOffset+1]]);
    });

  return points.length > 0 ? points : null;
}

const X = 0, Y = 1;

class GrahamScanner
{
  anchorPoint: SimplePoint | undefined;
  reverse: boolean;
  points: SimplePoint[];

  constructor()
  {
    this.anchorPoint = undefined;
    this.reverse = false;
    this.points = [];
  }
  _findPolarAngle(a: SimplePoint, b: SimplePoint): number
  {
    const ONE_RADIAN = 57.295779513082;
    let deltaX, deltaY;

    // If the points are undefined, return a zero difference angle.
    if (!a || !b) return 0;

    deltaX = (b[X] - a[X]);
    deltaY = (b[Y] - a[Y]);

    if (deltaX == 0 && deltaY == 0) {
        return 0;
    }

    let angle = Math.atan2(deltaY, deltaX) * ONE_RADIAN;

    if (this.reverse) {
      if (angle <= 0) {
          angle += 360;
      }
    }
    else
    {
      if (angle >= 0) {
          angle += 360;
      }
    }

    return angle;
  }
  addPoint(pt: SimplePoint): void
  {
    // Check for a new anchor
    const newAnchor =
        ( this.anchorPoint === undefined ) ||
        ( this.anchorPoint[Y] > pt[Y] ) ||
        ( this.anchorPoint[Y] === pt[Y] && this.anchorPoint[X] > pt[X] );

    if ( newAnchor ) {
      if ( this.anchorPoint !== undefined ) {
          this.points.push(pt);
      }
      this.anchorPoint = pt;
    }
    else
    {
      this.points.push(pt);
    }
  }
  _sortPoints(): SimplePoint[] 
  {
    var self = this;

    return this.points.sort(function(a: SimplePoint, b: SimplePoint) 
    {
      const polarA = self._findPolarAngle(self.anchorPoint as SimplePoint, a);
      const polarB = self._findPolarAngle(self.anchorPoint as SimplePoint, b);
    
      if (polarA < polarB) {
          return -1;
      }
      if (polarA > polarB) {
          return 1;
      }
    
      return 0;
    });
  }
  _checkPoints(p0: SimplePoint, p1: SimplePoint, p2: SimplePoint): boolean 
  {
    let difAngle;
    const cwAngle = this._findPolarAngle(p0, p1);
    const ccwAngle = this._findPolarAngle(p0, p2);

    if (cwAngle > ccwAngle) {
      difAngle = cwAngle - ccwAngle;

      return !(difAngle > 180);
    }
    else if (cwAngle < ccwAngle)
    {
      difAngle = ccwAngle - cwAngle;

      return (difAngle > 180);
    }

    return true;
  }
  getHull(): SimplePoint[] 
  {
    let hullPoints: SimplePoint[] = [];
    let points: SimplePoint[];
    let pointsLength: number;

    this.reverse = this.points.every(
      function (point)
      {
        return (point[X] < 0 && point[Y] < 0);
      }
    );

    points = this._sortPoints();
    pointsLength = points.length;

    // If there are less than 3 points, joining these points creates a correct hull.
    if (pointsLength < 3) {
        points.unshift(this.anchorPoint as SimplePoint);
        return points;
    }

    // Move first two points to output array
    const first: SimplePoint = points.shift() as SimplePoint;
    const second: SimplePoint = points.shift() as SimplePoint;
    hullPoints.push(first, second);

    // Scan is repeated until no concave points are present.
    while (true) {
      let p0: SimplePoint;
      let p1: SimplePoint;
      let p2: SimplePoint;

      hullPoints.push(points.shift() as SimplePoint);

      p0 = hullPoints[hullPoints.length - 3];
      p1 = hullPoints[hullPoints.length - 2];
      p2 = hullPoints[hullPoints.length - 1];

      if (this._checkPoints(p0, p1, p2)) {
          hullPoints.splice(hullPoints.length - 2, 1);
      }

      if (points.length == 0) 
      {
        if (pointsLength == hullPoints.length) 
        {
          // Check for duplicate anchorPoint edge-case, if not found, add the anchorpoint as the first item.
          const ap: SimplePoint = this.anchorPoint as SimplePoint;
          // Remove any udefined elements in the hullPoints array.
          hullPoints = hullPoints.filter(function(p) { return !!p; });
          if (!hullPoints.some(function(p){
                  return(p[X] == ap[X] && p[Y] == ap[Y]);
              })) {
              hullPoints.unshift(this.anchorPoint as SimplePoint);
          }
          return hullPoints;
        }
        points = hullPoints;
        pointsLength = points.length;
        hullPoints = [];
        const first: SimplePoint = points.shift() as SimplePoint;
        const second: SimplePoint = points.shift() as SimplePoint;
        hullPoints.push(first, second);
      }
    }
  }
}

/**
 * Graham's Scan Convex Hull Algorithm
 * @desc An implementation of the Graham's Scan Convex Hull algorithm in JavaScript.
 * @author Brian Barnett, brian@3kb.co.uk, http://brianbar.net/ || http://3kb.co.uk/
 * @version 1.0.5
 */

/*
function ConvexHullGrahamScan() {
  this.anchorPoint = undefined;
  this.reverse = false;
  this.points = [];
}

ConvexHullGrahamScan.prototype = {

  constructor: ConvexHullGrahamScan,

  Point: function (x, y) {
      this.x = x;
      this.y = y;
  },

  _findPolarAngle: function (a, b) {
      var ONE_RADIAN = 57.295779513082;
      var deltaX, deltaY;

      //if the points are undefined, return a zero difference angle.
      if (!a || !b) return 0;

      deltaX = (b.x - a.x);
      deltaY = (b.y - a.y);

      if (deltaX == 0 && deltaY == 0) {
          return 0;
      }

      var angle = Math.atan2(deltaY, deltaX) * ONE_RADIAN;

      if (this.reverse){
          if (angle <= 0) {
              angle += 360;
          }
      }else{
          if (angle >= 0) {
              angle += 360;
          }
      }

      return angle;
  },

  addPoint: function (x, y) {
      //Check for a new anchor
      var newAnchor =
          (this.anchorPoint === undefined) ||
          ( this.anchorPoint.y > y ) ||
          ( this.anchorPoint.y === y && this.anchorPoint.x > x );

      if ( newAnchor ) {
          if ( this.anchorPoint !== undefined ) {
              this.points.push(new this.Point(this.anchorPoint.x, this.anchorPoint.y));
          }
          this.anchorPoint = new this.Point(x, y);
      } else {
          this.points.push(new this.Point(x, y));
      }
  },

  _sortPoints: function () {
      var self = this;

      return this.points.sort(function (a, b) {
          var polarA = self._findPolarAngle(self.anchorPoint, a);
          var polarB = self._findPolarAngle(self.anchorPoint, b);

          if (polarA < polarB) {
              return -1;
          }
          if (polarA > polarB) {
              return 1;
          }

          return 0;
      });
  },

  _checkPoints: function (p0, p1, p2) {
      var difAngle;
      var cwAngle = this._findPolarAngle(p0, p1);
      var ccwAngle = this._findPolarAngle(p0, p2);

      if (cwAngle > ccwAngle) {

          difAngle = cwAngle - ccwAngle;

          return !(difAngle > 180);

      } else if (cwAngle < ccwAngle) {

          difAngle = ccwAngle - cwAngle;

          return (difAngle > 180);

      }

      return true;
  },

  getHull: function () {
      var hullPoints = [],
          points,
          pointsLength;

      this.reverse = this.points.every(function(point){
          return (point.x < 0 && point.y < 0);
      });

      points = this._sortPoints();
      pointsLength = points.length;

      //If there are less than 3 points, joining these points creates a correct hull.
      if (pointsLength < 3) {
          points.unshift(this.anchorPoint);
          return points;
      }

      //move first two points to output array
      hullPoints.push(points.shift(), points.shift());

      //scan is repeated until no concave points are present.
      while (true) {
          var p0,
              p1,
              p2;

          hullPoints.push(points.shift());

          p0 = hullPoints[hullPoints.length - 3];
          p1 = hullPoints[hullPoints.length - 2];
          p2 = hullPoints[hullPoints.length - 1];

          if (this._checkPoints(p0, p1, p2)) {
              hullPoints.splice(hullPoints.length - 2, 1);
          }

          if (points.length == 0) {
              if (pointsLength == hullPoints.length) {
                  //check for duplicate anchorPoint edge-case, if not found, add the anchorpoint as the first item.
                  var ap = this.anchorPoint;
                  //remove any udefined elements in the hullPoints array.
                  hullPoints = hullPoints.filter(function(p) { return !!p; });
                  if (!hullPoints.some(function(p){
                          return(p.x == ap.x && p.y == ap.y);
                      })) {
                      hullPoints.unshift(this.anchorPoint);
                  }
                  return hullPoints;
              }
              points = hullPoints;
              pointsLength = points.length;
              hullPoints = [];
              hullPoints.push(points.shift(), points.shift());
          }
      }
  }
};

// EXPORTS

if (typeof define === 'function' && define.amd) {
  define(function() {
      return ConvexHullGrahamScan;
  });
}
if (typeof module !== 'undefined') {
  module.exports = ConvexHullGrahamScan;
}

*/
