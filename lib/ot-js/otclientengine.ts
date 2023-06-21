// Shared libraries
import * as LogAbstract from "../logabstract/all";

import * as OT from "./ottypes";
import * as OTC from "./otcomposite";
import * as OTE from "./otengine";

export class OTClientEngine extends OTE.OTEngine
{
	// Data members
	clientID: string;
	resourceID: string;
	isNeedAck: boolean;
	isNeedResend: boolean;
  bReadOnly: boolean;
	clientSequenceNo: number;
	stateServer: OTC.OTCompositeResource;
	stateLocal: OTC.OTCompositeResource;
  valCache: any;
  prefailCache: any;

	actionAllClient: OTC.OTCompositeResource;
	actionAllPendingClient: OTC.OTCompositeResource;
	actionSentClient: OTC.OTCompositeResource;
	actionSentClientOriginal: OTC.OTCompositeResource;
	actionServerInterposedSentClient: OTC.OTCompositeResource;

	// Constructor
	constructor(ilog: LogAbstract.ILog, rid: string, cid: string)
		{
      super(ilog);

			this.resourceID = rid;
			this.clientID = cid;
			this.initialize();
      this.bReadOnly = false;
      this.valCache = {};
		}

	initialize(): void
		{
      if (this.prefailCache === undefined && this.clientSequenceNo > 0)
        this.prefailCache = this.valCache;
			this.clientSequenceNo = 0;
			this.isNeedAck = false;
			this.isNeedResend = false;
			this.actionAllClient = new OTC.OTCompositeResource(this.resourceID, this.clientID);
			this.actionAllPendingClient = new OTC.OTCompositeResource(this.resourceID, this.clientID);
			this.actionSentClient = new OTC.OTCompositeResource(this.resourceID, this.clientID);
			this.actionSentClientOriginal = new OTC.OTCompositeResource(this.resourceID, this.clientID);
			this.actionServerInterposedSentClient = new OTC.OTCompositeResource(this.resourceID, this.clientID);
			this.stateServer = new OTC.OTCompositeResource(this.resourceID, this.clientID);
			this.stateLocal = new OTC.OTCompositeResource(this.resourceID, this.clientID);
		}

	// Members
	serverClock(): number
		{
			return this.stateServer.clock;
		}

  rid(): string
    {
      return this.resourceID;
    }

  cid(): string
    {
      return this.resourceID;
    }

  toPartialValue(resourceName: string): any
    {
      return this.valCache[resourceName];
    }

	toValue(): any
		{
			return this.valCache;
		}

  toPrefailValue(): any
    {
      return this.prefailCache;
    }

  clearPrefail(): void
    {
      delete this.prefailCache;
    }

  setReadOnly(b: boolean): void
    {
      if (b != this.bReadOnly)
      {
        this.bReadOnly = b;
        //No longer necessary - especially since we want to allow local edits to be applied for temporary work.
        //if (this.bReadOnly)
         // this.failbackToServerState();
      }
    }

  startLocalEdit(): OTC.OTCompositeResource
    {
      return new OTC.OTCompositeResource(this.resourceID, this.clientID);
    }

	isPending(): boolean
		{
			return this.isNeedResend || !this.actionAllPendingClient.isEmpty();
		}

	getPending(): OTC.OTCompositeResource
		{
			if (!this.isNeedResend && this.actionAllPendingClient.isEmpty())
				return null;
			else
			{
				// If "isNeedResend" I need to send the exact same event (instead of aggregating all pending)
				// because the server might have actually received and processed the event and I just didn't
				// receive acknowledgement. If I merge that event into others I'll lose ability to distinguish
				// that. Eventually when I re-establish communication with server I will get that event response
				// and can then move on.
				if (! this.isNeedResend)
				{
					this.actionSentClient = this.actionAllPendingClient.copy();
          //console.log(`ClientEngine:getPending: bump sequence count from ${this.clientSequenceNo}`);
					this.actionSentClient.clientSequenceNo = this.clientSequenceNo++;
					this.actionAllPendingClient.empty();
				}
				this.actionSentClient.clock = this.stateServer.clock;
				this.actionSentClientOriginal = this.actionSentClient.copy();
				this.actionServerInterposedSentClient.empty();
				this.isNeedAck = true;
				this.isNeedResend = false;
				return this.actionSentClient.copy();
			}
		}

	// When I fail to send, I need to reset to resend the event again
	resetPending(): void
		{
			if (this.isNeedAck)
			{
				this.isNeedAck = false;
				this.isNeedResend = true;
        //console.log('otclientengine: resetPending');
			}
      //else
       // console.log('otclientengine: resetPending ignored because isNeedAck false');
		}

	// When I don't accurately have server state - will then refresh from server
	failbackToInitialState(): void
		{
      console.log('otclientengine: failbackToInitialState');
      if (this.prefailCache === undefined)
        this.prefailCache = this.valCache;
			this.initialize();
		}

