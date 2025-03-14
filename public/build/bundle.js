
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function set_store_value(store, ret, value) {
        store.set(value);
        return ret;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value == null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function select_option(select, value, mounting) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        if (!mounting || value !== undefined) {
            select.selectedIndex = -1; // no option should be selected
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked');
        return selected_option && selected_option.__value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier} [start]
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=} start
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let started = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (started) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            started = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
                // We need to set this to false because callbacks can still happen despite having unsubscribed:
                // Callbacks might already be placed in the queue which doesn't know it should no longer
                // invoke this derived store.
                started = false;
            };
        });
    }

    class Path {
        constructor(id, controlPoints = [], color = this.getRandomBrightColor(), robotHeading = 'constant') {
            this.id = id;
            this.controlPoints = controlPoints;
            this.color = color;
            this.robotHeading = robotHeading;
            this.bezierCurvePoints = this.calculateBezier(); // calculate initial bezier curve points
        }

        static revive(obj) {
            const path = new Path(obj.id);
            path.controlPoints = obj.controlPoints;
            path.color = obj.color;
            path.robotHeading = obj.robotHeading;
            path.startAngleDegrees = obj.startAngleDegrees;
            path.endAngleDegrees = obj.endAngleDegrees;
            path.constantAngleDegrees = obj.constantAngleDegrees;
            path.reverse = obj.reverse;
            path.bezierCurvePoints = obj.bezierCurvePoints; // restore bezier curve points
            return path;
        }

        getRandomBrightColor() {
            const r = Math.floor(Math.random() * 128 + 128);
            const g = Math.floor(Math.random() * 128 + 128);
            const b = Math.floor(Math.random() * 128 + 128);
            return `rgb(${r}, ${g}, ${b})`; // return a random bright color
        }

        calculateBezier() {
            if (this.controlPoints.length < 2) return [];
            let curve = [];
            this.subdivideAdaptive(this.controlPoints, 0, 1, curve); // start adaptive subdivision
            return curve;
        }

        subdivideAdaptive(controlPoints, tStart, tEnd, curve, threshold = 0.001) {
            const midT = (tStart + tEnd) / 2;
            const pStart = this.deCasteljau(controlPoints, tStart);
            const pEnd = this.deCasteljau(controlPoints, tEnd);
            const pMid = this.deCasteljau(controlPoints, midT);

            const linearMid = {
                x: (pStart.x + pEnd.x) / 2,
                y: (pStart.y + pEnd.y) / 2
            };

            const error = Math.sqrt((pMid.x - linearMid.x) ** 2 + (pMid.y - linearMid.y) ** 2);

            if (error > threshold) {
                this.subdivideAdaptive(controlPoints, tStart, midT, curve, threshold); // recursively subdivide
                this.subdivideAdaptive(controlPoints, midT, tEnd, curve, threshold); // recursively subdivide
            } else {
                curve.push(pStart);
                curve.push(pEnd);
            }
        }

        deCasteljau(points, t) {
            if (points.length === 1) return points[0];
            let newPoints = [];
            for (let i = 0; i < points.length - 1; i++) {
                let x = (1 - t) * points[i].x + t * points[i + 1].x;
                let y = (1 - t) * points[i].y + t * points[i + 1].y;
                newPoints.push({ x, y });
            }
            return this.deCasteljau(newPoints, t); // recursively apply de Casteljau's algorithm
        }

        addControlPoint(x, y) {
            this.controlPoints.push({ x, y });
            this.bezierCurvePoints = this.calculateBezier(); // recalculate bezier curve points
        }

        updateControlPoint(index, x, y) {
            if (index >= 0 && index < this.controlPoints.length) {
                this.controlPoints[index] = { x, y };
                this.bezierCurvePoints = this.calculateBezier(); // recalculate bezier curve points
            }
        }

        setColor(color) {
            this.color = color;
        }

        setHeading(robotHeading) {
            this.robotHeading = robotHeading;
        }
    }

    // function to create a persistent store
    const persistStore = (key, initialValue) => {
      const revivePaths = (value) => value.map(p => Path.revive(p));
      
      const storedValue = localStorage.getItem(key);
      let parsedValue;
      
      try {
        parsedValue = storedValue 
        ? key === 'paths'
          ? revivePaths(JSON.parse(storedValue))
          : JSON.parse(storedValue)
        : initialValue;
      } catch {
        parsedValue = initialValue;
      }
      
      const store = writable(parsedValue);
      store.subscribe(value => {
        localStorage.setItem(key, JSON.stringify(value));
      });
      return store;
      };

    // creating persistent stores for various settings
    const paths = persistStore('paths', []);
    const robotLength = persistStore('robotLength', 18);
    const robotWidth = persistStore('robotWidth', 18);
    const robotUnits = persistStore('robotUnits', 'inches');
    const rotationUnits = persistStore('rotationUnits', 'degrees');
    const shouldShowHitbox = persistStore('shouldShowHitbox', false);
    const shouldHaveBoilerplate = persistStore('shouldHaveBoilerplate', false);
    const autoLinkPaths = persistStore('autoLinkPaths', true);
    const shouldRepeatPath = persistStore('shouldRepeatPath', true);

    // derived store to calculate display dimensions
    const displayDimensions = derived(
      [robotLength, robotWidth, robotUnits],
      ([$length, $width, $units]) => ({
      displayLength: parseFloat(($units === 'inches' ? $length : $length * 2.54).toFixed(2)),
      displayWidth: parseFloat(($units === 'inches' ? $width : $width * 2.54).toFixed(2))
      })
    );

    const bezierCache = new Map();

    function getCachedBezier(t, controlPoints) {
        const key = JSON.stringify({ t, controlPoints });
        if (!bezierCache.has(key)) {
            bezierCache.set(key, getPointAt(t, controlPoints));
        }
        return bezierCache.get(key);
    }

    function getPointAt(t, controlPoints) {
        if (controlPoints.length === 2) {
            // linear interpolation for 2 points
            return {
                x: (1 - t) * controlPoints[0].x + t * controlPoints[1].x,
                y: (1 - t) * controlPoints[0].y + t * controlPoints[1].y
            };
        }

        if (controlPoints.length === 1) {
            // single point, return as is
            return controlPoints[0];
        }

        let newPoints = [];
        for (let i = 0; i < controlPoints.length - 1; i++) {
            let x = (1 - t) * controlPoints[i].x + t * controlPoints[i + 1].x;
            let y = (1 - t) * controlPoints[i].y + t * controlPoints[i + 1].y;
            newPoints.push({ x, y });
        }

        // recursive call for more than 2 points
        return getPointAt(t, newPoints);
    }

    function getDerivativeAt(t, controlPoints) {
        if (controlPoints.length < 2) return { x: 0, y: 0 };

        let derivatives = [];
        for (let i = 0; i < controlPoints.length - 1; i++) {
            let x = controlPoints.length * (controlPoints[i + 1].x - controlPoints[i].x);
            let y = controlPoints.length * (controlPoints[i + 1].y - controlPoints[i].y);
            derivatives.push({ x, y });
        }

        return getCachedBezier(t, derivatives);
    }

    function getNormalAt(t, controlPoints) {
        const tangent = getDerivativeAt(t, controlPoints);
        const length = Math.sqrt(tangent.x ** 2 + tangent.y ** 2);
        if (length === 0) return { x: 0, y: 0 }; 
        return { x: -tangent.y / length, y: tangent.x / length }; 
    }

    function getOffsetPointAt(t, controlPoints, width) {
        const point = getCachedBezier(t, controlPoints);
        const normal = getNormalAt(t, controlPoints);

        return {
            left: { x: point.x + normal.x * (width / 2), y: point.y + normal.y * (width / 2) },
            right: { x: point.x - normal.x * (width / 2), y: point.y - normal.y * (width / 2) }
        };
    }

    function generateHitboxPath(controlPoints, width) {
        if (controlPoints.length < 2) {
            console.warn(`WARN skipping hitbox: not enough control points (${controlPoints.length} found)`);
            return { leftPath: [], rightPath: [] };
        }

        const leftPath = [];
        const rightPath = [];

        // case 1: linear path (2 points)
        if (controlPoints.length === 2) {
            console.log("generating LINEAR hitbox for 2pt path");
            for (let t = 0; t <= 1; t += 0.01) {
                const x = (1 - t) * controlPoints[0].x + t * controlPoints[1].x;
                const y = (1 - t) * controlPoints[0].y + t * controlPoints[1].y;
                const normal = getNormalAt(t, controlPoints);

                leftPath.push({ x: x + normal.x * (width / 2), y: y + normal.y * (width / 2) });
                rightPath.push({ x: x - normal.x * (width / 2), y: y - normal.y * (width / 2) });
            }
        }
        // case 2: bézier curve (3+ points)
        else {
            console.log("generating Bézier hitbox");
            for (let t = 0; t <= 1; t += 0.01) {
                const offsetPoints = getOffsetPointAt(t, controlPoints, width);
                leftPath.push(offsetPoints.left);
                rightPath.push(offsetPoints.right);
            }
        }

        console.log("generated hitbox:", { leftPath, rightPath });
        return { leftPath, rightPath };
    }

    /* src/App.svelte generated by Svelte v3.59.2 */
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	child_ctx[84] = list;
    	child_ctx[85] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[86] = list[i].x;
    	child_ctx[87] = list[i].y;
    	child_ctx[89] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    function get_each_context_4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    function get_each_context_5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[86] = list[i].x;
    	child_ctx[87] = list[i].y;
    	return child_ctx;
    }

    // (1245:8) {#if $paths.length > 0}
    function create_if_block_14(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "class", "start-pos-box svelte-fwhu0b");
    			attr_dev(input, "type", "number");
    			attr_dev(input, "step", "1");
    			add_location(input, file, 1245, 8, 34197);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*$paths*/ ctx[3][0].controlPoints[0].x);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[39]),
    					listen_dev(input, "input", /*input_handler_2*/ ctx[40], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 8 && to_number(input.value) !== /*$paths*/ ctx[3][0].controlPoints[0].x) {
    				set_input_value(input, /*$paths*/ ctx[3][0].controlPoints[0].x);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_14.name,
    		type: "if",
    		source: "(1245:8) {#if $paths.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (1252:8) {#if $paths.length > 0}
    function create_if_block_13(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "class", "start-pos-box svelte-fwhu0b");
    			attr_dev(input, "type", "number");
    			attr_dev(input, "step", "1");
    			add_location(input, file, 1252, 8, 34684);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*$paths*/ ctx[3][0].controlPoints[0].y);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler_1*/ ctx[41]),
    					listen_dev(input, "input", /*input_handler_3*/ ctx[42], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 8 && to_number(input.value) !== /*$paths*/ ctx[3][0].controlPoints[0].y) {
    				set_input_value(input, /*$paths*/ ctx[3][0].controlPoints[0].y);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_13.name,
    		type: "if",
    		source: "(1252:8) {#if $paths.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (1319:5) {#each path.controlPoints as { x, y }}
    function create_each_block_5(ctx) {
    	let div1;
    	let div0;
    	let t;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t = space();
    			attr_dev(div0, "class", "point svelte-fwhu0b");
    			set_style(div0, "left", /*x*/ ctx[86] / 144 * 100 + "%");
    			set_style(div0, "bottom", /*y*/ ctx[87] / 144 * 100 + "%");
    			set_style(div0, "background", /*path*/ ctx[5].color);
    			add_location(div0, file, 1320, 7, 38029);
    			attr_dev(div1, "class", "hover-point svelte-fwhu0b");
    			add_location(div1, file, 1319, 6, 37996);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 8) {
    				set_style(div0, "left", /*x*/ ctx[86] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*$paths*/ 8) {
    				set_style(div0, "bottom", /*y*/ ctx[87] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*$paths*/ 8) {
    				set_style(div0, "background", /*path*/ ctx[5].color);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_5.name,
    		type: "each",
    		source: "(1319:5) {#each path.controlPoints as { x, y }}",
    		ctx
    	});

    	return block;
    }

    // (1318:4) {#each $paths as path}
    function create_each_block_4(ctx) {
    	let each_1_anchor;
    	let each_value_5 = /*path*/ ctx[5].controlPoints;
    	validate_each_argument(each_value_5);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_5.length; i += 1) {
    		each_blocks[i] = create_each_block_5(get_each_context_5(ctx, each_value_5, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 8) {
    				each_value_5 = /*path*/ ctx[5].controlPoints;
    				validate_each_argument(each_value_5);
    				let i;

    				for (i = 0; i < each_value_5.length; i += 1) {
    					const child_ctx = get_each_context_5(ctx, each_value_5, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_5(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_5.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_4.name,
    		type: "each",
    		source: "(1318:4) {#each $paths as path}",
    		ctx
    	});

    	return block;
    }

    // (1327:4) {#if $paths.length > 0}
    function create_if_block_12(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "./assets/robot.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Robot");
    			attr_dev(img, "id", "robot");
    			set_style(img, "width", /*$robotWidth*/ ctx[2] / 144 * 100 + "%");
    			set_style(img, "height", /*$robotLength*/ ctx[15] / 144 * 100 + "%");
    			set_style(img, "left", /*robotX*/ ctx[6] / 144 * 100 + "%");
    			set_style(img, "bottom", /*robotY*/ ctx[7] / 144 * 100 + "%");
    			set_style(img, "user-select", "none");
    			set_style(img, "position", "absolute");
    			attr_dev(img, "class", "svelte-fwhu0b");
    			add_location(img, file, 1327, 5, 38247);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$robotWidth*/ 4) {
    				set_style(img, "width", /*$robotWidth*/ ctx[2] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*$robotLength*/ 32768) {
    				set_style(img, "height", /*$robotLength*/ ctx[15] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*robotX*/ 64) {
    				set_style(img, "left", /*robotX*/ ctx[6] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*robotY*/ 128) {
    				set_style(img, "bottom", /*robotY*/ ctx[7] / 144 * 100 + "%");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_12.name,
    		type: "if",
    		source: "(1327:4) {#if $paths.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (1344:5) {#if $shouldShowHitbox}
    function create_if_block_10(ctx) {
    	let each_1_anchor;
    	let each_value_3 = /*offsetPaths*/ ctx[10];
    	validate_each_argument(each_value_3);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*offsetPaths*/ 1024) {
    				each_value_3 = /*offsetPaths*/ ctx[10];
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_3.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_10.name,
    		type: "if",
    		source: "(1344:5) {#if $shouldShowHitbox}",
    		ctx
    	});

    	return block;
    }

    // (1346:7) {#if path.left.length > 0 && path.right.length > 0}
    function create_if_block_11(ctx) {
    	let polygon;
    	let polygon_points_value;
    	let path0;
    	let path0_d_value;
    	let path0_stroke_value;
    	let path1;
    	let path1_d_value;
    	let path1_stroke_value;

    	const block = {
    		c: function create() {
    			polygon = svg_element("polygon");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			attr_dev(polygon, "points", polygon_points_value = /*path*/ ctx[5].left.map(func).join(' ') + ' ' + /*path*/ ctx[5].right.reverse().map(func_1).join(' '));
    			attr_dev(polygon, "fill", "rgba(255, 255, 255, 0.2)");
    			attr_dev(polygon, "stroke", "none");
    			attr_dev(polygon, "class", "svelte-fwhu0b");
    			add_location(polygon, file, 1346, 8, 38846);
    			attr_dev(path0, "d", path0_d_value = "M " + /*path*/ ctx[5].left.map(func_2).join(' '));
    			attr_dev(path0, "stroke", path0_stroke_value = /*path*/ ctx[5].color);
    			attr_dev(path0, "fill", "none");
    			attr_dev(path0, "stroke-width", "1");
    			attr_dev(path0, "opacity", "0.4");
    			attr_dev(path0, "class", "svelte-fwhu0b");
    			add_location(path0, file, 1354, 8, 39113);
    			attr_dev(path1, "d", path1_d_value = "M " + /*path*/ ctx[5].right.map(func_3).join(' '));
    			attr_dev(path1, "stroke", path1_stroke_value = /*path*/ ctx[5].color);
    			attr_dev(path1, "fill", "none");
    			attr_dev(path1, "stroke-width", "1");
    			attr_dev(path1, "opacity", "0.4");
    			attr_dev(path1, "class", "svelte-fwhu0b");
    			add_location(path1, file, 1356, 8, 39262);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, polygon, anchor);
    			insert_dev(target, path0, anchor);
    			insert_dev(target, path1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*offsetPaths*/ 1024 && polygon_points_value !== (polygon_points_value = /*path*/ ctx[5].left.map(func).join(' ') + ' ' + /*path*/ ctx[5].right.reverse().map(func_1).join(' '))) {
    				attr_dev(polygon, "points", polygon_points_value);
    			}

    			if (dirty[0] & /*offsetPaths*/ 1024 && path0_d_value !== (path0_d_value = "M " + /*path*/ ctx[5].left.map(func_2).join(' '))) {
    				attr_dev(path0, "d", path0_d_value);
    			}

    			if (dirty[0] & /*offsetPaths*/ 1024 && path0_stroke_value !== (path0_stroke_value = /*path*/ ctx[5].color)) {
    				attr_dev(path0, "stroke", path0_stroke_value);
    			}

    			if (dirty[0] & /*offsetPaths*/ 1024 && path1_d_value !== (path1_d_value = "M " + /*path*/ ctx[5].right.map(func_3).join(' '))) {
    				attr_dev(path1, "d", path1_d_value);
    			}

    			if (dirty[0] & /*offsetPaths*/ 1024 && path1_stroke_value !== (path1_stroke_value = /*path*/ ctx[5].color)) {
    				attr_dev(path1, "stroke", path1_stroke_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(polygon);
    			if (detaching) detach_dev(path0);
    			if (detaching) detach_dev(path1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_11.name,
    		type: "if",
    		source: "(1346:7) {#if path.left.length > 0 && path.right.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (1345:6) {#each offsetPaths as path}
    function create_each_block_3(ctx) {
    	let if_block_anchor;
    	let if_block = /*path*/ ctx[5].left.length > 0 && /*path*/ ctx[5].right.length > 0 && create_if_block_11(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*path*/ ctx[5].left.length > 0 && /*path*/ ctx[5].right.length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_11(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(1345:6) {#each offsetPaths as path}",
    		ctx
    	});

    	return block;
    }

    // (1365:6) {#if path.main.length > 0}
    function create_if_block_9(ctx) {
    	let path_1;
    	let path_1_d_value;
    	let path_1_stroke_value;

    	const block = {
    		c: function create() {
    			path_1 = svg_element("path");
    			attr_dev(path_1, "d", path_1_d_value = "M " + /*path*/ ctx[5].main.map(func_4).join(' '));
    			attr_dev(path_1, "stroke", path_1_stroke_value = /*path*/ ctx[5].color);
    			attr_dev(path_1, "fill", "none");
    			attr_dev(path_1, "stroke-width", "1");
    			attr_dev(path_1, "class", "svelte-fwhu0b");
    			add_location(path_1, file, 1365, 7, 39552);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path_1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*offsetPaths*/ 1024 && path_1_d_value !== (path_1_d_value = "M " + /*path*/ ctx[5].main.map(func_4).join(' '))) {
    				attr_dev(path_1, "d", path_1_d_value);
    			}

    			if (dirty[0] & /*offsetPaths*/ 1024 && path_1_stroke_value !== (path_1_stroke_value = /*path*/ ctx[5].color)) {
    				attr_dev(path_1, "stroke", path_1_stroke_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9.name,
    		type: "if",
    		source: "(1365:6) {#if path.main.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (1364:5) {#each offsetPaths as path}
    function create_each_block_2(ctx) {
    	let if_block_anchor;
    	let if_block = /*path*/ ctx[5].main.length > 0 && create_if_block_9(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*path*/ ctx[5].main.length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_9(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(1364:5) {#each offsetPaths as path}",
    		ctx
    	});

    	return block;
    }

    // (1405:62) 
    function create_if_block_8(ctx) {
    	let label;
    	let t0;
    	let t1;
    	let t2;
    	let label_for_value;

    	const block = {
    		c: function create() {
    			label = element("label");
    			t0 = text("Control Point ");
    			t1 = text(/*i*/ ctx[89]);
    			t2 = text(":");
    			attr_dev(label, "for", label_for_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89]);
    			set_style(label, "user-select", "none");
    			attr_dev(label, "class", "svelte-fwhu0b");
    			add_location(label, file, 1405, 11, 43499);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, t0);
    			append_dev(label, t1);
    			append_dev(label, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 8 && label_for_value !== (label_for_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89])) {
    				attr_dev(label, "for", label_for_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(1405:62) ",
    		ctx
    	});

    	return block;
    }

    // (1403:10) {#if (i == 0)}
    function create_if_block_7(ctx) {
    	let label;
    	let t;
    	let label_for_value;

    	const block = {
    		c: function create() {
    			label = element("label");
    			t = text("Endpoint:");
    			attr_dev(label, "for", label_for_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89]);
    			set_style(label, "user-select", "none");
    			attr_dev(label, "class", "svelte-fwhu0b");
    			add_location(label, file, 1403, 11, 43340);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 8 && label_for_value !== (label_for_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89])) {
    				attr_dev(label, "for", label_for_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(1403:10) {#if (i == 0)}",
    		ctx
    	});

    	return block;
    }

    // (1429:27) 
    function create_if_block_3(ctx) {
    	let div2;
    	let div0;
    	let label0;
    	let t0;
    	let label0_for_value;
    	let t1;
    	let input0;
    	let input0_id_value;
    	let input0_value_value;
    	let t2;
    	let div1;
    	let label1;
    	let t3;
    	let label1_for_value;
    	let t4;
    	let input1;
    	let input1_id_value;
    	let input1_value_value;
    	let t5;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let t9;
    	let mounted;
    	let dispose;

    	function input_handler_7(...args) {
    		return /*input_handler_7*/ ctx[60](/*path*/ ctx[5], /*each_value*/ ctx[84], /*path_index*/ ctx[85], ...args);
    	}

    	function input_handler_8(...args) {
    		return /*input_handler_8*/ ctx[61](/*path*/ ctx[5], /*each_value*/ ctx[84], /*path_index*/ ctx[85], ...args);
    	}

    	function select_change_handler() {
    		/*select_change_handler*/ ctx[62].call(select, /*each_value*/ ctx[84], /*path_index*/ ctx[85]);
    	}

    	function change_handler() {
    		return /*change_handler*/ ctx[63](/*path*/ ctx[5]);
    	}

    	function select_block_type_2(ctx, dirty) {
    		if (/*path*/ ctx[5].robotHeading === 'linear') return create_if_block_4;
    		if (/*path*/ ctx[5].robotHeading === 'tangential') return create_if_block_5;
    		if (/*path*/ ctx[5].robotHeading === 'constant') return create_if_block_6;
    	}

    	let current_block_type = select_block_type_2(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			label0 = element("label");
    			t0 = text("X:");
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			div1 = element("div");
    			label1 = element("label");
    			t3 = text("Y:");
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Constant";
    			option1 = element("option");
    			option1.textContent = "Tangential";
    			option2 = element("option");
    			option2.textContent = "Linear";
    			t9 = space();
    			if (if_block) if_block.c();
    			attr_dev(label0, "class", "cp-x svelte-fwhu0b");
    			attr_dev(label0, "for", label0_for_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89]);
    			set_style(label0, "user-select", "none");
    			add_location(label0, file, 1431, 12, 45400);
    			attr_dev(input0, "id", input0_id_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89]);
    			attr_dev(input0, "class", "standard-input-box svelte-fwhu0b");
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "step", "1");
    			input0.value = input0_value_value = /*path*/ ctx[5].controlPoints[/*path*/ ctx[5].controlPoints.length - 1].x;
    			add_location(input0, file, 1432, 12, 45503);
    			attr_dev(div0, "class", "control-point-mini-box-x svelte-fwhu0b");
    			add_location(div0, file, 1430, 11, 45349);
    			attr_dev(label1, "class", "cp-y svelte-fwhu0b");
    			attr_dev(label1, "for", label1_for_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89] + "-y");
    			set_style(label1, "user-select", "none");
    			add_location(label1, file, 1435, 12, 45885);
    			attr_dev(input1, "id", input1_id_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89] + "-y");
    			attr_dev(input1, "class", "standard-input-box svelte-fwhu0b");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "step", "1");
    			input1.value = input1_value_value = /*path*/ ctx[5].controlPoints[/*path*/ ctx[5].controlPoints.length - 1].y;
    			add_location(input1, file, 1436, 12, 45990);
    			attr_dev(div1, "class", "control-point-mini-box-y svelte-fwhu0b");
    			add_location(div1, file, 1434, 11, 45834);
    			option0.__value = "constant";
    			option0.value = option0.__value;
    			attr_dev(option0, "class", "svelte-fwhu0b");
    			add_location(option0, file, 1440, 12, 46536);
    			option1.__value = "tangential";
    			option1.value = option1.__value;
    			attr_dev(option1, "class", "svelte-fwhu0b");
    			add_location(option1, file, 1441, 12, 46591);
    			option2.__value = "linear";
    			option2.value = option2.__value;
    			attr_dev(option2, "class", "svelte-fwhu0b");
    			add_location(option2, file, 1442, 12, 46650);
    			attr_dev(select, "id", "robot-heading");
    			attr_dev(select, "class", "standard-input-box svelte-fwhu0b");
    			if (/*path*/ ctx[5].robotHeading === void 0) add_render_callback(select_change_handler);
    			add_location(select, file, 1439, 11, 46391);
    			attr_dev(div2, "class", "control-point-mini-box svelte-fwhu0b");
    			add_location(div2, file, 1429, 10, 45301);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, label0);
    			append_dev(label0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, input0);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			append_dev(div1, label1);
    			append_dev(label1, t3);
    			append_dev(div1, t4);
    			append_dev(div1, input1);
    			append_dev(div2, t5);
    			append_dev(div2, select);
    			append_dev(select, option0);
    			append_dev(select, option1);
    			append_dev(select, option2);
    			select_option(select, /*path*/ ctx[5].robotHeading, true);
    			append_dev(div2, t9);
    			if (if_block) if_block.m(div2, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", input_handler_7, false, false, false, false),
    					listen_dev(input1, "input", input_handler_8, false, false, false, false),
    					listen_dev(select, "change", select_change_handler),
    					listen_dev(select, "change", change_handler, false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*$paths*/ 8 && label0_for_value !== (label0_for_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89])) {
    				attr_dev(label0, "for", label0_for_value);
    			}

    			if (dirty[0] & /*$paths*/ 8 && input0_id_value !== (input0_id_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89])) {
    				attr_dev(input0, "id", input0_id_value);
    			}

    			if (dirty[0] & /*$paths*/ 8 && input0_value_value !== (input0_value_value = /*path*/ ctx[5].controlPoints[/*path*/ ctx[5].controlPoints.length - 1].x) && input0.value !== input0_value_value) {
    				prop_dev(input0, "value", input0_value_value);
    			}

    			if (dirty[0] & /*$paths*/ 8 && label1_for_value !== (label1_for_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89] + "-y")) {
    				attr_dev(label1, "for", label1_for_value);
    			}

    			if (dirty[0] & /*$paths*/ 8 && input1_id_value !== (input1_id_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89] + "-y")) {
    				attr_dev(input1, "id", input1_id_value);
    			}

    			if (dirty[0] & /*$paths*/ 8 && input1_value_value !== (input1_value_value = /*path*/ ctx[5].controlPoints[/*path*/ ctx[5].controlPoints.length - 1].y) && input1.value !== input1_value_value) {
    				prop_dev(input1, "value", input1_value_value);
    			}

    			if (dirty[0] & /*$paths*/ 8) {
    				select_option(select, /*path*/ ctx[5].robotHeading);
    			}

    			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div2, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);

    			if (if_block) {
    				if_block.d();
    			}

    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(1429:27) ",
    		ctx
    	});

    	return block;
    }

    // (1408:10) {#if i > 0 && i!=path.controlPoints.length-1}
    function create_if_block_1(ctx) {
    	let div2;
    	let div0;
    	let label0;
    	let t0;
    	let label0_for_value;
    	let t1;
    	let input0;
    	let input0_value_value;
    	let t2;
    	let div1;
    	let label1;
    	let t3;
    	let label1_for_value;
    	let t4;
    	let input1;
    	let input1_value_value;
    	let t5;
    	let mounted;
    	let dispose;

    	function input_handler_5(...args) {
    		return /*input_handler_5*/ ctx[57](/*path*/ ctx[5], /*i*/ ctx[89], /*each_value*/ ctx[84], /*path_index*/ ctx[85], ...args);
    	}

    	function input_handler_6(...args) {
    		return /*input_handler_6*/ ctx[58](/*path*/ ctx[5], /*i*/ ctx[89], /*each_value*/ ctx[84], /*path_index*/ ctx[85], ...args);
    	}

    	let if_block = /*i*/ ctx[89] > 0 && create_if_block_2(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			label0 = element("label");
    			t0 = text("X:");
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			div1 = element("div");
    			label1 = element("label");
    			t3 = text("Y:");
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			if (if_block) if_block.c();
    			attr_dev(label0, "class", "cp-x svelte-fwhu0b");
    			attr_dev(label0, "for", label0_for_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89]);
    			set_style(label0, "user-select", "none");
    			add_location(label0, file, 1410, 13, 43777);
    			attr_dev(input0, "id", "cp-input");
    			attr_dev(input0, "class", "standard-input-box svelte-fwhu0b");
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "step", "1");
    			input0.value = input0_value_value = /*path*/ ctx[5].controlPoints[/*i*/ ctx[89]].x;
    			add_location(input0, file, 1411, 13, 43881);
    			attr_dev(div0, "class", "control-point-mini-box-x svelte-fwhu0b");
    			add_location(div0, file, 1409, 12, 43725);
    			attr_dev(label1, "class", "cp-y svelte-fwhu0b");
    			attr_dev(label1, "for", label1_for_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89] + "-y");
    			set_style(label1, "user-select", "none");
    			add_location(label1, file, 1414, 13, 44195);
    			attr_dev(input1, "id", "cp-input");
    			attr_dev(input1, "class", "standard-input-box svelte-fwhu0b");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "step", "1");
    			input1.value = input1_value_value = /*path*/ ctx[5].controlPoints[/*i*/ ctx[89]].y;
    			add_location(input1, file, 1415, 13, 44301);
    			attr_dev(div1, "class", "control-point-mini-box-y svelte-fwhu0b");
    			add_location(div1, file, 1413, 12, 44143);
    			attr_dev(div2, "class", "control-point-mini-box svelte-fwhu0b");
    			add_location(div2, file, 1408, 11, 43676);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, label0);
    			append_dev(label0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, input0);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			append_dev(div1, label1);
    			append_dev(label1, t3);
    			append_dev(div1, t4);
    			append_dev(div1, input1);
    			append_dev(div2, t5);
    			if (if_block) if_block.m(div2, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", input_handler_5, false, false, false, false),
    					listen_dev(input1, "input", input_handler_6, false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*$paths*/ 8 && label0_for_value !== (label0_for_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89])) {
    				attr_dev(label0, "for", label0_for_value);
    			}

    			if (dirty[0] & /*$paths*/ 8 && input0_value_value !== (input0_value_value = /*path*/ ctx[5].controlPoints[/*i*/ ctx[89]].x) && input0.value !== input0_value_value) {
    				prop_dev(input0, "value", input0_value_value);
    			}

    			if (dirty[0] & /*$paths*/ 8 && label1_for_value !== (label1_for_value = "control-point-" + /*path*/ ctx[5].id + "-" + /*i*/ ctx[89] + "-y")) {
    				attr_dev(label1, "for", label1_for_value);
    			}

    			if (dirty[0] & /*$paths*/ 8 && input1_value_value !== (input1_value_value = /*path*/ ctx[5].controlPoints[/*i*/ ctx[89]].y) && input1.value !== input1_value_value) {
    				prop_dev(input1, "value", input1_value_value);
    			}

    			if (/*i*/ ctx[89] > 0) if_block.p(ctx, dirty);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(1408:10) {#if i > 0 && i!=path.controlPoints.length-1}",
    		ctx
    	});

    	return block;
    }

    // (1458:54) 
    function create_if_block_6(ctx) {
    	let div;
    	let input;
    	let mounted;
    	let dispose;

    	function input_input_handler_3() {
    		/*input_input_handler_3*/ ctx[70].call(input, /*each_value*/ ctx[84], /*path_index*/ ctx[85]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			attr_dev(input, "id", "constant-angle");
    			attr_dev(input, "class", "standard-input-box svelte-fwhu0b");
    			attr_dev(input, "type", "number");
    			attr_dev(input, "step", "0.01");
    			add_location(input, file, 1459, 13, 47664);
    			attr_dev(div, "class", "control-point-mini-box svelte-fwhu0b");
    			add_location(div, file, 1458, 12, 47614);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			set_input_value(input, /*path*/ ctx[5].constantAngleDegrees);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", input_input_handler_3),
    					listen_dev(input, "input", /*input_handler_12*/ ctx[71], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*$paths*/ 8 && to_number(input.value) !== /*path*/ ctx[5].constantAngleDegrees) {
    				set_input_value(input, /*path*/ ctx[5].constantAngleDegrees);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(1458:54) ",
    		ctx
    	});

    	return block;
    }

    // (1453:56) 
    function create_if_block_5(ctx) {
    	let div;
    	let label;
    	let t1;
    	let input;
    	let mounted;
    	let dispose;

    	function input_change_handler() {
    		/*input_change_handler*/ ctx[68].call(input, /*each_value*/ ctx[84], /*path_index*/ ctx[85]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			label = element("label");
    			label.textContent = "Reverse:";
    			t1 = space();
    			input = element("input");
    			attr_dev(label, "for", "reverse");
    			set_style(label, "user-select", "none");
    			attr_dev(label, "class", "svelte-fwhu0b");
    			add_location(label, file, 1454, 13, 47346);
    			attr_dev(input, "id", "reverse");
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "class", "svelte-fwhu0b");
    			add_location(input, file, 1455, 13, 47423);
    			attr_dev(div, "class", "control-point-mini-box svelte-fwhu0b");
    			add_location(div, file, 1453, 12, 47296);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, label);
    			append_dev(div, t1);
    			append_dev(div, input);
    			input.checked = /*path*/ ctx[5].reverse;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", input_change_handler),
    					listen_dev(input, "input", /*input_handler_11*/ ctx[69], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*$paths*/ 8) {
    				input.checked = /*path*/ ctx[5].reverse;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(1453:56) ",
    		ctx
    	});

    	return block;
    }

    // (1446:11) {#if path.robotHeading === 'linear'}
    function create_if_block_4(ctx) {
    	let div0;
    	let input0;
    	let t;
    	let div1;
    	let input1;
    	let mounted;
    	let dispose;

    	function input0_input_handler() {
    		/*input0_input_handler*/ ctx[64].call(input0, /*each_value*/ ctx[84], /*path_index*/ ctx[85]);
    	}

    	function input1_input_handler() {
    		/*input1_input_handler*/ ctx[66].call(input1, /*each_value*/ ctx[84], /*path_index*/ ctx[85]);
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			input0 = element("input");
    			t = space();
    			div1 = element("div");
    			input1 = element("input");
    			attr_dev(input0, "id", "start-angle");
    			attr_dev(input0, "class", "standard-input-box svelte-fwhu0b");
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "step", "0.01");
    			add_location(input0, file, 1447, 13, 46822);
    			attr_dev(div0, "class", "control-point-mini-box svelte-fwhu0b");
    			add_location(div0, file, 1446, 12, 46772);
    			attr_dev(input1, "id", "end-angle");
    			attr_dev(input1, "class", "standard-input-box svelte-fwhu0b");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "step", "0.01");
    			add_location(input1, file, 1450, 13, 47058);
    			attr_dev(div1, "class", "control-point-mini-box svelte-fwhu0b");
    			add_location(div1, file, 1449, 12, 47008);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, input0);
    			set_input_value(input0, /*path*/ ctx[5].startAngleDegrees);
    			insert_dev(target, t, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, input1);
    			set_input_value(input1, /*path*/ ctx[5].endAngleDegrees);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", input0_input_handler),
    					listen_dev(input0, "input", /*input_handler_9*/ ctx[65], false, false, false, false),
    					listen_dev(input1, "input", input1_input_handler),
    					listen_dev(input1, "input", /*input_handler_10*/ ctx[67], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*$paths*/ 8 && to_number(input0.value) !== /*path*/ ctx[5].startAngleDegrees) {
    				set_input_value(input0, /*path*/ ctx[5].startAngleDegrees);
    			}

    			if (dirty[0] & /*$paths*/ 8 && to_number(input1.value) !== /*path*/ ctx[5].endAngleDegrees) {
    				set_input_value(input1, /*path*/ ctx[5].endAngleDegrees);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(1446:11) {#if path.robotHeading === 'linear'}",
    		ctx
    	});

    	return block;
    }

    // (1419:11) {#if (i > 0)}
    function create_if_block_2(ctx) {
    	let svg;
    	let path_1;
    	let mounted;
    	let dispose;

    	function click_handler_4() {
    		return /*click_handler_4*/ ctx[59](/*path*/ ctx[5], /*i*/ ctx[89]);
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path_1 = svg_element("path");
    			attr_dev(path_1, "d", "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z");
    			attr_dev(path_1, "class", "svelte-fwhu0b");
    			add_location(path_1, file, 1423, 285, 45002);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24px");
    			attr_dev(svg, "viewBox", "0 -960 960 960");
    			attr_dev(svg, "width", "24px");
    			attr_dev(svg, "fill", "#FF474D");
    			set_style(svg, "cursor", "pointer");
    			attr_dev(svg, "class", "svelte-fwhu0b");
    			add_location(svg, file, 1423, 11, 44728);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path_1);

    			if (!mounted) {
    				dispose = listen_dev(svg, "click", click_handler_4, false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(1419:11) {#if (i > 0)}",
    		ctx
    	});

    	return block;
    }

    // (1401:8) {#each path.controlPoints as { x, y }
    function create_each_block_1(ctx) {
    	let div;
    	let t;

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[89] == 0) return create_if_block_7;
    		if (/*i*/ ctx[89] > 0 && /*i*/ ctx[89] != /*path*/ ctx[5].controlPoints.length - 1) return create_if_block_8;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*i*/ ctx[89] > 0 && /*i*/ ctx[89] != /*path*/ ctx[5].controlPoints.length - 1) return create_if_block_1;
    		if (/*i*/ ctx[89] == 0) return create_if_block_3;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1 && current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			attr_dev(div, "class", "control-point-box svelte-fwhu0b");
    			add_location(div, file, 1401, 9, 43272);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t);
    			if (if_block1) if_block1.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div, t);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if (if_block1) if_block1.d(1);
    				if_block1 = current_block_type_1 && current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);

    			if (if_block0) {
    				if_block0.d();
    			}

    			if (if_block1) {
    				if_block1.d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(1401:8) {#each path.controlPoints as { x, y }",
    		ctx
    	});

    	return block;
    }

    // (1377:4) {#each $paths as path}
    function create_each_block(ctx) {
    	let div4;
    	let div2;
    	let div0;
    	let svg0;
    	let path0;
    	let svg0_fill_value;
    	let t0;
    	let svg1;
    	let path1;
    	let svg1_fill_value;
    	let t1;
    	let input;
    	let t2;
    	let p;
    	let t3;
    	let t4_value = /*path*/ ctx[5].id + 1 + "";
    	let t4;
    	let t5;
    	let div1;
    	let svg2;
    	let path2;
    	let svg2_fill_value;
    	let t6;
    	let svg3;
    	let path3;
    	let t7;
    	let div3;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[50](/*path*/ ctx[5]);
    	}

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[51](/*path*/ ctx[5]);
    	}

    	function input_input_handler_2() {
    		/*input_input_handler_2*/ ctx[52].call(input, /*each_value*/ ctx[84], /*path_index*/ ctx[85]);
    	}

    	function input_handler_4() {
    		return /*input_handler_4*/ ctx[53](/*path*/ ctx[5]);
    	}

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[54](/*path*/ ctx[5]);
    	}

    	function click_handler_3() {
    		return /*click_handler_3*/ ctx[55](/*path*/ ctx[5]);
    	}

    	function keydown_handler(...args) {
    		return /*keydown_handler*/ ctx[56](/*path*/ ctx[5], ...args);
    	}

    	let each_value_1 = /*path*/ ctx[5].controlPoints;
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			svg0 = svg_element("svg");
    			path0 = svg_element("path");
    			t0 = space();
    			svg1 = svg_element("svg");
    			path1 = svg_element("path");
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			p = element("p");
    			t3 = text("Path ");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			svg2 = svg_element("svg");
    			path2 = svg_element("path");
    			t6 = space();
    			svg3 = svg_element("svg");
    			path3 = svg_element("path");
    			t7 = space();
    			div3 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(path0, "d", "M480-240 240-480l56-56 144 144v-368h80v368l144-144 56 56-240 240Z");
    			attr_dev(path0, "class", "svelte-fwhu0b");
    			add_location(path0, file, 1383, 534, 40660);
    			attr_dev(svg0, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg0, "height", "24px");
    			attr_dev(svg0, "viewBox", "0 -960 960 960");
    			attr_dev(svg0, "width", "24px");

    			attr_dev(svg0, "fill", svg0_fill_value = !(/*path*/ ctx[5].id == 0 || /*path*/ ctx[5].id == /*$paths*/ ctx[3].length - 1)
    			? "black"
    			: "gray");

    			set_style(svg0, "cursor", !(/*path*/ ctx[5].id == 0 || /*path*/ ctx[5].id == /*$paths*/ ctx[3].length - 1)
    			? 'pointer'
    			: 'default');

    			attr_dev(svg0, "class", "svelte-fwhu0b");
    			add_location(svg0, file, 1383, 8, 40134);
    			attr_dev(path1, "d", "M440-240v-368L296-464l-56-56 240-240 240 240-56 56-144-144v368h-80Z");
    			attr_dev(path1, "class", "svelte-fwhu0b");
    			add_location(path1, file, 1386, 482, 41358);
    			attr_dev(svg1, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg1, "height", "24px");
    			attr_dev(svg1, "viewBox", "0 -960 960 960");
    			attr_dev(svg1, "width", "24px");

    			attr_dev(svg1, "fill", svg1_fill_value = !(/*path*/ ctx[5].id == 0 || /*path*/ ctx[5].id == 1)
    			? "black"
    			: "gray");

    			set_style(svg1, "cursor", !(/*path*/ ctx[5].id == 0 || /*path*/ ctx[5].id == 1)
    			? 'pointer'
    			: 'default');

    			attr_dev(svg1, "class", "svelte-fwhu0b");
    			add_location(svg1, file, 1386, 8, 40884);
    			attr_dev(input, "type", "color");
    			attr_dev(input, "class", "color-circle svelte-fwhu0b");
    			set_style(input, "background-color", /*path*/ ctx[5].color);
    			add_location(input, file, 1387, 8, 41452);
    			attr_dev(p, "class", "path-title svelte-fwhu0b");
    			set_style(p, "user-select", "none");
    			add_location(p, file, 1388, 8, 41622);
    			attr_dev(div0, "class", "path-and-color svelte-fwhu0b");
    			add_location(div0, file, 1379, 7, 39894);
    			attr_dev(path2, "d", "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z");
    			attr_dev(path2, "class", "svelte-fwhu0b");
    			add_location(path2, file, 1394, 276, 42216);
    			attr_dev(svg2, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg2, "height", "24px");
    			attr_dev(svg2, "viewBox", "0 -960 960 960");
    			attr_dev(svg2, "width", "24px");
    			attr_dev(svg2, "fill", svg2_fill_value = /*$paths*/ ctx[3].length > 1 ? "#FF474D" : "gray");
    			set_style(svg2, "cursor", /*$paths*/ ctx[3].length > 1 ? 'pointer' : 'default');
    			attr_dev(svg2, "class", "svelte-fwhu0b");
    			add_location(svg2, file, 1394, 8, 41948);
    			attr_dev(path3, "d", "M440-280h80v-160h160v-80H520v-160h-80v160H280v80h160v160Zm40 200q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z");
    			attr_dev(path3, "class", "svelte-fwhu0b");
    			add_location(path3, file, 1395, 347, 42776);
    			attr_dev(svg3, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg3, "height", "24px");
    			attr_dev(svg3, "viewBox", "0 -960 960 960");
    			attr_dev(svg3, "width", "24px");
    			attr_dev(svg3, "fill", "#90EE90");
    			set_style(svg3, "cursor", "pointer");
    			attr_dev(svg3, "class", "svelte-fwhu0b");
    			add_location(svg3, file, 1395, 8, 42437);
    			attr_dev(div1, "class", "add-and-remove svelte-fwhu0b");
    			add_location(div1, file, 1392, 7, 41846);
    			attr_dev(div2, "class", "path-header svelte-fwhu0b");
    			add_location(div2, file, 1378, 6, 39861);
    			attr_dev(div3, "class", "path-control-points svelte-fwhu0b");
    			add_location(div3, file, 1399, 7, 43179);
    			attr_dev(div4, "class", "path svelte-fwhu0b");
    			set_style(div4, "border-color", /*path*/ ctx[5].color);
    			add_location(div4, file, 1377, 5, 39800);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div2);
    			append_dev(div2, div0);
    			append_dev(div0, svg0);
    			append_dev(svg0, path0);
    			append_dev(div0, t0);
    			append_dev(div0, svg1);
    			append_dev(svg1, path1);
    			append_dev(div0, t1);
    			append_dev(div0, input);
    			set_input_value(input, /*path*/ ctx[5].color);
    			append_dev(div0, t2);
    			append_dev(div0, p);
    			append_dev(p, t3);
    			append_dev(p, t4);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			append_dev(div1, svg2);
    			append_dev(svg2, path2);
    			append_dev(div1, t6);
    			append_dev(div1, svg3);
    			append_dev(svg3, path3);
    			append_dev(div4, t7);
    			append_dev(div4, div3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div3, null);
    				}
    			}

    			if (!mounted) {
    				dispose = [
    					listen_dev(svg0, "click", click_handler, false, false, false, false),
    					listen_dev(svg1, "click", click_handler_1, false, false, false, false),
    					listen_dev(input, "input", input_input_handler_2),
    					listen_dev(input, "input", input_handler_4, false, false, false, false),
    					listen_dev(svg2, "click", click_handler_2, false, false, false, false),
    					listen_dev(svg3, "click", click_handler_3, false, false, false, false),
    					listen_dev(svg3, "keydown", keydown_handler, false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*$paths*/ 8 && svg0_fill_value !== (svg0_fill_value = !(/*path*/ ctx[5].id == 0 || /*path*/ ctx[5].id == /*$paths*/ ctx[3].length - 1)
    			? "black"
    			: "gray")) {
    				attr_dev(svg0, "fill", svg0_fill_value);
    			}

    			if (dirty[0] & /*$paths*/ 8) {
    				set_style(svg0, "cursor", !(/*path*/ ctx[5].id == 0 || /*path*/ ctx[5].id == /*$paths*/ ctx[3].length - 1)
    				? 'pointer'
    				: 'default');
    			}

    			if (dirty[0] & /*$paths*/ 8 && svg1_fill_value !== (svg1_fill_value = !(/*path*/ ctx[5].id == 0 || /*path*/ ctx[5].id == 1)
    			? "black"
    			: "gray")) {
    				attr_dev(svg1, "fill", svg1_fill_value);
    			}

    			if (dirty[0] & /*$paths*/ 8) {
    				set_style(svg1, "cursor", !(/*path*/ ctx[5].id == 0 || /*path*/ ctx[5].id == 1)
    				? 'pointer'
    				: 'default');
    			}

    			if (dirty[0] & /*$paths*/ 8) {
    				set_style(input, "background-color", /*path*/ ctx[5].color);
    			}

    			if (dirty[0] & /*$paths*/ 8) {
    				set_input_value(input, /*path*/ ctx[5].color);
    			}

    			if (dirty[0] & /*$paths*/ 8 && t4_value !== (t4_value = /*path*/ ctx[5].id + 1 + "")) set_data_dev(t4, t4_value);

    			if (dirty[0] & /*$paths*/ 8 && svg2_fill_value !== (svg2_fill_value = /*$paths*/ ctx[3].length > 1 ? "#FF474D" : "gray")) {
    				attr_dev(svg2, "fill", svg2_fill_value);
    			}

    			if (dirty[0] & /*$paths*/ 8) {
    				set_style(svg2, "cursor", /*$paths*/ ctx[3].length > 1 ? 'pointer' : 'default');
    			}

    			if (dirty[0] & /*$paths, generateBezierCurve, updateRobotPosition*/ 1075838984) {
    				each_value_1 = /*path*/ ctx[5].controlPoints;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div3, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}

    			if (dirty[0] & /*$paths*/ 8) {
    				set_style(div4, "border-color", /*path*/ ctx[5].color);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(1377:4) {#each $paths as path}",
    		ctx
    	});

    	return block;
    }

    // (1484:5) {:else}
    function create_else_block(ctx) {
    	let svg;
    	let path_1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path_1 = svg_element("path");
    			attr_dev(path_1, "d", "M520-200v-560h240v560H520Zm-320 0v-560h240v560H200Zm400-80h80v-400h-80v400Zm-320 0h80v-400h-80v400Zm0-400v400-400Zm320 0v400-400Z");
    			attr_dev(path_1, "class", "svelte-fwhu0b");
    			add_location(path_1, file, 1484, 134, 48773);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24px");
    			attr_dev(svg, "viewBox", "0 -960 960 960");
    			attr_dev(svg, "width", "24px");
    			attr_dev(svg, "fill", "#FF474D");
    			attr_dev(svg, "class", "svelte-fwhu0b");
    			add_location(svg, file, 1484, 6, 48645);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path_1);

    			if (!mounted) {
    				dispose = listen_dev(svg, "click", /*pausePath*/ ctx[31], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(1484:5) {:else}",
    		ctx
    	});

    	return block;
    }

    // (1481:5) {#if !isPlaying}
    function create_if_block(ctx) {
    	let svg;
    	let path_1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path_1 = svg_element("path");
    			attr_dev(path_1, "d", "M320-200v-560l440 280-440 280Zm80-280Zm0 134 210-134-210-134v268Z");
    			attr_dev(path_1, "class", "svelte-fwhu0b");
    			add_location(path_1, file, 1482, 134, 48542);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24px");
    			attr_dev(svg, "viewBox", "0 -960 960 960");
    			attr_dev(svg, "width", "24px");
    			attr_dev(svg, "fill", "#90EE90");
    			attr_dev(svg, "class", "svelte-fwhu0b");
    			add_location(svg, file, 1482, 7, 48415);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path_1);

    			if (!mounted) {
    				dispose = listen_dev(svg, "click", /*playPath*/ ctx[29], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(1481:5) {#if !isPlaying}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div30;
    	let div1;
    	let h1;
    	let t1;
    	let div0;
    	let svg0;
    	let path_1;
    	let t2;
    	let button0;
    	let t4;
    	let button1;
    	let t6;
    	let button2;
    	let t8;
    	let div29;
    	let div25;
    	let div22;
    	let div21;
    	let div20;
    	let h20;
    	let t10;
    	let div2;
    	let label0;
    	let t12;
    	let select0;
    	let option0;
    	let option1;
    	let t15;
    	let div3;
    	let label1;
    	let t17;
    	let input0;
    	let t18;
    	let div4;
    	let label2;
    	let t20;
    	let input1;
    	let t21;
    	let h21;
    	let t23;
    	let div8;
    	let label3;
    	let t25;
    	let div7;
    	let div5;
    	let label4;
    	let t27;
    	let t28;
    	let div6;
    	let label5;
    	let t30;
    	let t31;
    	let label6;
    	let t33;
    	let div14;
    	let div12;
    	let div9;
    	let label7;
    	let t35;
    	let input2;
    	let t36;
    	let div10;
    	let label8;
    	let t38;
    	let input3;
    	let t39;
    	let div11;
    	let label9;
    	let t41;
    	let input4;
    	let input4_value_value;
    	let t42;
    	let div13;
    	let label10;
    	let t44;
    	let input5;
    	let input5_value_value;
    	let t45;
    	let h22;
    	let t47;
    	let div15;
    	let label11;
    	let t49;
    	let input6;
    	let t50;
    	let div16;
    	let label12;
    	let t52;
    	let input7;
    	let t53;
    	let div17;
    	let label13;
    	let t55;
    	let input8;
    	let t56;
    	let div18;
    	let label14;
    	let t58;
    	let input9;
    	let t59;
    	let div19;
    	let label15;
    	let t61;
    	let select1;
    	let option2;
    	let option3;
    	let t64;
    	let div23;
    	let t65;
    	let t66;
    	let svg1;
    	let if_block3_anchor;
    	let t67;
    	let div24;
    	let t68;
    	let button3;
    	let t70;
    	let div28;
    	let div27;
    	let div26;
    	let t71;
    	let input10;
    	let mounted;
    	let dispose;
    	let if_block0 = /*$paths*/ ctx[3].length > 0 && create_if_block_14(ctx);
    	let if_block1 = /*$paths*/ ctx[3].length > 0 && create_if_block_13(ctx);
    	let each_value_4 = /*$paths*/ ctx[3];
    	validate_each_argument(each_value_4);
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_4.length; i += 1) {
    		each_blocks_2[i] = create_each_block_4(get_each_context_4(ctx, each_value_4, i));
    	}

    	let if_block2 = /*$paths*/ ctx[3].length > 0 && create_if_block_12(ctx);
    	let if_block3 = /*$shouldShowHitbox*/ ctx[17] && create_if_block_10(ctx);
    	let each_value_2 = /*offsetPaths*/ ctx[10];
    	validate_each_argument(each_value_2);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value = /*$paths*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	function select_block_type_3(ctx, dirty) {
    		if (!/*isPlaying*/ ctx[0]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_3(ctx);
    	let if_block4 = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div30 = element("div");
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "JPather";
    			t1 = space();
    			div0 = element("div");
    			svg0 = svg_element("svg");
    			path_1 = svg_element("path");
    			t2 = space();
    			button0 = element("button");
    			button0.textContent = "Reset To Default";
    			t4 = space();
    			button1 = element("button");
    			button1.textContent = "Import Control Points";
    			t6 = space();
    			button2 = element("button");
    			button2.textContent = "Export Control Points";
    			t8 = space();
    			div29 = element("div");
    			div25 = element("div");
    			div22 = element("div");
    			div21 = element("div");
    			div20 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Robot Options";
    			t10 = space();
    			div2 = element("div");
    			label0 = element("label");
    			label0.textContent = "Units:";
    			t12 = space();
    			select0 = element("select");
    			option0 = element("option");
    			option0.textContent = "Inches";
    			option1 = element("option");
    			option1.textContent = "Centimeters";
    			t15 = space();
    			div3 = element("div");
    			label1 = element("label");
    			label1.textContent = "Robot Length:";
    			t17 = space();
    			input0 = element("input");
    			t18 = space();
    			div4 = element("div");
    			label2 = element("label");
    			label2.textContent = "Robot Width:";
    			t20 = space();
    			input1 = element("input");
    			t21 = space();
    			h21 = element("h2");
    			h21.textContent = "Field Options";
    			t23 = space();
    			div8 = element("div");
    			label3 = element("label");
    			label3.textContent = "Starting Position:";
    			t25 = space();
    			div7 = element("div");
    			div5 = element("div");
    			label4 = element("label");
    			label4.textContent = "X:";
    			t27 = space();
    			if (if_block0) if_block0.c();
    			t28 = space();
    			div6 = element("div");
    			label5 = element("label");
    			label5.textContent = "Y:";
    			t30 = space();
    			if (if_block1) if_block1.c();
    			t31 = space();
    			label6 = element("label");
    			label6.textContent = "Live Position:";
    			t33 = space();
    			div14 = element("div");
    			div12 = element("div");
    			div9 = element("div");
    			label7 = element("label");
    			label7.textContent = "X:";
    			t35 = space();
    			input2 = element("input");
    			t36 = space();
    			div10 = element("div");
    			label8 = element("label");
    			label8.textContent = "Y:";
    			t38 = space();
    			input3 = element("input");
    			t39 = space();
    			div11 = element("div");
    			label9 = element("label");
    			label9.textContent = "θ:";
    			t41 = space();
    			input4 = element("input");
    			t42 = space();
    			div13 = element("div");
    			label10 = element("label");
    			label10.textContent = "Current Path:";
    			t44 = space();
    			input5 = element("input");
    			t45 = space();
    			h22 = element("h2");
    			h22.textContent = "Advanced Options";
    			t47 = space();
    			div15 = element("div");
    			label11 = element("label");
    			label11.textContent = "Show Robot Hitbox:";
    			t49 = space();
    			input6 = element("input");
    			t50 = space();
    			div16 = element("div");
    			label12 = element("label");
    			label12.textContent = "New Auto Boilerplate:";
    			t52 = space();
    			input7 = element("input");
    			t53 = space();
    			div17 = element("div");
    			label13 = element("label");
    			label13.textContent = "Infinite Path Looping:";
    			t55 = space();
    			input8 = element("input");
    			t56 = space();
    			div18 = element("div");
    			label14 = element("label");
    			label14.textContent = "Auto-link Paths:";
    			t58 = space();
    			input9 = element("input");
    			t59 = space();
    			div19 = element("div");
    			label15 = element("label");
    			label15.textContent = "Rotational Units:";
    			t61 = space();
    			select1 = element("select");
    			option2 = element("option");
    			option2.textContent = "Degrees";
    			option3 = element("option");
    			option3.textContent = "Radians";
    			t64 = space();
    			div23 = element("div");

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t65 = space();
    			if (if_block2) if_block2.c();
    			t66 = space();
    			svg1 = svg_element("svg");
    			if (if_block3) if_block3.c();
    			if_block3_anchor = empty();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t67 = space();
    			div24 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t68 = space();
    			button3 = element("button");
    			button3.textContent = "Add Path";
    			t70 = space();
    			div28 = element("div");
    			div27 = element("div");
    			div26 = element("div");
    			if_block4.c();
    			t71 = space();
    			input10 = element("input");
    			attr_dev(h1, "class", "page-title svelte-fwhu0b");
    			add_location(h1, file, 1178, 2, 31565);
    			attr_dev(path_1, "d", "M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H160v400Zm140-40-56-56 103-104-104-104 57-56 160 160-160 160Zm180 0v-80h240v80H480Z");
    			attr_dev(path_1, "class", "svelte-fwhu0b");
    			add_location(path_1, file, 1181, 155, 31846);
    			attr_dev(svg0, "id", "code-window-btn");
    			attr_dev(svg0, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg0, "height", "24px");
    			attr_dev(svg0, "viewBox", "0 -960 960 960");
    			attr_dev(svg0, "width", "24px");
    			attr_dev(svg0, "fill", "black");
    			attr_dev(svg0, "class", "svelte-fwhu0b");
    			add_location(svg0, file, 1181, 3, 31694);
    			set_style(button0, "user-select", "none");
    			attr_dev(button0, "class", "svelte-fwhu0b");
    			add_location(button0, file, 1182, 3, 32083);
    			set_style(button1, "user-select", "none");
    			attr_dev(button1, "class", "svelte-fwhu0b");
    			add_location(button1, file, 1183, 3, 32172);
    			set_style(button2, "user-select", "none");
    			attr_dev(button2, "class", "svelte-fwhu0b");
    			add_location(button2, file, 1184, 3, 32271);
    			attr_dev(div0, "class", "export-import svelte-fwhu0b");
    			add_location(div0, file, 1179, 2, 31603);
    			attr_dev(div1, "class", "header svelte-fwhu0b");
    			add_location(div1, file, 1177, 1, 31542);
    			attr_dev(h20, "class", "section-title svelte-fwhu0b");
    			set_style(h20, "user-select", "none");
    			add_location(h20, file, 1194, 6, 32528);
    			attr_dev(label0, "for", "robotUnits");
    			set_style(label0, "user-select", "none");
    			attr_dev(label0, "class", "svelte-fwhu0b");
    			add_location(label0, file, 1197, 7, 32641);
    			option0.__value = "inches";
    			option0.value = option0.__value;
    			attr_dev(option0, "class", "svelte-fwhu0b");
    			add_location(option0, file, 1199, 8, 32798);
    			option1.__value = "cm";
    			option1.value = option1.__value;
    			attr_dev(option1, "class", "svelte-fwhu0b");
    			add_location(option1, file, 1200, 8, 32845);
    			attr_dev(select0, "id", "robotUnits");
    			attr_dev(select0, "class", "standard-input-box svelte-fwhu0b");
    			if (/*$robotUnits*/ ctx[18] === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[36].call(select0));
    			add_location(select0, file, 1198, 7, 32713);
    			attr_dev(div2, "class", "robot-options svelte-fwhu0b");
    			add_location(div2, file, 1196, 6, 32606);
    			attr_dev(label1, "for", "robot-length");
    			set_style(label1, "user-select", "none");
    			attr_dev(label1, "class", "svelte-fwhu0b");
    			add_location(label1, file, 1207, 7, 32971);
    			attr_dev(input0, "id", "robot-length");
    			attr_dev(input0, "class", "standard-input-box svelte-fwhu0b");
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "step", "1");
    			input0.value = /*displayLength*/ ctx[12];
    			add_location(input0, file, 1208, 7, 33052);
    			attr_dev(div3, "class", "robot-options svelte-fwhu0b");
    			add_location(div3, file, 1206, 6, 32936);
    			attr_dev(label2, "for", "robot-width");
    			set_style(label2, "user-select", "none");
    			attr_dev(label2, "class", "svelte-fwhu0b");
    			add_location(label2, file, 1219, 7, 33330);
    			attr_dev(input1, "id", "robot-width");
    			attr_dev(input1, "class", "standard-input-box svelte-fwhu0b");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "step", "1");
    			input1.value = /*displayWidth*/ ctx[11];
    			add_location(input1, file, 1220, 7, 33409);
    			attr_dev(div4, "class", "robot-options svelte-fwhu0b");
    			add_location(div4, file, 1218, 8, 33295);
    			attr_dev(h21, "id", "field-options");
    			attr_dev(h21, "class", "section-title svelte-fwhu0b");
    			set_style(h21, "user-select", "none");
    			add_location(h21, file, 1232, 6, 33649);
    			attr_dev(label3, "class", "adv-options svelte-fwhu0b");
    			set_style(label3, "user-select", "none");
    			add_location(label3, file, 1237, 6, 33850);
    			attr_dev(label4, "class", "cp-x svelte-fwhu0b");
    			set_style(label4, "user-select", "none");
    			add_location(label4, file, 1243, 8, 34100);
    			attr_dev(div5, "class", "control-point-mini-box-x svelte-fwhu0b");
    			add_location(div5, file, 1241, 7, 33988);
    			attr_dev(label5, "class", "cp-x svelte-fwhu0b");
    			set_style(label5, "user-select", "none");
    			add_location(label5, file, 1250, 8, 34587);
    			attr_dev(div6, "class", "control-point-mini-box-y svelte-fwhu0b");
    			add_location(div6, file, 1248, 7, 34475);
    			attr_dev(div7, "class", "control-point-mini-box svelte-fwhu0b");
    			add_location(div7, file, 1240, 6, 33944);
    			attr_dev(div8, "class", "start-pos-container svelte-fwhu0b");
    			add_location(div8, file, 1236, 6, 33810);
    			attr_dev(label6, "class", "adv-options svelte-fwhu0b");
    			set_style(label6, "user-select", "none");
    			add_location(label6, file, 1259, 6, 35052);
    			attr_dev(label7, "class", "cp-x svelte-fwhu0b");
    			set_style(label7, "user-select", "none");
    			add_location(label7, file, 1264, 9, 35335);
    			attr_dev(input2, "class", "start-pos-box svelte-fwhu0b");
    			attr_dev(input2, "type", "number");
    			attr_dev(input2, "step", "0.001");
    			input2.readOnly = true;
    			add_location(input2, file, 1265, 9, 35401);
    			attr_dev(div9, "class", "control-point-mini-box-x svelte-fwhu0b");
    			add_location(div9, file, 1262, 8, 35221);
    			attr_dev(label8, "class", "cp-y svelte-fwhu0b");
    			set_style(label8, "user-select", "none");
    			add_location(label8, file, 1269, 9, 35626);
    			attr_dev(input3, "class", "start-pos-box svelte-fwhu0b");
    			attr_dev(input3, "type", "number");
    			attr_dev(input3, "step", "0.001");
    			input3.readOnly = true;
    			add_location(input3, file, 1270, 9, 35692);
    			attr_dev(div10, "class", "control-point-mini-box-y svelte-fwhu0b");
    			add_location(div10, file, 1267, 8, 35512);
    			attr_dev(label9, "class", "cp-heading svelte-fwhu0b");
    			set_style(label9, "user-select", "none");
    			add_location(label9, file, 1274, 9, 35923);
    			attr_dev(input4, "class", "start-pos-box svelte-fwhu0b");
    			attr_dev(input4, "type", "number");
    			attr_dev(input4, "step", "0.001");
    			input4.value = input4_value_value = Math.round(/*robotLiveAngle*/ ctx[9]);
    			input4.readOnly = true;
    			add_location(input4, file, 1275, 9, 35995);
    			attr_dev(div11, "class", "control-point-mini-box-heading svelte-fwhu0b");
    			add_location(div11, file, 1272, 8, 35803);
    			attr_dev(div12, "class", "cp-x-y svelte-fwhu0b");
    			add_location(div12, file, 1261, 7, 35192);
    			attr_dev(label10, "class", "cp-x svelte-fwhu0b");
    			set_style(label10, "user-select", "none");
    			set_style(label10, "font-weight", "600");
    			add_location(label10, file, 1280, 8, 36259);
    			attr_dev(input5, "class", "start-pos-box svelte-fwhu0b");
    			attr_dev(input5, "type", "number");
    			attr_dev(input5, "step", "0.001");
    			input5.value = input5_value_value = /*currentPathIndex*/ ctx[8] + 1;
    			input5.readOnly = true;
    			add_location(input5, file, 1281, 8, 36351);
    			attr_dev(div13, "class", "control-point-mini-box-x current-path svelte-fwhu0b");
    			add_location(div13, file, 1278, 7, 36134);
    			attr_dev(div14, "id", "live-pos");
    			attr_dev(div14, "class", "control-point-mini-box svelte-fwhu0b");
    			add_location(div14, file, 1260, 6, 35134);
    			attr_dev(h22, "id", "advanced-options");
    			attr_dev(h22, "class", "section-title svelte-fwhu0b");
    			set_style(h22, "user-select", "none");
    			add_location(h22, file, 1286, 6, 36489);
    			attr_dev(label11, "for", "field-length");
    			set_style(label11, "user-select", "none");
    			attr_dev(label11, "class", "svelte-fwhu0b");
    			add_location(label11, file, 1288, 7, 36629);
    			attr_dev(input6, "id", "auto-link-paths");
    			attr_dev(input6, "type", "checkbox");
    			attr_dev(input6, "class", "svelte-fwhu0b");
    			add_location(input6, file, 1289, 7, 36716);
    			attr_dev(div15, "class", "advanced-options svelte-fwhu0b");
    			add_location(div15, file, 1287, 6, 36591);
    			attr_dev(label12, "for", "field-length");
    			set_style(label12, "user-select", "none");
    			attr_dev(label12, "class", "svelte-fwhu0b");
    			add_location(label12, file, 1293, 7, 36854);
    			attr_dev(input7, "id", "auto-link-paths");
    			attr_dev(input7, "type", "checkbox");
    			attr_dev(input7, "class", "svelte-fwhu0b");
    			add_location(input7, file, 1294, 7, 36944);
    			attr_dev(div16, "class", "advanced-options svelte-fwhu0b");
    			add_location(div16, file, 1292, 6, 36816);
    			attr_dev(label13, "for", "field-length");
    			set_style(label13, "user-select", "none");
    			attr_dev(label13, "class", "svelte-fwhu0b");
    			add_location(label13, file, 1298, 7, 37087);
    			attr_dev(input8, "id", "auto-link-paths");
    			attr_dev(input8, "type", "checkbox");
    			attr_dev(input8, "class", "svelte-fwhu0b");
    			add_location(input8, file, 1299, 7, 37178);
    			attr_dev(div17, "class", "advanced-options svelte-fwhu0b");
    			add_location(div17, file, 1297, 6, 37049);
    			attr_dev(label14, "for", "field-length");
    			set_style(label14, "user-select", "none");
    			attr_dev(label14, "class", "svelte-fwhu0b");
    			add_location(label14, file, 1302, 7, 37315);
    			attr_dev(input9, "id", "auto-link-paths");
    			attr_dev(input9, "type", "checkbox");
    			attr_dev(input9, "class", "svelte-fwhu0b");
    			add_location(input9, file, 1303, 7, 37399);
    			attr_dev(div18, "class", "advanced-options svelte-fwhu0b");
    			add_location(div18, file, 1301, 6, 37277);
    			attr_dev(label15, "for", "rotationUnits");
    			set_style(label15, "user-select", "none");
    			attr_dev(label15, "class", "svelte-fwhu0b");
    			add_location(label15, file, 1306, 7, 37533);
    			option2.__value = "degrees";
    			option2.value = option2.__value;
    			attr_dev(option2, "class", "svelte-fwhu0b");
    			add_location(option2, file, 1308, 8, 37742);
    			option3.__value = "radians";
    			option3.value = option3.__value;
    			attr_dev(option3, "class", "svelte-fwhu0b");
    			add_location(option3, file, 1309, 8, 37791);
    			attr_dev(select1, "id", "rotationUnits");
    			attr_dev(select1, "class", "standard-input-box svelte-fwhu0b");
    			if (/*$rotationUnits*/ ctx[4] === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[49].call(select1));
    			add_location(select1, file, 1307, 7, 37619);
    			attr_dev(div19, "class", "advanced-options svelte-fwhu0b");
    			add_location(div19, file, 1305, 6, 37495);
    			attr_dev(div20, "class", "svelte-fwhu0b");
    			add_location(div20, file, 1193, 5, 32516);
    			attr_dev(div21, "class", "robot-options-menu svelte-fwhu0b");
    			add_location(div21, file, 1192, 4, 32478);
    			attr_dev(div22, "class", "settings-column svelte-fwhu0b");
    			add_location(div22, file, 1191, 3, 32444);
    			attr_dev(svg1, "viewBox", "0 0 144 144");
    			attr_dev(svg1, "width", "100%");
    			attr_dev(svg1, "height", "100%");
    			set_style(svg1, "position", "absolute");
    			set_style(svg1, "top", "0");
    			set_style(svg1, "left", "0");
    			attr_dev(svg1, "class", "svelte-fwhu0b");
    			add_location(svg1, file, 1340, 4, 38566);
    			attr_dev(div23, "class", "field svelte-fwhu0b");
    			add_location(div23, file, 1316, 3, 37899);
    			set_style(button3, "user-select", "none");
    			attr_dev(button3, "class", "svelte-fwhu0b");
    			add_location(button3, file, 1471, 4, 47968);
    			attr_dev(div24, "class", "paths svelte-fwhu0b");
    			add_location(div24, file, 1375, 3, 39748);
    			attr_dev(div25, "class", "container svelte-fwhu0b");
    			add_location(div25, file, 1190, 2, 32417);
    			attr_dev(div26, "class", "play-button svelte-fwhu0b");
    			add_location(div26, file, 1477, 4, 48168);
    			attr_dev(input10, "type", "range");
    			attr_dev(input10, "id", "scrub");
    			attr_dev(input10, "min", "0");
    			attr_dev(input10, "max", "100");
    			attr_dev(input10, "step", "0.001");
    			attr_dev(input10, "class", "svelte-fwhu0b");
    			add_location(input10, file, 1488, 4, 48953);
    			attr_dev(div27, "class", "scrubbing-bar svelte-fwhu0b");
    			add_location(div27, file, 1476, 3, 48136);
    			attr_dev(div28, "class", "footer svelte-fwhu0b");
    			add_location(div28, file, 1475, 2, 48112);
    			attr_dev(div29, "class", "main-content svelte-fwhu0b");
    			add_location(div29, file, 1188, 1, 32386);
    			attr_dev(div30, "class", "svelte-fwhu0b");
    			add_location(div30, file, 1176, 0, 31535);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div30, anchor);
    			append_dev(div30, div1);
    			append_dev(div1, h1);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, svg0);
    			append_dev(svg0, path_1);
    			append_dev(div0, t2);
    			append_dev(div0, button0);
    			append_dev(div0, t4);
    			append_dev(div0, button1);
    			append_dev(div0, t6);
    			append_dev(div0, button2);
    			append_dev(div30, t8);
    			append_dev(div30, div29);
    			append_dev(div29, div25);
    			append_dev(div25, div22);
    			append_dev(div22, div21);
    			append_dev(div21, div20);
    			append_dev(div20, h20);
    			append_dev(div20, t10);
    			append_dev(div20, div2);
    			append_dev(div2, label0);
    			append_dev(div2, t12);
    			append_dev(div2, select0);
    			append_dev(select0, option0);
    			append_dev(select0, option1);
    			select_option(select0, /*$robotUnits*/ ctx[18], true);
    			append_dev(div20, t15);
    			append_dev(div20, div3);
    			append_dev(div3, label1);
    			append_dev(div3, t17);
    			append_dev(div3, input0);
    			append_dev(div20, t18);
    			append_dev(div20, div4);
    			append_dev(div4, label2);
    			append_dev(div4, t20);
    			append_dev(div4, input1);
    			append_dev(div20, t21);
    			append_dev(div20, h21);
    			append_dev(div20, t23);
    			append_dev(div20, div8);
    			append_dev(div8, label3);
    			append_dev(div8, t25);
    			append_dev(div8, div7);
    			append_dev(div7, div5);
    			append_dev(div5, label4);
    			append_dev(div5, t27);
    			if (if_block0) if_block0.m(div5, null);
    			append_dev(div7, t28);
    			append_dev(div7, div6);
    			append_dev(div6, label5);
    			append_dev(div6, t30);
    			if (if_block1) if_block1.m(div6, null);
    			append_dev(div20, t31);
    			append_dev(div20, label6);
    			append_dev(div20, t33);
    			append_dev(div20, div14);
    			append_dev(div14, div12);
    			append_dev(div12, div9);
    			append_dev(div9, label7);
    			append_dev(div9, t35);
    			append_dev(div9, input2);
    			set_input_value(input2, /*robotX*/ ctx[6]);
    			append_dev(div12, t36);
    			append_dev(div12, div10);
    			append_dev(div10, label8);
    			append_dev(div10, t38);
    			append_dev(div10, input3);
    			set_input_value(input3, /*robotY*/ ctx[7]);
    			append_dev(div12, t39);
    			append_dev(div12, div11);
    			append_dev(div11, label9);
    			append_dev(div11, t41);
    			append_dev(div11, input4);
    			append_dev(div14, t42);
    			append_dev(div14, div13);
    			append_dev(div13, label10);
    			append_dev(div13, t44);
    			append_dev(div13, input5);
    			append_dev(div20, t45);
    			append_dev(div20, h22);
    			append_dev(div20, t47);
    			append_dev(div20, div15);
    			append_dev(div15, label11);
    			append_dev(div15, t49);
    			append_dev(div15, input6);
    			input6.checked = /*$shouldShowHitbox*/ ctx[17];
    			append_dev(div20, t50);
    			append_dev(div20, div16);
    			append_dev(div16, label12);
    			append_dev(div16, t52);
    			append_dev(div16, input7);
    			input7.checked = /*$shouldHaveBoilerplate*/ ctx[13];
    			append_dev(div20, t53);
    			append_dev(div20, div17);
    			append_dev(div17, label13);
    			append_dev(div17, t55);
    			append_dev(div17, input8);
    			input8.checked = /*$shouldRepeatPath*/ ctx[16];
    			append_dev(div20, t56);
    			append_dev(div20, div18);
    			append_dev(div18, label14);
    			append_dev(div18, t58);
    			append_dev(div18, input9);
    			input9.checked = /*$autoLinkPaths*/ ctx[14];
    			append_dev(div20, t59);
    			append_dev(div20, div19);
    			append_dev(div19, label15);
    			append_dev(div19, t61);
    			append_dev(div19, select1);
    			append_dev(select1, option2);
    			append_dev(select1, option3);
    			select_option(select1, /*$rotationUnits*/ ctx[4], true);
    			append_dev(div25, t64);
    			append_dev(div25, div23);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				if (each_blocks_2[i]) {
    					each_blocks_2[i].m(div23, null);
    				}
    			}

    			append_dev(div23, t65);
    			if (if_block2) if_block2.m(div23, null);
    			append_dev(div23, t66);
    			append_dev(div23, svg1);
    			if (if_block3) if_block3.m(svg1, null);
    			append_dev(svg1, if_block3_anchor);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(svg1, null);
    				}
    			}

    			append_dev(div25, t67);
    			append_dev(div25, div24);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div24, null);
    				}
    			}

    			append_dev(div24, t68);
    			append_dev(div24, button3);
    			append_dev(div29, t70);
    			append_dev(div29, div28);
    			append_dev(div28, div27);
    			append_dev(div27, div26);
    			if_block4.m(div26, null);
    			append_dev(div27, t71);
    			append_dev(div27, input10);
    			set_input_value(input10, /*linearScrubValue*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen_dev(svg0, "click", /*showCodeWindow*/ ctx[33], false, false, false, false),
    					listen_dev(button0, "click", /*resetToDefault*/ ctx[23], false, false, false, false),
    					listen_dev(button1, "click", /*importControlPoints*/ ctx[24], false, false, false, false),
    					listen_dev(button2, "click", /*exportControlPoints*/ ctx[22], false, false, false, false),
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[36]),
    					listen_dev(input0, "input", /*input_handler*/ ctx[37], false, false, false, false),
    					listen_dev(input1, "input", /*input_handler_1*/ ctx[38], false, false, false, false),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[43]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[44]),
    					listen_dev(input6, "change", /*input6_change_handler*/ ctx[45]),
    					listen_dev(input7, "change", /*input7_change_handler*/ ctx[46]),
    					listen_dev(input8, "change", /*input8_change_handler*/ ctx[47]),
    					listen_dev(input9, "change", /*input9_change_handler*/ ctx[48]),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[49]),
    					listen_dev(select1, "change", /*updateRobotPosition*/ ctx[30], false, false, false, false),
    					listen_dev(button3, "click", /*click_handler_5*/ ctx[72], false, false, false, false),
    					listen_dev(input10, "change", /*input10_change_input_handler*/ ctx[73]),
    					listen_dev(input10, "input", /*input10_change_input_handler*/ ctx[73]),
    					listen_dev(input10, "input", /*updateRobotPosition*/ ctx[30], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$robotUnits*/ 262144) {
    				select_option(select0, /*$robotUnits*/ ctx[18]);
    			}

    			if (dirty[0] & /*displayLength*/ 4096 && input0.value !== /*displayLength*/ ctx[12]) {
    				prop_dev(input0, "value", /*displayLength*/ ctx[12]);
    			}

    			if (dirty[0] & /*displayWidth*/ 2048 && input1.value !== /*displayWidth*/ ctx[11]) {
    				prop_dev(input1, "value", /*displayWidth*/ ctx[11]);
    			}

    			if (/*$paths*/ ctx[3].length > 0) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_14(ctx);
    					if_block0.c();
    					if_block0.m(div5, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*$paths*/ ctx[3].length > 0) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_13(ctx);
    					if_block1.c();
    					if_block1.m(div6, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty[0] & /*robotX*/ 64 && to_number(input2.value) !== /*robotX*/ ctx[6]) {
    				set_input_value(input2, /*robotX*/ ctx[6]);
    			}

    			if (dirty[0] & /*robotY*/ 128 && to_number(input3.value) !== /*robotY*/ ctx[7]) {
    				set_input_value(input3, /*robotY*/ ctx[7]);
    			}

    			if (dirty[0] & /*robotLiveAngle*/ 512 && input4_value_value !== (input4_value_value = Math.round(/*robotLiveAngle*/ ctx[9])) && input4.value !== input4_value_value) {
    				prop_dev(input4, "value", input4_value_value);
    			}

    			if (dirty[0] & /*currentPathIndex*/ 256 && input5_value_value !== (input5_value_value = /*currentPathIndex*/ ctx[8] + 1) && input5.value !== input5_value_value) {
    				prop_dev(input5, "value", input5_value_value);
    			}

    			if (dirty[0] & /*$shouldShowHitbox*/ 131072) {
    				input6.checked = /*$shouldShowHitbox*/ ctx[17];
    			}

    			if (dirty[0] & /*$shouldHaveBoilerplate*/ 8192) {
    				input7.checked = /*$shouldHaveBoilerplate*/ ctx[13];
    			}

    			if (dirty[0] & /*$shouldRepeatPath*/ 65536) {
    				input8.checked = /*$shouldRepeatPath*/ ctx[16];
    			}

    			if (dirty[0] & /*$autoLinkPaths*/ 16384) {
    				input9.checked = /*$autoLinkPaths*/ ctx[14];
    			}

    			if (dirty[0] & /*$rotationUnits*/ 16) {
    				select_option(select1, /*$rotationUnits*/ ctx[4]);
    			}

    			if (dirty[0] & /*$paths*/ 8) {
    				each_value_4 = /*$paths*/ ctx[3];
    				validate_each_argument(each_value_4);
    				let i;

    				for (i = 0; i < each_value_4.length; i += 1) {
    					const child_ctx = get_each_context_4(ctx, each_value_4, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_2[i] = create_each_block_4(child_ctx);
    						each_blocks_2[i].c();
    						each_blocks_2[i].m(div23, t65);
    					}
    				}

    				for (; i < each_blocks_2.length; i += 1) {
    					each_blocks_2[i].d(1);
    				}

    				each_blocks_2.length = each_value_4.length;
    			}

    			if (/*$paths*/ ctx[3].length > 0) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_12(ctx);
    					if_block2.c();
    					if_block2.m(div23, t66);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*$shouldShowHitbox*/ ctx[17]) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_10(ctx);
    					if_block3.c();
    					if_block3.m(svg1, if_block3_anchor);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (dirty[0] & /*offsetPaths*/ 1024) {
    				each_value_2 = /*offsetPaths*/ ctx[10];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_2(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(svg1, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_2.length;
    			}

    			if (dirty[0] & /*$paths, generateBezierCurve, updateRobotPosition, addControlPointToPathWithIndex, deletePath, updatePathColor*/ 1545601032 | dirty[1] & /*checkAutoLinkControlPoints*/ 2) {
    				each_value = /*$paths*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div24, t68);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (current_block_type === (current_block_type = select_block_type_3(ctx)) && if_block4) {
    				if_block4.p(ctx, dirty);
    			} else {
    				if_block4.d(1);
    				if_block4 = current_block_type(ctx);

    				if (if_block4) {
    					if_block4.c();
    					if_block4.m(div26, null);
    				}
    			}

    			if (dirty[0] & /*linearScrubValue*/ 2) {
    				set_input_value(input10, /*linearScrubValue*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div30);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			destroy_each(each_blocks_2, detaching);
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			if_block4.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function calculateBezier(points, steps) {
    	let curve = [];

    	for (let t = 0; t <= 1; t += 1 / steps) {
    		curve.push(deCasteljau(points, t));
    	}

    	curve.push(points[points.length - 1]);
    	return curve;
    }

    /**
     * computes a point on a Bezier curve using De Casteljau's algorithm.
     *
     * @param {Array<{x: number, y: number}>} points - an array of points defining the Bezier curve.
     * @param {number} t - the parameter t, where 0 <= t <= 1, representing the position on the curve.
     * @returns {{x: number, y: number}} - the computed point on the Bezier curve at parameter t.
     */
    function deCasteljau(points, t) {
    	if (points.length === 1) return points[0];
    	let newPoints = [];

    	for (let i = 0; i < points.length - 1; i++) {
    		let x = (1 - t) * points[i].x + t * points[i + 1].x;
    		let y = (1 - t) * points[i].y + t * points[i + 1].y;
    		newPoints.push({ x, y });
    	}

    	return deCasteljau(newPoints, t);
    }

    const func = p => `${p.x},${144 - p.y}`;
    const func_1 = p => `${p.x},${144 - p.y}`;
    const func_2 = p => `${p.x},${144 - p.y}`;
    const func_3 = p => `${p.x},${144 - p.y}`;
    const func_4 = p => `${p.x},${144 - p.y}`;

    function instance($$self, $$props, $$invalidate) {
    	let animTime;
    	let displayLength;
    	let displayWidth;
    	let $robotWidth;
    	let $paths;
    	let $shouldHaveBoilerplate;
    	let $rotationUnits;
    	let $autoLinkPaths;
    	let $robotLength;
    	let $shouldRepeatPath;
    	let $shouldShowHitbox;
    	let $robotUnits;
    	let $displayDimensions;
    	validate_store(robotWidth, 'robotWidth');
    	component_subscribe($$self, robotWidth, $$value => $$invalidate(2, $robotWidth = $$value));
    	validate_store(paths, 'paths');
    	component_subscribe($$self, paths, $$value => $$invalidate(3, $paths = $$value));
    	validate_store(shouldHaveBoilerplate, 'shouldHaveBoilerplate');
    	component_subscribe($$self, shouldHaveBoilerplate, $$value => $$invalidate(13, $shouldHaveBoilerplate = $$value));
    	validate_store(rotationUnits, 'rotationUnits');
    	component_subscribe($$self, rotationUnits, $$value => $$invalidate(4, $rotationUnits = $$value));
    	validate_store(autoLinkPaths, 'autoLinkPaths');
    	component_subscribe($$self, autoLinkPaths, $$value => $$invalidate(14, $autoLinkPaths = $$value));
    	validate_store(robotLength, 'robotLength');
    	component_subscribe($$self, robotLength, $$value => $$invalidate(15, $robotLength = $$value));
    	validate_store(shouldRepeatPath, 'shouldRepeatPath');
    	component_subscribe($$self, shouldRepeatPath, $$value => $$invalidate(16, $shouldRepeatPath = $$value));
    	validate_store(shouldShowHitbox, 'shouldShowHitbox');
    	component_subscribe($$self, shouldShowHitbox, $$value => $$invalidate(17, $shouldShowHitbox = $$value));
    	validate_store(robotUnits, 'robotUnits');
    	component_subscribe($$self, robotUnits, $$value => $$invalidate(18, $robotUnits = $$value));
    	validate_store(displayDimensions, 'displayDimensions');
    	component_subscribe($$self, displayDimensions, $$value => $$invalidate(35, $displayDimensions = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let scrubValue = 0;
    	let robotX = 12;
    	let robotY = 96;
    	let isPlaying = false;
    	let wasPaused = true;
    	let isStartingFromBeginning = true;
    	let intervalId = null;
    	let animInterval = 1;
    	let progress = 0;
    	let elapsedTime = 0;
    	let path = null;
    	let pathAnimTime = 0;
    	let linearScrubValue = 0;
    	let motionBlurAmount = 0.02;
    	let currentPathIndex = 0;
    	let pathStartTime = 0;
    	let robotLiveAngle = 0;

    	/**
     * updates the robot length based on the provided value
     *
     * @param {number|string} value - the new length value to be set, can be a number or a string that can be parsed to a number.
     */
    	function updateRobotLength(value) {
    		const newValue = parseFloat(value) || 0;
    		set_store_value(robotLength, $robotLength = parseFloat(($robotUnits === 'inches' ? newValue : newValue / 2.54).toFixed(2)), $robotLength);
    	}

    	/**
     * updates the robot width based on the provided value
     * 
     * @param {number|string} value - the new width value to be set, can be a number or a string that can be parsed to a number.
     */
    	function updateRobotWidth(value) {
    		const newValue = parseFloat(value) || 0;
    		set_store_value(robotWidth, $robotWidth = parseFloat(($robotUnits === 'inches' ? newValue : newValue / 2.54).toFixed(2)), $robotWidth);
    	}

    	/**
     * generates the Bezier curve for the specified path.
     *
     * @param {number} pathId - the ID of the path for which to generate the Bezier curve.
     */
    	function generateBezierCurve(pathId) {
    		paths.update(paths => {
    			const path = paths.find(p => p.id === pathId);

    			if (path) {
    				path.bezierCurvePoints = calculateBezier(path.controlPoints, 100);
    			}

    			return paths;
    		});
    	}

    	// exports the control points and related settings to a JSON file
    	function exportControlPoints() {
    		const data = {
    			paths: $paths,
    			robotLength: $robotLength,
    			robotWidth: $robotWidth,
    			robotUnits: $robotUnits,
    			rotationUnits: $rotationUnits,
    			shouldShowHitbox: $shouldShowHitbox,
    			shouldHaveBoilerplate: $shouldHaveBoilerplate,
    			autoLinkPaths: $autoLinkPaths,
    			shouldRepeatPath: $shouldRepeatPath
    		};

    		const json = JSON.stringify(data, null, 2);
    		const blob = new Blob([json], { type: 'application/json' });
    		const url = URL.createObjectURL(blob);
    		const link = document.createElement('a');
    		link.href = url;
    		link.download = 'paths.json';
    		link.click();
    	}

    	// resets all settings to their default values
    	function resetToDefault() {
    		paths.set([]);
    		addPath();
    		generateBezierCurve($paths.length - 1);
    		updateRobotPosition();
    		robotLength.set(18);
    		robotWidth.set(18);
    		robotUnits.set('inches');
    		rotationUnits.set('degrees');
    		shouldShowHitbox.set(false);
    		shouldHaveBoilerplate.set(false);
    		autoLinkPaths.set(true);
    		shouldRepeatPath.set(true);
    	}

    	// imports control points and related settings from a JSON file
    	function importControlPoints() {
    		const input = document.createElement('input');
    		input.type = 'file';
    		input.accept = '.json';

    		input.onchange = async event => {
    			const file = event.target.files[0];
    			const text = await file.text();
    			const data = JSON.parse(text);
    			paths.set(data.paths);
    			robotLength.set(data.robotLength);
    			robotWidth.set(data.robotWidth);
    			robotUnits.set(data.robotUnits);
    			rotationUnits.set(data.rotationUnits);
    			shouldShowHitbox.set(data.shouldShowHitbox);
    			shouldHaveBoilerplate.set(data.shouldHaveBoilerplate);
    			autoLinkPaths.set(data.autoLinkPaths);
    			shouldRepeatPath.set(data.shouldRepeatPath);
    			data.paths.forEach((_, index) => generateBezierCurve(index));
    			updateRobotPosition();
    		};

    		input.click();
    	}

    	// adds a new path to the list of paths
    	function addPath() {
    		paths.update(paths => {
    			const newPath = new Path(paths.length);

    			if (paths.length > 0) {
    				const lastPath = paths[paths.length - 1];

    				if (lastPath.controlPoints.length > 0) {
    					const lastControlPoint = lastPath.controlPoints[lastPath.controlPoints.length - 1];
    					const angle = Math.random() * 2 * Math.PI;
    					const distance = 50;
    					const x = 72 + Math.cos(angle) * distance;
    					const y = 72 + Math.sin(angle) * distance;

    					newPath.controlPoints.push({
    						x: lastControlPoint.x,
    						y: lastControlPoint.y
    					});

    					newPath.controlPoints.push({ x, y });
    				}
    			} else {
    				newPath.controlPoints.push({ x: 12, y: 96 });
    				newPath.controlPoints.push({ x: 36, y: 96 });
    			}

    			newPath.bezierCurvePoints = newPath.calculateBezier();
    			return [...paths, newPath];
    		});
    	}

    	// if there's no paths on mount, add a new path
    	onMount(() => {
    		paths.update(p => {
    			if (p.length === 0) {
    				addPath();
    			}

    			return p;
    		});
    	});

    	/**
     * adds a control point to the specified path at the given index.
     *
     * @param {number} pathId - the ID of the path to which the control point will be added.
     * @param {number} index - the index at which the control point will be added (but idk why this is still here, we don't use it)
     */
    	function addControlPointToPathWithIndex(pathId, index) {
    		paths.update(paths => {
    			const path = paths.find(p => p.id === pathId);

    			if (path) {
    				const angle = Math.random() * 2 * Math.PI;
    				const distance = 50;

    				// generate a random point in a circle from the center of the field
    				const x = 72 + Math.cos(angle) * distance;

    				const y = 72 + Math.sin(angle) * distance;

    				if (path.controlPoints.length > 1) {
    					const insertIndex = path.controlPoints.length - 1;
    					path.controlPoints.splice(insertIndex, 0, { x, y });
    				} else {
    					path.controlPoints.push({ x, y });
    				}
    			}

    			return paths;
    		});
    	}

    	/**
     * updates the color of a specific path identified by its ID.
     *
     * @param {string} pathId - the unique identifier of the path to update.
     * @param {string} color - the new color to set for the specified path.
     */
    	function updatePathColor(pathId, color) {
    		paths.update(paths => {
    			const path = paths.find(p => p.id === pathId);

    			if (path) {
    				path.setColor(color);
    			}

    			return paths;
    		});
    	}

    	/**
     * deletes a path by its ID and updates the paths store.
     * 
     * @param {number} pathId - the ID of the path to delete.
     */
    	function deletePath(pathId) {
    		paths.update(paths => {
    			const updatedPaths = paths.filter(path => path.id !== pathId);

    			updatedPaths.forEach((path, index) => {
    				path.id = index;
    			});

    			// check if auto-link paths is enabled and the path to be deleted is not the first or last path
    			if ($autoLinkPaths && pathId > 0 && pathId < paths.length - 1) {
    				const previousPath = updatedPaths[pathId - 1];
    				const nextPath = updatedPaths[pathId];

    				if (previousPath && nextPath) {
    					nextPath.controlPoints[0] = {
    						...previousPath.controlPoints[previousPath.controlPoints.length - 1]
    					};

    					nextPath.bezierCurvePoints = calculateBezier(nextPath.controlPoints, 100);
    				}
    			}

    			return updatedPaths;
    		});
    	}

    	// plays the path animation
    	function playPath() {
    		if (isPlaying) return;
    		$$invalidate(0, isPlaying = true);

    		$$invalidate(8, currentPathIndex = isStartingFromBeginning
    		? 0
    		: Math.floor(scrubValue / 100 * $paths.length));

    		pathStartTime = Date.now() - (isStartingFromBeginning
    		? 0
    		: scrubValue % (100 / $paths.length) / 100 * animTime * 1000);

    		// if the path was paused, we need to adjust the start time to account for the time the path was paused
    		if (wasPaused) {
    			pathStartTime = Date.now() - progress * pathAnimTime * 1000;
    		}

    		// set an interval to update the animation frame
    		intervalId = setInterval(
    			() => {
    				elapsedTime = (Date.now() - pathStartTime) / 1000;
    				$$invalidate(5, path = $paths[currentPathIndex]);
    				pathAnimTime = animTime / $paths.length;
    				progress = elapsedTime / pathAnimTime;

    				// update the linear scrub value based on the current progress
    				$$invalidate(1, linearScrubValue = (currentPathIndex + progress) / $paths.length * 100);

    				// add easing to the progress
    				if (progress < 0.5) {
    					progress = 2 * progress * progress;
    				} else {
    					progress = -1 + (4 - 2 * progress) * progress;
    				}

    				scrubValue = (currentPathIndex + progress) / $paths.length * 100;
    				updateRobotPosition();

    				// check if the current path animation is complete
    				if (elapsedTime >= pathAnimTime) {
    					if (currentPathIndex + 1 >= $paths.length) {
    						if ($shouldRepeatPath) {
    							$$invalidate(8, currentPathIndex = 0);
    						} else {
    							pausePath();
    						}
    					} else {
    						// move to the next path
    						$$invalidate(8, currentPathIndex++, currentPathIndex);
    					}

    					pathStartTime = Date.now();
    				}
    			},
    			animInterval
    		);
    	}

    	function updateRobotPosition() {
    		let totalPoints = 0;

    		$paths.forEach(path => {
    			totalPoints += path.bezierCurvePoints.length; // calculate total points
    		});

    		let accumulatedPoints = 0;

    		for (let path of $paths) {
    			if (scrubValue <= (accumulatedPoints + path.bezierCurvePoints.length) / totalPoints * 100) {
    				const relativeScrubValue = (scrubValue - accumulatedPoints / totalPoints * 100) / (path.bezierCurvePoints.length / totalPoints * 100);
    				const pointIndex = Math.floor(relativeScrubValue * (path.bezierCurvePoints.length - 1)); // find the point index
    				const point = path.bezierCurvePoints[pointIndex];

    				if (point) {
    					$$invalidate(6, robotX = point.x);
    					$$invalidate(7, robotY = point.y);
    					const robotElement = document.getElementById('robot');

    					if (robotElement) {
    						if (path.robotHeading === 'tangential') {
    							const nextPoint = path.bezierCurvePoints[Math.min(pointIndex + 1, path.bezierCurvePoints.length - 1)];
    							const prevPoint = path.bezierCurvePoints[Math.max(pointIndex - 1, 0)];
    							let angle = Math.atan2(nextPoint.y - prevPoint.y, nextPoint.x - prevPoint.x); // calculate tangential angle

    							if (path.reverse) {
    								angle += Math.PI;
    							}

    							robotElement.style.transform = `translate(-50%, 50%) rotate(${-angle + Math.PI / 2}rad)`;

    							$$invalidate(9, robotLiveAngle = $rotationUnits === 'degrees'
    							? angle * (180 / Math.PI)
    							: angle);
    						} else if (path.robotHeading === 'linear') {
    							const startAngle = path.startAngle || 0;
    							const endAngle = path.endAngle || 0;
    							const angle = startAngle + (endAngle - startAngle) * relativeScrubValue; // interpolate linear angle
    							robotElement.style.transform = `translate(-50%, 50%) rotate(${-angle + Math.PI / 2}rad)`;

    							$$invalidate(9, robotLiveAngle = $rotationUnits === 'degrees'
    							? angle * (180 / Math.PI)
    							: angle);
    						} else if (path.robotHeading === 'constant') {
    							const angle = path.constantAngle || 0;
    							robotElement.style.transform = `translate(-50%, 50%) rotate(${-angle + Math.PI / 2}rad)`; // set constant angle

    							$$invalidate(9, robotLiveAngle = $rotationUnits === 'degrees'
    							? -angle * (180 / Math.PI)
    							: -angle);
    						}
    					}
    				}

    				break;
    			}

    			accumulatedPoints += path.bezierCurvePoints.length; // accumulate points
    		}
    	}

    	// pauses the path animation by stopping the interval and updating state variables
    	function pausePath() {
    		$$invalidate(0, isPlaying = false);

    		if (intervalId) {
    			clearInterval(intervalId);
    			intervalId = null;
    		}

    		$$invalidate(34, wasPaused = true);
    		isStartingFromBeginning = false;
    	}

    	// add path on DOM content load
    	document.addEventListener('DOMContentLoaded', () => {
    		if ($paths.length === 0) {
    			addPath();
    			generateBezierCurve($paths.length - 1);
    		}
    	});

    	// on mouse down event listener to move control points
    	document.addEventListener('mousedown', event => {
    		const field = document.querySelector('.field');
    		const rect = field.getBoundingClientRect();
    		const mouseX = event.clientX - rect.left;
    		const mouseY = event.clientY - rect.top;
    		let selectedPathId = null;
    		let selectedPointIndex = null;
    		let selectedPathId2 = null;
    		let selectedPointIndex2 = null;

    		// update selected control points based on mouse position
    		$paths.forEach(path => {
    			path.controlPoints.forEach((point, index) => {
    				const pointX = point.x / 144 * rect.width;
    				const pointY = rect.height - point.y / 144 * rect.height;
    				const distance = Math.sqrt((mouseX - pointX) ** 2 + (mouseY - pointY) ** 2);

    				if (distance < 10) {
    					if (selectedPathId === null && selectedPointIndex === null) {
    						selectedPathId = path.id;
    						selectedPointIndex = index;
    					} else if ($autoLinkPaths && selectedPathId2 === null && selectedPointIndex2 === null) {
    						selectedPathId2 = path.id;
    						selectedPointIndex2 = index;
    					}
    				}
    			});
    		});

    		if (selectedPathId !== null && selectedPointIndex !== null) {
    			const movePoint = moveEvent => {
    				// clamp the control points to the field boundaries
    				const newMouseX = moveEvent.clientX - rect.left;

    				const newMouseY = moveEvent.clientY - rect.top;
    				let newX = newMouseX / rect.width * 144;
    				let newY = 144 - newMouseY / rect.height * 144;

    				// apply hitbox offset to ensure the robot stays within the field
    				const hitboxOffsetX = $robotWidth / 2;

    				const hitboxOffsetY = $robotLength / 2;
    				newX = Math.max(hitboxOffsetX, Math.min(144 - hitboxOffsetX, newX));
    				newY = Math.max(hitboxOffsetY, Math.min(144 - hitboxOffsetY, newY));

    				paths.update(paths => {
    					const path = paths.find(p => p.id === selectedPathId);

    					if (path) {
    						path.controlPoints[selectedPointIndex] = { x: newX, y: newY };
    						path.bezierCurvePoints = calculateBezier(path.controlPoints, 100);
    					}

    					if ($autoLinkPaths && selectedPathId2 !== null && selectedPointIndex2 !== null) {
    						const path2 = paths.find(p => p.id === selectedPathId2);

    						if (path2) {
    							path2.controlPoints[selectedPointIndex2] = { x: newX, y: newY };
    							path2.bezierCurvePoints = calculateBezier(path2.controlPoints, 100);
    						}
    					}

    					return paths;
    				});

    				updateRobotPosition();
    			};

    			const stopMove = () => {
    				// remove event listeners when the mouse button is released
    				document.removeEventListener('mousemove', movePoint);

    				document.removeEventListener('mouseup', stopMove);
    			};

    			// add event listeners for mouse move and mouse up
    			document.addEventListener('mousemove', movePoint);

    			document.addEventListener('mouseup', stopMove);
    		}
    	});

    	function checkAutoLinkControlPoints() {
    		if ($autoLinkPaths) {
    			paths.update(paths => {
    				// iterate through each path except the last one
    				for (let i = 0; i < paths.length - 1; i++) {
    					const currentPath = paths[i];
    					const nextPath = paths[i + 1];

    					// check if both current and next paths have control points
    					if (currentPath.controlPoints.length > 0 && nextPath.controlPoints.length > 0) {
    						const lastPoint = currentPath.controlPoints[currentPath.controlPoints.length - 1];

    						// set the first control point of the next path to the last control point of the current path
    						nextPath.controlPoints[0] = { ...lastPoint };

    						nextPath.bezierCurvePoints = calculateBezier(nextPath.controlPoints, 100);
    					}
    				}

    				return paths;
    			});
    		}
    	}

    	function showCodeWindow() {
    		const codeWindow = window.open('', 'CodeWindow', 'width=600,height=400');
    		let codeContent = '';

    		// add boilerplate code if the option is selected
    		if ($shouldHaveBoilerplate) {
    			codeContent += 'package your.package.here;\n\n';
    			codeContent += 'import com.pedropathing.follower.Follower;\n';
    			codeContent += 'import com.pedropathing.localization.Pose;\n';
    			codeContent += 'import com.pedropathing.pathgen.BezierCurve;\n';
    			codeContent += 'import com.pedropathing.pathgen.BezierLine;\n';
    			codeContent += 'import com.pedropathing.pathgen.Path;\n';
    			codeContent += 'import com.pedropathing.pathgen.Point;\n';
    			codeContent += 'import com.pedropathing.util.Constants;\n';
    			codeContent += 'import com.pedropathing.util.Timer;\n';
    			codeContent += 'import com.qualcomm.robotcore.eventloop.opmode.Autonomous;\n';
    			codeContent += 'import com.qualcomm.robotcore.eventloop.opmode.OpMode;\n';
    			codeContent += 'import pedroPathing.constants.FConstants;\n';
    			codeContent += 'import pedroPathing.constants.LConstants;\n\n';
    			codeContent += '@Autonomous(name = "New Auto", group = "Examples")\n';
    			codeContent += 'public class NewAuto extends OpMode {\n\n';
    			codeContent += '    private Follower follower;\n';
    			codeContent += '    private Timer pathTimer, actionTimer, opmodeTimer;\n';
    			codeContent += '    private int pathState;\n\n';
    		}

    		codeContent += 'private final Pose startPose = new Pose(';
    		codeContent += robotX.toFixed(3) + ', ';
    		codeContent += robotY.toFixed(3) + ', ';

    		codeContent += $rotationUnits === 'degrees'
    		? `Math.toRadians(${robotLiveAngle.toFixed(3)})`
    		: robotLiveAngle.toFixed(3);

    		codeContent += ');\n\n';
    		codeContent += 'private Path ';

    		$paths.forEach((path, index) => {
    			codeContent += `p${index + 1}`;

    			if (index < $paths.length - 1) {
    				codeContent += ', ';
    			}
    		});

    		codeContent += ';\n\n';
    		codeContent += 'public void buildPaths() {\n';

    		$paths.forEach((path, index) => {
    			const points = path.controlPoints.map(point => `new Point(${point.x.toFixed(3)}, ${point.y.toFixed(3)}, Point.CARTESIAN)`).join(',\n                ');

    			const bezierType = path.controlPoints.length === 2
    			? 'BezierLine'
    			: 'BezierCurve';

    			codeContent += `    p${index + 1} = new Path(new ${bezierType}(\n                ${points}\n        )\n    );\n\n`;

    			// change code based on heading option selected
    			if (path.robotHeading === 'constant') {
    				const angle = $rotationUnits === 'degrees'
    				? `Math.toRadians(${path.constantAngleDegrees || 0})`
    				: `${path.constantAngleDegrees || 0}`;

    				codeContent += `    p${index + 1}.setConstantHeadingInterpolation(${angle});\n\n`;
    			} else if (path.robotHeading === 'tangential') {
    				codeContent += `    p${index + 1}.setTangentHeadingInterpolation();\n`;

    				if (path.reverse) {
    					codeContent += `    p${index + 1}.setReversed(true);\n\n`;
    				} else {
    					codeContent += `    p${index + 1}.setReversed(false);\n\n`;
    				}
    			} else if (path.robotHeading === 'linear') {
    				const startAngle = $rotationUnits === 'degrees'
    				? `Math.toRadians(${path.startAngleDegrees || 0})`
    				: `${path.startAngleDegrees || 0}`;

    				const endAngle = $rotationUnits === 'degrees'
    				? `Math.toRadians(${path.endAngleDegrees || 0})`
    				: `${path.endAngleDegrees || 0}`;

    				codeContent += `    p${index + 1}.setLinearHeadingInterpolation(${startAngle}, ${endAngle});\n\n`;
    			}
    		});

    		codeContent += '}\n\n';

    		if ($shouldHaveBoilerplate) {
    			codeContent += 'public void autonomousPathUpdate() {\n';
    			codeContent += '    switch (pathState) {\n';

    			$paths.forEach((_, index) => {
    				codeContent += `        case ${index * 10}:\n`;
    				codeContent += `            if (!follower.isBusy()) {\n`;
    				codeContent += `                follower.followPath(p${index + 1});\n`;
    				codeContent += `                setPathState(${(index + 1) * 10});\n`;
    				codeContent += `            }\n`;
    				codeContent += `            break;\n`;
    			});

    			codeContent += '    }\n';
    			codeContent += '}\n\n';
    			codeContent += 'public void setPathState(int pState) {\n';
    			codeContent += '    pathState = pState;\n';
    			codeContent += '    pathTimer.resetTimer();\n';
    			codeContent += '}\n\n';
    			codeContent += 'public void loop() {\n';
    			codeContent += '    follower.update();\n';
    			codeContent += '    autonomousPathUpdate();\n';
    			codeContent += '    telemetry.addData("path state", pathState);\n';
    			codeContent += '    telemetry.addData("x", follower.getPose().getX());\n';
    			codeContent += '    telemetry.addData("y", follower.getPose().getY());\n';
    			codeContent += '    telemetry.addData("heading", follower.getPose().getHeading());\n';
    			codeContent += '    telemetry.update();\n';
    			codeContent += '}\n\n';
    			codeContent += 'public void init() {\n';
    			codeContent += '    pathTimer = new Timer();\n';
    			codeContent += '    opmodeTimer = new Timer();\n';
    			codeContent += '    opmodeTimer.resetTimer();\n\n';
    			codeContent += '    Constants.setConstants(FConstants.class, LConstants.class);\n';
    			codeContent += '    follower = new Follower(hardwareMap);\n';
    			codeContent += '    follower.setStartingPose(startPose);\n';
    			codeContent += '    buildPaths();\n';
    			codeContent += '}\n\n';
    			codeContent += 'public void init_loop() {}\n\n';
    			codeContent += 'public void start() {\n';
    			codeContent += '    opmodeTimer.resetTimer();\n';
    			codeContent += '    setPathState(0);\n';
    			codeContent += '}\n\n';
    			codeContent += 'public void stop() {}\n\n';
    			codeContent += '}';
    		}

    		codeWindow.document.write('<pre>' + codeContent + '</pre>');
    		codeWindow.document.close();
    	}

    	let offsetPaths = [];
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function select0_change_handler() {
    		$robotUnits = select_value(this);
    		robotUnits.set($robotUnits);
    	}

    	const input_handler = e => updateRobotLength(e.target.value);
    	const input_handler_1 = e => updateRobotWidth(e.target.value);

    	function input_input_handler() {
    		$paths[0].controlPoints[0].x = to_number(this.value);
    		paths.set($paths);
    	}

    	const input_handler_2 = e => {
    		set_store_value(paths, $paths[0].controlPoints[0].x = parseFloat(e.target.value), $paths);
    		generateBezierCurve(0);
    		paths.set($paths);
    		updateRobotPosition();
    	};

    	function input_input_handler_1() {
    		$paths[0].controlPoints[0].y = to_number(this.value);
    		paths.set($paths);
    	}

    	const input_handler_3 = e => {
    		set_store_value(paths, $paths[0].controlPoints[0].y = parseFloat(e.target.value), $paths);
    		generateBezierCurve(0);
    		paths.set($paths);
    		updateRobotPosition();
    	};

    	function input2_input_handler() {
    		robotX = to_number(this.value);
    		$$invalidate(6, robotX);
    	}

    	function input3_input_handler() {
    		robotY = to_number(this.value);
    		$$invalidate(7, robotY);
    	}

    	function input6_change_handler() {
    		$shouldShowHitbox = this.checked;
    		shouldShowHitbox.set($shouldShowHitbox);
    	}

    	function input7_change_handler() {
    		$shouldHaveBoilerplate = this.checked;
    		shouldHaveBoilerplate.set($shouldHaveBoilerplate);
    	}

    	function input8_change_handler() {
    		$shouldRepeatPath = this.checked;
    		shouldRepeatPath.set($shouldRepeatPath);
    	}

    	function input9_change_handler() {
    		$autoLinkPaths = this.checked;
    		autoLinkPaths.set($autoLinkPaths);
    	}

    	function select1_change_handler() {
    		$rotationUnits = select_value(this);
    		rotationUnits.set($rotationUnits);
    	}

    	const click_handler = path => {
    		if (!(path.id == 0 || path.id == $paths.length - 1)) {
    			const temp = $paths[path.id + 1];
    			set_store_value(paths, $paths[path.id + 1] = { ...$paths[path.id], id: path.id + 1 }, $paths);
    			set_store_value(paths, $paths[path.id] = { ...temp, id: path.id }, $paths);
    			paths.set($paths);
    			checkAutoLinkControlPoints();
    		}
    	};

    	const click_handler_1 = path => {
    		if (!(path.id == 0 || path.id == 1)) {
    			const temp = $paths[path.id - 1];
    			set_store_value(paths, $paths[path.id - 1] = { ...$paths[path.id], id: path.id - 1 }, $paths);
    			set_store_value(paths, $paths[path.id] = { ...temp, id: path.id }, $paths);
    			paths.set($paths);
    			checkAutoLinkControlPoints();
    		}
    	};

    	function input_input_handler_2(each_value, path_index) {
    		each_value[path_index].color = this.value;
    		paths.set($paths);
    	}

    	const input_handler_4 = path => updatePathColor(path.id, path.color);

    	const click_handler_2 = path => {
    		if ($paths.length > 1) deletePath(path.id);
    	};

    	const click_handler_3 = path => addControlPointToPathWithIndex(path.id, path.controlPoints.length - 1);

    	const keydown_handler = (path, e) => {
    		if (e.key === 'Enter') addControlPointToPathWithIndex(path.id, path.controlPoints.length - 1);
    	};

    	const input_handler_5 = (path, i, each_value, path_index, e) => {
    		set_store_value(paths, each_value[path_index].controlPoints[i].x = parseFloat(e.target.value), $paths);
    		generateBezierCurve(path.id);
    		paths.set($paths);
    	};

    	const input_handler_6 = (path, i, each_value, path_index, e) => {
    		set_store_value(paths, each_value[path_index].controlPoints[i].y = parseFloat(e.target.value), $paths);
    		generateBezierCurve(path.id);
    		paths.set($paths);
    	};

    	const click_handler_4 = (path, i) => {
    		if (path.controlPoints.length > 2) {
    			path.controlPoints.splice(i, 1);
    			generateBezierCurve(path.id);
    			paths.set($paths);
    		}
    	};

    	const input_handler_7 = (path, each_value, path_index, e) => {
    		set_store_value(paths, each_value[path_index].controlPoints[path.controlPoints.length - 1].x = parseFloat(e.target.value), $paths);
    		generateBezierCurve(path.id);
    		paths.set($paths);
    	};

    	const input_handler_8 = (path, each_value, path_index, e) => {
    		set_store_value(paths, each_value[path_index].controlPoints[path.controlPoints.length - 1].y = parseFloat(e.target.value), $paths);
    		generateBezierCurve(path.id);
    		paths.set($paths);
    	};

    	function select_change_handler(each_value, path_index) {
    		each_value[path_index].robotHeading = select_value(this);
    		paths.set($paths);
    	}

    	const change_handler = path => generateBezierCurve(path.id);

    	function input0_input_handler(each_value, path_index) {
    		each_value[path_index].startAngleDegrees = to_number(this.value);
    		paths.set($paths);
    	}

    	const input_handler_9 = () => updateRobotPosition();

    	function input1_input_handler(each_value, path_index) {
    		each_value[path_index].endAngleDegrees = to_number(this.value);
    		paths.set($paths);
    	}

    	const input_handler_10 = () => updateRobotPosition();

    	function input_change_handler(each_value, path_index) {
    		each_value[path_index].reverse = this.checked;
    		paths.set($paths);
    	}

    	const input_handler_11 = () => updateRobotPosition();

    	function input_input_handler_3(each_value, path_index) {
    		each_value[path_index].constantAngleDegrees = to_number(this.value);
    		paths.set($paths);
    	}

    	const input_handler_12 = () => updateRobotPosition();

    	const click_handler_5 = () => {
    		addPath();
    		generateBezierCurve($paths.length - 1);
    	};

    	function input10_change_input_handler() {
    		linearScrubValue = to_number(this.value);
    		$$invalidate(1, linearScrubValue);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		paths,
    		robotLength,
    		robotWidth,
    		robotUnits,
    		rotationUnits,
    		shouldShowHitbox,
    		shouldHaveBoilerplate,
    		autoLinkPaths,
    		shouldRepeatPath,
    		displayDimensions,
    		PathClass: Path,
    		generateHitboxPath,
    		getPointAt,
    		scrubValue,
    		robotX,
    		robotY,
    		isPlaying,
    		wasPaused,
    		isStartingFromBeginning,
    		intervalId,
    		animInterval,
    		progress,
    		elapsedTime,
    		path,
    		pathAnimTime,
    		linearScrubValue,
    		motionBlurAmount,
    		currentPathIndex,
    		pathStartTime,
    		robotLiveAngle,
    		updateRobotLength,
    		updateRobotWidth,
    		generateBezierCurve,
    		calculateBezier,
    		deCasteljau,
    		exportControlPoints,
    		resetToDefault,
    		importControlPoints,
    		addPath,
    		addControlPointToPathWithIndex,
    		updatePathColor,
    		deletePath,
    		playPath,
    		updateRobotPosition,
    		pausePath,
    		checkAutoLinkControlPoints,
    		showCodeWindow,
    		offsetPaths,
    		animTime,
    		displayWidth,
    		displayLength,
    		$robotWidth,
    		$paths,
    		$shouldHaveBoilerplate,
    		$rotationUnits,
    		$autoLinkPaths,
    		$robotLength,
    		$shouldRepeatPath,
    		$shouldShowHitbox,
    		$robotUnits,
    		$displayDimensions
    	});

    	$$self.$inject_state = $$props => {
    		if ('scrubValue' in $$props) scrubValue = $$props.scrubValue;
    		if ('robotX' in $$props) $$invalidate(6, robotX = $$props.robotX);
    		if ('robotY' in $$props) $$invalidate(7, robotY = $$props.robotY);
    		if ('isPlaying' in $$props) $$invalidate(0, isPlaying = $$props.isPlaying);
    		if ('wasPaused' in $$props) $$invalidate(34, wasPaused = $$props.wasPaused);
    		if ('isStartingFromBeginning' in $$props) isStartingFromBeginning = $$props.isStartingFromBeginning;
    		if ('intervalId' in $$props) intervalId = $$props.intervalId;
    		if ('animInterval' in $$props) $$invalidate(82, animInterval = $$props.animInterval);
    		if ('progress' in $$props) progress = $$props.progress;
    		if ('elapsedTime' in $$props) elapsedTime = $$props.elapsedTime;
    		if ('path' in $$props) $$invalidate(5, path = $$props.path);
    		if ('pathAnimTime' in $$props) pathAnimTime = $$props.pathAnimTime;
    		if ('linearScrubValue' in $$props) $$invalidate(1, linearScrubValue = $$props.linearScrubValue);
    		if ('motionBlurAmount' in $$props) $$invalidate(83, motionBlurAmount = $$props.motionBlurAmount);
    		if ('currentPathIndex' in $$props) $$invalidate(8, currentPathIndex = $$props.currentPathIndex);
    		if ('pathStartTime' in $$props) pathStartTime = $$props.pathStartTime;
    		if ('robotLiveAngle' in $$props) $$invalidate(9, robotLiveAngle = $$props.robotLiveAngle);
    		if ('offsetPaths' in $$props) $$invalidate(10, offsetPaths = $$props.offsetPaths);
    		if ('animTime' in $$props) animTime = $$props.animTime;
    		if ('displayWidth' in $$props) $$invalidate(11, displayWidth = $$props.displayWidth);
    		if ('displayLength' in $$props) $$invalidate(12, displayLength = $$props.displayLength);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*$paths*/ 8) {
    			animTime = 1.56 * $paths.length;
    		}

    		if ($$self.$$.dirty[1] & /*$displayDimensions*/ 16) {
    			$$invalidate(12, { displayLength, displayWidth } = $displayDimensions, displayLength, ($$invalidate(11, displayWidth), $$invalidate(35, $displayDimensions)));
    		}

    		if ($$self.$$.dirty[0] & /*$rotationUnits, $paths*/ 24) {
    			{
    				// convert angles based on selected units
    				const angleConversionFactor = $rotationUnits === 'degrees' ? Math.PI / 180 : 1;

    				$paths.forEach(path => {
    					if (path.robotHeading === 'linear') {
    						path.startAngle = (path.startAngleDegrees || 0) * angleConversionFactor;
    						path.endAngle = (path.endAngleDegrees || 0) * angleConversionFactor;
    					} else if (path.robotHeading === 'constant') {
    						path.constantAngle = (path.constantAngleDegrees || 0) * angleConversionFactor;
    					}
    				});
    			}
    		}

    		if ($$self.$$.dirty[0] & /*isPlaying, $paths, linearScrubValue*/ 11 | $$self.$$.dirty[1] & /*wasPaused*/ 8) {
    			{
    				if (!isPlaying && wasPaused) {
    					const totalPaths = $paths.length;
    					const pathIndex = Math.floor(linearScrubValue / 100 * totalPaths);
    					const pathProgress = linearScrubValue / 100 * totalPaths - pathIndex;

    					const adjustedProgress = pathProgress < 0.5
    					? 2 * pathProgress * pathProgress
    					: -1 + (4 - 2 * pathProgress) * pathProgress;

    					scrubValue = (pathIndex + adjustedProgress) / totalPaths * 100;
    					$$invalidate(8, currentPathIndex = pathIndex);
    					progress = adjustedProgress;
    					updateRobotPosition();
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*isPlaying*/ 1) {
    			{
    				const robotElement = document.getElementById('robot');

    				if (robotElement) {
    					robotElement.style.transition = isPlaying
    					? `transform ${animInterval}ms linear`
    					: 'none';

    					robotElement.style.filter = isPlaying ? `blur(${motionBlurAmount * 10}px)` : 'none';
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*$paths, $robotWidth*/ 12) {
    			{
    				// initialize offsetPaths with empty arrays for left, right, and main paths
    				$$invalidate(10, offsetPaths = $paths.map(path => ({
    					left: [],
    					right: [],
    					main: [],
    					color: path.color,
    					controlPoints: path.controlPoints
    				})));

    				// iterate through each path to generate hitbox paths and main paths
    				$paths.forEach((path, pathIndex) => {
    					if (path.controlPoints.length >= 2) {
    						let mainPath = [];
    						const { leftPath, rightPath } = generateHitboxPath(path.controlPoints, $robotWidth);

    						// generate main path points using getPointAt function
    						for (let t = 0; t <= 1; t += 0.01) {
    							const mainPoint = getPointAt(t, path.controlPoints);
    							mainPath.push(mainPoint);
    						}

    						// update offsetPaths with generated paths
    						$$invalidate(10, offsetPaths[pathIndex].main = mainPath, offsetPaths);

    						$$invalidate(10, offsetPaths[pathIndex].left = leftPath, offsetPaths);
    						$$invalidate(10, offsetPaths[pathIndex].right = rightPath, offsetPaths);
    					}
    				});
    			}
    		}
    	};

    	{
    		checkAutoLinkControlPoints();
    		updateRobotPosition();
    		generateBezierCurve(1);
    	}

    	return [
    		isPlaying,
    		linearScrubValue,
    		$robotWidth,
    		$paths,
    		$rotationUnits,
    		path,
    		robotX,
    		robotY,
    		currentPathIndex,
    		robotLiveAngle,
    		offsetPaths,
    		displayWidth,
    		displayLength,
    		$shouldHaveBoilerplate,
    		$autoLinkPaths,
    		$robotLength,
    		$shouldRepeatPath,
    		$shouldShowHitbox,
    		$robotUnits,
    		updateRobotLength,
    		updateRobotWidth,
    		generateBezierCurve,
    		exportControlPoints,
    		resetToDefault,
    		importControlPoints,
    		addPath,
    		addControlPointToPathWithIndex,
    		updatePathColor,
    		deletePath,
    		playPath,
    		updateRobotPosition,
    		pausePath,
    		checkAutoLinkControlPoints,
    		showCodeWindow,
    		wasPaused,
    		$displayDimensions,
    		select0_change_handler,
    		input_handler,
    		input_handler_1,
    		input_input_handler,
    		input_handler_2,
    		input_input_handler_1,
    		input_handler_3,
    		input2_input_handler,
    		input3_input_handler,
    		input6_change_handler,
    		input7_change_handler,
    		input8_change_handler,
    		input9_change_handler,
    		select1_change_handler,
    		click_handler,
    		click_handler_1,
    		input_input_handler_2,
    		input_handler_4,
    		click_handler_2,
    		click_handler_3,
    		keydown_handler,
    		input_handler_5,
    		input_handler_6,
    		click_handler_4,
    		input_handler_7,
    		input_handler_8,
    		select_change_handler,
    		change_handler,
    		input0_input_handler,
    		input_handler_9,
    		input1_input_handler,
    		input_handler_10,
    		input_change_handler,
    		input_handler_11,
    		input_input_handler_3,
    		input_handler_12,
    		click_handler_5,
    		input10_change_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, null, [-1, -1, -1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
