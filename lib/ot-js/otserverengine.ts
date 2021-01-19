// Shared libraries
import * as LogAbstract from '../logabstract/all';

// Local libraries
import * as OT from "./ottypes";
import * as OTC from "./otcomposite";
import * as OTS from "./otsession";
import * as OTE from "./otengine";

export const ClientIDForServer: string = '-Server-';

export class OTServerEngine extends OTE.OTEngine
{
  // Data members
  stateServer: OTC.OTCompositeResource;
  logServer: OTC.OTCompositeResource[];
  valCache: any;
  fullCache: any;
  highSequence: any;
  clientSequenceNo: number;

  // Constructor
  constructor(ilog: LogAbstract.ILog, rid: string)
    {
      super(ilog);

      this.stateServer = new OTC.OTCompositeResource(rid, "");
      this.logServer = [];
      this.highSequence = {};
      this.clientSequenceNo = 0;
      this.valCache = {};
      this.fullCache = null;
    }

  serverClock(): number
    {
      return this.stateServer.clock;
    }

  rid(): string
    {
      return this.stateServer.resourceName;
    }

  cid(): string
    {
      return ClientIDForServer;
    }

  startLocalEdit(): OTC.OTCompositeResource
    {
      return new OTC.OTCompositeResource(this.rid(), this.cid());
    }

  resetCaches(): void
    {
      this.valCache = {};
      this.fullCache = null;
    }

  toPartialValue(resourceName: string): any
    {
      if (this.valCache[resourceName] === undefined)
        this.valCache[resourceName] = this.stateServer.toPartialValue(resourceName);
      return this.valCache[resourceName];
    }

  toValue(): any
    {
      // In general, server does not require this but maybe for testing purposes
      if (this.fullCache == null)
        this.fullCache = this.stateServer.toValue();
      return this.fullCache;
    }

  getProp(s: string): any
    {
      let o = this.toPartialValue('WellKnownName_meta');
      return o == null ? '' : o[s];
    }

  getName(): string
    {
      return this.getProp('name');
    }

  getType(): string
    {
      return this.getProp('type');
    }

  getDescription(): string
    {
      return this.getProp('description');
    }

  getCreatedBy(): string
    {
      return this.getProp('createdby');
    }

  getCreateTime(): string
    {
      return this.getProp('createtime');
    }

  getCreatedByName(): string
    {
      let s: string = this.getCreatedBy();
      if (s != '')
      {
        let users: any = this.toPartialValue('WellKnownName_users');
        if (users && users[s] && users[s]['name'])
          return users[s]['name'];
      }

      return '';
    }

  hasSeenEvent(orig: OTC.OTCompositeResource): boolean
    {
      let clientSequenceNo: any = this.highSequence[orig.clientID];
      let bSeen = (clientSequenceNo !== undefined && Number(clientSequenceNo) >= orig.clientSequenceNo);
      return bSeen;
    }

  isNextEvent(orig: OTC.OTCompositeResource): boolean
    {
      let nSeen: any = this.highSequence[orig.clientID];
      let bNext = (nSeen === undefined && orig.clientSequenceNo == 0)
          || (Number(nSeen)+1 == orig.clientSequenceNo);
      if (! bNext)
      {
        if (nSeen === undefined)
          this.ilog.event( { event: 'OT anomaly: non-zero client seqNo for new client', sessionid: this.stateServer.resourceID } );
        else
          this.ilog.event( { event: 'OT anomaly: unexpected client seqNo', sessionid: this.stateServer.resourceID } );
      }
      return bNext;
    }

  rememberSeenEvent(orig: OTC.OTCompositeResource): void
    {
      this.highSequence[orig.clientID] = orig.clientSequenceNo;
    }

  forgetEvents(orig: OTC.OTCompositeResource): void
    {
      delete this.highSequence[orig.clientID];
    }
  
  clientHighSequence(cid: string): number
    {
      let clientSequenceNo: any = this.highSequence[cid];

      return clientSequenceNo === undefined ? 0 : Number(clientSequenceNo);
    }

  garbageCollect(): void
    {
      let resources = this.toPartialValue('WellKnownName_resource');
      if (this.stateServer.garbageCollect(resources))
      {
        this.resetCaches();
        this.emit('state');
      }

      // TODO: Also remove entries from log to minimize memory use.
    }

  // Function: addServer
  //
  // Description:
  //  This is the server state update processing upon receiving an event from an endpoint.
  //  The received event is transformed (if possible) and added to the server state.
  //  The logic here is straight-forward - transform the incoming event so it is relative to
  //  the current state and then apply.

