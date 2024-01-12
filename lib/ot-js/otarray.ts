import * as OT from "./ottypes";

const TestUnitSize: number = 4;
let TestCounter: number = 0;

// Array Ops
export const OpInsert: number = 1;
export const OpDelete: number = 2;
export const OpRetain: number = 3;
export const OpCursor: number = 4;	// 2nd arg is 0/1 for start/end of region, 3rd arg is clientID
export const OpSet: number = 5;
export const OpTmpRetain: number = 6;

// Op, Len, Data
export type OTSingleArrayEdit = [number, number, any];
export type OTEdits = OTSingleArrayEdit[];

enum OTalignEdgesType { AlignForCompose, AlignForTransform };

// Set of interfaces that operates on the underlying array-like value type.
// If more efficient, can modify the initial argument and simply return it.
// Alternatively, can create new instance and return it (string works this way since
// underlying type is immutable).
// This is used for the array-like specialization of IOTInterface
export interface IOTArrayLikeOperations
{
	underlyingTypeName(): string;

	// Return empty instance
	empty(): any;

	// Insert new instance at position specified
	insert(t: any, pos: number, tInsert: any): any;				// Can modify input

	// Delete part of instance
	delete(t: any, pos: number, len: number): any;				// Can modify input

	// Set value of part of instance
	set(t: any, pos: number, tSet: any): any;					// Can modify input

	// append to instance (insert at end)
	append(t: any, tAppend: any): any;							// Can modify input

	// Take substring of instance
	substr(t: any, pos: number, len: number): any;				// Can modify input

	// Take substring of provided base value type and set
	substrOf(t: any, pos: number, len: number, tsub: any): any;	// Cannot modify input

	// Construct an instance N long
	constructN(n: number): any;

	// Test for equality
	equal(t1: any, t2: any): boolean;

	// copy an instance
	copy(t: any): any;											// Need to do deep copy if T is mutable.

	// Return length of instance
	length(t: any): number;
};

// Operates on a single "OTSingleArrayEdit", parameterized by an object that manipulates the underlying
// array-like value stored as the third property of the 3-element edit object.
export class OTSingleArrayEditor
{
	raw: IOTArrayLikeOperations;

	constructor(raw: IOTArrayLikeOperations)
		{
			this.raw = raw;
		}

	copy(a: OTSingleArrayEdit): OTSingleArrayEdit 		// If a[2] is mutable, need to override and do deep copy
		{ return [ a[0], a[1], this.raw.copy(a[2]) ]; }

	// Static Predicates for MoveAction
	isDelete(a: OTSingleArrayEdit): boolean { return a[0] == OpDelete; }
	isNotDelete(a: OTSingleArrayEdit): boolean { return a[0] != OpDelete; }
	isCursor(a: OTSingleArrayEdit): boolean { return a[0] == OpCursor; }
	isNotCursor(a: OTSingleArrayEdit): boolean { return a[0] != OpCursor; }
	isTmpRetain(a: OTSingleArrayEdit): boolean { return a[0] == OpTmpRetain; }
	isNotTmpRetainOrDelete(a: OTSingleArrayEdit): boolean { return (a[0] != OpTmpRetain && a[0] != OpDelete); }
	isTmpRetainOrDelete(a: OTSingleArrayEdit): boolean { return (a[0] == OpTmpRetain || a[0] == OpDelete); }

	// Other static predicates
	isIgnore(a: OTSingleArrayEdit): boolean { return a[0] < 0; }
	isNoOp(a: OTSingleArrayEdit): boolean { return a[1] === 0 && a[0] != OpCursor; }
	isEqual(a1: OTSingleArrayEdit, a2: OTSingleArrayEdit) { return a1[0] == a2[0] && a1[1] == a2[1] && this.raw.equal(a1[2], a2[2]); }

	// Helpers
	appendValue(a: OTSingleArrayEdit, s: any): void
		{ a[2] = this.raw.append(a[2], s); a[1] = a[1] + this.raw.length(s); }
	empty(a: OTSingleArrayEdit): void { a[0] = OpCursor; a[1] = 0; a[2] = this.raw.empty(); }
	setIgnore(a: OTSingleArrayEdit): void { if (a[0] > 0) a[0] = - a[0]; }
	substr(aIn: OTSingleArrayEdit, pos: number, len: number): void
		{
			let sSource: any = aIn[2];
			if (len > 0 && pos+len <= this.raw.length(sSource))
				aIn[2] = this.raw.substr(sSource, pos, len);
			aIn[1] = len;
		}
	substrFromRaw(aIn: OTSingleArrayEdit, pos: number, len: number, s: any): void
		{
			let sSource: any = s;
			if (len > 0 && pos+len <= this.raw.length(sSource))
				aIn[2] = this.raw.substr(sSource, pos, len);
			aIn[1] = len;
		}
	copyWithSubstr(aIn: OTSingleArrayEdit, pos: number, len: number): OTSingleArrayEdit
		{
			let aOut: OTSingleArrayEdit = this.copy(aIn);
			this.substr(aOut, pos, len);
			return aOut;
		}
};

