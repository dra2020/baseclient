import * as OT from "./ottypes";
import * as OTA from "./otarray";
import * as OTM from "./otmap";
import * as OTC from "./otcounter";

export const clockInitialValue: number = -1;		// Initial value
export const clockTerminateValue: number = -2;		// Terminal action from client.
export const clockRandomizeValue: number = -3;		// Fill in with random data.
export const clockFailureValue: number = -4;		// Server failed to apply
export const clockInitializeValue: number = -5;		// Used to initialize client to a specific string value.
export const clockUndoValue: number = -6;			// Used to indicate we should generate an undo event.
export const clockSeenValue: number = -7;			// Server has already seen this event

export class OTCompositeResource extends OT.OTResourceBase
{
	resourceID: string;
	clientID: string;
	clock: number;
	clientSequenceNo: number;
	static typeRegistry: any;

	constructor(rid: string, cid: string)
		{
			super('root', 'composite');
			this.resourceID = rid;
			this.clientID = cid;
			this.clock = clockInitialValue;
			this.clientSequenceNo = 0;
		}

	static registerType(underlyingType: string, factory: (resourceName: string) => OT.OTResourceBase): void
		{
			if (OTCompositeResource.typeRegistry == null)
				OTCompositeResource.typeRegistry = { };
			OTCompositeResource.typeRegistry[underlyingType] = factory;
		}

	findResource(rname: string, utype: string = '', bConstruct: boolean = false): OT.IOTResource
		{
			for (let i: number = this.length-1; i >= 0; i--)
				if (this.edits[i].resourceName === rname)
					return this.edits[i];
			if (bConstruct)
			{
				let edit: OT.IOTResource = OTCompositeResource.constructResource(rname, utype);
				this.edits.push(edit);
				return edit;
			}
			else
				return null;
		}

  map(rid: string): OTM.OTMapResource
    {
      return this.findResource(rid, 'map', true) as OTM.OTMapResource;
    }

  array(rid: string): OTA.OTArrayResource
    {
      return this.findResource(rid, 'array', true) as OTA.OTArrayResource;
    }

  counter(rid: string): OTC.OTCounterResource
    {
      return this.findResource(rid, 'counter', true) as OTC.OTCounterResource;
    }

	garbageCollect(map: any): boolean
		{
			if (map)
			{
				let bDirty: boolean = false;
				for (let i: number = this.length-1; i >= 0; i--)
				{
					if (map[this.edits[i].resourceName] === undefined)
					{
						this.edits.splice(i, 1);
						bDirty = true;
					}
				}
				return bDirty;
			}
			else
				return false;	// If no resource map, we don't garbage collect
		}

	isEmpty(): boolean
		{
			// Canonical empty is an empty edits array, but an array of empty edits is always considered empty
			for (let i: number = 0; i < this.length; i++)
				if (! this.edits[i].isEmpty())
					return false;
			return true;
		}

	// Copy an instance
	copy(): OTCompositeResource
		{
			let c: OTCompositeResource = new OTCompositeResource(this.resourceID, this.clientID);
			c.clock = this.clock;
			c.clientSequenceNo = this.clientSequenceNo;
			for (let i: number = 0; i < this.length; i++)
				c.edits.push(this.edits[i].copy());
			return c;
		}

	// Test whether two operations are effectively equivalent
	effectivelyEqual(rhs: OTCompositeResource): boolean
		{
			// This should really be a structural error
			if (this.length != rhs.length)
				return false;
			for (let i: number = 0; i < this.length; i++)
			{
				let lhsEdit: OT.IOTResource = this.edits[i];
				let rhsEdit: OT.IOTResource = rhs.findResource(lhsEdit.resourceName);

				if ((rhsEdit == null && !lhsEdit.isEmpty()) || ! lhsEdit.effectivelyEqual(rhsEdit))
					return false;
			}
			return true;
		}