  addServer(orig: OTC.OTCompositeResource): number
    {
      try
      {
        // First transform, then add to log
        let i: number;
        let a: OTC.OTCompositeResource = orig.copy();

        for (i = this.logServer.length; i > 0; i--)
        {
          let aService: OTC.OTCompositeResource = this.logServer[i-1];

          if (aService.clock == a.clock)
            break;
        }

        // Handle if we've seen it already (client did not receive ack, probably communication error on response)
        if (this.hasSeenEvent(orig))
        {
          // Treat this as success if we still have event in log - the client did not receive an
          // ack but is now re-connected and will get resynced correctly.
          if (i > 0)
          {
            this.ilog.event({ sessionid: this.stateServer.resourceID, event: `addServer: duplicate event: no problem` });
            //console.log('addServer: seen event - handling cleanly');
            return OTS.ESuccess;
          }
          else
          {
            //console.log('addServer: seen event - resetting client');
            this.ilog.event({ sessionid: this.stateServer.resourceID, event: `addServer: duplicate event: resetting client` });
            this.forgetEvents(orig);  // we are now resetting client in this case, so forget this client
            return OTS.EClockSeen;
          }
        }

        // If this isn't next in sequence, I lost one (probably because I went "back in time"
        // due to server restart). In that case client is forced to re-initialize (losing local
        // edits). I also need to re-initialize sequence numbering.
        if (! this.isNextEvent(orig))
        {
          //console.log('addServer: received out-of-order (future) event');
          this.ilog.event({ sessionid: this.stateServer.resourceID, event: `addServer: received out-of-order event` });
          this.forgetEvents(orig);
          return OTS.EClockAnomaly;
        }

        // Fail if we have discarded that old state
        if (a.clock >= 0 && i == 0)
        {
          this.ilog.event({ sessionid: this.stateServer.resourceID, event: `addServer: received old event` });

          // This should really be ClockFailure which would force the client to resend with a newer
          // clock value. But there appears to be a bug when session is reloaded that results in
          // client never getting synced up. So for now force a reset (which might result in some
          // client edits being discarded).
          this.forgetEvents(orig);
          return OTS.EClockReset;
          //return OTS.EClockFailure;
        }

        // OK, all good, transform and apply
        if (i < this.logServer.length)
        {
          let aPrior: OTC.OTCompositeResource = this.logServer[i].copy();

          for (i++; i < this.logServer.length; i++)
            aPrior.compose(this.logServer[i]);

          a.transform(aPrior, true);
        }

        a.clock = this.stateServer.clock + 1;
        this.stateServer.compose(a);
        this.resetCaches();
        this.emit('state');
        this.logServer.push(a.copy());

        this.rememberSeenEvent(orig);
        return OTS.ESuccess;
      }
      catch (err)
      {
        this.ilog.error('addServer: unexpected exception');
        this.forgetEvents(orig);
        return OTS.EClockReset;
        //return OTS.EClockFailure;
      }
    }

  addLocalEdit(orig: OTC.OTCompositeResource): void
    {
      orig.clock = this.serverClock();
      orig.clientSequenceNo = this.clientSequenceNo++;
      let errno: number = this.addServer(orig);
    }

  toJSON(): any
    {
      let log: any[] = [];
      for (let i: number = 0; i < this.logServer.length; i++)
        log.push(this.logServer[i].toJSON());
      return { state: this.stateServer.toJSON(), highSequence: this.highSequence, log: log };
    }

  validateLog(): void
    {
      // Yikes, invalid log created by bad revision reverting - validate on load and truncate if necessary
      try
      {
        if (this.logServer.length > 0)
        {
          let aPrior: OTC.OTCompositeResource = this.logServer[0].copy();

          for (let i: number = 1; i < this.logServer.length; i++)
            aPrior.compose(this.logServer[i]);
        }
      }
      catch (err)
      {
        this.ilog.event({ sessionid: this.stateServer.resourceID, event: `OTServer: corrupted log truncated` });
        this.logServer = [];
        this.logServer.push(this.stateServer.copy());
      }
    }

  loadFromObject(o: any): void
    {
      if (o.state !== undefined)
      {
        this.stateServer = OTC.OTCompositeResource.constructFromObject(o.state);
        this.logServer = [];
        this.resetCaches();
        this.emit('state');
      }
      if (o.log !== undefined)
      {
        for (let i: number = 0; i < o.log.length; i++)
          this.logServer.push(OTC.OTCompositeResource.constructFromObject(o.log[i]));
        this.validateLog();
      }
      else
      {
        this.logServer = [];
        this.logServer.push(this.stateServer.copy());
      }
      if (o.highSequence !== undefined)
        this.highSequence = o.highSequence;
      this.clientSequenceNo = this.clientHighSequence(ClientIDForServer) + 1;
    }
}