	// When I have server state but my state got mixed up
	failbackToServerState(): void
		{
      console.log('otclientengine: failbackToServerState');
      if (this.prefailCache === undefined)
        this.prefailCache = this.valCache;
			this.stateLocal = this.stateServer.copy();
			this.isNeedAck = false;
			this.actionSentClient.empty();
			this.actionSentClientOriginal.empty();
			this.actionServerInterposedSentClient.empty();
			this.actionAllPendingClient.empty();
			this.actionAllClient.empty();
      this.valCache = this.stateLocal.toValue();
      this.emit('state');
		}

	//
	// Function: OTClientEngine.addRemote
	//
	// Description:
	//	This function is really where the action is in managing the dynamic logic of applying OT. This is run
	//	on each end point and handles the events received from the server. This includes server acknowledgements
	//	(both success and failure) of locally generated events as well as all the events generated from other
	//	clients.
	//
	//	The key things that happen here are:
	//		1. Track server state.
	//		2. Respond to server acknowledgement of locally generated events. This also includes validation
	//			(with failback code) in case where server transformed my event in a way that was inconsistent
	//			with what I expected (due to insert collision that arose due to multiple independent events).
	//		3. Transform the incoming event (by local events) so it can be applied to local state.
	//		4. Transform pending local events so they can be dispatched to the service once the service
	//			is ready for another event.
	//

	addRemote(orig: OTC.OTCompositeResource): void
		{
			// Reset if server forces restart
			if (orig.clock == OTC.clockInitialValue)
			{
				this.failbackToInitialState();
				return;
			}

			// Reset if server restarted and we don't sync up
			if (orig.clock < 0)
			{
				// If server didn't lose anything I can just keep going...
				if (this.stateServer.clock+1 == -orig.clock)
					orig.clock = - orig.clock
				else
				{
					this.failbackToInitialState();
					return;
				}
			}

			// Ignore if I've seen this event already
			if (orig.clock <= this.serverClock())
			{
				return;
			}

			let bMine: boolean = orig.clientID == this.clientID;
			let bResend: boolean = bMine && orig.clock == OTC.clockFailureValue;
			let a: OTC.OTCompositeResource = orig.copy();

			if (bResend)
			{
				// Service failed my request. Retry with currently outstanding content.
				this.resetPending();
				return;
			}

			try
			{
				// Track server state and clock
				this.stateServer.compose(a);

				if (bMine)
				{
					// Validate that I didn't run into unresolvable conflict
					if (! this.actionServerInterposedSentClient.isEmpty())
					{
						this.actionSentClientOriginal.transform(this.actionServerInterposedSentClient, true);
						if (! this.actionSentClient.effectivelyEqual(this.actionSentClientOriginal))
						{
							this.failbackToServerState();
						}
					}

					// I don't need to apply to local state since it has already been applied - this is just an ack.
					this.isNeedAck = false;
					this.actionSentClient.empty();
					this.actionSentClientOriginal.empty();
					this.actionServerInterposedSentClient.empty();
					this.actionAllClient = this.actionAllPendingClient.copy();
				}
				else
				{
					// Transform server action to apply locally by transforming by all pending client actions
					a.transform(this.actionAllClient, false);

					// And then compose with local state
					this.stateLocal.compose(a);

					// Transform pending client by server action so it is rooted off the server state.
					// This ensures that I can convert the next server action I receive.
					this.actionAllClient.transform(orig, true);

					// Transform server action to be after previously sent client action and then
					// transform the unsent actions so they are ready to be sent.
					let aServerTransformed: OTC.OTCompositeResource = orig.copy();
					aServerTransformed.transform(this.actionSentClient, false);
					this.actionAllPendingClient.transform(aServerTransformed, true);

					// And then transform the sent client action so ready to be used for transforming next server event
					this.actionSentClient.transform(orig, true);

					// Track server operations interposed between a sent action
					if (this.isNeedAck)
						this.actionServerInterposedSentClient.compose(orig);

          // Let clients know
          this.valCache = this.stateLocal.toValue();
          this.emit('state');
				}
			}
			catch (err)
			{
        this.ilog.error("OTClientEngine.addRemote: unexpected exception: " + err);
				this.failbackToInitialState();
			}
		}

	//
	// Function: addLocalEdit
	//
	// Description:
	//	This is the logic for adding an action to the local state. The logic is straight-forward
	//	as we need to track:
	//		1. The composed set of unacknowledged locally generated events.
	//		2. The composed set of unsent locally generated events (queued until sent event is acknowledged).
	//		3. The local state.
	//		4. An undo operation.
	//
	addLocalEdit(orig: OTC.OTCompositeResource): void
		{
      //Comment out bReadOnly test to now allow changes to be locally applied for readonly sessions, for playing around.
      //Server still prevents any edits from actually being applied. And clientsession changes
      //Don't actually send edits as well.
      //if (! this.bReadOnly)
      {
        try
        {
          this.actionAllClient.compose(orig);
          this.actionAllPendingClient.compose(orig);
          this.stateLocal.compose(orig);
          this.valCache = this.stateLocal.toValue();
          this.emit('state');
        }
        catch (err)
        {
          this.ilog.error("OTClientEngine.addLocalEdit: unexpected exception: " + err);
          this.failbackToInitialState();
        }
      }
		}
};
