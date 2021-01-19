import * as Util from '../util/all';

import * as OT from './ottypes';

// This implements OT for a dictionary of objects. OT is pretty trivial for maps - last wins.

export const OpMapSet = 1;
export const OpMapDel = 2;
export type MapEdit = [ number, string, any ];	// Op, Key, Value

export class OTMapResource extends OT.OTResourceBase
{
	constructor(rid: string)
		{
			super(rid, 'map');
		}
	static factory(rid: string): OTMapResource { return new OTMapResource(rid); }

  // Set a property
  set(p: string, a: any): OTMapResource
    {
      this.edits.push([ OpMapSet, p, a ]);
      return this;
    }

  // Delete a property
  del(p: string): OTMapResource
    {
      this.edits.push([ OpMapDel, p, 0 ]);
      return this;
    }

	// copy an instance
	copy(): OTMapResource
		{
			let c: OTMapResource = new OTMapResource(this.resourceName);
			for (let i: number = 0; i < this.length; i++)
			{
				let e: MapEdit = this.edits[i];
				c.edits.push([ e[0], e[1], e[2] ]);
			}
			return c;
		}

	// Test whether two operations are effectively equivalent
	effectivelyEqual(rhs: OTMapResource): boolean
		{
			// This should really be a structural error
			if (this.length != rhs.length)
				return false;

			// This checks for exact structural equivalency. Really the ordering shouldn't matter for Map so
			// an improvement to this algorithm would be to be more robust to ordering differences.
			for (let i: number = 0; i < this.length; i++)
			{
				let e1: MapEdit = this.edits[i];
				let e2: MapEdit = rhs.edits[i];
				if (e1[0] != e2[0] || e1[1] != e2[1] || !Util.deepEqual(e1[2], e2[2]))
					return false;
			}
			return true;
		}

	// Core OT algorithm for this type
	transform(prior: OTMapResource, bPriorIsService: boolean): void
		{
			// Last wins - if I'm last, my sets and deletes are all preserved
			if (bPriorIsService)
				return;

			// OK, remove any operations (either sets or deletes), that conflict with me
			// First load in my properties
			let myEdits: any = this.toObject();

			// Now delete any that are overridden
			for (let i: number = 0; i < prior.length; i++)
				delete myEdits[(prior.edits[i])[1]];

			// Now restore edit array from edited object
			this.fromObject(myEdits);
		}

	// compose two edit actions
	compose(rhs: OTMapResource): void 			// throws on error
		{
			let o: any = this.toObject();
			for (let i: number = 0; i < rhs.length; i++)
			{
				let eR: MapEdit = rhs.edits[i];
				o[eR[1]] = [ eR[0], eR[1], eR[2] ];		// Note this overwrites any existing operation on this key, set or del
			}
			this.fromObject(o);
		}

	apply(startValue: any): any
		{
			if (startValue == null)
				startValue = { };
			for (let i: number = 0; i < this.length; i++)
			{
				let e: MapEdit = this.edits[i];
				switch (e[0])
				{
					case OpMapSet:
						startValue[e[1]] = e[2];
						break;
					case OpMapDel:
						delete startValue[e[1]];
						break;
				}
			}
			return startValue;
		}

	minimize(): any
		{
			// Effectively removes OpMapDel
			let o: any = this.apply({});
			this.edits = [];
			for (var p in o)
				if (o.hasOwnProperty(p))
					this.edits.push([ OpMapSet, p, o[p] ]);
		}

	loadObject(o: any): any
		{
			for (let i: number = 0; i < this.length; i++)
				o[(this.edits[i])[1]] = this.edits[i];
			return o;
		}

	toObject(): any
		{
			return this.loadObject({ });
		}

	fromObject(o: any): void
		{
			this.edits = [];
			for (var p in o)
				if (o.hasOwnProperty(p))
					this.edits.push(o[p]);
		}
}