export class OTStringOperations implements IOTArrayLikeOperations
{
	underlyingTypeName(): string { return 'string'; }
	empty(): any { return ''; }
	insert(a: any, pos: number, aInsert: any): any
		{
			let s: string = a as string;
			let sInsert: string = aInsert as string;
			return s.substr(0, pos) + sInsert + s.substr(pos);
		}
	delete(a: any, pos: number, len: number): any
		{
			let s: string = a as string;
			return s.substr(0, pos) + s.substr(pos+len);
		}
	set(a: any, pos: number, aSet: any): any
		{
			let s: string = a as string;
			let sSet: string = aSet as string;
			return s.substr(0, pos) + sSet + s.substr(pos+sSet.length);
		}
	append(a: any, aAppend: any): any
		{
			let s: string = a as string;
			let sAppend: string = aAppend as string;
			return s + sAppend;
		}
	substr(a: any, pos: number, len: number): any					// Can modify source
		{
			let s: string = a as string;
			return s.substr(pos, len);
		}
	substrOf(a: any, pos: number, len: number, aSub: any): any			// Copies from tsub argument
		{
			// a unused if not updated with return value contents
			let sSub: string = aSub as string;
			return sSub.substr(pos, len);
		}
	constructN(n: number): any
		{
			let x = ' ';
			let s = '';
			for (;;)
			{
				if (n & 1)
					s += x;
				n >>= 1;
				if (n)
					x += x;
				else
					break;
			}
			return s;
		}
	equal(a1: any, a2: any): boolean
		{
			let s1: string = a1 as string;
			let s2: string = a2 as string;
			return s1 === s2;
		}
	copy(a: any): any { return a; }
	length(a: any): number { return a.length; }
};

export class OTArrayOperations implements IOTArrayLikeOperations
{
	underlyingTypeName(): string { return 'array'; }
	empty(): any { return []; }
	insert(a: any, pos: number, aInsert: any): any
		{
			let arr: Array<any> = a as Array<any>;
			let arrInsert: Array<any> = aInsert as Array<any>;
			let arrReturn = Array(arr.length + arrInsert.length);
			let i: number, j: number;
			for (i = 0; i < pos; i++)
				arrReturn[i] = arr[i];
			for (j = 0; j < arrInsert.length; j++)
				arrReturn[i+j] = arrInsert[j];
			for (i = pos; i < arr.length; i++)
				arrReturn[i+j] = arr[i];
			return arrReturn;
		}
	delete(a: any, pos: number, len: number): any
		{
			let arr: Array<any> = a as Array<any>;
			arr.splice(pos, len);
			return arr;
		}
	set(a: any, pos: number, aSet: any): any
		{
			let arr: Array<any> = a as Array<any>;
			let arrSet: Array<any> = aSet as Array<any>;
			for (let i: number = 0; i < arrSet.length; i++)
				arr[i+pos] = arrSet[i];
			return arr;
		}
	append(a: any, aAppend: any): any
		{
			let arr: Array<any> = a as Array<any>;
			let arrAppend: Array<any> = aAppend as Array<any>;
			return arr.concat(arrAppend);
		}
	substr(a: any, pos: number, len: number): any					// Can modify source
		{
			let arr: Array<any> = a as Array<any>;
			return arr.slice(pos, pos+len);
		}
	substrOf(a: any, pos: number, len: number, aSub: any): any			// Copies from tsub argument
		{
			// a unused if not updated with return value contents
			let arrSub: Array<any> = aSub as Array<any>;
			return arrSub.slice(pos, pos+len);
		}
	constructN(n: number): any
		{
			return new Array(n);
		}
	equal(a1: any, a2: any): boolean
		{
			let arr1: Array<any> = a1 as Array<any>;
			let arr2: Array<any> = a2 as Array<any>;
			if (arr1.length != arr2.length)
				return false;
			for (let i: number = 0; i < arr1.length; i++)
				if (arr1[i] !== arr2[i])
					return false;
			return true;
		}
	copy(a: any): any
		{
			let arr: Array<any> = a as Array<any>;
			let arrRet = new Array(arr.length);
			for (let i: number = 0; i < arr.length; i++)
				arrRet[i] = arr[i];
			return arrRet;
		}
	length(a: any): number
		{
			return a.length;
		}
};

