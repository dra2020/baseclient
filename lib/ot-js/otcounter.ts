import * as OT from "./ottypes";

// This implements OT for a simple map of counters. Instead of a new value replacing the 
// keyed value, values are added together. This allows a simple accumulating counter.
// Possible future additions:
//	Add additional semantics for how the values accumulate. Examples from DropBox's datastore API
//	included "min" and "max" as alternate rules to "sum".
//

export const OpCounterAdd = 1;
export const OpCounterDel = 2;
export type CounterEdit = [ number, string, any ];	// Op, Key, Value

export class OTCounterResource extends OT.OTResourceBase
{
	constructor(rid: string)
		{
			super(rid, 'counter');
		}
	static factory(rid: string): OTCounterResource { return new OTCounterResource(rid); }

	// copy an instance
	copy(): OTCounterResource
		{
			let c: OTCounterResource = new OTCounterResource(this.resourceName);
			for (let i: number = 0; i < this.length; i++)
			{
				let e: CounterEdit = this.edits[i];
				c.edits.push([ e[0], e[1], e[2] ]);
			}
			return c;
		}

	// Test whether two operations are effectively equivalent
	effectivelyEqual(rhs: OTCounterResource): boolean
		{
			// This should really be a structural error
			if (this.length != rhs.length)
				return false;

			// This checks for exact structural equivalency. Really the ordering shouldn't matter for Counter so
			// an improvement to this algorithm would be to be more robust to ordering differences.
			for (let i: number = 0; i < this.length; i++)
			{
				let e1: CounterEdit = this.edits[i];
				let e2: CounterEdit = rhs.edits[i];
				if (e1[0] != e2[0] || e1[1] != e2[1] || e1[2] != e2[2])
					return false;
			}
			return true;
		}

	// Core OT algorithm for this type
	transform(prior: OTCounterResource, bPriorIsService: boolean): void
		{
			// Last wins - if I'm last, my adds and deletes are all preserved
			if (bPriorIsService)
				return;

			// Deletes in prior will delete mine. Implement by loading up properties rather than
			// using N^2 lookup through Edits array.
			let myEdits: any = this.toObject();
			let bEdited: boolean = false;

			// Now delete any that are deleted by prior.
			for (let i: number = 0; i < prior.length; i++)
			{
				let eP: CounterEdit = prior.edits[i];
				if (eP[0] == OpCounterDel)
				{
					delete myEdits[eP[1]];
					bEdited = true;
				}
			}

			// Now restore edit array from edited object
			if (bEdited)
				this.fromObject(myEdits);
		}

	// compose two edit actions
	compose(rhs: OTCounterResource): void 			// throws on error
		{
			let lhsKeys: any = this.toObject();
			let rhsKeys: any = rhs.toObject();
			for (let i: number = 0; i < rhs.length; i++)
			{
				let eR: CounterEdit = rhs.edits[i];
				let eL: CounterEdit = lhsKeys[eR[1]];
				if (eL === undefined)
					lhsKeys[eR[1]] = [ eR[0], eR[1], eR[2] ];
				else
					eL[2] += eR[2];
			}
			this.fromObject(lhsKeys);
		}

	apply(startValue: any): any
		{
			if (startValue == null)
				startValue = { };
			for (let i: number = 0; i < this.length; i++)
			{
				let e: CounterEdit = this.edits[i];
				switch (e[0])
				{
					case OpCounterAdd:
						if (startValue[e[1]] === undefined)
							startValue[e[1]] = e[2];
						else
							startValue[e[1]] += e[2];
						break;
					case OpCounterDel:
						delete startValue[e[1]];
						break;
				}
			}
			return startValue;
		}

	minimize(): any
		{
			// No-op
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
