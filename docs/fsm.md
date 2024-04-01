# fsm
Library for managing the execution of a linked tree of finite state machines.

# Overview

The `Fsm` library and class serves as the base class for chainable finite state machines.

The library improves management of asynchronous work in several ways over more primitive syntactic approaches
like plain callbacks, async/await, promises or async libraries. These include:

- The state of your computation is managed as an explicit set of objects rather than
an opaque mixture of callbacks and closures.

- It is easy to model a computation that proceeds through multiple intermediate states rather
than simply "in-process" or "done".

- Computations (objects) can be built as a tree of dependent computations, effectively acting as a
data-flow model, a natural way of describing many computations.

- The mechanism integrates well with existing mechanisms like callbacks and promises.

- A state machine more directly models how the computation is proceeding rather than syntactic models
like async/await that explicitly try to hide the real control flow.

- Requiring a class definition to represent the computation tends to facilitate reuse of the
asynchronous logic rather than having callbacks sprinkled through the code base.

A potential disadvantage of the FSM mechanism is that requiring a new subclass tends
to have a heavier syntactic weight than
mechanisms like simple callbacks.
For some, this is an advantage in not trivializing the additional
state complexity that an outstanding asynchronous computation represents for the application.

The normal usage is to sub-class the Fsm base class and override the `tick` function to walk the
state machine through its states.

Each machine begins in the FSM_STARTING state.
The `tick` function on the class gets scheduled to be called (asynchronously) initially after
construction and then explicitly whenever
the state changes (by a call to the class function `setState`).

A subclass overrides the `tick` function to run the machine through its state transitions.

Additionally, a finite state machine can `waitOn` another state machine.
When that machine is marked complete (either `FSM_DONE` or `FSM_ERROR`),
any machines waiting on that state machine get scheduled to have their `tick` function called as well.

A machine is `ready` when all `Fsm`'s it is waiting on have been marked complete.

The `tick` function of a dependent state machine is called whenever any machine it is waiting on completes,
but normally the `tick` function only performs activity when the machine is `ready`.

Most usage involves the `tick` function first testing if it is `ready` before doing any activity,
although a usage that wanted to take action whenever any waitedOn dependent completes might omit that test
(e.g. to race multiple asynchronous operations and use whichever result completes first or
immediately complete if any one of several outstanding dependents fail).

For example, this is typical usage:

```javascript
tick(): void
{
  if (this.ready)
  {
    // all dependents are complete, take action now
  }
}
```

Of course, a state machine can go from `ready` to not `ready` as many times as necessary simply by waiting on
some new `Fsm` within its `tick` function.

Normally a Fsm-based class does not fire off any activity until the first time its `tick` function is called (rather than
in the constructor).

So,

```javascript
constructor(env: Environment)
{
  super(env);
  // Don't do any real work here.
}

tick(): void
{
  if (this.ready)
  {
    switch (this.state)
    {
      case FSM_STARTING:
        // Kick off activity here
        break;
    }
  }
}
```

That is not a requirement but increases flexibility by allowing clients to construct the Fsm and
then add dependents it must wait on before any activity is kicked off.

The infrastructure only cares about the starting state FSM_STARTING and the completion states `FSM_ERROR` and `FSM_DONE`.
Any other state values can
be used internally to a state machine to manage walking through different active states prior to completion.
For convenenience, the names `FSM_CUSTOM1` through `FSM_CUSTOM9` are predefined and internal states can use these
values (typically assigned to something semantically meaningful) however they wish.

The state `FSM_PENDING` has no special meaning but is defined for convenience since many state machines go through
a single intermediate state (`FSM_STARTING` to `FSM_PENDING` to `FSM_DONE`).

Callbacks can be integrated easily by having the callback set the `Fsm` state, which allows either completion
notification to any other waiting state machines or the next step in the current state machine to be executed.

```javascript
tick(): void
{
  if (this.ready)
  {
    switch (this.state)
    {
      case FSM_STARTING:
        asyncAPIWithCallback((err: any, result: any) => {
            if (err)
              this.setState(FSM_ERROR);
            else
              this.setState(FSM_DONE);
          });
        break;
    }
  }
}
```

or

