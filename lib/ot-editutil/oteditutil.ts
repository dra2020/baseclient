import * as LogAbstract from '../logabstract/all';
import * as OT from '../ot-js/all';

import * as DMP from "diff-match-patch";
let DiffMatchPatch = new DMP.diff_match_patch();
let DIFF_DELETE = DMP.DIFF_DELETE;
let DIFF_INSERT = DMP.DIFF_INSERT;
let DIFF_EQUAL = DMP.DIFF_EQUAL;

export class OTEditUtil
{
	// Data members
	ilog: LogAbstract.ILog;
	resourceID: string;
	resourceName: string;
	clientID: string;

	// Constructor
	constructor(ilog: LogAbstract.ILog, rid: string, cid: string, name: string)
		{
			this.ilog = ilog;
			this.resourceID = rid;
			this.clientID = cid;
			this.resourceName = name;
		}

	//
	// Function: insertAtStart
	//
	// Description:
	//	Generate an OTCompositeResource to insert a string at the start of a buffer of the given size.
	//

	insertAtStart(s: any, nCurrentLen: number): OT.OTCompositeResource
		{
			let edit = new OT.OTCompositeResource(this.resourceID, this.clientID);
			let sEdit = new OT.OTStringResource(this.resourceName);
			sEdit.edits.push([ OT.OpInsert, s.length, s ]);
			sEdit.edits.push([ OT.OpCursor, 0, '' ]);
			sEdit.edits.push([ OT.OpRetain, nCurrentLen, '' ]);
			edit.edits.push(sEdit);
			return edit;
		}

	//
	// Function: insertAtEnd
	//
	// Description:
	//	Generate an OTCompositeResource to insert a string at the end of a buffer of the given size.
	//

	insertAtEnd(s: any, nCurrentLen: number): OT.OTCompositeResource
		{
			let edit = new OT.OTCompositeResource(this.resourceID, this.clientID);
			let sEdit = new OT.OTStringResource(this.resourceName);
			sEdit.edits.push([ OT.OpRetain, nCurrentLen, '' ]);
			sEdit.edits.push([ OT.OpInsert, s.length, s ]);
			sEdit.edits.push([ OT.OpCursor, 0, '' ]);
			edit.edits.push(sEdit);
			return edit;
		}

	//
	// Function: injectCursor
	//
	// Inject start/end cursor positions into an existing string resource.
	//

	injectCursor(edit: OT.OTCompositeResource, start: number, end?: number): void
		{
			if (start === undefined) return;
			if (end === undefined) end = start;

			let sEdit: OT.OTStringResource = edit.findResource(this.resourceName) as OT.OTStringResource;
			if (sEdit == null)
				return;
			let cEdit: OT.OTStringResource = new OT.OTStringResource(this.resourceName);
			if (start != 0)
				cEdit.edits.push( [ OT.OpRetain, start, '' ] );
			cEdit.edits.push( [ OT.OpCursor, 0, this.clientID ] );
			if (end != start)
			{
				cEdit.edits.push( [ OT.OpRetain, end-start, '' ] );
				cEdit.edits.push( [ OT.OpCursor, 1, this.clientID ] );
			}
			let nFinal: number = sEdit.finalLength();
			if (end != nFinal)
				cEdit.edits.push( [ OT.OpRetain, nFinal-end, '' ] );
			sEdit.compose(cEdit);
		}

	//
	// Function: extractCursor
	//
	// Extract cursor information by client. Returns an object indexed by clientID with an object with
	// properties startSelection, endSelection.
	//

	extractCursor(edit: OT.OTCompositeResource): any
		{
			let cursors: any = { };
			let sEdit: OT.OTStringResource = edit.findResource(this.resourceName) as OT.OTStringResource;
			if (sEdit == null)
				return cursors;
			let pos: number = 0;
			for (let i: number = 0; i < sEdit.length; i++)
			{
				let a: OT.OTSingleArrayEdit = sEdit.edits[i];
				switch (a[0])
				{
					case OT.OpInsert:
						pos += a[1];
						break;
					case OT.OpDelete:
						break;
					case OT.OpRetain:
						pos += a[1];
						break;
					case OT.OpCursor:
						if (a[2] != '')	// should have clientID...
						{
							let sel: any = cursors[a[2]];	// a[2] is clientID
							if (sel === undefined) { sel = { }; cursors[a[2]] = sel; }
							if (a[1] == 0)
								sel['selectionStart'] = pos;	// 0 is selectionStart
							else
								sel['selectionEnd'] = pos;		// 1 is selectionEnd
						}
						break;
					case OT.OpSet:
						pos += a[1];
						break;
				}
			}
			return cursors;
		}

	//
	// Function: computeEdit
	//
	// Description:
	//	Given an old and new string, generate the (minimal) edits list necessary to convert the old
	//	string into the new string.
	//
	// 	This is useful if you're not actually tracking the specfic edit operations happening to the
	//	underlying string but rather just examining old and new values and trying to transmit
	//	minimal diffs.
	//
	//	There are various good algorithms for computing the "edit distance" between two strings.
	//	Here I've used the google DiffMatchPatch algorithm.
	//

	computeEdit(sOld: string, sNew: string): OT.OTCompositeResource
		{
			let edit = new OT.OTCompositeResource(this.resourceID, this.clientID);
			let sEdit = new OT.OTStringResource(this.resourceName);
			let diffs: DMP.Diff[] = DiffMatchPatch.diff_main(sOld, sNew);
			if (diffs)
				for (let i: number = 0; i < diffs.length; i++)
				{
					let diff: DMP.Diff = diffs[i];
					let s = diff[1];
					switch (diff[0])
					{
						case DIFF_DELETE:
							sEdit.edits.push([ OT.OpDelete, s.length, '' ]);
							break;
						case DIFF_INSERT:
							sEdit.edits.push([ OT.OpInsert, s.length, s ]);
							break;
						case DIFF_EQUAL:
							sEdit.edits.push([ OT.OpRetain, s.length, '' ]);
							break;
					}
				}

			edit.edits.push(sEdit);
			return edit;
		}
}