export class OTArrayLikeResource extends OT.OTResourceBase
{
	editor: OTSingleArrayEditor;

	constructor(ed: OTSingleArrayEditor, rname: string)
		{
			super(rname, ed.raw.underlyingTypeName());
			this.editor = ed;
		}

	copy(): OTArrayLikeResource
		{
			return null;	// Needs to be overridden
		}

	moveEdits(newA: OTEdits, iStart: number, iEnd?: number, pred?: (a: OTSingleArrayEdit) => boolean)
		{
			if (iEnd == undefined)
				iEnd = this.edits.length - 1;

			for (; iStart <= iEnd; iStart++)
			{
				let a: OTSingleArrayEdit = this.edits[iStart];
				if (!this.editor.isIgnore(a) && (pred == undefined || pred(a)))
					newA.push(a);
			}
		}

	equal(rhs: OTArrayLikeResource): boolean
		{
			if (this.length != rhs.length)
				return false;
			for (let i: number = 0; i < this.length; i++)
				if (! this.editor.isEqual(this.edits[i], rhs.edits[i]))
					return false;
			return true;
		}

	// Function: OTArrayLikeResource::effectivelyEqual
	//
	// Description:
	//	A looser definition than operator==. Returns true if two actions would result in the
	//	same final string. This ignores no-ops like OpCursor and allows different orderings of
	//	inserts and deletes at the same location.
	//
	//  Played around with different algorithms, but the simplest is probably just to apply
	//	the two actions and see if I get the same final string. Came up with an interesting
	//	algorithm of walking through comparing hashes, but that was not robust to operations
	//	being split into fragments and interposed with alternate ops (OpCursor or interleaving of Ins/Del)
	//	that still leave the string the same. If unhappy with this approach (which scales with size
	//	of string to edit rather than complexity of the edit), the other approach would be to canonicalize
	//	the edit operations (including removing cursor operations and normalizing order of deletes).
	//	(Added that version of the algorithm under #ifdef). Could also dynamically choose approach based
	//	on relative size of arrays.
	//
	effectivelyEqual(rhs: OTArrayLikeResource): boolean
		{
			// Exactly equal is always effectively equal
			if (this.equal(rhs))
				return true;

			if (this.originalLength() != rhs.originalLength())
				return false;

			// Preferred algorithm
			let s: any = this.editor.raw.constructN(this.originalLength());

			let sL: any = this.apply(s);
			let sR: any = rhs.apply(s);
			return sL === sR;

			// Alternate algorithm (see above)
			//let aL: OTArrayLikeResource = this.copy();
			//let aR: OTArrayLikeResource = rhs.copy();

			//aL.fullyCoalesce();
			//aR.fullyCoalesce();
			//return aL.equal(aR);
		}

	basesConsistent(rhs: OTArrayLikeResource): void
		{
			if (this.originalLength() != rhs.originalLength())
			{
				console.log("Logic Failure: transform: Bases Inconsistent.");
				throw("Logic Failure: transform: Bases Inconsistent.");
			}
		}

	originalLength(): number
		{
			let len: number = 0;

			for (let i: number = 0; i < this.length; i++)
			{
				let a: OTSingleArrayEdit = this.edits[i];
				if (a[0] == OpRetain || a[0] == OpDelete || a[0] == OpSet)
					len += a[1];
			}
			return len;
		}

	finalLength(): number
		{
			let len: number = 0;

			for (let i: number = 0; i < this.length; i++)
			{
				let a: OTSingleArrayEdit = this.edits[i];
				if (a[0] == OpRetain || a[0] == OpInsert || a[0] == OpSet)
					len += a[1];
			}
			return len;
		}

	apply(aValue: any): any
		{
			if (aValue == null)
				aValue = this.editor.raw.empty();
			let pos: number = 0;
			for (let i: number = 0; i < this.length; i++)
			{
				let a: OTSingleArrayEdit = this.edits[i];

				switch (a[0])
				{
					case OpRetain:
						pos += a[1];
						break;
					case OpCursor:
						break;
					case OpDelete:
						aValue = this.editor.raw.delete(aValue, pos, a[1]);
						break;
					case OpInsert:
						aValue = this.editor.raw.insert(aValue, pos, a[2]);
						pos += a[1];
						break;
					case OpSet:
						aValue = this.editor.raw.set(aValue, pos, a[2]);
						pos += a[1];
						break;
				}
			}
			return aValue;
		}

