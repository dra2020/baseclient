# ot-js
This is a JavaScript version of a basic OT library that implements OT for strings, basic arrays and maps (dictionaries).
It presumes the approach used in Google Wave where a basic resource implements the key actions of "transform" and
"compose". Clients serialize through a central server (which transforms as necessary when the client changes were not
based off the tip). Clients receive the edit stream from the server and transform as necessary to update their local state.
As with Google Wave, this presumes only a single edit action is outstanding at each client (local edits are composed and
queued up until the outstanding action is acknowledged by the server).

This library also provides a general framework for extending to other data types, although requires that these data types
be well-known to the server and the client.

This code serves as the basis for both the server and the client implementation of OT (there is an example implementation
of both at dra2020/ot-js-server).

The basic structure is that a set of client interacts with the server to establish a composite resource made up of
named strings, arrays and maps that represent the shared client state. Clients submit "edits" to these resources and
the server mediates these, applying the basic OT algorithm to transform incoming events and the dispatch them to all
the clients.

The key types are described below.

## IOTResource (ottypes.ts)

This TypeScript interface defines the core functions necessary to implement OT for a new resource type.
The key function is "transform" which implements the core OT algorithm for this type. Note it takes a second boolean argument,
"bPrior" which indicates whether the argument will be applied prior to this one in the canonical server ordering.
This can be used to disambiguate situations that are otherwise ambiguous (e.g. classically, which action gets precedence
when two insertions occur at the same location). (Is the final canonical result "ab" or "ba"?)

The other key function with some complexity is "compose" which composes two operations into a new single operation
that achieves the same final effect. This is key to actually implementing the overall system as well as for efficiency.

Each resource defines an "edits" array which is composed of generic JavaScript objects suitable for serialization. This
array is passed "as is" as the definition of the operation that needs to be performed.

Each resource has a "name" which is used to support a composite collection of resources accessed by name.

Each resource has an "underlyingType" which defines the mechanism by which the appropriate resource class is instantiated
at the client and the server. The mechanism is extensible but requires that these be "well known" and pre-shared
between client and server.

## OTResourceBase (ottypes.ts)

This class implements the IOTResource interface and provides some additional useful utility functions. All new types should
extend from this class.

## OTCompositeResource (otcomposite.ts)

OTCompositeResource provides the mechanism for grouping a set of resources together, referenced by name. The client/server
engine implementation assume OTCompositeResource is the base resource shared between instances.

## OTArrayLikeResource (otarray.ts)

OTArrayLikeResource is the base class for array-like data types that support insert, delete, retain, cursor and set. This
class is further subclassed to support strings and generic arrays. This implements the guts of the hard OT algorithm for
strings.

## OTStringResource (otarray.ts)

Implements a shared string (e.g. for editing plain text).

## OTArrayResource (otarray.ts)

Implements a shared array. The content of any specific entry in the array can be any serializable JSON object, although 
the update to the object must be effectively atomic - there is no internal semantics around updating the value.

## OTMapResource (otmap.ts)

Implements a basic associative array with set and delete operations. Like OTArrayResource, the base data type can be any
serializable object but is always updated atomically.

## OTCounterResource (otcounter.ts)

Implements a basic associative array with add and delete operations. The values associated with the keys are integer counters
and the "add" operation increments (or decrements) the underlying value. Obviously this composes and transforms trivially.

## OTClientEngine (otclientengine.ts)

Implements the core client semantics of the OT process, as implemented in Google Wave. The core functions here are "addLocal"
which adds a local change to the local state and prepares it for sending to the server and "addRemote" which receives
an event from the server applies it to the local state. That event might be a response to sending up a local event.

The function "getPending" indicates when a pending event is available for send.

The client engine implements the required core semantics for the Google Wave OT implementation (which requires that any
local changes are queued locally while there is an outstanding request to the server). This logic here is a bit tricky so the
implementation here is critical to getting OT right.


## OTServerEngine (otserverengine.ts)

Implements the server processing (through the core function "addServer") for implementing the client-server OT algorithm.
The core model here is that the client can submit an event against an old state of the server as long as the server can
appropriately transform the event in order to apply it to the local state. This requires maintaining some ongoing log
of all states and events.
