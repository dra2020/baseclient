import * as Util from '../util/all';

import * as P from './poly';
import * as PP from './polypack';

// Adapted from rowanwins/shamos-hoey 
/*
MIT License

Copyright (c) 2019 Rowan Winsemius

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// External libraries
import TinyQueue from 'tinyqueue'
import SplayTree from 'splaytree'

class Event
{
  x: number;
  y: number;
  otherEvent: Event;
  isLeftEndpoint: boolean | null;
  segment: Segment;

  constructor(x: number, y: number)
  {
    this.x = x
    this.y = y

    this.otherEvent = null
    this.isLeftEndpoint = null
    this.segment = null
  }

  isOtherEndOfSegment(eventToCheck: Event): boolean
  {
    return this === eventToCheck.otherEvent
  }

  isSamePoint(eventToCheck: Event): boolean
  {
    return this.x === eventToCheck.x && this.y === eventToCheck.y
  }

  isBelow(p: Event): boolean
  {
    return this.isLeftEndpoint ?
        signedArea(this, this.otherEvent, p) > 0 :
        signedArea(this.otherEvent, p, this) > 0
  }

  isAbove(p: Event): boolean
  {
    return !this.isBelow(p)
  }
}

class EventQueue
{
  tiny: TinyQueue<Event>;

  constructor()
  {
    this.tiny = new TinyQueue<Event>([], checkWhichEventIsLeft)
  }

  push(event: Event): void { this.tiny.push(event) }
  pop(): Event { return this.tiny.pop() as Event }
  get length(): number { return this.tiny.length }
}

class Segment
{
  leftSweepEvent: Event;
  rightSweepEvent: Event;
  segmentAbove: Segment;
  segmentBelow: Segment;

  constructor(event: Event)
  {
    this.leftSweepEvent = event
    this.rightSweepEvent = event.otherEvent
    this.segmentAbove = null
    this.segmentBelow = null

    event.segment = this
    event.otherEvent.segment = this
  }
}

class SweepLine
{
  tree: SplayTree<Segment>;

  constructor()
  {
    this.tree = new SplayTree<Segment>(compareSegments)
  }

  addSegment(event: Event): Segment
  {
     const seg = new Segment(event)
     const node: any = this.tree.insert(seg)
     const nextNode: any = this.tree.next(node)
     const prevNode: any = this.tree.prev(node)
     if (nextNode !== null)
     {
       seg.segmentAbove = nextNode.key
       seg.segmentAbove.segmentBelow = seg
     }
     if (prevNode !== null)
     {
       seg.segmentBelow = prevNode.key
       seg.segmentBelow.segmentAbove = seg
     }
     return node.key
  }

  findSegment(seg: Segment): Segment
  {
     const node: any = this.tree.find(seg)
     if (node === null) return null
     return node.key
  }

  removeSegmentFromSweepline(seg: Segment): void
  {
    const node: any = this.tree.find(seg)
    if (node === null) return
    const nextNode: any = this.tree.next(node)
    const prevNode: any = this.tree.prev(node)

    if (nextNode !== null)
    {
      const nextSeg = nextNode.key
      nextSeg.segmentBelow = seg.segmentBelow
    }
    if (prevNode !== null)
    {
      const prevSeg = prevNode.key
      prevSeg.segmentAbove = seg.segmentAbove
    }
    this.tree.remove(seg)
  }

  testIntersect(seg1: Segment, seg2: Segment): boolean
  {
    if (seg1 === null || seg2 === null) return false

    if (seg1.rightSweepEvent.isSamePoint(seg2.leftSweepEvent) ||
        seg1.rightSweepEvent.isSamePoint(seg2.rightSweepEvent) ||
        seg1.leftSweepEvent.isSamePoint(seg2.leftSweepEvent) ||
        seg1.leftSweepEvent.isSamePoint(seg2.rightSweepEvent)) return false

    const x1 = seg1.leftSweepEvent.x
    const y1 = seg1.leftSweepEvent.y
    const x2 = seg1.rightSweepEvent.x
    const y2 = seg1.rightSweepEvent.y
    const x3 = seg2.leftSweepEvent.x
    const y3 = seg2.leftSweepEvent.y
    const x4 = seg2.rightSweepEvent.x
    const y4 = seg2.rightSweepEvent.y

    const denom = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1))
    const numeA = ((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))
    const numeB = ((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))

    if (denom === 0)
    {
      if (numeA === 0 && numeB === 0) return false
      return false
    }

    const uA = numeA / denom
    const uB = numeB / denom

    return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1)
  }
}

function checkWhichEventIsLeft(e1: Event, e2: Event): number
{
  if (e1.x > e2.x) return 1
  if (e1.x < e2.x) return -1

  if (e1.y !== e2.y) return e1.y > e2.y ? 1 : -1
  return 1
}

function compareSegments(seg1: Segment, seg2: Segment): number
{
  if (seg1 === seg2) return 0

  if (signedArea(seg1.leftSweepEvent, seg1.rightSweepEvent, seg2.leftSweepEvent) !== 0 ||
      signedArea(seg1.leftSweepEvent, seg1.rightSweepEvent, seg2.rightSweepEvent) !== 0)
  {
    // If the segments share their left endpoints
    // use the right endpoint to sort
    if (seg1.leftSweepEvent.isSamePoint(seg2.leftSweepEvent)) return seg1.leftSweepEvent.isBelow(seg2.rightSweepEvent) ? -1 : 1

    // If the segments have different left endpoints
    // use the left endpoint to sort
    if (seg1.leftSweepEvent.x === seg2.leftSweepEvent.x) return seg1.leftSweepEvent.y < seg2.leftSweepEvent.y  ? -1 : 1

    // If the line segment associated to e1 been inserted
    // into S after the line segment associated to e2 ?
    if (checkWhichEventIsLeft(seg1.leftSweepEvent, seg2.leftSweepEvent) === 1) return seg2.leftSweepEvent.isAbove(seg1.leftSweepEvent) ? -1 : 1

    // The line segment associated to e2 has been inserted
    // into S after the line segment associated to e1
    return seg1.leftSweepEvent.isBelow(seg2.leftSweepEvent) ? -1 : 1
  }

  return checkWhichEventIsLeft(seg1.leftSweepEvent, seg2.leftSweepEvent) === 1 ? 1 : -1
}

function runCheck(eventQueue: EventQueue): boolean
{
  const sweepLine = new SweepLine()
  let currentSegment = null
  while (eventQueue.length)
  {
    const event = eventQueue.pop()

    if (event.isLeftEndpoint)
    {
      currentSegment = sweepLine.addSegment(event)
      if (sweepLine.testIntersect(currentSegment, currentSegment.segmentAbove)) return true
      if (sweepLine.testIntersect(currentSegment, currentSegment.segmentBelow)) return true
    }
    else
    {
      if (!event.segment) continue
      if (sweepLine.testIntersect(event.segment.segmentAbove, event.segment.segmentBelow)) return true
      sweepLine.removeSegmentFromSweepline(event.segment)
    }
  }
  return false
}

function signedArea(p0: any, p1: any, p2: any): number
{
  return (p0.x - p2.x) * (p1.y - p2.y) - (p1.x - p2.x) * (p0.y - p2.y)
}

export function selfIntersectFast(poly: any): boolean
{
  let pp = P.polyNormalize(poly);
  if (pp == null) return false;

  // Fill queue
  let eventQueue = new EventQueue();
  PP.polyPackEachRing(pp, (b: Float64Array, iPoly: number, iRing: number, iOffset: number, nPoints: number) => {
      let iEnd = iOffset + (nPoints - 1) * 2; // iterating over segments so right before last point
      for (; iOffset < iEnd; iOffset += 2)
      {
        const e1 = new Event(b[iOffset], b[iOffset+1]);
        const e2 = new Event(b[iOffset+2], b[iOffset+3]);

        e1.otherEvent = e2
        e2.otherEvent = e1

        if (checkWhichEventIsLeft(e1, e2) > 0)
        {
          e2.isLeftEndpoint = true
          e1.isLeftEndpoint = false
        }
        else
        {
          e1.isLeftEndpoint = true
          e2.isLeftEndpoint = false
        }
        eventQueue.push(e1)
        eventQueue.push(e2)
      }
    });

  return runCheck(eventQueue)
}