	coalesce(bDeleteCursor: boolean = false): void
		{
			if (this.length == 0)
				return;

			// coalesce adjoining actions and delete no-ops
			let newA: OTEdits = [];
			let aLast: OTSingleArrayEdit;
			for (let i: number = 0; i < this.length; i++)
			{
				let aNext: OTSingleArrayEdit = this.edits[i];
				if (this.editor.isNoOp(aNext) || (bDeleteCursor && aNext[0] == OpCursor))
					continue;

				if (newA.length > 0 && aNext[0] == aLast[0])
				{
					if (aNext[0] == OpInsert || aNext[0] == OpSet)
						this.editor.appendValue(aLast, aNext[2]);
					else
						aLast[1] += aNext[1];
				}
				else
				{
					newA.push(aNext);
					aLast = aNext;
				}
			}

			this.edits = newA;
		}

	// Function: fullyCoalesce
	//
	// Description:
	//	Heavier duty version of coalesce that fully normalizes so that two actions that result in same
	//	final edit are exactly the same. This normalizes order of insert/deletes and deletes OpCursor,
	//	and then does coalesce.
	//
	fullyCoalesce(): void
		{
			// TODO
			this.coalesce(true);
		}

	// Function: Invert
	//
	// Description:
	//	Given an action, convert it to its inverse (action + inverse) = identity (retain(n)).
	//
	//	Note that in order to compute the inverse, you need the input state (e.g. because in order to invert
	//	OpDelete, you need to know the deleted characters.
	//
	invert(sInput: any): void
		{
			let pos: number = 0;	// Tracks position in input string.

			for (let i: number = 0; i < this.length; i++)
			{
				let a: OTSingleArrayEdit = this.edits[i];

				switch (a[0])
				{
					case OpCursor:
						break;
					case OpRetain:
						pos += a[1];
						break;
					case OpInsert:
						a[2] = '';
						a[0] = OpDelete;
						break;
					case OpDelete:
						a[2] = this.editor.copyWithSubstr(sInput, pos, a[1]);
						a[0] = OpInsert;
						pos += a[1];
						break;
					case OpSet:
						a[2] = this.editor.copyWithSubstr(sInput, pos, a[1]);
						pos += a[1];
						break;
				}
			}
		}

	// Function: alignEdges
	//
	// Description:
	//	Slice up this action sequence so its edges align with the action sequence I am going to
	//	process it with. The processing (compose or transform) determines which actions Slice
	//	takes into account when moving the parallel counters forward. When processing for
	//	compose, deletes in rhs can be ignored. When processing for transform, inserts in both
	//	lhs and rhs can be ignored.
	//	

	alignEdges(rhs: OTArrayLikeResource, st: OTalignEdgesType): void
		{
			let posR: number = 0;
			let posL: number = 0;
			let iL: number = 0;
			let newA: OTEdits = [];
			let aAfter: OTSingleArrayEdit = undefined;
			let aL: OTSingleArrayEdit = undefined;

			for (let iR: number = 0; iR < rhs.length; iR++)
			{
				let aR: OTSingleArrayEdit = rhs.edits[iR];

				switch (aR[0])
				{
					case OpCursor:
						break;
					case OpInsert:
						break;
					case OpDelete:
						posR += aR[1];
						break;
					case OpSet:
						posR += aR[1];
						break;
					case OpRetain:
						posR += aR[1];
						break;
				}

				// Advance iL/posL to equal to posR
				while (posL < posR && (aAfter != undefined || iL < this.length))
				{
					if (aAfter == undefined)
					{
						aL = this.edits[iL];
						newA.push(aL);
						iL++;
					}
					else
					{
						aL = aAfter;
					}

					switch (aL[0])
					{
						case OpCursor:
							break;
						case OpInsert:
							if (st == OTalignEdgesType.AlignForCompose) posL += aL[1];
							break;
						case OpDelete:
							if (st == OTalignEdgesType.AlignForTransform) posL += aL[1];
							break;
						case OpSet:
							posL += aL[1];
							break;
						case OpRetain:
							posL += aL[1];
							break;
					}

					// Split this one if it spans boundary
					if (posL > posR)
					{
						let nRight: number = posL - posR;
						let nLeft: number = aL[1] - nRight;

						aAfter = this.editor.copyWithSubstr(aL, nLeft, nRight);
						this.editor.substr(aL, 0, nLeft);
						newA.push(aAfter);
						posL = posR;
					}
					else
						aAfter = undefined;
				}
			}

			// Append any we missed
			this.moveEdits(newA, iL);

			this.edits = newA;
		}
	
