import * as OT from '../ot-js/all';
import * as Util from '../util/all';

export const MERGE: number = 0;
export const REPLACE: number = 1;

export class Editor
{
  private engine: OT.OTEngine;
  private root: OT.OTCompositeResource;
  private stamps: OT.OTCounterResource;

  constructor(engine: OT.OTEngine)
    {
      this.engine = engine;
      this.root = null;
      this.stamps = null;
    }

  startLocalEdit(): void
    {
      if (this.root == null)
        this.root = this.engine.startLocalEdit();
    }

  stamp(rid: string, prop: string): void
    {
      if (this.stamps == null)
      {
        this.startLocalEdit();
        this.stamps = new OT.OTCounterResource(rid);
        this.root.edits.push(this.stamps);
      }
      this.stamps.edits.push([ OT.OpCounterAdd, prop, 1 ]);
    }

  set(rid: string, p: string, v: any): Editor
    {
      this.rawObject(rid).set(p, v);
      return this;
    }

  del(rid: string, p: string): Editor
    {
      this.rawObject(rid).del(p);
      return this;
    }

  rawObject(rid: string): OT.OTMapResource
    {
      this.startLocalEdit();
      return this.root.map(rid);
    }

  rawArray(rid: string): OT.OTArrayResource
    {
      this.startLocalEdit();
      return this.root.array(rid);
    }

  editCounter(rid: string, oNew: any, mode: number = MERGE): void
    {
      let oOld = this.engine.toPartialValue(rid);
      let aDiff: string[] = keyDiff(oOld, oNew);
      
      let mEdit = new OT.OTCounterResource(rid);

      // Propagate sets
      for (let i: number = 0; i < aDiff.length; i++)
        mEdit.edits.push([ OT.OpCounterAdd, aDiff[i], oNew[aDiff[i]] ]);

      // Also propagate deletes if REPLACE mode
      if (mode == REPLACE)
      {
        for (var p in oOld) if (oOld.hasOwnProperty(p))
          if (oNew[p] === undefined)
            mEdit.edits.push([ OT.OpCounterDel, p, 0 ]);
      }

      if (mEdit.edits.length)
      {
        this.startLocalEdit();
        this.root.edits.push(mEdit);
      }
    }

  editObject(rid: string, oNew: any, mode: number = MERGE): void
    {
      if (rid === 'stamps')
      {
        this.editCounter(rid, oNew, mode);
        return;
      }

      let oOld = this.engine.toPartialValue(rid);
      let aDiff: string[] = keyDiff(oOld, oNew);
      
      let mEdit = new OT.OTMapResource(rid);

      // Propagate sets
      for (let i: number = 0; i < aDiff.length; i++)
        mEdit.edits.push([ OT.OpMapSet, aDiff[i], oNew[aDiff[i]] ]);

      // Also propagate deletes if REPLACE mode
      if (mode == REPLACE)
      {
        for (var p in oOld) if (oOld.hasOwnProperty(p))
          if (oNew[p] === undefined)
            mEdit.edits.push([ OT.OpMapDel, p, 0 ]);
      }

      if (mEdit.edits.length)
      {
        this.startLocalEdit();
        this.root.edits.push(mEdit);
      }
    }

    editArray(rid: string, aNew: any[]): void
    {
      let aOld = this.engine.toPartialValue(rid);
      if (aOld == null) aOld = [];
      if (Util.deepEqual(aNew, aOld))
        return;

      let aEdit = new OT.OTArrayResource(rid);

      let i: number = 0;
      let iRetain: number = 0;
      for (; i < aNew.length && i < aOld.length; i++)
        if (Util.deepEqual(aNew[i], aOld[i]))
          iRetain++;
        else
        {
          if (iRetain > 0)
          {
            aEdit.edits.push([ OT.OpRetain, iRetain, [] ] );
            iRetain = 0;
          }
          aEdit.edits.push([ OT.OpSet, 1, [ aNew[i] ] ]);
        }
      // Preserve equal ones at end
      if (iRetain > 0)
        aEdit.edits.push([ OT.OpRetain, iRetain, [] ] );
      // Add new ones
      if (aNew.length > i)
        aEdit.edits.push([ OT.OpInsert, aNew.length - i, aNew.slice(i) ]);
      // Or delete old ones
      else if (aOld.length > i)
        aEdit.edits.push([ OT.OpDelete, aOld.length - i, [] ]);

      if (aEdit.edits.length)
      {
        this.startLocalEdit();
        this.root.edits.push(aEdit);
      }
    }

    edit(oNew: any): boolean
    {
      for (var p in oNew) if (oNew.hasOwnProperty(p))
        if (Array.isArray(oNew[p]))
          this.editArray(p, oNew[p]);
        else
          this.editObject(p, oNew[p]);
      return this.commit();
    }

    get length(): number
    {
      return this.root && this.root.edits ? this.root.edits.length : 0;
    }

    commit(): boolean
    {
      if (this.root)
      {
        try
        {
          if (this.root.edits.length)
            this.engine.addLocalEdit(this.root);
          this.root = null;
          this.stamps = null;
          return true;
        }
        catch (err)
        {
          // Really would like to log this, but effectively this is a programming error of mismatched bases.
          return false;
        }
      }
    }
}

function keyDiff(oOld: any, oNew: any): string[]
	{
		if (oNew == null)
			return [];

		let aDiff: string[] = [];
		for (var p in oNew) if (oNew.hasOwnProperty(p))
			{
				if (oOld == null || oOld[p] === undefined)
					aDiff.push(p)
				else if (! Util.deepEqual(oNew[p], oOld[p]))
					aDiff.push(p);
			}
		return aDiff;
	}
