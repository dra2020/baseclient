# poly
Small utility library of convenient polygon functions used for geojson project.

These library functions all take either a GeoJSON polygon or multipolygon feature
or take a bare set of points (in the same basic format as either the GeoJSON
polygon). Look to the reference but basically, a polygon is an array whose first
member is the outer ring and subsequent members are the internal holes.

A multipolygon is just an array of polygons.

A ring is an array of points. The array should be at least 4 points long and the
first and last points should be equal.

A point is an array of lon, lat (that is, x, y).

### Earth Radius
export declare const EARTH_RADIUS = 6371000;

### polyNormalize
export declare function polyNormalize(poly: any): any;

Used internally to normalize the input for subsequent processing. Exposed
if you want to be consistent. The result is either null or the points
array in multi-polygon format.

### polyArea
export declare function polyArea(poly: any): number;

Compute the area of the polygon in meters squared.

### polyPerimeter
export declare function polyPerimeter(poly: any): number;

Compute the perimeter of a polygon in meters.

### Circle class
export declare class Circle {
    x: number;
    y: number;
    r: number;
    constructor(x: number, y: number, r: number);
}

Used for subsequent functions.

### polyToCircle

export declare function polyToCircle(poly: any): Circle | null;

Return smallest circle that encloses all points.

### polyToPolsbyPopperCircle

export declare function polyToPolsbyPopperCircle(poly: any): Circle | null;

Returns circle whose perimeter is equal to the perimeter of the bounding perimeter
of the polygon.

### polyFromCircle

export declare function polyFromCircle(c: Circle, nSegments?: number): any;

Return a polygon (in normalized form) that approximates the circle provided.
NSegments specifies the number of segments to use (must be at least 8).

### polyConvexHull

export declare function polyConvexHull(poly: any): any;

A.M. Andrew's monotone chain 2D convex hull algorithm.

### Compactness Description
export interface CompactnessDescription {
    value: number;
    reock: number;
    polsby_popper: number;
    convex_hull: number;
    schwartzberg: number;
}

Type returned from polyCompactness function.

### polyCompactness

export declare function polyCompactness(poly: any): CompactnessDescription;

Compute the compactness of the polygon.

### PolyDescription

export interface PolyDescription {
    npoly: number;
    nhole: number;
    npoint: number;
}

Type returned from polyDescribe.

### polyDescribe

export declare function polyDescribe(poly: any): PolyDescription;

Describe the given polygon.