	getCursorCache(): any
		{
			let cursorCache: any = { };

			for (let i: number = 0; i < this.length; i++)
			{
				let a: OTSingleArrayEdit = this.edits[i];

				if (a[0] == OpCursor && a[2] != null)
					cursorCache[a[2]] = '';
			}
			return cursorCache;
		}

	// Function: compose
	//
	// Description:
	//	compose the current action with the action passed in. This alters the current action.
	//
	//	Basic structure is to walk through the RHS list of actions, processing each one in turn.
	//	That then drives the walk through the left hand side and the necessary edits. I use
	//	"posR" and "posL" to work through equivalent positions in the two strings being edited.
	//	Deletions in the LHS don't effect posL because they don't show up in the input string to RHS.
	//	Similarly, insertions in the RHS don't effect posR since they have no equivalent string location
	//	in the LHS.	(Note transform follows similar structure but different logic for how posR and posL
	//	track each other since in that case they are effectively referencing the same input string.)
	//
	compose(rhs: OTArrayLikeResource): void
		{
			let cursorCache: any = rhs.getCursorCache();

			if (this.length == 0)
			{
				this.edits = rhs.edits.map(this.editor.copy, this.editor);
				return;
			}
			else if (rhs.edits.length == 0)
				return;

			if (this.finalLength() != rhs.originalLength())
			{
				console.log("Logic Failure: compose: Bases Inconsistent.");
				throw("Logic Failure: compose: Bases Inconsistent.");
			}

			// Break overlapping segments before start to simplify logic below.
			this.alignEdges(rhs, OTalignEdgesType.AlignForCompose);

			// Iterate with parallel position markers in two arrays
			let posR: number = 0;
			let posL: number = 0;
			let iL: number = 0;
			let bDone: boolean;
			let newA: OTSingleArrayEdit[] = [];

			for (let iR: number = 0; iR < rhs.length; iR++)
			{
				let aR: OTSingleArrayEdit = rhs.edits[iR];

				switch (aR[0])
				{
					case OpRetain:
						posR += aR[1];
						break;

					case OpSet:
					case OpDelete:
					case OpInsert:
					case OpCursor:
						// Advance to cursor location
						bDone = false;
						while (!bDone && iL < this.length)
						{
							let aL: OTSingleArrayEdit = this.edits[iL];

							switch (aL[0])
							{
								case OpCursor:
									// Only copy old cursor locations if they aren't empty and aren't duplicated in this rhs.
									if (aL[2] != '' && cursorCache[aL[2]] === undefined)
										newA.push(aL);
									iL++;
									break;
								case OpSet:
								case OpRetain:
								case OpInsert:
									if (posL == posR)
										bDone = true;
									else
									{
										posL += aL[1];
										newA.push(aL);
										iL++;
									}
									break;
								case OpDelete:
									newA.push(aL);
									iL++;	// Move past since deletes are not referenced by RHS
									break;
							}
						}

						if (aR[0] == OpDelete)
						{
							// Remove sequence of cursor, insert, retains, sets, replaced by delete.
							// Note that insert/delete cancel each other out, so there is a bit of complexity there.
							let nChange: number = aR[1];
							let nRemain: number = aR[1];
							for (; nChange > 0 && iL < this.length; iL++)
							{
								let aL: OTSingleArrayEdit = this.edits[iL];

								switch (aL[0])
								{
									case OpCursor:
										// Only copy old cursor locations if they aren't empty and aren't duplicated in this rhs.
										if (aL[2] != '' && cursorCache[aL[2]] === undefined)
											newA.push(aL);
										break;
									case OpDelete:
										newA.push(aL);
										break;
									case OpSet:
									case OpRetain:
									case OpInsert:
										nRemain -= aL[0] == OpInsert ? aL[1] : 0;
										nChange -= aL[1];
										// Don't copy into new array
										break;
								}
							}

							// Now add in the delete
							if (nRemain > 0)
								newA.push([ OpDelete, nRemain, '' ]);
						}
						else if (aR[0] == OpSet)
						{
							// Process sequence of cursor, insert, retains, sets
							let nChange: number = aR[1];
							for (; nChange > 0 && iL < this.length; iL++)
							{
								let aL: OTSingleArrayEdit = this.edits[iL];
								let opL: number = OpInsert;

								switch (aL[0])
								{
									case OpCursor:
										// Only copy old cursor locations if they aren't empty and aren't duplicated in this rhs.
										if (aL[2] != '' && cursorCache[aL[2]] === undefined)
											newA.push(aL);
										break;
									case OpDelete:
										newA.push(aL);
										break;
									case OpSet:
									case OpRetain:
										opL = OpSet;
										// fallthrough
									case OpInsert:
										// A Set composed with Insert becomes Insert of Set content
										this.editor.substrFromRaw(aL, aR[1]-nChange, aL[1], aR[2]);
										aL[0] = opL;
										nChange -= aL[1];
										newA.push(aL);
										break;
								}
							}
						}
						else // cursor, insert
						{
							// Add in the RHS operation at proper location
							newA.push(this.editor.copy(aR));
						}
						break;
				}
			}

			// copy any remaining actions, excluding cursors duplicated in rhs
			this.moveEdits(newA, iL, this.length-1,
				function (e: OTSingleArrayEdit)
					{ return (e[0] != OpCursor) || (e[2] != '' && cursorCache[e[2]] === undefined) } );

			this.edits = newA;

			this.coalesce();
		}

