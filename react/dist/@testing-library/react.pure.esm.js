import * as React from 'react';
import ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import { fireEvent as fireEvent$1, configure, prettyDOM, getQueriesForElement } from '@testing-library/dom';
export * from '@testing-library/dom';
import * as testUtils from 'react-dom/test-utils';

const domAct = testUtils.act;

function getGlobalThis() {
  /* istanbul ignore else */
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }
  /* istanbul ignore next */


  if (typeof self !== 'undefined') {
    return self;
  }
  /* istanbul ignore next */


  if (typeof window !== 'undefined') {
    return window;
  }
  /* istanbul ignore next */


  if (typeof global !== 'undefined') {
    return global;
  }
  /* istanbul ignore next */


  throw new Error('unable to locate global object');
}

function setIsReactActEnvironment(isReactActEnvironment) {
  getGlobalThis().IS_REACT_ACT_ENVIRONMENT = isReactActEnvironment;
}

function getIsReactActEnvironment() {
  return getGlobalThis().IS_REACT_ACT_ENVIRONMENT;
}

function withGlobalActEnvironment(actImplementation) {
  return callback => {
    const previousActEnvironment = getIsReactActEnvironment();
    setIsReactActEnvironment(true);

    try {
      // The return value of `act` is always a thenable.
      let callbackNeedsToBeAwaited = false;
      const actResult = actImplementation(() => {
        const result = callback();

        if (result !== null && typeof result === 'object' && typeof result.then === 'function') {
          callbackNeedsToBeAwaited = true;
        }

        return result;
      });

      if (callbackNeedsToBeAwaited) {
        const thenable = actResult;
        return {
          then: (resolve, reject) => {
            thenable.then(returnValue => {
              setIsReactActEnvironment(previousActEnvironment);
              resolve(returnValue);
            }, error => {
              setIsReactActEnvironment(previousActEnvironment);
              reject(error);
            });
          }
        };
      } else {
        setIsReactActEnvironment(previousActEnvironment);
        return actResult;
      }
    } catch (error) {
      // Can't be a `finally {}` block since we don't know if we have to immediately restore IS_REACT_ACT_ENVIRONMENT
      // or if we have to await the callback first.
      setIsReactActEnvironment(previousActEnvironment);
      throw error;
    }
  };
}

const act = withGlobalActEnvironment(domAct);
/* eslint no-console:0 */

// dom-testing-library's version of fireEvent. The reason
// we make this distinction however is because we have
// a few extra events that work a bit differently

const fireEvent = function () {
  return fireEvent$1(...arguments);
};

Object.keys(fireEvent$1).forEach(key => {
  fireEvent[key] = function () {
    return fireEvent$1[key](...arguments);
  };
}); // React event system tracks native mouseOver/mouseOut events for
// running onMouseEnter/onMouseLeave handlers
// @link https://github.com/facebook/react/blob/b87aabdfe1b7461e7331abb3601d9e6bb27544bc/packages/react-dom/src/events/EnterLeaveEventPlugin.js#L24-L31

const mouseEnter = fireEvent.mouseEnter;
const mouseLeave = fireEvent.mouseLeave;

fireEvent.mouseEnter = function () {
  mouseEnter(...arguments);
  return fireEvent.mouseOver(...arguments);
};

fireEvent.mouseLeave = function () {
  mouseLeave(...arguments);
  return fireEvent.mouseOut(...arguments);
};

const pointerEnter = fireEvent.pointerEnter;
const pointerLeave = fireEvent.pointerLeave;

fireEvent.pointerEnter = function () {
  pointerEnter(...arguments);
  return fireEvent.pointerOver(...arguments);
};

fireEvent.pointerLeave = function () {
  pointerLeave(...arguments);
  return fireEvent.pointerOut(...arguments);
};

const select = fireEvent.select;

fireEvent.select = (node, init) => {
  select(node, init); // React tracks this event only on focused inputs

  node.focus(); // React creates this event when one of the following native events happens
  // - contextMenu
  // - mouseUp
  // - dragEnd
  // - keyUp
  // - keyDown
  // so we can use any here
  // @link https://github.com/facebook/react/blob/b87aabdfe1b7461e7331abb3601d9e6bb27544bc/packages/react-dom/src/events/SelectEventPlugin.js#L203-L224

  fireEvent.keyUp(node, init);
}; // React event system tracks native focusout/focusin events for
// running blur/focus handlers
// @link https://github.com/facebook/react/pull/19186


const blur = fireEvent.blur;
const focus = fireEvent.focus;

fireEvent.blur = function () {
  fireEvent.focusOut(...arguments);
  return blur(...arguments);
};

fireEvent.focus = function () {
  fireEvent.focusIn(...arguments);
  return focus(...arguments);
};

configure({
  unstable_advanceTimersWrapper: cb => {
    return act(cb);
  },
  // We just want to run `waitFor` without IS_REACT_ACT_ENVIRONMENT
  // But that's not necessarily how `asyncWrapper` is used since it's a public method.
  // Let's just hope nobody else is using it.
  asyncWrapper: async cb => {
    const previousActEnvironment = getIsReactActEnvironment();
    setIsReactActEnvironment(false);

    try {
      return await cb();
    } finally {
      setIsReactActEnvironment(previousActEnvironment);
    }
  },
  eventWrapper: cb => {
    let result;
    act(() => {
      result = cb();
    });
    return result;
  }
}); // Ideally we'd just use a WeakMap where containers are keys and roots are values.
// We use two variables so that we can bail out in constant time when we render with a new container (most common use case)

/**
 * @type {Set<import('react-dom').Container>}
 */

const mountedContainers = new Set();
/**
 * @type Array<{container: import('react-dom').Container, root: ReturnType<typeof createConcurrentRoot>}>
 */

