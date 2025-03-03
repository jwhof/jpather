
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
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

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
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

    /* src/App.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	child_ctx[90] = list;
    	child_ctx[91] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[18] = list[i].x;
    	child_ctx[19] = list[i].y;
    	child_ctx[93] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	return child_ctx;
    }

    function get_each_context_4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[98] = list[i];
    	child_ctx[93] = i;
    	return child_ctx;
    }

    function get_each_context_5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	return child_ctx;
    }

    function get_each_context_6(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[18] = list[i].x;
    	child_ctx[19] = list[i].y;
    	return child_ctx;
    }

    // (1125:8) {#if $paths.length > 0}
    function create_if_block_15(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "class", "start-pos-box svelte-27ngvs");
    			attr_dev(input, "type", "number");
    			attr_dev(input, "step", "1");
    			add_location(input, file, 1125, 8, 28809);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*$paths*/ ctx[7][0].controlPoints[0].x);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[41]),
    					listen_dev(input, "input", /*input_handler_2*/ ctx[42], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 128 && to_number(input.value) !== /*$paths*/ ctx[7][0].controlPoints[0].x) {
    				set_input_value(input, /*$paths*/ ctx[7][0].controlPoints[0].x);
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
    		id: create_if_block_15.name,
    		type: "if",
    		source: "(1125:8) {#if $paths.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (1132:8) {#if $paths.length > 0}
    function create_if_block_14(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "class", "start-pos-box svelte-27ngvs");
    			attr_dev(input, "type", "number");
    			attr_dev(input, "step", "1");
    			add_location(input, file, 1132, 8, 29296);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*$paths*/ ctx[7][0].controlPoints[0].y);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler_1*/ ctx[43]),
    					listen_dev(input, "input", /*input_handler_3*/ ctx[44], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 128 && to_number(input.value) !== /*$paths*/ ctx[7][0].controlPoints[0].y) {
    				set_input_value(input, /*$paths*/ ctx[7][0].controlPoints[0].y);
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
    		source: "(1132:8) {#if $paths.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (1194:5) {#each path.controlPoints as { x, y }}
    function create_each_block_6(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "point svelte-27ngvs");
    			set_style(div0, "left", /*x*/ ctx[18] / 144 * 100 + "%");
    			set_style(div0, "bottom", /*y*/ ctx[19] / 144 * 100 + "%");
    			set_style(div0, "background", /*path*/ ctx[8].color);
    			add_location(div0, file, 1195, 6, 32370);
    			attr_dev(div1, "class", "hover-point svelte-27ngvs");
    			add_location(div1, file, 1194, 5, 32338);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 128) {
    				set_style(div0, "left", /*x*/ ctx[18] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*$paths*/ 128) {
    				set_style(div0, "bottom", /*y*/ ctx[19] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*$paths*/ 128) {
    				set_style(div0, "background", /*path*/ ctx[8].color);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_6.name,
    		type: "each",
    		source: "(1194:5) {#each path.controlPoints as { x, y }}",
    		ctx
    	});

    	return block;
    }

    // (1193:4) {#each $paths as path}
    function create_each_block_5(ctx) {
    	let each_1_anchor;
    	let each_value_6 = /*path*/ ctx[8].controlPoints;
    	validate_each_argument(each_value_6);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_6.length; i += 1) {
    		each_blocks[i] = create_each_block_6(get_each_context_6(ctx, each_value_6, i));
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
    			if (dirty[0] & /*$paths*/ 128) {
    				each_value_6 = /*path*/ ctx[8].controlPoints;
    				validate_each_argument(each_value_6);
    				let i;

    				for (i = 0; i < each_value_6.length; i += 1) {
    					const child_ctx = get_each_context_6(ctx, each_value_6, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_6(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_6.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_5.name,
    		type: "each",
    		source: "(1193:4) {#each $paths as path}",
    		ctx
    	});

    	return block;
    }

    // (1202:4) {#if $paths.length > 0}
    function create_if_block_13(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "./assets/robot.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Robot");
    			attr_dev(img, "id", "robot");
    			set_style(img, "width", /*robotWidth*/ ctx[1] / 144 * 100 + "%");
    			set_style(img, "height", /*robotLength*/ ctx[0] / 144 * 100 + "%");
    			set_style(img, "left", /*robotX*/ ctx[9] / 144 * 100 + "%");
    			set_style(img, "bottom", /*robotY*/ ctx[10] / 144 * 100 + "%");
    			set_style(img, "user-select", "none");
    			attr_dev(img, "class", "svelte-27ngvs");
    			add_location(img, file, 1202, 5, 32556);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*robotWidth*/ 2) {
    				set_style(img, "width", /*robotWidth*/ ctx[1] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*robotLength*/ 1) {
    				set_style(img, "height", /*robotLength*/ ctx[0] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*robotX*/ 512) {
    				set_style(img, "left", /*robotX*/ ctx[9] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*robotY*/ 1024) {
    				set_style(img, "bottom", /*robotY*/ ctx[10] / 144 * 100 + "%");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_13.name,
    		type: "if",
    		source: "(1202:4) {#if $paths.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (1206:4) {#if shouldShowHitbox}
    function create_if_block_9(ctx) {
    	let svg;
    	let each_value_3 = /*offsetPaths*/ ctx[6];
    	validate_each_argument(each_value_3);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(svg, "viewBox", "0 0 144 144");
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			set_style(svg, "position", "absolute");
    			set_style(svg, "top", "0");
    			set_style(svg, "left", "0");
    			attr_dev(svg, "class", "svelte-27ngvs");
    			add_location(svg, file, 1206, 5, 32816);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(svg, null);
    				}
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*offsetPaths*/ 64) {
    				each_value_3 = /*offsetPaths*/ ctx[6];
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(svg, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_3.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9.name,
    		type: "if",
    		source: "(1206:4) {#if shouldShowHitbox}",
    		ctx
    	});

    	return block;
    }

    // (1210:8) {#if i < path.main.length - 1}
    function create_if_block_10(ctx) {
    	let line;
    	let line_x__value;
    	let line_y__value;
    	let line_x__value_1;
    	let line_y__value_1;
    	let if_block0_anchor;
    	let if_block1_anchor;
    	let if_block0 = /*path*/ ctx[8].left[/*i*/ ctx[93]] && /*path*/ ctx[8].left[/*i*/ ctx[93] + 1] && create_if_block_12(ctx);
    	let if_block1 = /*path*/ ctx[8].right[/*i*/ ctx[93]] && /*path*/ ctx[8].right[/*i*/ ctx[93] + 1] && create_if_block_11(ctx);

    	const block = {
    		c: function create() {
    			line = svg_element("line");
    			if (if_block0) if_block0.c();
    			if_block0_anchor = empty();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			attr_dev(line, "x1", line_x__value = /*point*/ ctx[98].x);
    			attr_dev(line, "y1", line_y__value = 144 - /*point*/ ctx[98].y);
    			attr_dev(line, "x2", line_x__value_1 = /*path*/ ctx[8].main[/*i*/ ctx[93] + 1].x);
    			attr_dev(line, "y2", line_y__value_1 = 144 - /*path*/ ctx[8].main[/*i*/ ctx[93] + 1].y);
    			attr_dev(line, "stroke", "white");
    			attr_dev(line, "opacity", "0.3");
    			attr_dev(line, "stroke-width", "1");
    			attr_dev(line, "class", "svelte-27ngvs");
    			add_location(line, file, 1211, 9, 33069);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, line, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, if_block0_anchor, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*offsetPaths*/ 64 && line_x__value !== (line_x__value = /*point*/ ctx[98].x)) {
    				attr_dev(line, "x1", line_x__value);
    			}

    			if (dirty[0] & /*offsetPaths*/ 64 && line_y__value !== (line_y__value = 144 - /*point*/ ctx[98].y)) {
    				attr_dev(line, "y1", line_y__value);
    			}

    			if (dirty[0] & /*offsetPaths*/ 64 && line_x__value_1 !== (line_x__value_1 = /*path*/ ctx[8].main[/*i*/ ctx[93] + 1].x)) {
    				attr_dev(line, "x2", line_x__value_1);
    			}

    			if (dirty[0] & /*offsetPaths*/ 64 && line_y__value_1 !== (line_y__value_1 = 144 - /*path*/ ctx[8].main[/*i*/ ctx[93] + 1].y)) {
    				attr_dev(line, "y2", line_y__value_1);
    			}

    			if (/*path*/ ctx[8].left[/*i*/ ctx[93]] && /*path*/ ctx[8].left[/*i*/ ctx[93] + 1]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_12(ctx);
    					if_block0.c();
    					if_block0.m(if_block0_anchor.parentNode, if_block0_anchor);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*path*/ ctx[8].right[/*i*/ ctx[93]] && /*path*/ ctx[8].right[/*i*/ ctx[93] + 1]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_11(ctx);
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(line);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(if_block0_anchor);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_10.name,
    		type: "if",
    		source: "(1210:8) {#if i < path.main.length - 1}",
    		ctx
    	});

    	return block;
    }

    // (1222:9) {#if path.left[i] && path.left[i + 1]}
    function create_if_block_12(ctx) {
    	let line;
    	let line_x__value;
    	let line_y__value;
    	let line_x__value_1;
    	let line_y__value_1;

    	const block = {
    		c: function create() {
    			line = svg_element("line");
    			attr_dev(line, "x1", line_x__value = /*path*/ ctx[8].left[/*i*/ ctx[93]].x);
    			attr_dev(line, "y1", line_y__value = 144 - /*path*/ ctx[8].left[/*i*/ ctx[93]].y);
    			attr_dev(line, "x2", line_x__value_1 = /*path*/ ctx[8].left[/*i*/ ctx[93] + 1].x);
    			attr_dev(line, "y2", line_y__value_1 = 144 - /*path*/ ctx[8].left[/*i*/ ctx[93] + 1].y);
    			attr_dev(line, "stroke", "white");
    			attr_dev(line, "opacity", "0.3");
    			attr_dev(line, "stroke-width", "1");
    			attr_dev(line, "class", "svelte-27ngvs");
    			add_location(line, file, 1222, 10, 33403);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, line, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*offsetPaths*/ 64 && line_x__value !== (line_x__value = /*path*/ ctx[8].left[/*i*/ ctx[93]].x)) {
    				attr_dev(line, "x1", line_x__value);
    			}

    			if (dirty[0] & /*offsetPaths*/ 64 && line_y__value !== (line_y__value = 144 - /*path*/ ctx[8].left[/*i*/ ctx[93]].y)) {
    				attr_dev(line, "y1", line_y__value);
    			}

    			if (dirty[0] & /*offsetPaths*/ 64 && line_x__value_1 !== (line_x__value_1 = /*path*/ ctx[8].left[/*i*/ ctx[93] + 1].x)) {
    				attr_dev(line, "x2", line_x__value_1);
    			}

    			if (dirty[0] & /*offsetPaths*/ 64 && line_y__value_1 !== (line_y__value_1 = 144 - /*path*/ ctx[8].left[/*i*/ ctx[93] + 1].y)) {
    				attr_dev(line, "y2", line_y__value_1);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(line);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_12.name,
    		type: "if",
    		source: "(1222:9) {#if path.left[i] && path.left[i + 1]}",
    		ctx
    	});

    	return block;
    }

    // (1233:9) {#if path.right[i] && path.right[i + 1]}
    function create_if_block_11(ctx) {
    	let line;
    	let line_x__value;
    	let line_y__value;
    	let line_x__value_1;
    	let line_y__value_1;

    	const block = {
    		c: function create() {
    			line = svg_element("line");
    			attr_dev(line, "x1", line_x__value = /*path*/ ctx[8].right[/*i*/ ctx[93]].x);
    			attr_dev(line, "y1", line_y__value = 144 - /*path*/ ctx[8].right[/*i*/ ctx[93]].y);
    			attr_dev(line, "x2", line_x__value_1 = /*path*/ ctx[8].right[/*i*/ ctx[93] + 1].x);
    			attr_dev(line, "y2", line_y__value_1 = 144 - /*path*/ ctx[8].right[/*i*/ ctx[93] + 1].y);
    			attr_dev(line, "stroke", "white");
    			attr_dev(line, "opacity", "0.3");
    			attr_dev(line, "stroke-width", "1");
    			attr_dev(line, "class", "svelte-27ngvs");
    			add_location(line, file, 1233, 10, 33728);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, line, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*offsetPaths*/ 64 && line_x__value !== (line_x__value = /*path*/ ctx[8].right[/*i*/ ctx[93]].x)) {
    				attr_dev(line, "x1", line_x__value);
    			}

    			if (dirty[0] & /*offsetPaths*/ 64 && line_y__value !== (line_y__value = 144 - /*path*/ ctx[8].right[/*i*/ ctx[93]].y)) {
    				attr_dev(line, "y1", line_y__value);
    			}

    			if (dirty[0] & /*offsetPaths*/ 64 && line_x__value_1 !== (line_x__value_1 = /*path*/ ctx[8].right[/*i*/ ctx[93] + 1].x)) {
    				attr_dev(line, "x2", line_x__value_1);
    			}

    			if (dirty[0] & /*offsetPaths*/ 64 && line_y__value_1 !== (line_y__value_1 = 144 - /*path*/ ctx[8].right[/*i*/ ctx[93] + 1].y)) {
    				attr_dev(line, "y2", line_y__value_1);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(line);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_11.name,
    		type: "if",
    		source: "(1233:9) {#if path.right[i] && path.right[i + 1]}",
    		ctx
    	});

    	return block;
    }

    // (1209:7) {#each path.main as point, i}
    function create_each_block_4(ctx) {
    	let if_block_anchor;
    	let if_block = /*i*/ ctx[93] < /*path*/ ctx[8].main.length - 1 && create_if_block_10(ctx);

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
    			if (/*i*/ ctx[93] < /*path*/ ctx[8].main.length - 1) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_10(ctx);
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
    		id: create_each_block_4.name,
    		type: "each",
    		source: "(1209:7) {#each path.main as point, i}",
    		ctx
    	});

    	return block;
    }

    // (1208:6) {#each offsetPaths as path}
    function create_each_block_3(ctx) {
    	let each_1_anchor;
    	let each_value_4 = /*path*/ ctx[8].main;
    	validate_each_argument(each_value_4);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_4.length; i += 1) {
    		each_blocks[i] = create_each_block_4(get_each_context_4(ctx, each_value_4, i));
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
    			if (dirty[0] & /*offsetPaths*/ 64) {
    				each_value_4 = /*path*/ ctx[8].main;
    				validate_each_argument(each_value_4);
    				let i;

    				for (i = 0; i < each_value_4.length; i += 1) {
    					const child_ctx = get_each_context_4(ctx, each_value_4, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_4(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_4.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(1208:6) {#each offsetPaths as path}",
    		ctx
    	});

    	return block;
    }

    // (1252:5) {#each $paths as path}
    function create_each_block_2(ctx) {
    	let polyline;
    	let polyline_points_value;

    	const block = {
    		c: function create() {
    			polyline = svg_element("polyline");
    			attr_dev(polyline, "class", "curve svelte-27ngvs");
    			attr_dev(polyline, "points", polyline_points_value = /*path*/ ctx[8].bezierCurvePoints.map(func).join(' '));
    			set_style(polyline, "stroke", /*path*/ ctx[8].color);
    			add_location(polyline, file, 1252, 6, 34177);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, polyline, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 128 && polyline_points_value !== (polyline_points_value = /*path*/ ctx[8].bezierCurvePoints.map(func).join(' '))) {
    				attr_dev(polyline, "points", polyline_points_value);
    			}

    			if (dirty[0] & /*$paths*/ 128) {
    				set_style(polyline, "stroke", /*path*/ ctx[8].color);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(polyline);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(1252:5) {#each $paths as path}",
    		ctx
    	});

    	return block;
    }

    // (1295:62) 
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
    			t1 = text(/*i*/ ctx[93]);
    			t2 = text(":");
    			attr_dev(label, "for", label_for_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93]);
    			set_style(label, "user-select", "none");
    			attr_dev(label, "class", "svelte-27ngvs");
    			add_location(label, file, 1295, 11, 38152);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, t0);
    			append_dev(label, t1);
    			append_dev(label, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 128 && label_for_value !== (label_for_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93])) {
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
    		source: "(1295:62) ",
    		ctx
    	});

    	return block;
    }

    // (1293:10) {#if (i == 0)}
    function create_if_block_7(ctx) {
    	let label;
    	let t;
    	let label_for_value;

    	const block = {
    		c: function create() {
    			label = element("label");
    			t = text("Endpoint:");
    			attr_dev(label, "for", label_for_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93]);
    			set_style(label, "user-select", "none");
    			attr_dev(label, "class", "svelte-27ngvs");
    			add_location(label, file, 1293, 11, 37993);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 128 && label_for_value !== (label_for_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93])) {
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
    		source: "(1293:10) {#if (i == 0)}",
    		ctx
    	});

    	return block;
    }

    // (1319:27) 
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
    		return /*input_handler_7*/ ctx[61](/*path*/ ctx[8], /*each_value*/ ctx[90], /*path_index*/ ctx[91], ...args);
    	}

    	function input_handler_8(...args) {
    		return /*input_handler_8*/ ctx[62](/*path*/ ctx[8], /*each_value*/ ctx[90], /*path_index*/ ctx[91], ...args);
    	}

    	function select_change_handler() {
    		/*select_change_handler*/ ctx[63].call(select, /*each_value*/ ctx[90], /*path_index*/ ctx[91]);
    	}

    	function change_handler() {
    		return /*change_handler*/ ctx[64](/*path*/ ctx[8]);
    	}

    	function select_block_type_2(ctx, dirty) {
    		if (/*path*/ ctx[8].robotHeading === 'linear') return create_if_block_4;
    		if (/*path*/ ctx[8].robotHeading === 'tangential') return create_if_block_5;
    		if (/*path*/ ctx[8].robotHeading === 'constant') return create_if_block_6;
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
    			attr_dev(label0, "class", "cp-x svelte-27ngvs");
    			attr_dev(label0, "for", label0_for_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93]);
    			set_style(label0, "user-select", "none");
    			add_location(label0, file, 1321, 12, 40053);
    			attr_dev(input0, "id", input0_id_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93]);
    			attr_dev(input0, "class", "standard-input-box svelte-27ngvs");
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "step", "1");
    			input0.value = input0_value_value = /*path*/ ctx[8].controlPoints[/*path*/ ctx[8].controlPoints.length - 1].x;
    			add_location(input0, file, 1322, 12, 40156);
    			attr_dev(div0, "class", "control-point-mini-box-x svelte-27ngvs");
    			add_location(div0, file, 1320, 11, 40002);
    			attr_dev(label1, "class", "cp-y svelte-27ngvs");
    			attr_dev(label1, "for", label1_for_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93] + "-y");
    			set_style(label1, "user-select", "none");
    			add_location(label1, file, 1325, 12, 40538);
    			attr_dev(input1, "id", input1_id_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93] + "-y");
    			attr_dev(input1, "class", "standard-input-box svelte-27ngvs");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "step", "1");
    			input1.value = input1_value_value = /*path*/ ctx[8].controlPoints[/*path*/ ctx[8].controlPoints.length - 1].y;
    			add_location(input1, file, 1326, 12, 40643);
    			attr_dev(div1, "class", "control-point-mini-box-y svelte-27ngvs");
    			add_location(div1, file, 1324, 11, 40487);
    			option0.__value = "constant";
    			option0.value = option0.__value;
    			attr_dev(option0, "class", "svelte-27ngvs");
    			add_location(option0, file, 1330, 12, 41189);
    			option1.__value = "tangential";
    			option1.value = option1.__value;
    			attr_dev(option1, "class", "svelte-27ngvs");
    			add_location(option1, file, 1331, 12, 41244);
    			option2.__value = "linear";
    			option2.value = option2.__value;
    			attr_dev(option2, "class", "svelte-27ngvs");
    			add_location(option2, file, 1332, 12, 41303);
    			attr_dev(select, "id", "robot-heading");
    			attr_dev(select, "class", "standard-input-box svelte-27ngvs");
    			if (/*path*/ ctx[8].robotHeading === void 0) add_render_callback(select_change_handler);
    			add_location(select, file, 1329, 11, 41044);
    			attr_dev(div2, "class", "control-point-mini-box svelte-27ngvs");
    			add_location(div2, file, 1319, 10, 39954);
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
    			select_option(select, /*path*/ ctx[8].robotHeading, true);
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

    			if (dirty[0] & /*$paths*/ 128 && label0_for_value !== (label0_for_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93])) {
    				attr_dev(label0, "for", label0_for_value);
    			}

    			if (dirty[0] & /*$paths*/ 128 && input0_id_value !== (input0_id_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93])) {
    				attr_dev(input0, "id", input0_id_value);
    			}

    			if (dirty[0] & /*$paths*/ 128 && input0_value_value !== (input0_value_value = /*path*/ ctx[8].controlPoints[/*path*/ ctx[8].controlPoints.length - 1].x) && input0.value !== input0_value_value) {
    				prop_dev(input0, "value", input0_value_value);
    			}

    			if (dirty[0] & /*$paths*/ 128 && label1_for_value !== (label1_for_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93] + "-y")) {
    				attr_dev(label1, "for", label1_for_value);
    			}

    			if (dirty[0] & /*$paths*/ 128 && input1_id_value !== (input1_id_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93] + "-y")) {
    				attr_dev(input1, "id", input1_id_value);
    			}

    			if (dirty[0] & /*$paths*/ 128 && input1_value_value !== (input1_value_value = /*path*/ ctx[8].controlPoints[/*path*/ ctx[8].controlPoints.length - 1].y) && input1.value !== input1_value_value) {
    				prop_dev(input1, "value", input1_value_value);
    			}

    			if (dirty[0] & /*$paths*/ 128) {
    				select_option(select, /*path*/ ctx[8].robotHeading);
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
    		source: "(1319:27) ",
    		ctx
    	});

    	return block;
    }

    // (1298:10) {#if i > 0 && i!=path.controlPoints.length-1}
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
    		return /*input_handler_5*/ ctx[58](/*path*/ ctx[8], /*i*/ ctx[93], /*each_value*/ ctx[90], /*path_index*/ ctx[91], ...args);
    	}

    	function input_handler_6(...args) {
    		return /*input_handler_6*/ ctx[59](/*path*/ ctx[8], /*i*/ ctx[93], /*each_value*/ ctx[90], /*path_index*/ ctx[91], ...args);
    	}

    	let if_block = /*i*/ ctx[93] > 0 && create_if_block_2(ctx);

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
    			attr_dev(label0, "class", "cp-x svelte-27ngvs");
    			attr_dev(label0, "for", label0_for_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93]);
    			set_style(label0, "user-select", "none");
    			add_location(label0, file, 1300, 13, 38430);
    			attr_dev(input0, "id", "cp-input");
    			attr_dev(input0, "class", "standard-input-box svelte-27ngvs");
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "step", "1");
    			input0.value = input0_value_value = /*path*/ ctx[8].controlPoints[/*i*/ ctx[93]].x;
    			add_location(input0, file, 1301, 13, 38534);
    			attr_dev(div0, "class", "control-point-mini-box-x svelte-27ngvs");
    			add_location(div0, file, 1299, 12, 38378);
    			attr_dev(label1, "class", "cp-y svelte-27ngvs");
    			attr_dev(label1, "for", label1_for_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93] + "-y");
    			set_style(label1, "user-select", "none");
    			add_location(label1, file, 1304, 13, 38848);
    			attr_dev(input1, "id", "cp-input");
    			attr_dev(input1, "class", "standard-input-box svelte-27ngvs");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "step", "1");
    			input1.value = input1_value_value = /*path*/ ctx[8].controlPoints[/*i*/ ctx[93]].y;
    			add_location(input1, file, 1305, 13, 38954);
    			attr_dev(div1, "class", "control-point-mini-box-y svelte-27ngvs");
    			add_location(div1, file, 1303, 12, 38796);
    			attr_dev(div2, "class", "control-point-mini-box svelte-27ngvs");
    			add_location(div2, file, 1298, 11, 38329);
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

    			if (dirty[0] & /*$paths*/ 128 && label0_for_value !== (label0_for_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93])) {
    				attr_dev(label0, "for", label0_for_value);
    			}

    			if (dirty[0] & /*$paths*/ 128 && input0_value_value !== (input0_value_value = /*path*/ ctx[8].controlPoints[/*i*/ ctx[93]].x) && input0.value !== input0_value_value) {
    				prop_dev(input0, "value", input0_value_value);
    			}

    			if (dirty[0] & /*$paths*/ 128 && label1_for_value !== (label1_for_value = "control-point-" + /*path*/ ctx[8].id + "-" + /*i*/ ctx[93] + "-y")) {
    				attr_dev(label1, "for", label1_for_value);
    			}

    			if (dirty[0] & /*$paths*/ 128 && input1_value_value !== (input1_value_value = /*path*/ ctx[8].controlPoints[/*i*/ ctx[93]].y) && input1.value !== input1_value_value) {
    				prop_dev(input1, "value", input1_value_value);
    			}

    			if (/*i*/ ctx[93] > 0) if_block.p(ctx, dirty);
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
    		source: "(1298:10) {#if i > 0 && i!=path.controlPoints.length-1}",
    		ctx
    	});

    	return block;
    }

    // (1348:54) 
    function create_if_block_6(ctx) {
    	let div;
    	let input;
    	let mounted;
    	let dispose;

    	function input_input_handler_3() {
    		/*input_input_handler_3*/ ctx[71].call(input, /*each_value*/ ctx[90], /*path_index*/ ctx[91]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			attr_dev(input, "id", "constant-angle");
    			attr_dev(input, "class", "standard-input-box svelte-27ngvs");
    			attr_dev(input, "type", "number");
    			attr_dev(input, "step", "0.01");
    			add_location(input, file, 1349, 13, 42317);
    			attr_dev(div, "class", "control-point-mini-box svelte-27ngvs");
    			add_location(div, file, 1348, 12, 42267);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			set_input_value(input, /*path*/ ctx[8].constantAngleDegrees);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", input_input_handler_3),
    					listen_dev(input, "input", /*input_handler_12*/ ctx[72], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*$paths*/ 128 && to_number(input.value) !== /*path*/ ctx[8].constantAngleDegrees) {
    				set_input_value(input, /*path*/ ctx[8].constantAngleDegrees);
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
    		source: "(1348:54) ",
    		ctx
    	});

    	return block;
    }

    // (1343:56) 
    function create_if_block_5(ctx) {
    	let div;
    	let label;
    	let t1;
    	let input;
    	let mounted;
    	let dispose;

    	function input_change_handler() {
    		/*input_change_handler*/ ctx[69].call(input, /*each_value*/ ctx[90], /*path_index*/ ctx[91]);
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
    			attr_dev(label, "class", "svelte-27ngvs");
    			add_location(label, file, 1344, 13, 41999);
    			attr_dev(input, "id", "reverse");
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "class", "svelte-27ngvs");
    			add_location(input, file, 1345, 13, 42076);
    			attr_dev(div, "class", "control-point-mini-box svelte-27ngvs");
    			add_location(div, file, 1343, 12, 41949);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, label);
    			append_dev(div, t1);
    			append_dev(div, input);
    			input.checked = /*path*/ ctx[8].reverse;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", input_change_handler),
    					listen_dev(input, "input", /*input_handler_11*/ ctx[70], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*$paths*/ 128) {
    				input.checked = /*path*/ ctx[8].reverse;
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
    		source: "(1343:56) ",
    		ctx
    	});

    	return block;
    }

    // (1336:11) {#if path.robotHeading === 'linear'}
    function create_if_block_4(ctx) {
    	let div0;
    	let input0;
    	let t;
    	let div1;
    	let input1;
    	let mounted;
    	let dispose;

    	function input0_input_handler_1() {
    		/*input0_input_handler_1*/ ctx[65].call(input0, /*each_value*/ ctx[90], /*path_index*/ ctx[91]);
    	}

    	function input1_input_handler_1() {
    		/*input1_input_handler_1*/ ctx[67].call(input1, /*each_value*/ ctx[90], /*path_index*/ ctx[91]);
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			input0 = element("input");
    			t = space();
    			div1 = element("div");
    			input1 = element("input");
    			attr_dev(input0, "id", "start-angle");
    			attr_dev(input0, "class", "standard-input-box svelte-27ngvs");
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "step", "0.01");
    			add_location(input0, file, 1337, 13, 41475);
    			attr_dev(div0, "class", "control-point-mini-box svelte-27ngvs");
    			add_location(div0, file, 1336, 12, 41425);
    			attr_dev(input1, "id", "end-angle");
    			attr_dev(input1, "class", "standard-input-box svelte-27ngvs");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "step", "0.01");
    			add_location(input1, file, 1340, 13, 41711);
    			attr_dev(div1, "class", "control-point-mini-box svelte-27ngvs");
    			add_location(div1, file, 1339, 12, 41661);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, input0);
    			set_input_value(input0, /*path*/ ctx[8].startAngleDegrees);
    			insert_dev(target, t, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, input1);
    			set_input_value(input1, /*path*/ ctx[8].endAngleDegrees);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", input0_input_handler_1),
    					listen_dev(input0, "input", /*input_handler_9*/ ctx[66], false, false, false, false),
    					listen_dev(input1, "input", input1_input_handler_1),
    					listen_dev(input1, "input", /*input_handler_10*/ ctx[68], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*$paths*/ 128 && to_number(input0.value) !== /*path*/ ctx[8].startAngleDegrees) {
    				set_input_value(input0, /*path*/ ctx[8].startAngleDegrees);
    			}

    			if (dirty[0] & /*$paths*/ 128 && to_number(input1.value) !== /*path*/ ctx[8].endAngleDegrees) {
    				set_input_value(input1, /*path*/ ctx[8].endAngleDegrees);
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
    		source: "(1336:11) {#if path.robotHeading === 'linear'}",
    		ctx
    	});

    	return block;
    }

    // (1309:11) {#if (i > 0)}
    function create_if_block_2(ctx) {
    	let svg;
    	let path_1;
    	let mounted;
    	let dispose;

    	function click_handler_4() {
    		return /*click_handler_4*/ ctx[60](/*path*/ ctx[8], /*i*/ ctx[93]);
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path_1 = svg_element("path");
    			attr_dev(path_1, "d", "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z");
    			attr_dev(path_1, "class", "svelte-27ngvs");
    			add_location(path_1, file, 1313, 285, 39655);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24px");
    			attr_dev(svg, "viewBox", "0 -960 960 960");
    			attr_dev(svg, "width", "24px");
    			attr_dev(svg, "fill", "#FF474D");
    			set_style(svg, "cursor", "pointer");
    			attr_dev(svg, "class", "svelte-27ngvs");
    			add_location(svg, file, 1313, 11, 39381);
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
    		source: "(1309:11) {#if (i > 0)}",
    		ctx
    	});

    	return block;
    }

    // (1291:8) {#each path.controlPoints as { x, y }
    function create_each_block_1(ctx) {
    	let div;
    	let t;

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[93] == 0) return create_if_block_7;
    		if (/*i*/ ctx[93] > 0 && /*i*/ ctx[93] != /*path*/ ctx[8].controlPoints.length - 1) return create_if_block_8;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*i*/ ctx[93] > 0 && /*i*/ ctx[93] != /*path*/ ctx[8].controlPoints.length - 1) return create_if_block_1;
    		if (/*i*/ ctx[93] == 0) return create_if_block_3;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1 && current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			attr_dev(div, "class", "control-point-box svelte-27ngvs");
    			add_location(div, file, 1291, 9, 37925);
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
    		source: "(1291:8) {#each path.controlPoints as { x, y }",
    		ctx
    	});

    	return block;
    }

    // (1267:4) {#each $paths as path}
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
    	let t4_value = /*path*/ ctx[8].id + 1 + "";
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
    		return /*click_handler*/ ctx[51](/*path*/ ctx[8]);
    	}

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[52](/*path*/ ctx[8]);
    	}

    	function input_input_handler_2() {
    		/*input_input_handler_2*/ ctx[53].call(input, /*each_value*/ ctx[90], /*path_index*/ ctx[91]);
    	}

    	function input_handler_4() {
    		return /*input_handler_4*/ ctx[54](/*path*/ ctx[8]);
    	}

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[55](/*path*/ ctx[8]);
    	}

    	function click_handler_3() {
    		return /*click_handler_3*/ ctx[56](/*path*/ ctx[8]);
    	}

    	function keydown_handler(...args) {
    		return /*keydown_handler*/ ctx[57](/*path*/ ctx[8], ...args);
    	}

    	let each_value_1 = /*path*/ ctx[8].controlPoints;
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
    			attr_dev(path0, "class", "svelte-27ngvs");
    			add_location(path0, file, 1273, 534, 35313);
    			attr_dev(svg0, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg0, "height", "24px");
    			attr_dev(svg0, "viewBox", "0 -960 960 960");
    			attr_dev(svg0, "width", "24px");

    			attr_dev(svg0, "fill", svg0_fill_value = !(/*path*/ ctx[8].id == 0 || /*path*/ ctx[8].id == /*$paths*/ ctx[7].length - 1)
    			? "black"
    			: "gray");

    			set_style(svg0, "cursor", !(/*path*/ ctx[8].id == 0 || /*path*/ ctx[8].id == /*$paths*/ ctx[7].length - 1)
    			? 'pointer'
    			: 'default');

    			attr_dev(svg0, "class", "svelte-27ngvs");
    			add_location(svg0, file, 1273, 8, 34787);
    			attr_dev(path1, "d", "M440-240v-368L296-464l-56-56 240-240 240 240-56 56-144-144v368h-80Z");
    			attr_dev(path1, "class", "svelte-27ngvs");
    			add_location(path1, file, 1276, 482, 36011);
    			attr_dev(svg1, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg1, "height", "24px");
    			attr_dev(svg1, "viewBox", "0 -960 960 960");
    			attr_dev(svg1, "width", "24px");

    			attr_dev(svg1, "fill", svg1_fill_value = !(/*path*/ ctx[8].id == 0 || /*path*/ ctx[8].id == 1)
    			? "black"
    			: "gray");

    			set_style(svg1, "cursor", !(/*path*/ ctx[8].id == 0 || /*path*/ ctx[8].id == 1)
    			? 'pointer'
    			: 'default');

    			attr_dev(svg1, "class", "svelte-27ngvs");
    			add_location(svg1, file, 1276, 8, 35537);
    			attr_dev(input, "type", "color");
    			attr_dev(input, "class", "color-circle svelte-27ngvs");
    			set_style(input, "background-color", /*path*/ ctx[8].color);
    			add_location(input, file, 1277, 8, 36105);
    			attr_dev(p, "class", "path-title svelte-27ngvs");
    			set_style(p, "user-select", "none");
    			add_location(p, file, 1278, 8, 36275);
    			attr_dev(div0, "class", "path-and-color svelte-27ngvs");
    			add_location(div0, file, 1269, 7, 34547);
    			attr_dev(path2, "d", "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z");
    			attr_dev(path2, "class", "svelte-27ngvs");
    			add_location(path2, file, 1284, 276, 36869);
    			attr_dev(svg2, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg2, "height", "24px");
    			attr_dev(svg2, "viewBox", "0 -960 960 960");
    			attr_dev(svg2, "width", "24px");
    			attr_dev(svg2, "fill", svg2_fill_value = /*$paths*/ ctx[7].length > 1 ? "#FF474D" : "gray");
    			set_style(svg2, "cursor", /*$paths*/ ctx[7].length > 1 ? 'pointer' : 'default');
    			attr_dev(svg2, "class", "svelte-27ngvs");
    			add_location(svg2, file, 1284, 8, 36601);
    			attr_dev(path3, "d", "M440-280h80v-160h160v-80H520v-160h-80v160H280v80h160v160Zm40 200q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z");
    			attr_dev(path3, "class", "svelte-27ngvs");
    			add_location(path3, file, 1285, 347, 37429);
    			attr_dev(svg3, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg3, "height", "24px");
    			attr_dev(svg3, "viewBox", "0 -960 960 960");
    			attr_dev(svg3, "width", "24px");
    			attr_dev(svg3, "fill", "#90EE90");
    			set_style(svg3, "cursor", "pointer");
    			attr_dev(svg3, "class", "svelte-27ngvs");
    			add_location(svg3, file, 1285, 8, 37090);
    			attr_dev(div1, "class", "add-and-remove svelte-27ngvs");
    			add_location(div1, file, 1282, 7, 36499);
    			attr_dev(div2, "class", "path-header svelte-27ngvs");
    			add_location(div2, file, 1268, 6, 34514);
    			attr_dev(div3, "class", "path-control-points svelte-27ngvs");
    			add_location(div3, file, 1289, 7, 37832);
    			attr_dev(div4, "class", "path svelte-27ngvs");
    			set_style(div4, "border-color", /*path*/ ctx[8].color);
    			add_location(div4, file, 1267, 5, 34453);
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
    			set_input_value(input, /*path*/ ctx[8].color);
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

    			if (dirty[0] & /*$paths*/ 128 && svg0_fill_value !== (svg0_fill_value = !(/*path*/ ctx[8].id == 0 || /*path*/ ctx[8].id == /*$paths*/ ctx[7].length - 1)
    			? "black"
    			: "gray")) {
    				attr_dev(svg0, "fill", svg0_fill_value);
    			}

    			if (dirty[0] & /*$paths*/ 128) {
    				set_style(svg0, "cursor", !(/*path*/ ctx[8].id == 0 || /*path*/ ctx[8].id == /*$paths*/ ctx[7].length - 1)
    				? 'pointer'
    				: 'default');
    			}

    			if (dirty[0] & /*$paths*/ 128 && svg1_fill_value !== (svg1_fill_value = !(/*path*/ ctx[8].id == 0 || /*path*/ ctx[8].id == 1)
    			? "black"
    			: "gray")) {
    				attr_dev(svg1, "fill", svg1_fill_value);
    			}

    			if (dirty[0] & /*$paths*/ 128) {
    				set_style(svg1, "cursor", !(/*path*/ ctx[8].id == 0 || /*path*/ ctx[8].id == 1)
    				? 'pointer'
    				: 'default');
    			}

    			if (dirty[0] & /*$paths*/ 128) {
    				set_style(input, "background-color", /*path*/ ctx[8].color);
    			}

    			if (dirty[0] & /*$paths*/ 128) {
    				set_input_value(input, /*path*/ ctx[8].color);
    			}

    			if (dirty[0] & /*$paths*/ 128 && t4_value !== (t4_value = /*path*/ ctx[8].id + 1 + "")) set_data_dev(t4, t4_value);

    			if (dirty[0] & /*$paths*/ 128 && svg2_fill_value !== (svg2_fill_value = /*$paths*/ ctx[7].length > 1 ? "#FF474D" : "gray")) {
    				attr_dev(svg2, "fill", svg2_fill_value);
    			}

    			if (dirty[0] & /*$paths*/ 128) {
    				set_style(svg2, "cursor", /*$paths*/ ctx[7].length > 1 ? 'pointer' : 'default');
    			}

    			if (dirty[0] & /*$paths, generateBezierCurve, paths*/ 9437312 | dirty[1] & /*updateRobotPosition*/ 1) {
    				each_value_1 = /*path*/ ctx[8].controlPoints;
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

    			if (dirty[0] & /*$paths*/ 128) {
    				set_style(div4, "border-color", /*path*/ ctx[8].color);
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
    		source: "(1267:4) {#each $paths as path}",
    		ctx
    	});

    	return block;
    }

    // (1374:5) {:else}
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
    			attr_dev(path_1, "class", "svelte-27ngvs");
    			add_location(path_1, file, 1374, 134, 43426);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24px");
    			attr_dev(svg, "viewBox", "0 -960 960 960");
    			attr_dev(svg, "width", "24px");
    			attr_dev(svg, "fill", "#FF474D");
    			attr_dev(svg, "class", "svelte-27ngvs");
    			add_location(svg, file, 1374, 6, 43298);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path_1);

    			if (!mounted) {
    				dispose = listen_dev(svg, "click", /*pausePath*/ ctx[32], false, false, false, false);
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
    		source: "(1374:5) {:else}",
    		ctx
    	});

    	return block;
    }

    // (1371:5) {#if !isPlaying}
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
    			attr_dev(path_1, "class", "svelte-27ngvs");
    			add_location(path_1, file, 1372, 134, 43195);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24px");
    			attr_dev(svg, "viewBox", "0 -960 960 960");
    			attr_dev(svg, "width", "24px");
    			attr_dev(svg, "fill", "#90EE90");
    			attr_dev(svg, "class", "svelte-27ngvs");
    			add_location(svg, file, 1372, 7, 43068);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path_1);

    			if (!mounted) {
    				dispose = listen_dev(svg, "click", /*playPath*/ ctx[30], false, false, false, false);
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
    		source: "(1371:5) {#if !isPlaying}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div29;
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
    	let div28;
    	let div24;
    	let div21;
    	let div20;
    	let div19;
    	let h20;
    	let t8;
    	let div2;
    	let label0;
    	let t10;
    	let select0;
    	let option0;
    	let option1;
    	let t13;
    	let div3;
    	let label1;
    	let t15;
    	let input0;
    	let t16;
    	let div4;
    	let label2;
    	let t18;
    	let input1;
    	let t19;
    	let h21;
    	let t21;
    	let div8;
    	let label3;
    	let t23;
    	let div7;
    	let div5;
    	let label4;
    	let t25;
    	let t26;
    	let div6;
    	let label5;
    	let t28;
    	let t29;
    	let label6;
    	let t31;
    	let div14;
    	let div12;
    	let div9;
    	let label7;
    	let t33;
    	let input2;
    	let t34;
    	let div10;
    	let label8;
    	let t36;
    	let input3;
    	let t37;
    	let div11;
    	let label9;
    	let t39;
    	let input4;
    	let input4_value_value;
    	let t40;
    	let div13;
    	let label10;
    	let t42;
    	let input5;
    	let input5_value_value;
    	let t43;
    	let h22;
    	let t45;
    	let div15;
    	let label11;
    	let t47;
    	let input6;
    	let t48;
    	let div16;
    	let label12;
    	let t50;
    	let input7;
    	let t51;
    	let div17;
    	let label13;
    	let t53;
    	let input8;
    	let t54;
    	let div18;
    	let label14;
    	let t56;
    	let select1;
    	let option2;
    	let option3;
    	let t59;
    	let div22;
    	let t60;
    	let t61;
    	let t62;
    	let svg1;
    	let t63;
    	let div23;
    	let t64;
    	let button2;
    	let t66;
    	let div27;
    	let div26;
    	let div25;
    	let t67;
    	let input9;
    	let mounted;
    	let dispose;
    	let if_block0 = /*$paths*/ ctx[7].length > 0 && create_if_block_15(ctx);
    	let if_block1 = /*$paths*/ ctx[7].length > 0 && create_if_block_14(ctx);
    	let each_value_5 = /*$paths*/ ctx[7];
    	validate_each_argument(each_value_5);
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_5.length; i += 1) {
    		each_blocks_2[i] = create_each_block_5(get_each_context_5(ctx, each_value_5, i));
    	}

    	let if_block2 = /*$paths*/ ctx[7].length > 0 && create_if_block_13(ctx);
    	let if_block3 = /*shouldShowHitbox*/ ctx[15] && create_if_block_9(ctx);
    	let each_value_2 = /*$paths*/ ctx[7];
    	validate_each_argument(each_value_2);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value = /*$paths*/ ctx[7];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	function select_block_type_3(ctx, dirty) {
    		if (!/*isPlaying*/ ctx[4]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_3(ctx);
    	let if_block4 = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div29 = element("div");
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "JPather";
    			t1 = space();
    			div0 = element("div");
    			svg0 = svg_element("svg");
    			path_1 = svg_element("path");
    			t2 = space();
    			button0 = element("button");
    			button0.textContent = "Import Control Points";
    			t4 = space();
    			button1 = element("button");
    			button1.textContent = "Export Control Points";
    			t6 = space();
    			div28 = element("div");
    			div24 = element("div");
    			div21 = element("div");
    			div20 = element("div");
    			div19 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Robot Options";
    			t8 = space();
    			div2 = element("div");
    			label0 = element("label");
    			label0.textContent = "Units:";
    			t10 = space();
    			select0 = element("select");
    			option0 = element("option");
    			option0.textContent = "Inches";
    			option1 = element("option");
    			option1.textContent = "Centimeters";
    			t13 = space();
    			div3 = element("div");
    			label1 = element("label");
    			label1.textContent = "Robot Length:";
    			t15 = space();
    			input0 = element("input");
    			t16 = space();
    			div4 = element("div");
    			label2 = element("label");
    			label2.textContent = "Robot Width:";
    			t18 = space();
    			input1 = element("input");
    			t19 = space();
    			h21 = element("h2");
    			h21.textContent = "Field Options";
    			t21 = space();
    			div8 = element("div");
    			label3 = element("label");
    			label3.textContent = "Starting Position:";
    			t23 = space();
    			div7 = element("div");
    			div5 = element("div");
    			label4 = element("label");
    			label4.textContent = "X:";
    			t25 = space();
    			if (if_block0) if_block0.c();
    			t26 = space();
    			div6 = element("div");
    			label5 = element("label");
    			label5.textContent = "Y:";
    			t28 = space();
    			if (if_block1) if_block1.c();
    			t29 = space();
    			label6 = element("label");
    			label6.textContent = "Live Position:";
    			t31 = space();
    			div14 = element("div");
    			div12 = element("div");
    			div9 = element("div");
    			label7 = element("label");
    			label7.textContent = "X:";
    			t33 = space();
    			input2 = element("input");
    			t34 = space();
    			div10 = element("div");
    			label8 = element("label");
    			label8.textContent = "Y:";
    			t36 = space();
    			input3 = element("input");
    			t37 = space();
    			div11 = element("div");
    			label9 = element("label");
    			label9.textContent = "θ:";
    			t39 = space();
    			input4 = element("input");
    			t40 = space();
    			div13 = element("div");
    			label10 = element("label");
    			label10.textContent = "Current Path:";
    			t42 = space();
    			input5 = element("input");
    			t43 = space();
    			h22 = element("h2");
    			h22.textContent = "Advanced Options";
    			t45 = space();
    			div15 = element("div");
    			label11 = element("label");
    			label11.textContent = "Show Robot Hitbox:";
    			t47 = space();
    			input6 = element("input");
    			t48 = space();
    			div16 = element("div");
    			label12 = element("label");
    			label12.textContent = "Infinite Path Looping:";
    			t50 = space();
    			input7 = element("input");
    			t51 = space();
    			div17 = element("div");
    			label13 = element("label");
    			label13.textContent = "Auto-link Paths:";
    			t53 = space();
    			input8 = element("input");
    			t54 = space();
    			div18 = element("div");
    			label14 = element("label");
    			label14.textContent = "Rotational Units:";
    			t56 = space();
    			select1 = element("select");
    			option2 = element("option");
    			option2.textContent = "Degrees";
    			option3 = element("option");
    			option3.textContent = "Radians";
    			t59 = space();
    			div22 = element("div");

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t60 = space();
    			if (if_block2) if_block2.c();
    			t61 = space();
    			if (if_block3) if_block3.c();
    			t62 = space();
    			svg1 = svg_element("svg");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t63 = space();
    			div23 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t64 = space();
    			button2 = element("button");
    			button2.textContent = "Add Path";
    			t66 = space();
    			div27 = element("div");
    			div26 = element("div");
    			div25 = element("div");
    			if_block4.c();
    			t67 = space();
    			input9 = element("input");
    			attr_dev(h1, "class", "page-title svelte-27ngvs");
    			add_location(h1, file, 1073, 2, 26361);
    			attr_dev(path_1, "d", "M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H160v400Zm140-40-56-56 103-104-104-104 57-56 160 160-160 160Zm180 0v-80h240v80H480Z");
    			attr_dev(path_1, "class", "svelte-27ngvs");
    			add_location(path_1, file, 1076, 155, 26642);
    			attr_dev(svg0, "id", "code-window-btn");
    			attr_dev(svg0, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg0, "height", "24px");
    			attr_dev(svg0, "viewBox", "0 -960 960 960");
    			attr_dev(svg0, "width", "24px");
    			attr_dev(svg0, "fill", "black");
    			attr_dev(svg0, "class", "svelte-27ngvs");
    			add_location(svg0, file, 1076, 3, 26490);
    			set_style(button0, "user-select", "none");
    			attr_dev(button0, "class", "svelte-27ngvs");
    			add_location(button0, file, 1077, 3, 26879);
    			set_style(button1, "user-select", "none");
    			attr_dev(button1, "class", "svelte-27ngvs");
    			add_location(button1, file, 1078, 3, 26978);
    			attr_dev(div0, "class", "export-import svelte-27ngvs");
    			add_location(div0, file, 1074, 2, 26399);
    			attr_dev(div1, "class", "header svelte-27ngvs");
    			add_location(div1, file, 1072, 1, 26338);
    			attr_dev(h20, "class", "section-title svelte-27ngvs");
    			set_style(h20, "user-select", "none");
    			add_location(h20, file, 1088, 6, 27235);
    			attr_dev(label0, "for", "robotUnits");
    			set_style(label0, "user-select", "none");
    			attr_dev(label0, "class", "svelte-27ngvs");
    			add_location(label0, file, 1091, 7, 27348);
    			option0.__value = "inches";
    			option0.value = option0.__value;
    			attr_dev(option0, "class", "svelte-27ngvs");
    			add_location(option0, file, 1093, 8, 27504);
    			option1.__value = "cm";
    			option1.value = option1.__value;
    			attr_dev(option1, "class", "svelte-27ngvs");
    			add_location(option1, file, 1094, 8, 27551);
    			attr_dev(select0, "id", "robotUnits");
    			attr_dev(select0, "class", "standard-input-box svelte-27ngvs");
    			if (/*robotUnits*/ ctx[2] === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[36].call(select0));
    			add_location(select0, file, 1092, 7, 27420);
    			attr_dev(div2, "class", "robot-options svelte-27ngvs");
    			add_location(div2, file, 1090, 6, 27313);
    			attr_dev(label1, "for", "robot-length");
    			set_style(label1, "user-select", "none");
    			attr_dev(label1, "class", "svelte-27ngvs");
    			add_location(label1, file, 1101, 7, 27677);
    			attr_dev(input0, "id", "robot-length");
    			attr_dev(input0, "class", "standard-input-box svelte-27ngvs");
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "step", "1");
    			add_location(input0, file, 1102, 7, 27758);
    			attr_dev(div3, "class", "robot-options svelte-27ngvs");
    			add_location(div3, file, 1100, 6, 27642);
    			attr_dev(label2, "for", "robot-width");
    			set_style(label2, "user-select", "none");
    			attr_dev(label2, "class", "svelte-27ngvs");
    			add_location(label2, file, 1106, 7, 27988);
    			attr_dev(input1, "id", "robot-width");
    			attr_dev(input1, "class", "standard-input-box svelte-27ngvs");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "step", "1");
    			add_location(input1, file, 1107, 7, 28067);
    			attr_dev(div4, "class", "robot-options svelte-27ngvs");
    			add_location(div4, file, 1105, 6, 27953);
    			attr_dev(h21, "id", "field-options");
    			attr_dev(h21, "class", "section-title svelte-27ngvs");
    			set_style(h21, "user-select", "none");
    			add_location(h21, file, 1112, 6, 28261);
    			attr_dev(label3, "class", "adv-options svelte-27ngvs");
    			set_style(label3, "user-select", "none");
    			add_location(label3, file, 1117, 6, 28462);
    			attr_dev(label4, "class", "cp-x svelte-27ngvs");
    			set_style(label4, "user-select", "none");
    			add_location(label4, file, 1123, 8, 28712);
    			attr_dev(div5, "class", "control-point-mini-box-x svelte-27ngvs");
    			add_location(div5, file, 1121, 7, 28600);
    			attr_dev(label5, "class", "cp-x svelte-27ngvs");
    			set_style(label5, "user-select", "none");
    			add_location(label5, file, 1130, 8, 29199);
    			attr_dev(div6, "class", "control-point-mini-box-y svelte-27ngvs");
    			add_location(div6, file, 1128, 7, 29087);
    			attr_dev(div7, "class", "control-point-mini-box svelte-27ngvs");
    			add_location(div7, file, 1120, 6, 28556);
    			attr_dev(div8, "class", "start-pos-container svelte-27ngvs");
    			add_location(div8, file, 1116, 6, 28422);
    			attr_dev(label6, "class", "adv-options svelte-27ngvs");
    			set_style(label6, "user-select", "none");
    			add_location(label6, file, 1139, 6, 29664);
    			attr_dev(label7, "class", "cp-x svelte-27ngvs");
    			set_style(label7, "user-select", "none");
    			add_location(label7, file, 1144, 9, 29947);
    			attr_dev(input2, "class", "start-pos-box svelte-27ngvs");
    			attr_dev(input2, "type", "number");
    			attr_dev(input2, "step", "0.001");
    			input2.readOnly = true;
    			add_location(input2, file, 1145, 9, 30013);
    			attr_dev(div9, "class", "control-point-mini-box-x svelte-27ngvs");
    			add_location(div9, file, 1142, 8, 29833);
    			attr_dev(label8, "class", "cp-y svelte-27ngvs");
    			set_style(label8, "user-select", "none");
    			add_location(label8, file, 1149, 9, 30238);
    			attr_dev(input3, "class", "start-pos-box svelte-27ngvs");
    			attr_dev(input3, "type", "number");
    			attr_dev(input3, "step", "0.001");
    			input3.readOnly = true;
    			add_location(input3, file, 1150, 9, 30304);
    			attr_dev(div10, "class", "control-point-mini-box-y svelte-27ngvs");
    			add_location(div10, file, 1147, 8, 30124);
    			attr_dev(label9, "class", "cp-heading svelte-27ngvs");
    			set_style(label9, "user-select", "none");
    			add_location(label9, file, 1154, 9, 30535);
    			attr_dev(input4, "class", "start-pos-box svelte-27ngvs");
    			attr_dev(input4, "type", "number");
    			attr_dev(input4, "step", "0.001");
    			input4.value = input4_value_value = Math.round(/*robotLiveAngle*/ ctx[13]);
    			input4.readOnly = true;
    			add_location(input4, file, 1155, 9, 30607);
    			attr_dev(div11, "class", "control-point-mini-box-heading svelte-27ngvs");
    			add_location(div11, file, 1152, 8, 30415);
    			attr_dev(div12, "class", "cp-x-y svelte-27ngvs");
    			add_location(div12, file, 1141, 7, 29804);
    			attr_dev(label10, "class", "cp-x svelte-27ngvs");
    			set_style(label10, "user-select", "none");
    			set_style(label10, "font-weight", "600");
    			add_location(label10, file, 1160, 8, 30871);
    			attr_dev(input5, "class", "start-pos-box svelte-27ngvs");
    			attr_dev(input5, "type", "number");
    			attr_dev(input5, "step", "0.001");
    			input5.value = input5_value_value = /*currentPathIndex*/ ctx[11] + 1;
    			input5.readOnly = true;
    			add_location(input5, file, 1161, 8, 30963);
    			attr_dev(div13, "class", "control-point-mini-box-x current-path svelte-27ngvs");
    			add_location(div13, file, 1158, 7, 30746);
    			attr_dev(div14, "id", "live-pos");
    			attr_dev(div14, "class", "control-point-mini-box svelte-27ngvs");
    			add_location(div14, file, 1140, 6, 29746);
    			attr_dev(h22, "id", "advanced-options");
    			attr_dev(h22, "class", "section-title svelte-27ngvs");
    			set_style(h22, "user-select", "none");
    			add_location(h22, file, 1166, 6, 31101);
    			attr_dev(label11, "for", "field-length");
    			set_style(label11, "user-select", "none");
    			attr_dev(label11, "class", "svelte-27ngvs");
    			add_location(label11, file, 1168, 7, 31241);
    			attr_dev(input6, "id", "auto-link-paths");
    			attr_dev(input6, "type", "checkbox");
    			attr_dev(input6, "class", "svelte-27ngvs");
    			add_location(input6, file, 1169, 7, 31328);
    			attr_dev(div15, "class", "advanced-options svelte-27ngvs");
    			add_location(div15, file, 1167, 6, 31203);
    			attr_dev(label12, "for", "field-length");
    			set_style(label12, "user-select", "none");
    			attr_dev(label12, "class", "svelte-27ngvs");
    			add_location(label12, file, 1173, 7, 31465);
    			attr_dev(input7, "id", "auto-link-paths");
    			attr_dev(input7, "type", "checkbox");
    			attr_dev(input7, "class", "svelte-27ngvs");
    			add_location(input7, file, 1174, 7, 31556);
    			attr_dev(div16, "class", "advanced-options svelte-27ngvs");
    			add_location(div16, file, 1172, 6, 31427);
    			attr_dev(label13, "for", "field-length");
    			set_style(label13, "user-select", "none");
    			attr_dev(label13, "class", "svelte-27ngvs");
    			add_location(label13, file, 1177, 7, 31692);
    			attr_dev(input8, "id", "auto-link-paths");
    			attr_dev(input8, "type", "checkbox");
    			attr_dev(input8, "class", "svelte-27ngvs");
    			add_location(input8, file, 1178, 7, 31776);
    			attr_dev(div17, "class", "advanced-options svelte-27ngvs");
    			add_location(div17, file, 1176, 6, 31654);
    			attr_dev(label14, "for", "rotationUnits");
    			set_style(label14, "user-select", "none");
    			attr_dev(label14, "class", "svelte-27ngvs");
    			add_location(label14, file, 1181, 7, 31909);
    			option2.__value = "degrees";
    			option2.value = option2.__value;
    			attr_dev(option2, "class", "svelte-27ngvs");
    			add_location(option2, file, 1183, 8, 32085);
    			option3.__value = "radians";
    			option3.value = option3.__value;
    			attr_dev(option3, "class", "svelte-27ngvs");
    			add_location(option3, file, 1184, 8, 32134);
    			attr_dev(select1, "id", "rotationUnits");
    			attr_dev(select1, "class", "standard-input-box svelte-27ngvs");
    			if (/*rotationUnits*/ ctx[3] === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[50].call(select1));
    			add_location(select1, file, 1182, 7, 31995);
    			attr_dev(div18, "class", "advanced-options svelte-27ngvs");
    			add_location(div18, file, 1180, 6, 31871);
    			attr_dev(div19, "class", "svelte-27ngvs");
    			add_location(div19, file, 1087, 5, 27223);
    			attr_dev(div20, "class", "robot-options-menu svelte-27ngvs");
    			add_location(div20, file, 1086, 4, 27185);
    			attr_dev(div21, "class", "settings-column svelte-27ngvs");
    			add_location(div21, file, 1085, 3, 27151);
    			attr_dev(svg1, "viewBox", "0 0 144 144");
    			attr_dev(svg1, "width", "100%");
    			attr_dev(svg1, "height", "100%");
    			set_style(svg1, "position", "absolute");
    			set_style(svg1, "top", "0");
    			set_style(svg1, "left", "0");
    			attr_dev(svg1, "class", "svelte-27ngvs");
    			add_location(svg1, file, 1250, 4, 34043);
    			attr_dev(div22, "class", "field svelte-27ngvs");
    			add_location(div22, file, 1191, 3, 32242);
    			set_style(button2, "user-select", "none");
    			attr_dev(button2, "class", "svelte-27ngvs");
    			add_location(button2, file, 1361, 4, 42621);
    			attr_dev(div23, "class", "paths svelte-27ngvs");
    			add_location(div23, file, 1265, 3, 34401);
    			attr_dev(div24, "class", "container svelte-27ngvs");
    			add_location(div24, file, 1084, 2, 27124);
    			attr_dev(div25, "class", "play-button svelte-27ngvs");
    			add_location(div25, file, 1367, 4, 42821);
    			attr_dev(input9, "type", "range");
    			attr_dev(input9, "id", "scrub");
    			attr_dev(input9, "min", "0");
    			attr_dev(input9, "max", "100");
    			attr_dev(input9, "step", "0.001");
    			attr_dev(input9, "class", "svelte-27ngvs");
    			add_location(input9, file, 1378, 4, 43606);
    			attr_dev(div26, "class", "scrubbing-bar svelte-27ngvs");
    			add_location(div26, file, 1366, 3, 42789);
    			attr_dev(div27, "class", "footer svelte-27ngvs");
    			add_location(div27, file, 1365, 2, 42765);
    			attr_dev(div28, "class", "main-content svelte-27ngvs");
    			add_location(div28, file, 1082, 1, 27093);
    			attr_dev(div29, "class", "svelte-27ngvs");
    			add_location(div29, file, 1071, 0, 26331);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div29, anchor);
    			append_dev(div29, div1);
    			append_dev(div1, h1);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, svg0);
    			append_dev(svg0, path_1);
    			append_dev(div0, t2);
    			append_dev(div0, button0);
    			append_dev(div0, t4);
    			append_dev(div0, button1);
    			append_dev(div29, t6);
    			append_dev(div29, div28);
    			append_dev(div28, div24);
    			append_dev(div24, div21);
    			append_dev(div21, div20);
    			append_dev(div20, div19);
    			append_dev(div19, h20);
    			append_dev(div19, t8);
    			append_dev(div19, div2);
    			append_dev(div2, label0);
    			append_dev(div2, t10);
    			append_dev(div2, select0);
    			append_dev(select0, option0);
    			append_dev(select0, option1);
    			select_option(select0, /*robotUnits*/ ctx[2], true);
    			append_dev(div19, t13);
    			append_dev(div19, div3);
    			append_dev(div3, label1);
    			append_dev(div3, t15);
    			append_dev(div3, input0);
    			set_input_value(input0, /*displayLength*/ ctx[17]);
    			append_dev(div19, t16);
    			append_dev(div19, div4);
    			append_dev(div4, label2);
    			append_dev(div4, t18);
    			append_dev(div4, input1);
    			set_input_value(input1, /*displayWidth*/ ctx[16]);
    			append_dev(div19, t19);
    			append_dev(div19, h21);
    			append_dev(div19, t21);
    			append_dev(div19, div8);
    			append_dev(div8, label3);
    			append_dev(div8, t23);
    			append_dev(div8, div7);
    			append_dev(div7, div5);
    			append_dev(div5, label4);
    			append_dev(div5, t25);
    			if (if_block0) if_block0.m(div5, null);
    			append_dev(div7, t26);
    			append_dev(div7, div6);
    			append_dev(div6, label5);
    			append_dev(div6, t28);
    			if (if_block1) if_block1.m(div6, null);
    			append_dev(div19, t29);
    			append_dev(div19, label6);
    			append_dev(div19, t31);
    			append_dev(div19, div14);
    			append_dev(div14, div12);
    			append_dev(div12, div9);
    			append_dev(div9, label7);
    			append_dev(div9, t33);
    			append_dev(div9, input2);
    			set_input_value(input2, /*robotX*/ ctx[9]);
    			append_dev(div12, t34);
    			append_dev(div12, div10);
    			append_dev(div10, label8);
    			append_dev(div10, t36);
    			append_dev(div10, input3);
    			set_input_value(input3, /*robotY*/ ctx[10]);
    			append_dev(div12, t37);
    			append_dev(div12, div11);
    			append_dev(div11, label9);
    			append_dev(div11, t39);
    			append_dev(div11, input4);
    			append_dev(div14, t40);
    			append_dev(div14, div13);
    			append_dev(div13, label10);
    			append_dev(div13, t42);
    			append_dev(div13, input5);
    			append_dev(div19, t43);
    			append_dev(div19, h22);
    			append_dev(div19, t45);
    			append_dev(div19, div15);
    			append_dev(div15, label11);
    			append_dev(div15, t47);
    			append_dev(div15, input6);
    			input6.checked = /*shouldShowHitbox*/ ctx[15];
    			append_dev(div19, t48);
    			append_dev(div19, div16);
    			append_dev(div16, label12);
    			append_dev(div16, t50);
    			append_dev(div16, input7);
    			input7.checked = /*shouldRepeatPath*/ ctx[12];
    			append_dev(div19, t51);
    			append_dev(div19, div17);
    			append_dev(div17, label13);
    			append_dev(div17, t53);
    			append_dev(div17, input8);
    			input8.checked = /*autoLinkPaths*/ ctx[14];
    			append_dev(div19, t54);
    			append_dev(div19, div18);
    			append_dev(div18, label14);
    			append_dev(div18, t56);
    			append_dev(div18, select1);
    			append_dev(select1, option2);
    			append_dev(select1, option3);
    			select_option(select1, /*rotationUnits*/ ctx[3], true);
    			append_dev(div24, t59);
    			append_dev(div24, div22);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				if (each_blocks_2[i]) {
    					each_blocks_2[i].m(div22, null);
    				}
    			}

    			append_dev(div22, t60);
    			if (if_block2) if_block2.m(div22, null);
    			append_dev(div22, t61);
    			if (if_block3) if_block3.m(div22, null);
    			append_dev(div22, t62);
    			append_dev(div22, svg1);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(svg1, null);
    				}
    			}

    			append_dev(div24, t63);
    			append_dev(div24, div23);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div23, null);
    				}
    			}

    			append_dev(div23, t64);
    			append_dev(div23, button2);
    			append_dev(div28, t66);
    			append_dev(div28, div27);
    			append_dev(div27, div26);
    			append_dev(div26, div25);
    			if_block4.m(div25, null);
    			append_dev(div26, t67);
    			append_dev(div26, input9);
    			set_input_value(input9, /*linearScrubValue*/ ctx[5]);

    			if (!mounted) {
    				dispose = [
    					listen_dev(svg0, "click", /*showCodeWindow*/ ctx[34], false, false, false, false),
    					listen_dev(button0, "click", /*importControlPoints*/ ctx[25], false, false, false, false),
    					listen_dev(button1, "click", /*exportControlPoints*/ ctx[24], false, false, false, false),
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[36]),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[37]),
    					listen_dev(input0, "input", /*input_handler*/ ctx[38], false, false, false, false),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[39]),
    					listen_dev(input1, "input", /*input_handler_1*/ ctx[40], false, false, false, false),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[45]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[46]),
    					listen_dev(input6, "change", /*input6_change_handler*/ ctx[47]),
    					listen_dev(input7, "change", /*input7_change_handler*/ ctx[48]),
    					listen_dev(input8, "change", /*input8_change_handler*/ ctx[49]),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[50]),
    					listen_dev(button2, "click", /*click_handler_5*/ ctx[73], false, false, false, false),
    					listen_dev(input9, "change", /*input9_change_input_handler*/ ctx[74]),
    					listen_dev(input9, "input", /*input9_change_input_handler*/ ctx[74]),
    					listen_dev(input9, "input", /*updateRobotPosition*/ ctx[31], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*robotUnits*/ 4) {
    				select_option(select0, /*robotUnits*/ ctx[2]);
    			}

    			if (dirty[0] & /*displayLength*/ 131072 && to_number(input0.value) !== /*displayLength*/ ctx[17]) {
    				set_input_value(input0, /*displayLength*/ ctx[17]);
    			}

    			if (dirty[0] & /*displayWidth*/ 65536 && to_number(input1.value) !== /*displayWidth*/ ctx[16]) {
    				set_input_value(input1, /*displayWidth*/ ctx[16]);
    			}

    			if (/*$paths*/ ctx[7].length > 0) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_15(ctx);
    					if_block0.c();
    					if_block0.m(div5, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*$paths*/ ctx[7].length > 0) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_14(ctx);
    					if_block1.c();
    					if_block1.m(div6, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty[0] & /*robotX*/ 512 && to_number(input2.value) !== /*robotX*/ ctx[9]) {
    				set_input_value(input2, /*robotX*/ ctx[9]);
    			}

    			if (dirty[0] & /*robotY*/ 1024 && to_number(input3.value) !== /*robotY*/ ctx[10]) {
    				set_input_value(input3, /*robotY*/ ctx[10]);
    			}

    			if (dirty[0] & /*robotLiveAngle*/ 8192 && input4_value_value !== (input4_value_value = Math.round(/*robotLiveAngle*/ ctx[13])) && input4.value !== input4_value_value) {
    				prop_dev(input4, "value", input4_value_value);
    			}

    			if (dirty[0] & /*currentPathIndex*/ 2048 && input5_value_value !== (input5_value_value = /*currentPathIndex*/ ctx[11] + 1) && input5.value !== input5_value_value) {
    				prop_dev(input5, "value", input5_value_value);
    			}

    			if (dirty[0] & /*shouldShowHitbox*/ 32768) {
    				input6.checked = /*shouldShowHitbox*/ ctx[15];
    			}

    			if (dirty[0] & /*shouldRepeatPath*/ 4096) {
    				input7.checked = /*shouldRepeatPath*/ ctx[12];
    			}

    			if (dirty[0] & /*autoLinkPaths*/ 16384) {
    				input8.checked = /*autoLinkPaths*/ ctx[14];
    			}

    			if (dirty[0] & /*rotationUnits*/ 8) {
    				select_option(select1, /*rotationUnits*/ ctx[3]);
    			}

    			if (dirty[0] & /*$paths*/ 128) {
    				each_value_5 = /*$paths*/ ctx[7];
    				validate_each_argument(each_value_5);
    				let i;

    				for (i = 0; i < each_value_5.length; i += 1) {
    					const child_ctx = get_each_context_5(ctx, each_value_5, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_2[i] = create_each_block_5(child_ctx);
    						each_blocks_2[i].c();
    						each_blocks_2[i].m(div22, t60);
    					}
    				}

    				for (; i < each_blocks_2.length; i += 1) {
    					each_blocks_2[i].d(1);
    				}

    				each_blocks_2.length = each_value_5.length;
    			}

    			if (/*$paths*/ ctx[7].length > 0) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_13(ctx);
    					if_block2.c();
    					if_block2.m(div22, t61);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*shouldShowHitbox*/ ctx[15]) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_9(ctx);
    					if_block3.c();
    					if_block3.m(div22, t62);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (dirty[0] & /*$paths*/ 128) {
    				each_value_2 = /*$paths*/ ctx[7];
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

    			if (dirty[0] & /*$paths, generateBezierCurve, paths, addControlPointToPathWithIndex, deletePath, updatePathColor*/ 948961408 | dirty[1] & /*updateRobotPosition, checkAutoLinkControlPoints*/ 5) {
    				each_value = /*$paths*/ ctx[7];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div23, t64);
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
    					if_block4.m(div25, null);
    				}
    			}

    			if (dirty[0] & /*linearScrubValue*/ 32) {
    				set_input_value(input9, /*linearScrubValue*/ ctx[5]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div29);
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

    const hitboxOffset = 5;

    function getRandomBrightColor() {
    	const r = Math.floor(Math.random() * 128 + 128);
    	const g = Math.floor(Math.random() * 128 + 128);
    	const b = Math.floor(Math.random() * 128 + 128);
    	return `rgb(${r}, ${g}, ${b})`;
    }

    function calculateBezier(points, steps) {
    	let curve = [];

    	for (let t = 0; t <= 1; t += 1 / steps) {
    		curve.push(deCasteljau(points, t));
    	}

    	curve.push(points[points.length - 1]);
    	return curve;
    }

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

    function bernsteinPolynomial(n, i, t) {
    	return factorial(n) / (factorial(i) * factorial(n - i)) * t ** i * (1 - t) ** (n - i);
    }

    function getPointAt(t, p0, p1, p2) {
    	const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
    	const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
    	return { x, y };
    }

    function getDerivativeAt(t, p0, p1, p2) {
    	const d1 = {
    		x: 2 * (p1.x - p0.x),
    		y: 2 * (p1.y - p0.y)
    	};

    	const d2 = {
    		x: 2 * (p2.x - p1.x),
    		y: 2 * (p2.y - p1.y)
    	};

    	const x = (1 - t) * d1.x + t * d2.x;
    	const y = (1 - t) * d1.y + t * d2.y;
    	return { x, y };
    }

    function getNormalAt(t, p0, p1, p2) {
    	const d = getDerivativeAt(t, p0, p1, p2);
    	const length = Math.sqrt(d.x * d.x + d.y * d.y);
    	return { x: -d.y / length, y: d.x / length }; // Perpendicular vector
    }

    function getOffsetPointAt(t, p0, p1, p2, offset) {
    	const point = getPointAt(t, p0, p1, p2);
    	const normal = getNormalAt(t, p0, p1, p2);

    	return {
    		left: {
    			x: point.x + normal.x * offset,
    			y: point.y + normal.y * offset
    		},
    		right: {
    			x: point.x - normal.x * offset,
    			y: point.y - normal.y * offset
    		}
    	};
    }

    // Generate two offset curves
    function generateHitboxPath(p0, p1, p2, offset) {
    	const leftPath = [];
    	const rightPath = [];

    	for (let t = 0; t <= 1; t += 0.01) {
    		const offsetPoints = getOffsetPointAt(t, p0, p1, p2, offset);
    		leftPath.push(offsetPoints.left);
    		rightPath.push(offsetPoints.right);
    	}

    	return { leftPath, rightPath };
    }

    const func = point => `${point.x},${144 - point.y}`;

    function instance($$self, $$props, $$invalidate) {
    	let displayLength;
    	let displayWidth;
    	let animTime;
    	let $paths;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let controlPoints = writable([]);
    	let paths = writable([]);
    	validate_store(paths, 'paths');
    	component_subscribe($$self, paths, value => $$invalidate(7, $paths = value));
    	let x = 0;
    	let y = 0;

    	// Robot dimensions in inches
    	let robotLength = 18;

    	let robotWidth = 18;

    	// Unit system
    	let robotUnits = 'inches';

    	let rotationUnits = 'degrees';

    	// Functions to update robotLength and robotWidth
    	function updateRobotLength(value) {
    		const newValue = parseFloat(value) || 0; // Treat empty input as 0
    		$$invalidate(0, robotLength = parseFloat((robotUnits === 'inches' ? newValue : newValue / 2.54).toFixed(2)));
    	}

    	function updateRobotWidth(value) {
    		const newValue = parseFloat(value) || 0; // Treat empty input as 0
    		$$invalidate(1, robotWidth = parseFloat((robotUnits === 'inches' ? newValue : newValue / 2.54).toFixed(2)));
    	}

    	function generateBezierCurve(pathId) {
    		paths.update(paths => {
    			const path = paths.find(p => p.id === pathId);

    			if (path) {
    				path.bezierCurvePoints = calculateBezier(path.controlPoints, 100);
    			}

    			return paths;
    		});
    	}

    	function exportControlPoints() {
    		const data = $paths.map(path => ({
    			id: path.id,
    			controlPoints: path.controlPoints,
    			color: path.color,
    			robotHeading: path.robotHeading,
    			startAngleDegrees: path.startAngleDegrees,
    			endAngleDegrees: path.endAngleDegrees,
    			constantAngleDegrees: path.constantAngleDegrees,
    			reverse: path.reverse
    		}));

    		const json = JSON.stringify(data, null, 2);
    		const blob = new Blob([json], { type: 'application/json' });
    		const url = URL.createObjectURL(blob);
    		const link = document.createElement('a');
    		link.href = url;
    		link.download = 'paths.json';
    		link.click();
    	}

    	function importControlPoints() {
    		const input = document.createElement('input');
    		input.type = 'file';
    		input.accept = '.json';

    		input.onchange = async event => {
    			const file = event.target.files[0];
    			const text = await file.text();
    			const data = JSON.parse(text);
    			paths.set(data.map((path, index) => ({ ...path, id: index })));
    			data.forEach((path, index) => generateBezierCurve(index));
    			updateRobotPosition();
    		};

    		input.click();
    	}

    	function addPath() {
    		paths.update(paths => {
    			const newPath = {
    				id: paths.length,
    				controlPoints: [],
    				bezierCurvePoints: [],
    				color: getRandomBrightColor(),
    				robotHeading: 'constant', // default heading
    				
    			};

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
    			} else if (paths.length === 0) {
    				newPath.controlPoints.push({ x: 12, y: 96 });
    				newPath.controlPoints.push({ x: 36, y: 96 });
    			}

    			return [...paths, newPath];
    		});
    	}

    	function addControlPointToPathWithIndex(pathId, index) {
    		paths.update(paths => {
    			const path = paths.find(p => p.id === pathId);
    			console.log(path.controlPoints);

    			if (path) {
    				const angle = Math.random() * 2 * Math.PI;
    				const distance = 50;
    				$$invalidate(18, x = 72 + Math.cos(angle) * distance);
    				$$invalidate(19, y = 72 + Math.sin(angle) * distance);
    				path.controlPoints.splice(index, 0, { x, y });
    				path.bezierCurvePoints = calculateBezier(path.controlPoints, 100);
    			}

    			console.log(path.controlPoints);
    			return paths;
    		});
    	}

    	function updatePathColor(pathId, color) {
    		paths.update(paths => {
    			const path = paths.find(p => p.id === pathId);

    			if (path) {
    				path.color = color;
    			}

    			return paths;
    		});
    	}

    	function deletePath(pathId) {
    		paths.update(paths => {
    			const updatedPaths = paths.filter(path => path.id !== pathId);

    			updatedPaths.forEach((path, index) => {
    				path.id = index;
    			});

    			if (autoLinkPaths && pathId > 0 && pathId < paths.length - 1) {
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
    	let shouldRepeatPath = true;
    	let robotLiveAngle = 0;

    	function playPath() {
    		if (isPlaying) return;
    		$$invalidate(4, isPlaying = true);

    		$$invalidate(11, currentPathIndex = isStartingFromBeginning
    		? 0
    		: Math.floor(scrubValue / 100 * $paths.length));

    		pathStartTime = Date.now() - (isStartingFromBeginning
    		? 0
    		: scrubValue % (100 / $paths.length) / 100 * animTime * 1000);

    		if (wasPaused) {
    			pathStartTime = Date.now() - progress * pathAnimTime * 1000;
    		}

    		intervalId = setInterval(
    			() => {
    				elapsedTime = (Date.now() - pathStartTime) / 1000;
    				$$invalidate(8, path = $paths[currentPathIndex]);
    				pathAnimTime = animTime / $paths.length;
    				progress = elapsedTime / pathAnimTime;
    				$$invalidate(5, linearScrubValue = (currentPathIndex + progress) / $paths.length * 100);

    				if (progress < 0.5) {
    					progress = 2 * progress * progress;
    				} else {
    					progress = -1 + (4 - 2 * progress) * progress;
    				}

    				scrubValue = (currentPathIndex + progress) / $paths.length * 100;
    				updateRobotPosition();

    				if (elapsedTime >= pathAnimTime) {
    					if (currentPathIndex + 1 >= $paths.length) {
    						if (shouldRepeatPath) {
    							$$invalidate(11, currentPathIndex = 0);
    						} else {
    							pausePath();
    						}
    					} else {
    						$$invalidate(11, currentPathIndex++, currentPathIndex);
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
    			totalPoints += path.bezierCurvePoints.length;
    		});

    		let accumulatedPoints = 0;

    		for (let path of $paths) {
    			if (scrubValue <= (accumulatedPoints + path.bezierCurvePoints.length) / totalPoints * 100) {
    				const relativeScrubValue = (scrubValue - accumulatedPoints / totalPoints * 100) / (path.bezierCurvePoints.length / totalPoints * 100);
    				const pointIndex = Math.floor(relativeScrubValue * (path.bezierCurvePoints.length - 1));
    				const point = path.bezierCurvePoints[pointIndex];

    				if (point) {
    					$$invalidate(9, robotX = point.x);
    					$$invalidate(10, robotY = point.y);
    					const robotElement = document.getElementById('robot');

    					if (robotElement) {
    						if (path.robotHeading === 'tangential') {
    							const nextPoint = path.bezierCurvePoints[Math.min(pointIndex + 1, path.bezierCurvePoints.length - 1)];
    							const prevPoint = path.bezierCurvePoints[Math.max(pointIndex - 1, 0)];
    							let angle = Math.atan2(nextPoint.y - prevPoint.y, nextPoint.x - prevPoint.x);

    							if (path.reverse) {
    								angle += Math.PI;
    							}

    							robotElement.style.transform = `translate(-50%, 50%) rotate(${-angle + Math.PI / 2}rad)`;

    							$$invalidate(13, robotLiveAngle = rotationUnits === 'degrees'
    							? angle * (180 / Math.PI)
    							: angle);
    						} else if (path.robotHeading === 'linear') {
    							const startAngle = path.startAngle || 0;
    							const endAngle = path.endAngle || 0;
    							const angle = startAngle + (endAngle - startAngle) * relativeScrubValue;
    							robotElement.style.transform = `translate(-50%, 50%) rotate(${-angle + Math.PI / 2}rad)`;

    							$$invalidate(13, robotLiveAngle = rotationUnits === 'degrees'
    							? angle * (180 / Math.PI)
    							: angle);
    						} else if (path.robotHeading === 'constant') {
    							const angle = path.constantAngle || 0;
    							robotElement.style.transform = `translate(-50%, 50%) rotate(${-angle + Math.PI / 2}rad)`;

    							$$invalidate(13, robotLiveAngle = rotationUnits === 'degrees'
    							? -angle * (180 / Math.PI)
    							: -angle);
    						}
    					}
    				}

    				break;
    			}

    			accumulatedPoints += path.bezierCurvePoints.length;
    		}
    	}

    	function pausePath() {
    		$$invalidate(4, isPlaying = false);

    		if (intervalId) {
    			clearInterval(intervalId);
    			intervalId = null;
    		}

    		$$invalidate(35, wasPaused = true);
    		isStartingFromBeginning = false;
    	}

    	document.addEventListener('DOMContentLoaded', () => {
    		addPath();
    		generateBezierCurve($paths.length - 1);
    	});

    	document.addEventListener('mousedown', event => {
    		const field = document.querySelector('.field');
    		const rect = field.getBoundingClientRect();
    		const mouseX = event.clientX - rect.left;
    		const mouseY = event.clientY - rect.top;
    		let selectedPathId = null;
    		let selectedPointIndex = null;
    		let selectedPathId2 = null;
    		let selectedPointIndex2 = null;

    		$paths.forEach(path => {
    			path.controlPoints.forEach((point, index) => {
    				const pointX = point.x / 144 * rect.width;
    				const pointY = rect.height - point.y / 144 * rect.height;
    				const distance = Math.sqrt((mouseX - pointX) ** 2 + (mouseY - pointY) ** 2);

    				if (distance < 10) {
    					if (selectedPathId === null && selectedPointIndex === null) {
    						selectedPathId = path.id;
    						selectedPointIndex = index;
    					} else if (autoLinkPaths && selectedPathId2 === null && selectedPointIndex2 === null) {
    						selectedPathId2 = path.id;
    						selectedPointIndex2 = index;
    					}
    				}
    			});
    		});

    		if (selectedPathId !== null && selectedPointIndex !== null) {
    			const movePoint = moveEvent => {
    				const newMouseX = moveEvent.clientX - rect.left;
    				const newMouseY = moveEvent.clientY - rect.top;
    				let newX = newMouseX / rect.width * 144;
    				let newY = 144 - newMouseY / rect.height * 144;
    				const hitboxOffsetX = robotWidth / 2;
    				const hitboxOffsetY = robotLength / 2;
    				newX = Math.max(hitboxOffsetX, Math.min(144 - hitboxOffsetX, newX));
    				newY = Math.max(hitboxOffsetY, Math.min(144 - hitboxOffsetY, newY));

    				paths.update(paths => {
    					const path = paths.find(p => p.id === selectedPathId);

    					if (path) {
    						path.controlPoints[selectedPointIndex] = { x: newX, y: newY };
    						path.bezierCurvePoints = calculateBezier(path.controlPoints, 100);
    					}

    					if (autoLinkPaths && selectedPathId2 !== null && selectedPointIndex2 !== null) {
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
    				document.removeEventListener('mousemove', movePoint);
    				document.removeEventListener('mouseup', stopMove);
    			};

    			document.addEventListener('mousemove', movePoint);
    			document.addEventListener('mouseup', stopMove);
    		}
    	});

    	let autoLinkPaths = true;

    	function checkAutoLinkControlPoints() {
    		if (autoLinkPaths) {
    			paths.update(paths => {
    				for (let i = 0; i < paths.length - 1; i++) {
    					const currentPath = paths[i];
    					const nextPath = paths[i + 1];

    					if (currentPath.controlPoints.length > 0 && nextPath.controlPoints.length > 0) {
    						const lastPoint = currentPath.controlPoints[currentPath.controlPoints.length - 1];
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
    		let codeContent = 'private Path ';

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

    			if (path.robotHeading === 'constant') {
    				const angle = rotationUnits === 'degrees'
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
    				const startAngle = rotationUnits === 'degrees'
    				? `Math.toRadians(${path.startAngleDegrees || 0})`
    				: `${path.startAngleDegrees || 0}`;

    				const endAngle = rotationUnits === 'degrees'
    				? `Math.toRadians(${path.endAngleDegrees || 0})`
    				: `${path.endAngleDegrees || 0}`;

    				codeContent += `    p${index + 1}.setLinearHeadingInterpolation(${startAngle}, ${endAngle});\n\n`;
    			}
    		});

    		codeContent += '}';
    		codeWindow.document.write('<pre>' + codeContent + '</pre>');
    		codeWindow.document.close();
    	}

    	let shouldShowHitbox = false;

    	// Usage Example:
    	const p0 = { x: 10, y: 20 };

    	const p1 = { x: 30, y: 60 };
    	const p2 = { x: 50, y: 20 };
    	const hitbox = generateHitboxPath(p0, p1, p2, hitboxOffset);
    	console.log(hitbox.leftPath, hitbox.rightPath); // Use this in SVG rendering
    	let offsetPaths = [];
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function select0_change_handler() {
    		robotUnits = select_value(this);
    		$$invalidate(2, robotUnits);
    	}

    	function input0_input_handler() {
    		displayLength = to_number(this.value);
    		(($$invalidate(17, displayLength), $$invalidate(2, robotUnits)), $$invalidate(0, robotLength));
    	}

    	const input_handler = e => updateRobotLength(parseFloat(e.target.value));

    	function input1_input_handler() {
    		displayWidth = to_number(this.value);
    		(($$invalidate(16, displayWidth), $$invalidate(2, robotUnits)), $$invalidate(1, robotWidth));
    	}

    	const input_handler_1 = e => updateRobotWidth(parseFloat(e.target.value));

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
    		$$invalidate(9, robotX);
    	}

    	function input3_input_handler() {
    		robotY = to_number(this.value);
    		$$invalidate(10, robotY);
    	}

    	function input6_change_handler() {
    		shouldShowHitbox = this.checked;
    		$$invalidate(15, shouldShowHitbox);
    	}

    	function input7_change_handler() {
    		shouldRepeatPath = this.checked;
    		$$invalidate(12, shouldRepeatPath);
    	}

    	function input8_change_handler() {
    		autoLinkPaths = this.checked;
    		$$invalidate(14, autoLinkPaths);
    	}

    	function select1_change_handler() {
    		rotationUnits = select_value(this);
    		$$invalidate(3, rotationUnits);
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

    	function input0_input_handler_1(each_value, path_index) {
    		each_value[path_index].startAngleDegrees = to_number(this.value);
    		paths.set($paths);
    	}

    	const input_handler_9 = () => updateRobotPosition();

    	function input1_input_handler_1(each_value, path_index) {
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

    	function input9_change_input_handler() {
    		linearScrubValue = to_number(this.value);
    		$$invalidate(5, linearScrubValue);
    	}

    	$$self.$capture_state = () => ({
    		linear: identity,
    		writable,
    		controlPoints,
    		paths,
    		x,
    		y,
    		robotLength,
    		robotWidth,
    		robotUnits,
    		rotationUnits,
    		updateRobotLength,
    		updateRobotWidth,
    		getRandomBrightColor,
    		generateBezierCurve,
    		calculateBezier,
    		deCasteljau,
    		exportControlPoints,
    		importControlPoints,
    		addPath,
    		addControlPointToPathWithIndex,
    		updatePathColor,
    		deletePath,
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
    		shouldRepeatPath,
    		robotLiveAngle,
    		playPath,
    		updateRobotPosition,
    		pausePath,
    		autoLinkPaths,
    		checkAutoLinkControlPoints,
    		showCodeWindow,
    		shouldShowHitbox,
    		bernsteinPolynomial,
    		getPointAt,
    		getDerivativeAt,
    		getNormalAt,
    		getOffsetPointAt,
    		generateHitboxPath,
    		p0,
    		p1,
    		p2,
    		hitboxOffset,
    		hitbox,
    		offsetPaths,
    		animTime,
    		displayWidth,
    		displayLength,
    		$paths
    	});

    	$$self.$inject_state = $$props => {
    		if ('controlPoints' in $$props) controlPoints = $$props.controlPoints;
    		if ('paths' in $$props) $$invalidate(20, paths = $$props.paths);
    		if ('x' in $$props) $$invalidate(18, x = $$props.x);
    		if ('y' in $$props) $$invalidate(19, y = $$props.y);
    		if ('robotLength' in $$props) $$invalidate(0, robotLength = $$props.robotLength);
    		if ('robotWidth' in $$props) $$invalidate(1, robotWidth = $$props.robotWidth);
    		if ('robotUnits' in $$props) $$invalidate(2, robotUnits = $$props.robotUnits);
    		if ('rotationUnits' in $$props) $$invalidate(3, rotationUnits = $$props.rotationUnits);
    		if ('scrubValue' in $$props) scrubValue = $$props.scrubValue;
    		if ('robotX' in $$props) $$invalidate(9, robotX = $$props.robotX);
    		if ('robotY' in $$props) $$invalidate(10, robotY = $$props.robotY);
    		if ('isPlaying' in $$props) $$invalidate(4, isPlaying = $$props.isPlaying);
    		if ('wasPaused' in $$props) $$invalidate(35, wasPaused = $$props.wasPaused);
    		if ('isStartingFromBeginning' in $$props) isStartingFromBeginning = $$props.isStartingFromBeginning;
    		if ('intervalId' in $$props) intervalId = $$props.intervalId;
    		if ('animInterval' in $$props) $$invalidate(84, animInterval = $$props.animInterval);
    		if ('progress' in $$props) progress = $$props.progress;
    		if ('elapsedTime' in $$props) elapsedTime = $$props.elapsedTime;
    		if ('path' in $$props) $$invalidate(8, path = $$props.path);
    		if ('pathAnimTime' in $$props) pathAnimTime = $$props.pathAnimTime;
    		if ('linearScrubValue' in $$props) $$invalidate(5, linearScrubValue = $$props.linearScrubValue);
    		if ('motionBlurAmount' in $$props) $$invalidate(85, motionBlurAmount = $$props.motionBlurAmount);
    		if ('currentPathIndex' in $$props) $$invalidate(11, currentPathIndex = $$props.currentPathIndex);
    		if ('pathStartTime' in $$props) pathStartTime = $$props.pathStartTime;
    		if ('shouldRepeatPath' in $$props) $$invalidate(12, shouldRepeatPath = $$props.shouldRepeatPath);
    		if ('robotLiveAngle' in $$props) $$invalidate(13, robotLiveAngle = $$props.robotLiveAngle);
    		if ('autoLinkPaths' in $$props) $$invalidate(14, autoLinkPaths = $$props.autoLinkPaths);
    		if ('shouldShowHitbox' in $$props) $$invalidate(15, shouldShowHitbox = $$props.shouldShowHitbox);
    		if ('offsetPaths' in $$props) $$invalidate(6, offsetPaths = $$props.offsetPaths);
    		if ('animTime' in $$props) animTime = $$props.animTime;
    		if ('displayWidth' in $$props) $$invalidate(16, displayWidth = $$props.displayWidth);
    		if ('displayLength' in $$props) $$invalidate(17, displayLength = $$props.displayLength);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*robotUnits, robotLength*/ 5) {
    			// Display dimensions (computed based on robotUnits)
    			$$invalidate(17, displayLength = parseFloat((robotUnits === 'inches'
    			? robotLength
    			: robotLength * 2.54).toFixed(2)));
    		}

    		if ($$self.$$.dirty[0] & /*robotUnits, robotWidth*/ 6) {
    			$$invalidate(16, displayWidth = parseFloat((robotUnits === 'inches' ? robotWidth : robotWidth * 2.54).toFixed(2)));
    		}

    		if ($$self.$$.dirty[0] & /*rotationUnits, $paths*/ 136) {
    			{
    				const angleConversionFactor = rotationUnits === 'degrees' ? Math.PI / 180 : 1;

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

    		if ($$self.$$.dirty[0] & /*$paths*/ 128) {
    			animTime = 1.56 * $paths.length;
    		}

    		if ($$self.$$.dirty[0] & /*isPlaying, $paths, linearScrubValue*/ 176 | $$self.$$.dirty[1] & /*wasPaused*/ 16) {
    			{
    				if (!isPlaying && wasPaused) {
    					const totalPaths = $paths.length;
    					const pathIndex = Math.floor(linearScrubValue / 100 * totalPaths);
    					const pathProgress = linearScrubValue / 100 * totalPaths - pathIndex;

    					const adjustedProgress = pathProgress < 0.5
    					? 2 * pathProgress * pathProgress
    					: -1 + (4 - 2 * pathProgress) * pathProgress;

    					scrubValue = (pathIndex + adjustedProgress) / totalPaths * 100;
    					$$invalidate(11, currentPathIndex = pathIndex);
    					progress = adjustedProgress;
    					updateRobotPosition();
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*isPlaying*/ 16) {
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

    		if ($$self.$$.dirty[0] & /*$paths, offsetPaths*/ 192) {
    			{
    				$$invalidate(6, offsetPaths = $paths.map(path => ({
    					left: [],
    					right: [],
    					main: [],
    					color: path.color,
    					controlPoints: path.controlPoints
    				})));

    				$paths.forEach((path, pathIndex) => {
    					if (path.controlPoints.length >= 2) {
    						for (let t = 0; t <= 1; t += 0.01) {
    							let leftPoint, rightPoint, mainPoint;

    							for (let i = 0; i < path.controlPoints.length - 1; i++) {
    								if (i < path.controlPoints.length - 2) {
    									mainPoint = getPointAt(t, path.controlPoints[i], path.controlPoints[i + 1], path.controlPoints[i + 2]);
    									({ left: leftPoint, right: rightPoint } = getOffsetPointAt(t, path.controlPoints[i], path.controlPoints[i + 1], path.controlPoints[i + 2], 5));
    								} else {
    									mainPoint = getPointAt(t, path.controlPoints[i], path.controlPoints[i + 1], path.controlPoints[i + 1]);
    									({ left: leftPoint, right: rightPoint } = getOffsetPointAt(t, path.controlPoints[i], path.controlPoints[i + 1], path.controlPoints[i + 1], 5));
    								}

    								offsetPaths[pathIndex].left.push(leftPoint);
    								offsetPaths[pathIndex].right.push(rightPoint);
    								offsetPaths[pathIndex].main.push(mainPoint);
    							}
    						}
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
    		robotLength,
    		robotWidth,
    		robotUnits,
    		rotationUnits,
    		isPlaying,
    		linearScrubValue,
    		offsetPaths,
    		$paths,
    		path,
    		robotX,
    		robotY,
    		currentPathIndex,
    		shouldRepeatPath,
    		robotLiveAngle,
    		autoLinkPaths,
    		shouldShowHitbox,
    		displayWidth,
    		displayLength,
    		x,
    		y,
    		paths,
    		updateRobotLength,
    		updateRobotWidth,
    		generateBezierCurve,
    		exportControlPoints,
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
    		select0_change_handler,
    		input0_input_handler,
    		input_handler,
    		input1_input_handler,
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
    		input0_input_handler_1,
    		input_handler_9,
    		input1_input_handler_1,
    		input_handler_10,
    		input_change_handler,
    		input_handler_11,
    		input_input_handler_3,
    		input_handler_12,
    		click_handler_5,
    		input9_change_input_handler
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