	tryCompose(rhs: OTArrayLikeResource): boolean
		{
			if (this.length == 0)
        return true;
			else if (rhs.edits.length == 0)
				return true;

			return this.finalLength() == rhs.originalLength();
    }

	performTransformReorder(bForceRetainBeforeInsert: boolean, newA: OTEdits, iBegin: number, iEnd: number): void
		{
			if (iBegin < 0 || iBegin > iEnd) return;
			if (bForceRetainBeforeInsert)
			{
				this.moveEdits(newA, iBegin, iEnd, this.editor.isTmpRetainOrDelete);
				this.moveEdits(newA, iBegin, iEnd, this.editor.isNotTmpRetainOrDelete);	// Is Insert or Cursor
			}
			else
			{
				this.moveEdits(newA, iBegin, iEnd, this.editor.isNotTmpRetainOrDelete);	// Is Insert or Cursor
				this.moveEdits(newA, iBegin, iEnd, this.editor.isTmpRetainOrDelete);
			}
		}

	// Function: normalizeNewRetainsAfterTransform
	//
	// Description:
	//	Helper function for transform() that does a post-processing pass to ensure that all
	//	Retains are properly ordered with respect to Inserts that occur at the same location
	//	(either before or after, depending on whether we are transforming based on server or client side).
	//	This ensures that the transform process is not sensitive to precise ordering of Inserts and
	//	Retains (since that ordering doesn't actually change the semantics of the edit performed and
	//	therefore should not result in a difference in processing here). And yes, it's a subtle issue
	//	that may not actually occur in real edits produced by some particular editor but does arise when
	//	testing against randomly generated edit streams.
	//
	//	A side consequence is also normalizing the ordering of inserts and deletes which also doesn't
	//	change the semantics of the edit but ensures we properly detect conflicting insertions.
	//
	//	The way to think of this algorithm is that Set's and Retains (pre-existing, not new TmpRetains) form
	//	hard boundaries in the ordering. The series of Cursor/TmpRetain/Insert/Deletes between Sets and Retains
	//	are re-ordered by this algorithm. TmpRetain's get pushed to the front or the back depending on the bForce
	//	flag passed in (which reflects which operation had precedence).
	//
	normalizeNewRetainsAfterTransform(bForceRetainBeforeInsert: boolean): void
		{
			if (this.length == 0)
				return;

			let i: number = 0;
			let newA: OTSingleArrayEdit[] = [];
			let iLastEdge: number = 0;

			// Normalize ordering for newly insert retains so they are properly ordered
			// with respect to inserts occurring at the same location.
			for (i = 0; i < this.length; i++)
			{
				let a: OTSingleArrayEdit = this.edits[i];
				if (a[0] == OpSet || a[0] == OpRetain)
				{
					this.performTransformReorder(bForceRetainBeforeInsert, newA, iLastEdge, i-1);
					newA.push(a);
					iLastEdge = i+1;
				}
			}
			this.performTransformReorder(bForceRetainBeforeInsert, newA, iLastEdge, this.length-1);

			// One last time to switch TmpRetain to Retain
			for (i = 0; i < newA.length; i++)
				if ((newA[i])[0] == OpTmpRetain)
					(newA[i])[0] = OpRetain;
			this.edits = newA;
		}

  tryTransform(prior: OTArrayLikeResource, bPriorIsService: boolean): boolean
    {
			if (this.length == 0 || prior.length == 0)
				return true;

			return this.originalLength() == prior.originalLength();
    }