const mountedRootEntries = [];

function createConcurrentRoot(container, _ref) {
  let {
    hydrate,
    ui,
    wrapper: WrapperComponent
  } = _ref;
  let root;

  if (hydrate) {
    act(() => {
      root = ReactDOMClient.hydrateRoot(container, WrapperComponent ? /*#__PURE__*/React.createElement(WrapperComponent, null, ui) : ui);
    });
  } else {
    root = ReactDOMClient.createRoot(container);
  }

  return {
    hydrate() {
      /* istanbul ignore if */
      if (!hydrate) {
        throw new Error('Attempted to hydrate a non-hydrateable root. This is a bug in `@testing-library/react`.');
      } // Nothing to do since hydration happens when creating the root object.

    },

    render(element) {
      root.render(element);
    },

    unmount() {
      root.unmount();
    }

  };
}

function createLegacyRoot(container) {
  return {
    hydrate(element) {
      ReactDOM.hydrate(element, container);
    },

    render(element) {
      ReactDOM.render(element, container);
    },

    unmount() {
      ReactDOM.unmountComponentAtNode(container);
    }

  };
}

function renderRoot(ui, _ref2) {
  let {
    baseElement,
    container,
    hydrate,
    queries,
    root,
    wrapper: WrapperComponent
  } = _ref2;

  const wrapUiIfNeeded = innerElement => WrapperComponent ? /*#__PURE__*/React.createElement(WrapperComponent, null, innerElement) : innerElement;

  act(() => {
    if (hydrate) {
      root.hydrate(wrapUiIfNeeded(ui), container);
    } else {
      root.render(wrapUiIfNeeded(ui), container);
    }
  });
  return {
    container,
    baseElement,
    debug: function (el, maxLength, options) {
      if (el === void 0) {
        el = baseElement;
      }

      return Array.isArray(el) ? // eslint-disable-next-line no-console
      el.forEach(e => console.log(prettyDOM(e, maxLength, options))) : // eslint-disable-next-line no-console,
      console.log(prettyDOM(el, maxLength, options));
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
    rerender: rerenderUi => {
      renderRoot(wrapUiIfNeeded(rerenderUi), {
        container,
        baseElement,
        root
      }); // Intentionally do not return anything to avoid unnecessarily complicating the API.
      // folks can use all the same utilities we return in the first place that are bound to the container
    },
    asFragment: () => {
      /* istanbul ignore else (old jsdom limitation) */
      if (typeof document.createRange === 'function') {
        return document.createRange().createContextualFragment(container.innerHTML);
      } else {
        const template = document.createElement('template');
        template.innerHTML = container.innerHTML;
        return template.content;
      }
    },
    ...getQueriesForElement(baseElement, queries)
  };
}

function render(ui, _temp) {
  let {
    container,
    baseElement = container,
    legacyRoot = false,
    queries,
    hydrate = false,
    wrapper
  } = _temp === void 0 ? {} : _temp;

  if (!baseElement) {
    // default to document.body instead of documentElement to avoid output of potentially-large
    // head elements (such as JSS style blocks) in debug output
    baseElement = document.body;
  }

  if (!container) {
    container = baseElement.appendChild(document.createElement('div'));
  }

  let root; // eslint-disable-next-line no-negated-condition -- we want to map the evolution of this over time. The root is created first. Only later is it re-used so we don't want to read the case that happens later first.

  if (!mountedContainers.has(container)) {
    const createRootImpl = legacyRoot ? createLegacyRoot : createConcurrentRoot;
    root = createRootImpl(container, {
      hydrate,
      ui,
      wrapper
    });
    mountedRootEntries.push({
      container,
      root
    }); // we'll add it to the mounted containers regardless of whether it's actually
    // added to document.body so the cleanup method works regardless of whether
    // they're passing us a custom container or not.

    mountedContainers.add(container);
  } else {
    mountedRootEntries.forEach(rootEntry => {
      // Else is unreachable since `mountedContainers` has the `container`.
      // Only reachable if one would accidentally add the container to `mountedContainers` but not the root to `mountedRootEntries`

      /* istanbul ignore else */
      if (rootEntry.container === container) {
        root = rootEntry.root;
      }
    });
  }

  return renderRoot(ui, {
    container,
    baseElement,
    queries,
    hydrate,
    wrapper,
    root
  });
}

function cleanup() {
  mountedRootEntries.forEach(_ref3 => {
    let {
      root,
      container
    } = _ref3;
    act(() => {
      root.unmount();
    });

    if (container.parentNode === document.body) {
      document.body.removeChild(container);
    }
  });
  mountedRootEntries.length = 0;
  mountedContainers.clear();
}

function renderHook(renderCallback, options) {
  if (options === void 0) {
    options = {};
  }

  const {
    initialProps,
    ...renderOptions
  } = options;
  const result = /*#__PURE__*/React.createRef();

  function TestComponent(_ref4) {
    let {
      renderCallbackProps
    } = _ref4;
    const pendingResult = renderCallback(renderCallbackProps);
    React.useEffect(() => {
      result.current = pendingResult;
    });
    return null;
  }

  const {
    rerender: baseRerender,
    unmount
  } = render( /*#__PURE__*/React.createElement(TestComponent, {
    renderCallbackProps: initialProps
  }), renderOptions);

  function rerender(rerenderCallbackProps) {
    return baseRerender( /*#__PURE__*/React.createElement(TestComponent, {
      renderCallbackProps: rerenderCallbackProps
    }));
  }

  return {
    result,
    rerender,
    unmount
  };
} // just re-export everything from dom-testing-library
/* eslint func-name-matching:0 */

export { act, cleanup, fireEvent, render, renderHook };