```javascript
tick(): void
{
  if (this.ready)
  {
    switch (this.state)
    {
      case FSM_STARTING:
        asyncAPIWithCallback((err: any, result: any) => {
            if (err)
              this.setState(FSM_ERROR);
            else
              this.setState(FSM_PENDING);
          });
        break;

      case FSM_PENDING:
        // Do more stuff here now that callback has completed.
        break;
    }
  }
}
```


### isDependentError

When an `Fsm` that is being waited on completes with an error, any waiting `Fsm`'s get the `isDependentError` flag set
and of course get a chance to run their `tick` function (since the dependent `Fsm` has completed).

They can decide if the semantics of the relationship then requires them to propagate, consume or otherwise handle the
error. No other error propagation happens automatically.
So:

```javascript
tick(): void
{
  if (this.ready && this.isDependentError)
    this.setState(FSM_ERROR);
  else if (this.ready)
  {
    // Normal code here
  }
}
```

would explicitly immediately propagate a dependent error.

Note that the check above to test whether the state machine is `ready` before `isDependentError` is to ensure you do not
loop continuously resetting the state to FSM_ERROR on each `tick` invocation.

### Reuse

An `Fsm` can be reused and transition from `ready` to not `ready` or `done` to not `done`.


### Cancellation

The standard member function `cancel` will set the state to `FSM_CANCEL` which is considered a done state as
well as an error state (and will set the dependentError flag on any waiting state machines).

By convention, a sub-class should override the `cancel` member function to allow external cancellation
if it needs to do more internal cleanup than set the state to `FSM_CANCEL`.

Additionally, it can use the `end` member function (by convention) to complete the state machine if that
makes sense and does not wanted to be treated as an error.
The class should override the `end` member function if it needs to do cleanup and finalization internally.

If a class internally is implemented with callbacks or promises, by convention it should check `if this.done`
when the callback or promise completes to check whether it may have been externally canceled while awaiting.

### waitOnCompletion

In some cases, a waiting `Fsm` wants to know immediately whether a dependent `Fsm` has completed.
For example, it might want to keep a queue filled rather than wait until all dependent state machines
have completed and it has transitioned to a ready state.

Additionally, entering the `tick()` function simply indicates _any_ `Fsm` may have completed and determining which
is `done` would normally require a linear walk through all dependents. This linear walk can risk introducing
O(N^2) behavior.

In these cases, an `Fsm` subclass may override the `waitOnCompletion` member function to get notified of
a completion. This gets called when any dependent machine completes with success or failure.
For example:

```javascript
waitOnCompletion(fsm: Fsm): void
{
  // Some processing on child completion, e.g.
  this.nFailures += fsm.iserror ? 1 : 0;
}
```

### FsmOnDone

A simple utility class `FsmOnDone` provides a way of integrating a callback with an Fsm-based infrastructor.

The FsmOnDone class will wait till the `Fsm` passed to the constructor completes and then call the provided
callback, passing the completed Fsm as the argument.

```javascript
let fsm = new FsmOnDone(env, fsmWait, (fsmWait: Fsm) => {
    /* do stuff with fsmWait since it is now complete */
  });
```

### FsmSleep

`FsmSleep` is a  simple utility class that creates a dependency that is marked done after
the number of milliseconds passed to the constructor.

So:

```javascript
fsm.waitOn(new FsmSleep(env, 1000));
```

will result in the object `fsm` having a dependency that will complete in 1000ms.

### FsmLoop

`FsmLoop` is a simple utility class to run an asynchronous process in a loop at some maximum rate.
It waits for the `Fsm` passed in to complete, then uses `FsmSleep` to wait until the specified
minimum interval is complete (starting when the `Fsm` started executing)and restarts the `Fsm`.
It is required that the `Fsm` properly handles going from the `FSM_DONE` state back to `FSM_STARTING`.

### FsmArray

`FsmArray` is a simple utility class that provides a mechanism for waiting for a stream of
objects to appear in an array and consuming them, repeatedly.
It will be marked `done` when any content is made available in the array (through the member `a`)
by calling `push` or `concat`.
When the content is consumed, it should be removed with `splice` or `reset`.
At this point, the `Fsm` will be placed back in the `starting` state and can be waited on again.