	transform(prior: OTArrayLikeResource, bPriorIsService: boolean): void
		{
			if (this.length == 0 || prior.length == 0)
				return;

			// Validate
			this.basesConsistent(prior);

			// Break overlapping segments before start to simplify logic below.
			this.alignEdges(prior, OTalignEdgesType.AlignForTransform);

			let posR: number = 0; // These walk in parallel across the consistent base strings (only retains, sets and deletes count)
			let posL: number = 0;
			let iL: number = 0;
			let bDone: boolean;
			let newA: OTEdits = [];

			for (let iR: number = 0; iR < prior.length; iR++)
			{
				let aR: OTSingleArrayEdit = prior.edits[iR];

				switch (aR[0])
				{
					case OpCursor:
						// No-op
						break;
					case OpInsert:
						{
						// Converts to a retain.
						// Need to find spot to insert retain. After loop, iL will contain location
						for (; iL < this.length; iL++)
						{
							if (posR == posL)
								break;

							let aL: OTSingleArrayEdit = this.edits[iL];
							if (this.editor.isIgnore(aL))
								continue;
							if (aL[0] != OpCursor && aL[0] != OpInsert)
								posL += aL[1];
							newA.push(aL);
						}
						let nRetain: number = aR[1];
						newA.push([ OpTmpRetain, nRetain, '' ]);
						posR += nRetain;
						posL += nRetain;
						}
						break;
					case OpSet:
						// Somewhat unintuitively, if prior is *not* service, then it will actually get applied *after*
						// the service instance of OpSet and so should take precedence. Therefore if prior is not service,
						// we need to go through and convert "OpSets" that overlap to be this content. If prior is service,
						// we can just treat them as "retains" since they have no effect on our operations.
						if (bPriorIsService)
							posR += aR[1];
						else
						{
							let nRemaining: number = aR[1];
							while (nRemaining > 0 && iL < this.length)
							{
								let aL: OTSingleArrayEdit = this.edits[iL];
								if (this.editor.isIgnore(aL))
								{
									iL++;
									continue;
								}
								let valL: number = aL[1];

								if (aL[0] == OpCursor || aL[0] == OpInsert)
								{
									iL++;
									newA.push(aL);
								}
								else
								{
									if (posR >= posL+valL)
									{
										// Not there yet
										posL += valL;
										iL++;
										newA.push(aL);
									}
									else
									{
										if (aL[0] == OpDelete || aL[0] == OpRetain)
										{
											if (valL <= nRemaining)
											{
												posR += valL;
												posL += valL;
												nRemaining -= valL;
												iL++;
												newA.push(aL);
											}
											else
											{
												// Not subsumed, but means that I didn't encounter an OpSet
												posR += nRemaining;
												nRemaining = 0;
											}
										}
										else // OpSet
										{
											if (aL[1] <= nRemaining)
											{
												posR += valL;
												posL += valL;
												this.editor.substrFromRaw(aL, aR[1] - nRemaining, valL, aR[2]);
												nRemaining -= valL;
												iL++;
												newA.push(aL);
											}
											else
											{
												// don't advance posL or iL because we will re-process the left over
												// part for the next action. Simply edit the data in place.
												// Set [0, nRemaining] of aL.Data to [aR[1]-nRemaining, nRemaining]
												//aL.Data.delete(0, nRemaining);
												//aL.Data.InsertValue(0, aR.Data, aR[1]-nRemaining, nRemaining);
												aL[2] = aR[2].substr(aR[1] - nRemaining) + aL[2].substr(nRemaining);
												posR += nRemaining;
												nRemaining = 0;
											}
										}
									}
								}
							}
						}
						break;
					case OpDelete:
						{
						let nRemaining: number = aR[1];
						let nDelay: number = 0;
						let iDelay: number;

						// Retains, sets and deletes are subsumed by prior deletes
						for (; nRemaining > 0 && iL < this.length; iL++)
						{
							let aL: OTSingleArrayEdit = this.edits[iL];
							if (this.editor.isIgnore(aL))
							{
								if (nDelay > 0)
									nDelay++;
								continue;
							}

							if (aL[0] == OpCursor || aL[0] == OpInsert)
							{
								if (nDelay == 0)
									iDelay = iL;
								nDelay++;
							}
							else
							{
								if (posR >= posL+aL[1])
								{
									// Go ahead and push any delayed actions
									for (let j: number = iDelay; nDelay > 0; nDelay--, j++)
									{
										let aD: OTSingleArrayEdit = this.edits[j];
										if (! this.editor.isIgnore(aD))
											newA.push(aD);
									}

									// Prior to the deleted content
									posL += aL[1];
									newA.push(aL);
								}
								else
								{
									// Retain/set/delete is fully subsumed.
									posR += aL[1];
									posL += aL[1];
									nRemaining -= aL[1];
									this.editor.setIgnore(aL);
									if (nDelay > 0)
										nDelay++;
								}
							}
						}

						// We want to reprocess any trailing insert/cursors so we recognize conflicting inserts even when
						// deletes intervene.
						if (nDelay > 0)
							iL = iDelay;
						}
						break;
					case OpRetain:
						// Just advance cursor
						posR += aR[1];
						break;
				}
			}

			this.moveEdits(newA, iL);
			this.edits = newA;
			this.normalizeNewRetainsAfterTransform(bPriorIsService);
			this.coalesce();
		}

