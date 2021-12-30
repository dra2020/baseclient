# DataFlow
Library for managing the synchronous execution of a series of data flow computations
that are recomputed only when inputs explicitly change (go "stale").

# Overview

A common design problem in interactive applications is that you have a set of base data
objects that are changing over time and then a set of derived data objects that are computed by
some functions over those base data objects.

In order to optimize interactive performance, you would like to minimize the amount of recomputation
that needs to happen when base data objects change to only those set of derived objects that are
actually impacted by the change. In order to ensure correctness, you want to ensure that they do
indeed get recomputed when the inputs have changed.

A common technique is to have the base data objects expose some `stamp` - perhaps simply a monotonically
increasing integer change stamp, a timestamp, or a content-based hash or even an entire new object that represents
the state of the world (libraries that implement `immutable` objects tend to work this way).
Dependent objects then keep track of the value of the `stamp` when they were computed.
Next time they are asked to compute their value, they can examine this saved stamp against the current
stamp value and only recompute if there has been a change.

Often derived objects are computed off some combination of base objects and so are maintaining and tracking
multiple stamps. A derived data object might also itself serve as the input to another derived computation.

The result is that you have a tree of data flows and would like to prune the computation to only compute
what is necessary based on the base changes that actually occurred.

The `DataFlow` class allows you to manage this set of computations in a structured way that makes the
dependencies explicit and handles the basic bookkeeping around changing and tracking stamps.

A base data object needs to simply match the `IDataFlow` interface to participate in the dataflow computation:

```javascript
interface IDataFlow {
  dfid: () => any
}
```

The `dfid` function is the `stamp` and should match the data flow semantics: it changes when dependent
derived objects need to be recomputed and can be tested against a previous stamp using JavaScript 
exact equivalence (===).

# Example

A derived data object should extend off the `DataFlow` class.

That object should describe its dependencies by the `uses` function. Here's a full class that we will walk through.

(Note that in the example below we have our class take a `IDataFlow` object in the constructor.
Normally it would take some object that exposes the data it needs to use for computing its value and
either matches the `IDataFlow` interface or exposes a sub-object that does and can be passed to the `uses` function call.
For simplicity I just had it take an `IDataFlow`.)

```javascript
class MyComputation extends DataFlow
{
  basedata: IDataFlow;
  _myresult: any;

  constructor(basedata: IDataFlow)
  {
    super();
    this.basedata = basedata;
    this.uses(basedata);
  }

  dfid(): any { this.ifcompute(); return this._myresult }

  myresult(): any { this.ifcompute(); return this._myresult }

  compute(): void
  {
    // compute _myresult from basedata
    // maybe only change _myresult conditionally - the change in basedata might have been irrelevant
  }
}
```

This class has a number of common characteristics you find in many `DataFlow` subclasses:

- It extends from the `DataFlow` class to inherit the basic change tracking mechanism.

- It defines its own dfid function so it can act as an internal node in a larger data flow computation.

- It defines a `compute` function that does the actual work of computing the derived result. This function might
examine the basedata object to determine if its value (`_myresult`) actually does change. If it doesn't need to
change, it would ensure that any downstream data flow nodes are not forced to recompute by leaving `_myresult`
unchanged.

- It uses the helper member function `ifcompute` to determine whether it needs to recompute its result. This function is
simply:

```javascript
ifcompute(): void
{
  if (this.usesStale())
  {
    this.usesRemember();
    this.compute();
  }
}
```

The function `usesStale` simply tests whether any nodes this object `uses` have changed in value since the last time
they were remembered. If the inputs are stale, the function calls `usesRemember` to remember the stamps (dfid) of the
inputs and calls the (typically overridden) `compute` function to perform the actual computation.

# wasStale

The helper function `wasStale` can be used inside a `compute` implementation to test a specific input for staleness.
That is, `compute` will be called when _any_ of its inputs are stale. In some cases, `compute` can be optimized if
it knows which specific inputs are stale. In order to use `wasStale`, provide an extra `name` argument to the `uses` call
for that input.

If you are considering using `wasStale`, also consider whether you might instead define an additional node in the data flow
tree that performs this pruning rather than embedding it inside your `compute` implementation.

# Common Patterns

There are some common patterns that recur when using `DataFlow`.

- A base object participates by simply exposing a `dfid` function over a pre-existing stamp that matches the DataFlow
semantics.

- A node acts as a _throttle_ or _gate_ to the computation tree by taking a dependency on an object that is promiscuous
about announcing changes and verifies that subsequent nodes are actually impacted. Those can then be simpler in
assuming that they should really recompute rather than mixing special checks into the internals of their `compute`
implementation. In fact, it is just this process of pulling out special "optimizations" around recomputation into
an explicit tree of dependencies that makes the `DataFlow` structure an improvement in the design of your application.

- An object just performs actions based on whether some input has changed. That is, it doesn't actual produce an
explicit result. The DataFlow model is a _pull_ model, so recomputation only happens when the result is actually
requested. In the case of side-effects, a common approach is to simply define a *root* `DataFlow` node and make this
node dependent on your classes that work through side-effects. At some appropriate point, `root.ifcompute()` is called
and the dependents are evaluated, triggering any side-effects.

- Some class computes multiple outputs. It is a common scenario that a node walking over some structure might actually
optimize by computing multiple outputs. In this case, you call ifcompute() before either output is requested,
but secondary calls will not need to do any work. So it would look something like this:

```javascript
class TwoOutputs extends DataFlow
{
  basedata: IDataFlow;
  _myresult1: any;
  _myresult2: any;

  constructor(basedata: IDataFlow)
  {
    super();
    this.basedata = basedata;
    this.uses(basedata);
  }

  // Just pick one output that matchs DataFlow semantics, or create an explicit additional stamp
  dfid(): any { this.ifcompute(); return this._myresult1 }

  myresult1(): any { this.ifcompute(); return this._myresult1 }
  myresult2(): any { this.ifcompute(); return this._myresult2 }

  compute(): void
  {
    // compute _myresult1 and _myresult2 from basedata
  }
}
```