	// Core OT algorithm for this type
	transform(rhs: OTCompositeResource, bPriorIsService: boolean): void
		{
			for (let i: number = 0; i < rhs.length; i++)
			{
				let rhsEdit: OT.IOTResource = rhs.edits[i];
				let lhsEdit: OT.IOTResource = this.findResource(rhsEdit.resourceName, rhsEdit.underlyingType, false);
				if (lhsEdit)
					lhsEdit.transform(rhsEdit, bPriorIsService);
			}
		}

	// compose two edit actions
	compose(rhs: OTCompositeResource): void 			// throws on error
		{
			for (let i: number = 0; i < rhs.length; i++)
			{
				let rhsEdit: OT.IOTResource = rhs.edits[i];

				let lhsEdit: OT.IOTResource = this.findResource(rhsEdit.resourceName, rhsEdit.underlyingType, !rhsEdit.isEmpty());
				if (lhsEdit)
					lhsEdit.compose(rhsEdit);
			}

			this.clock = rhs.clock;
			this.clientSequenceNo = rhs.clientSequenceNo;
		}

	// apply this edit to an existing value, returning new value (if underlying type is mutable, may modify input)
	// For composite, takes array of values, returns array of results, one for each underlying resource.
	apply(runningValue: any): any
		{
			if (runningValue == null)
				runningValue = { };
			for (let i: number = 0; i < this.length; i++)
			{
				let e: OT.IOTResource = this.edits[i];
				runningValue[e.resourceName] = e.apply(runningValue[e.resourceName]);
			}
			return runningValue;
		}

  toPartialValue(resourceName: string): any
    {
      let e = this.edits.find(e => e.resourceName === resourceName);
      return e ? e.apply(null) : null;
    }

	toValue(): any
		{
			return this.apply(null);
		}

	minimize(): void
		{
			for (let i: number = 0; i < this.length; i++)
				this.edits[i].minimize();
		}

	static constructResource(rname: string, utype: string): OT.IOTResource
		{
			if (OTCompositeResource.typeRegistry == null)
			{
				//throw "OTCompositeResource.constructResource: no registered factories";
				// This is only place where Composite type knows of other types - could hoist to outer level
				OTCompositeResource.registerType('string', OTA.OTStringResource.factory);
				OTCompositeResource.registerType('array', OTA.OTArrayResource.factory);
				OTCompositeResource.registerType('map', OTM.OTMapResource.factory);
				OTCompositeResource.registerType('counter', OTC.OTCounterResource.factory);
			}

			let factory: (resourceName: string) => OT.OTResourceBase = OTCompositeResource.typeRegistry[utype];
			if (factory == null)
				throw "OTCompositeResource.constructResource: no registered factory for " + utype;
			return factory(rname);
		}

	// Deserialization
	static constructFromObject(o: any): OTCompositeResource
		{
			let cedit: OTCompositeResource = new OTCompositeResource("", "");
			if (o['resourceID'] !== undefined)
				cedit.resourceID = o['resourceID'];
			if (o['clientID'] !== undefined)
				cedit.clientID = o['clientID'];
			if (o['clock'] !== undefined)
				cedit.clock = Number(o['clock']);
			if (o['clientSequenceNo'] !== undefined)
				cedit.clientSequenceNo = Number(o['clientSequenceNo']);
			if (o['edits'] !== undefined)
			{
				let arrEdits: any = o['edits'];
				for (let i: number = 0; i < arrEdits.length; i++)
				{
					let a: any = arrEdits[i];
					let rname: string = a['resourceName'];
					let utype: string = a['underlyingType'];
					let edit: OT.IOTResource = this.constructResource(rname, utype);
					edit.edits = a['edits'];
					cedit.edits.push(edit);
				}
			}
			return cedit;
		}

	// Serialization
	toJSON(): any
		{
			let o: any = {
				"resourceID": this.resourceID,
				"clientID": this.clientID,
				"clock": this.clock,
				"clientSequenceNo": this.clientSequenceNo,
				"edits": [] };
			for (let i: number = 0; i < this.length; i++)
			{
				let edit: OT.IOTResource = this.edits[i];
				let oEdit: any = { "resourceName": edit.resourceName, "underlyingType": edit.underlyingType, "edits": edit.edits };
				o["edits"].push(oEdit);
			}
			return o;
		}

}
