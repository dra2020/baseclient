# baseclient
The Baseclient library pulls together the core set of libraries required by the various components of DRA2020A.
This includes:

- the nodejs hosted server
- serverless lambda functions
- command line utilities run under nodejs
- client application (browser-hosted) runtime

These libraries are all packaged in this repository. Normally they are included like this:

    import { Util, Poly } from '@dra2020/baseclient';

Then the various functions of the different sets are available under their appropriate symbol.

These libraries are used across both client and server:

- [Util](./docs/util.md): A set of fairly vanilla JavaScript utility functions.
- [Poly](./docs/poly.md): A set of functions for processing polygons, typically in GeoJSON format.
- [Context](./docs/context.md): A set of functions for interrogating the context supplied to the application, either as
- [FSM](./docs/fsm.md): A set of functions for managing asynchronous, chainable finite state machines.
- [LogAbstract](./docs/logabstract.md): An abstract logging interface. Different implementations are used on client and server.
- [LogClient](./docs/logclient.md): A client implementation of the logging abstract interface.
- [OT](./docs/ot-js.md): An Operational Transformation implementation, used as the basis for all content editing.
- [OTE](./docs/ot-editutil.md): A set of utility functions for creating OT edits.
- [FilterExpr](./docs/filterexpr.md): A class for parsing and executing a filter expression against an array of objects.
