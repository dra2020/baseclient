
// Resource data type that supports basic OT inteface.
export interface IOTResource
{
	resourceName: string;
	underlyingType: string;
	edits: any[];

	// Normally defined by base class
	length: number;
	empty(): void;
	isEmpty(): boolean;

	// Copy an instance
	copy(): IOTResource;

	// Test whether two operations are effectively equivalent
	effectivelyEqual(rhs: IOTResource): boolean;

	// Core OT algorithm for this type
	transform(rhs: IOTResource, bPriorIsService: boolean): void;			// throws on error

  tryTransform(rhs: IOTResource, bPriorIsService: boolean): boolean;

	// compose two edit actions
	compose(rhs: IOTResource): void; 			// throws on error

  // tests if compose would succeed, false on failure to prevent throwing during compose and leaving in partial state
  tryCompose(rhs: IOTResource): boolean

	// apply this edit to an existing value, returning new value (if underlying type is mutable, may modify input)
	apply(startValue: any): any;

	// return a collapsed, minimal version of the operation, suitable for constructing from scratch from empty initial value
	minimize(): void;
}

// Useful base class
export class OTResourceBase implements IOTResource
{
	resourceName: string;
	underlyingType: string;
	edits: any[];

	constructor(rname: string, utype: string)
		{
			this.resourceName = rname;
			this.underlyingType = utype;
			this.edits = [];
		}

	get length(): number
		{
			return this.edits.length;
		}

	// Set an existing instance of the operation to be empty
	empty(): void
		{
			this.edits = [];
		}

	// Test
	isEmpty(): boolean
		{
			return this.edits.length == 0;
		}

	// Copy an instance
	copy(): OTResourceBase
		{
			throw "OTResourceBase.copy must be overridden in subclass";
		}

	// Test whether two operations are effectively equivalent
	effectivelyEqual(rhs: OTResourceBase): boolean
		{
			throw "OTResourceBase.effectivelyEqual must be overridden in subclass";
		}

	// Core OT algorithm for this type
	transform(rhs: OTResourceBase, bPriorIsService: boolean): void
		{
			throw "OTResourceBase.transform must be overridden in subclass";
		}

  // Test if transform would succeed, false on failure
  tryTransform(rhs: OTResourceBase, bPriorIsServer: boolean): boolean
    {
      return true;
    }

	// compose two edit actions
	compose(rhs: OTResourceBase): void
		{
			throw "OTResourceBase.compose must be overridden in subclass";
		}

  // test compose
  tryCompose(rhs: OTResourceBase): boolean
    {
      return true;
    }

	// apply this edit to an existing value, returning new value (if underlying type is mutable, may modify input)
	apply(startValue: any): any
		{
			throw "OTResourceBase.apply must be overridden in subclass";
		}

	minimize(): void
		{
			// Default implementation does nothing.
		}
}