	//
	// Function: generateRandom
	//
	// Description:
	//	Generate action containing a sequence of retain, insert, delete, cursor with the initial
	//	state of the string being nInitial. Make sure I always generate at least one insert or delete.
	//	Always operate in units of 4 (.123).
	//
	generateRandom(nInitial: number, clientID: string): void
		{
			// Ensure clean start
			this.empty();

			// Setup randomizer
			let nOps: number = 0;
			let nLen: number;
			let nBound: number;
			let s: any;

			while (nInitial > 0 || nOps == 0)
			{
				let op: number = randomWithinRange(0, 4);

				nBound = nInitial / TestUnitSize;
				if (nInitial == 0 && (op == OpDelete || op == OpRetain || op == OpSet))
					continue;
				switch (op)
				{
					case OpInsert:
						nOps++;
						nLen = randomWithinRange(1, 5);
						s = this.editor.raw.empty();
						for (let i: number = 0; i < nLen; i++)
							s = this.editor.raw.append(s, counterValue(this.editor.raw, TestCounter++));
						nLen *= TestUnitSize;
						this.edits.push([ OpInsert, nLen, s ]);
						break;
					case OpDelete:
						nOps++;
						nLen = randomWithinRange(1, nBound > 3 ? nBound / 3 : nBound);
						nLen *= TestUnitSize;
						nInitial -= nLen;
						this.edits.push([ OpDelete, nLen, this.editor.raw.empty() ]);
						break;
					case OpCursor:
						this.edits.push([ OpCursor, 0, clientID ]);
						break;
					case OpRetain:
						nLen = randomWithinRange(1, nBound);
						nLen *= TestUnitSize;
						nInitial -= nLen;
						this.edits.push([ OpRetain, nLen, this.editor.raw.empty() ]);
						break;
					case OpSet:
						nLen = 1;
						s = this.editor.raw.empty();
						for (let i: number = 0; i < nLen; i++)
							this.editor.raw.append(s, counterValue(this.editor.raw, TestCounter++));
						nLen *= TestUnitSize;
						nInitial -= nLen;
						this.edits.push([ OpSet, nLen, s ]);
						break;
				}
			}

			// Most importantly ensures canonical ordering of inserts and deletes.
			this.coalesce();
		}
}

export class OTStringResource extends OTArrayLikeResource
{
	static _editor: OTSingleArrayEditor = new OTSingleArrayEditor(new OTStringOperations());
	constructor(rname: string)
		{
			super(OTStringResource._editor, rname);
		}
	static factory(rname: string): OTStringResource { return new OTStringResource(rname); }
	copy(): OTStringResource
		{
			let copy: OTStringResource = new OTStringResource(this.resourceName);
			copy.edits = this.edits.map(copy.editor.copy, copy.editor);
			return copy;
		}
}

export class OTArrayResource extends OTArrayLikeResource
{
	static _editor: OTSingleArrayEditor = new OTSingleArrayEditor(new OTArrayOperations());
	constructor(rname: string)
		{
			super(OTArrayResource._editor, rname);
		}
	static factory(rname: string): OTArrayResource { return new OTArrayResource(rname); }

	copy(): OTArrayResource
		{
			let copy: OTArrayResource = new OTArrayResource(this.resourceName);
			copy.edits = this.edits.map(copy.editor.copy, copy.editor);
			return copy;
		}
}

function randomWithinRange(nMin: number, nMax: number): number
{
	return nMin + Math.floor(Math.random() * (nMax - nMin + 1));
}

function counterValue(ops: IOTArrayLikeOperations, c: number): any
{
	switch (ops.underlyingTypeName())
	{
		case 'string':
			{
				let a: string[] = new Array(TestUnitSize);
				a[0] = '.';
				for (let j: number = 1; j < TestUnitSize; j++, c = Math.floor(c / 10))
					a[TestUnitSize - j] = "" + (c % 10);
				return a.join('');
			}
		case 'array':
			{
				let a: number[] = new Array(TestUnitSize);
				for (let i: number = 0; i < TestUnitSize; i++, c += 0.1)
					a[i] = c;
				return a;
			}
		default:
			throw "counterValue: Unexpected underlying array-like type."
	}
}
