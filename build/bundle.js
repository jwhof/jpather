
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

    /* src\App.svelte generated by Svelte v3.59.2 */
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	child_ctx[63] = list;
    	child_ctx[64] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i].x;
    	child_ctx[13] = list[i].y;
    	child_ctx[65] = list;
    	child_ctx[66] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    function get_each_context_4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i].x;
    	child_ctx[13] = list[i].y;
    	return child_ctx;
    }

    // (800:8) {#if $paths.length > 0}
    function create_if_block_7(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "class", "standard-input-box svelte-vq7zdm");
    			attr_dev(input, "type", "number");
    			attr_dev(input, "step", "0.01");
    			add_location(input, file, 800, 8, 18711);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*$paths*/ ctx[5][0].controlPoints[0].x);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[31]),
    					listen_dev(input, "input", /*input_handler*/ ctx[32], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 32 && to_number(input.value) !== /*$paths*/ ctx[5][0].controlPoints[0].x) {
    				set_input_value(input, /*$paths*/ ctx[5][0].controlPoints[0].x);
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
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(800:8) {#if $paths.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (807:8) {#if $paths.length > 0}
    function create_if_block_6(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "class", "standard-input-box svelte-vq7zdm");
    			attr_dev(input, "type", "number");
    			attr_dev(input, "step", "0.01");
    			add_location(input, file, 807, 8, 19105);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*$paths*/ ctx[5][0].controlPoints[0].y);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler_1*/ ctx[33]),
    					listen_dev(input, "input", /*input_handler_1*/ ctx[34], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 32 && to_number(input.value) !== /*$paths*/ ctx[5][0].controlPoints[0].y) {
    				set_input_value(input, /*$paths*/ ctx[5][0].controlPoints[0].y);
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
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(807:8) {#if $paths.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (828:5) {#each path.controlPoints as { x, y }}
    function create_each_block_4(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "point svelte-vq7zdm");
    			set_style(div0, "left", /*x*/ ctx[12] / 144 * 100 + "%");
    			set_style(div0, "bottom", /*y*/ ctx[13] / 144 * 100 + "%");
    			set_style(div0, "background", /*path*/ ctx[14].color);
    			add_location(div0, file, 829, 6, 20024);
    			attr_dev(div1, "class", "hover-point svelte-vq7zdm");
    			add_location(div1, file, 828, 5, 19991);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 32) {
    				set_style(div0, "left", /*x*/ ctx[12] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*$paths*/ 32) {
    				set_style(div0, "bottom", /*y*/ ctx[13] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*$paths*/ 32) {
    				set_style(div0, "background", /*path*/ ctx[14].color);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_4.name,
    		type: "each",
    		source: "(828:5) {#each path.controlPoints as { x, y }}",
    		ctx
    	});

    	return block;
    }

    // (827:4) {#each $paths as path}
    function create_each_block_3(ctx) {
    	let each_1_anchor;
    	let each_value_4 = /*path*/ ctx[14].controlPoints;
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
    			if (dirty[0] & /*$paths*/ 32) {
    				each_value_4 = /*path*/ ctx[14].controlPoints;
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
    		source: "(827:4) {#each $paths as path}",
    		ctx
    	});

    	return block;
    }

    // (836:4) {#if $paths.length > 0}
    function create_if_block_5(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "/robot.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Robot");
    			attr_dev(img, "id", "robot");
    			set_style(img, "width", /*robotWidth*/ ctx[7] / 144 * 100 + "%");
    			set_style(img, "height", /*robotLength*/ ctx[6] / 144 * 100 + "%");
    			set_style(img, "left", /*robotX*/ ctx[8] / 144 * 100 + "%");
    			set_style(img, "bottom", /*robotY*/ ctx[9] / 144 * 100 + "%");
    			set_style(img, "user-select", "none");
    			attr_dev(img, "class", "svelte-vq7zdm");
    			add_location(img, file, 836, 5, 20217);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*robotWidth*/ 128) {
    				set_style(img, "width", /*robotWidth*/ ctx[7] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*robotLength*/ 64) {
    				set_style(img, "height", /*robotLength*/ ctx[6] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*robotX*/ 256) {
    				set_style(img, "left", /*robotX*/ ctx[8] / 144 * 100 + "%");
    			}

    			if (dirty[0] & /*robotY*/ 512) {
    				set_style(img, "bottom", /*robotY*/ ctx[9] / 144 * 100 + "%");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(836:4) {#if $paths.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (842:6) {#each $paths as path}
    function create_each_block_2(ctx) {
    	let polyline;
    	let polyline_points_value;

    	const block = {
    		c: function create() {
    			polyline = svg_element("polyline");
    			attr_dev(polyline, "class", "curve svelte-vq7zdm");
    			attr_dev(polyline, "points", polyline_points_value = /*path*/ ctx[14].bezierCurvePoints.map(func).join(' '));
    			set_style(polyline, "stroke", /*path*/ ctx[14].color);
    			add_location(polyline, file, 842, 7, 20588);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, polyline, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 32 && polyline_points_value !== (polyline_points_value = /*path*/ ctx[14].bezierCurvePoints.map(func).join(' '))) {
    				attr_dev(polyline, "points", polyline_points_value);
    			}

    			if (dirty[0] & /*$paths*/ 32) {
    				set_style(polyline, "stroke", /*path*/ ctx[14].color);
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
    		source: "(842:6) {#each $paths as path}",
    		ctx
    	});

    	return block;
    }

    // (878:28) 
    function create_if_block_4(ctx) {
    	let label;
    	let t0;
    	let t1_value = /*i*/ ctx[66] - 1 + "";
    	let t1;
    	let t2;
    	let label_for_value;

    	const block = {
    		c: function create() {
    			label = element("label");
    			t0 = text("Control Point ");
    			t1 = text(t1_value);
    			t2 = text(":");
    			attr_dev(label, "for", label_for_value = "control-point-" + /*path*/ ctx[14].id + "-" + /*i*/ ctx[66]);
    			set_style(label, "user-select", "none");
    			attr_dev(label, "class", "svelte-vq7zdm");
    			add_location(label, file, 878, 11, 24199);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, t0);
    			append_dev(label, t1);
    			append_dev(label, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 32 && label_for_value !== (label_for_value = "control-point-" + /*path*/ ctx[14].id + "-" + /*i*/ ctx[66])) {
    				attr_dev(label, "for", label_for_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(878:28) ",
    		ctx
    	});

    	return block;
    }

    // (876:10) {#if (path.controlPoints.length >= 2) && (i > 0) && (i < 2)}
    function create_if_block_3(ctx) {
    	let label;
    	let t;
    	let label_for_value;

    	const block = {
    		c: function create() {
    			label = element("label");
    			t = text("Endpoint:");
    			attr_dev(label, "for", label_for_value = "control-point-" + /*path*/ ctx[14].id + "-" + /*i*/ ctx[66]);
    			set_style(label, "user-select", "none");
    			attr_dev(label, "class", "svelte-vq7zdm");
    			add_location(label, file, 876, 11, 24072);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$paths*/ 32 && label_for_value !== (label_for_value = "control-point-" + /*path*/ ctx[14].id + "-" + /*i*/ ctx[66])) {
    				attr_dev(label, "for", label_for_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(876:10) {#if (path.controlPoints.length >= 2) && (i > 0) && (i < 2)}",
    		ctx
    	});

    	return block;
    }

    // (881:10) {#if i > 0 || path.controlPoints.length === 1}
    function create_if_block_1(ctx) {
    	let div2;
    	let div0;
    	let label0;
    	let t0;
    	let label0_for_value;
    	let t1;
    	let input0;
    	let input0_id_value;
    	let t2;
    	let div1;
    	let label1;
    	let t3;
    	let label1_for_value;
    	let t4;
    	let input1;
    	let input1_id_value;
    	let t5;
    	let mounted;
    	let dispose;

    	function input0_input_handler_1() {
    		/*input0_input_handler_1*/ ctx[44].call(input0, /*i*/ ctx[66], /*each_value*/ ctx[63], /*path_index*/ ctx[64]);
    	}

    	function input_handler_3() {
    		return /*input_handler_3*/ ctx[45](/*path*/ ctx[14]);
    	}

    	function input1_input_handler_1() {
    		/*input1_input_handler_1*/ ctx[46].call(input1, /*i*/ ctx[66], /*each_value*/ ctx[63], /*path_index*/ ctx[64]);
    	}

    	function input_handler_4() {
    		return /*input_handler_4*/ ctx[47](/*path*/ ctx[14]);
    	}

    	let if_block = /*i*/ ctx[66] > 1 && create_if_block_2(ctx);

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
    			attr_dev(label0, "class", "cp-x svelte-vq7zdm");
    			attr_dev(label0, "for", label0_for_value = "control-point-" + /*path*/ ctx[14].id + "-" + /*i*/ ctx[66]);
    			set_style(label0, "user-select", "none");
    			add_location(label0, file, 883, 13, 24485);
    			attr_dev(input0, "id", input0_id_value = "control-point-" + /*path*/ ctx[14].id + "-" + /*i*/ ctx[66]);
    			attr_dev(input0, "class", "standard-input-box svelte-vq7zdm");
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "step", "0.01");
    			add_location(input0, file, 884, 13, 24590);
    			attr_dev(div0, "class", "control-point-mini-box-x svelte-vq7zdm");
    			add_location(div0, file, 882, 12, 24432);
    			attr_dev(label1, "class", "cp-y svelte-vq7zdm");
    			attr_dev(label1, "for", label1_for_value = "control-point-" + /*path*/ ctx[14].id + "-" + /*i*/ ctx[66] + "-y");
    			set_style(label1, "user-select", "none");
    			add_location(label1, file, 887, 13, 24855);
    			attr_dev(input1, "id", input1_id_value = "control-point-" + /*path*/ ctx[14].id + "-" + /*i*/ ctx[66] + "-y");
    			attr_dev(input1, "class", "standard-input-box svelte-vq7zdm");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "step", "0.01");
    			add_location(input1, file, 888, 13, 24962);
    			attr_dev(div1, "class", "control-point-mini-box-y svelte-vq7zdm");
    			add_location(div1, file, 886, 12, 24802);
    			attr_dev(div2, "class", "control-point-mini-box svelte-vq7zdm");
    			add_location(div2, file, 881, 11, 24382);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, label0);
    			append_dev(label0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, input0);
    			set_input_value(input0, /*path*/ ctx[14].controlPoints[/*i*/ ctx[66]].x);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			append_dev(div1, label1);
    			append_dev(label1, t3);
    			append_dev(div1, t4);
    			append_dev(div1, input1);
    			set_input_value(input1, /*path*/ ctx[14].controlPoints[/*i*/ ctx[66]].y);
    			append_dev(div2, t5);
    			if (if_block) if_block.m(div2, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", input0_input_handler_1),
    					listen_dev(input0, "input", input_handler_3, false, false, false, false),
    					listen_dev(input1, "input", input1_input_handler_1),
    					listen_dev(input1, "input", input_handler_4, false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*$paths*/ 32 && label0_for_value !== (label0_for_value = "control-point-" + /*path*/ ctx[14].id + "-" + /*i*/ ctx[66])) {
    				attr_dev(label0, "for", label0_for_value);
    			}

    			if (dirty[0] & /*$paths*/ 32 && input0_id_value !== (input0_id_value = "control-point-" + /*path*/ ctx[14].id + "-" + /*i*/ ctx[66])) {
    				attr_dev(input0, "id", input0_id_value);
    			}

    			if (dirty[0] & /*$paths*/ 32 && to_number(input0.value) !== /*path*/ ctx[14].controlPoints[/*i*/ ctx[66]].x) {
    				set_input_value(input0, /*path*/ ctx[14].controlPoints[/*i*/ ctx[66]].x);
    			}

    			if (dirty[0] & /*$paths*/ 32 && label1_for_value !== (label1_for_value = "control-point-" + /*path*/ ctx[14].id + "-" + /*i*/ ctx[66] + "-y")) {
    				attr_dev(label1, "for", label1_for_value);
    			}

    			if (dirty[0] & /*$paths*/ 32 && input1_id_value !== (input1_id_value = "control-point-" + /*path*/ ctx[14].id + "-" + /*i*/ ctx[66] + "-y")) {
    				attr_dev(input1, "id", input1_id_value);
    			}

    			if (dirty[0] & /*$paths*/ 32 && to_number(input1.value) !== /*path*/ ctx[14].controlPoints[/*i*/ ctx[66]].y) {
    				set_input_value(input1, /*path*/ ctx[14].controlPoints[/*i*/ ctx[66]].y);
    			}

    			if (/*i*/ ctx[66] > 1) if_block.p(ctx, dirty);
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
    		source: "(881:10) {#if i > 0 || path.controlPoints.length === 1}",
    		ctx
    	});

    	return block;
    }

    // (893:11) {#if (i > 1)}
    function create_if_block_2(ctx) {
    	let svg;
    	let path_1;
    	let mounted;
    	let dispose;

    	function click_handler_4() {
    		return /*click_handler_4*/ ctx[48](/*path*/ ctx[14], /*i*/ ctx[66]);
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path_1 = svg_element("path");
    			attr_dev(path_1, "d", "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z");
    			attr_dev(path_1, "class", "svelte-vq7zdm");
    			add_location(path_1, file, 893, 285, 25547);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24px");
    			attr_dev(svg, "viewBox", "0 -960 960 960");
    			attr_dev(svg, "width", "24px");
    			attr_dev(svg, "fill", "#FF474D");
    			set_style(svg, "cursor", "pointer");
    			attr_dev(svg, "class", "svelte-vq7zdm");
    			add_location(svg, file, 893, 11, 25273);
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
    		source: "(893:11) {#if (i > 1)}",
    		ctx
    	});

    	return block;
    }

    // (874:8) {#each path.controlPoints as { x, y }
    function create_each_block_1(ctx) {
    	let div;
    	let t;

    	function select_block_type(ctx, dirty) {
    		if (/*path*/ ctx[14].controlPoints.length >= 2 && /*i*/ ctx[66] > 0 && /*i*/ ctx[66] < 2) return create_if_block_3;
    		if (/*i*/ ctx[66] > 0) return create_if_block_4;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);
    	let if_block1 = (/*i*/ ctx[66] > 0 || /*path*/ ctx[14].controlPoints.length === 1) && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			attr_dev(div, "class", "control-point-box svelte-vq7zdm");
    			add_location(div, file, 874, 9, 23956);
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

    			if (/*i*/ ctx[66] > 0 || /*path*/ ctx[14].controlPoints.length === 1) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);

    			if (if_block0) {
    				if_block0.d();
    			}

    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(874:8) {#each path.controlPoints as { x, y }",
    		ctx
    	});

    	return block;
    }

    // (855:4) {#each $paths as path}
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
    	let t4_value = /*path*/ ctx[14].id + 1 + "";
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
    		return /*click_handler*/ ctx[37](/*path*/ ctx[14]);
    	}

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[38](/*path*/ ctx[14]);
    	}

    	function input_input_handler_2() {
    		/*input_input_handler_2*/ ctx[39].call(input, /*each_value*/ ctx[63], /*path_index*/ ctx[64]);
    	}

    	function input_handler_2() {
    		return /*input_handler_2*/ ctx[40](/*path*/ ctx[14]);
    	}

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[41](/*path*/ ctx[14]);
    	}

    	function click_handler_3() {
    		return /*click_handler_3*/ ctx[42](/*path*/ ctx[14]);
    	}

    	function keydown_handler(...args) {
    		return /*keydown_handler*/ ctx[43](/*path*/ ctx[14], ...args);
    	}

    	let each_value_1 = /*path*/ ctx[14].controlPoints;
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
    			attr_dev(path0, "class", "svelte-vq7zdm");
    			add_location(path0, file, 859, 534, 21602);
    			attr_dev(svg0, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg0, "height", "24px");
    			attr_dev(svg0, "viewBox", "0 -960 960 960");
    			attr_dev(svg0, "width", "24px");

    			attr_dev(svg0, "fill", svg0_fill_value = !(/*path*/ ctx[14].id == 0 || /*path*/ ctx[14].id == /*$paths*/ ctx[5].length - 1)
    			? "black"
    			: "gray");

    			set_style(svg0, "cursor", !(/*path*/ ctx[14].id == 0 || /*path*/ ctx[14].id == /*$paths*/ ctx[5].length - 1)
    			? 'pointer'
    			: 'default');

    			attr_dev(svg0, "class", "svelte-vq7zdm");
    			add_location(svg0, file, 859, 8, 21076);
    			attr_dev(path1, "d", "M440-240v-368L296-464l-56-56 240-240 240 240-56 56-144-144v368h-80Z");
    			attr_dev(path1, "class", "svelte-vq7zdm");
    			add_location(path1, file, 861, 482, 22235);
    			attr_dev(svg1, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg1, "height", "24px");
    			attr_dev(svg1, "viewBox", "0 -960 960 960");
    			attr_dev(svg1, "width", "24px");

    			attr_dev(svg1, "fill", svg1_fill_value = !(/*path*/ ctx[14].id == 0 || /*path*/ ctx[14].id == 1)
    			? "black"
    			: "gray");

    			set_style(svg1, "cursor", !(/*path*/ ctx[14].id == 0 || /*path*/ ctx[14].id == 1)
    			? 'pointer'
    			: 'default');

    			attr_dev(svg1, "class", "svelte-vq7zdm");
    			add_location(svg1, file, 861, 8, 21761);
    			attr_dev(input, "type", "color");
    			attr_dev(input, "class", "color-circle svelte-vq7zdm");
    			set_style(input, "background-color", /*path*/ ctx[14].color);
    			add_location(input, file, 862, 8, 22330);
    			attr_dev(p, "class", "path-title svelte-vq7zdm");
    			set_style(p, "user-select", "none");
    			add_location(p, file, 863, 8, 22501);
    			attr_dev(div0, "class", "path-and-color svelte-vq7zdm");
    			add_location(div0, file, 857, 7, 20972);
    			attr_dev(path2, "d", "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z");
    			attr_dev(path2, "class", "svelte-vq7zdm");
    			add_location(path2, file, 867, 276, 22967);
    			attr_dev(svg2, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg2, "height", "24px");
    			attr_dev(svg2, "viewBox", "0 -960 960 960");
    			attr_dev(svg2, "width", "24px");
    			attr_dev(svg2, "fill", svg2_fill_value = /*$paths*/ ctx[5].length > 1 ? "#FF474D" : "gray");
    			set_style(svg2, "cursor", /*$paths*/ ctx[5].length > 1 ? 'pointer' : 'default');
    			attr_dev(svg2, "class", "svelte-vq7zdm");
    			add_location(svg2, file, 867, 8, 22699);
    			attr_dev(path3, "d", "M440-280h80v-160h160v-80H520v-160h-80v160H280v80h160v160Zm40 200q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z");
    			attr_dev(path3, "class", "svelte-vq7zdm");
    			add_location(path3, file, 868, 273, 23454);
    			attr_dev(svg3, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg3, "height", "24px");
    			attr_dev(svg3, "viewBox", "0 -960 960 960");
    			attr_dev(svg3, "width", "24px");
    			attr_dev(svg3, "fill", "#90EE90");
    			set_style(svg3, "cursor", "pointer");
    			attr_dev(svg3, "class", "svelte-vq7zdm");
    			add_location(svg3, file, 868, 8, 23189);
    			attr_dev(div1, "class", "add-and-remove svelte-vq7zdm");
    			add_location(div1, file, 865, 7, 22595);
    			attr_dev(div2, "class", "path-header svelte-vq7zdm");
    			add_location(div2, file, 856, 6, 20938);
    			attr_dev(div3, "class", "path-control-points svelte-vq7zdm");
    			add_location(div3, file, 872, 7, 23861);
    			attr_dev(div4, "class", "path svelte-vq7zdm");
    			set_style(div4, "border-color", /*path*/ ctx[14].color);
    			add_location(div4, file, 855, 5, 20876);
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
    			set_input_value(input, /*path*/ ctx[14].color);
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
    					listen_dev(input, "input", input_handler_2, false, false, false, false),
    					listen_dev(svg2, "click", click_handler_2, false, false, false, false),
    					listen_dev(svg3, "click", click_handler_3, false, false, false, false),
    					listen_dev(svg3, "keydown", keydown_handler, false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*$paths*/ 32 && svg0_fill_value !== (svg0_fill_value = !(/*path*/ ctx[14].id == 0 || /*path*/ ctx[14].id == /*$paths*/ ctx[5].length - 1)
    			? "black"
    			: "gray")) {
    				attr_dev(svg0, "fill", svg0_fill_value);
    			}

    			if (dirty[0] & /*$paths*/ 32) {
    				set_style(svg0, "cursor", !(/*path*/ ctx[14].id == 0 || /*path*/ ctx[14].id == /*$paths*/ ctx[5].length - 1)
    				? 'pointer'
    				: 'default');
    			}

    			if (dirty[0] & /*$paths*/ 32 && svg1_fill_value !== (svg1_fill_value = !(/*path*/ ctx[14].id == 0 || /*path*/ ctx[14].id == 1)
    			? "black"
    			: "gray")) {
    				attr_dev(svg1, "fill", svg1_fill_value);
    			}

    			if (dirty[0] & /*$paths*/ 32) {
    				set_style(svg1, "cursor", !(/*path*/ ctx[14].id == 0 || /*path*/ ctx[14].id == 1)
    				? 'pointer'
    				: 'default');
    			}

    			if (dirty[0] & /*$paths*/ 32) {
    				set_style(input, "background-color", /*path*/ ctx[14].color);
    			}

    			if (dirty[0] & /*$paths*/ 32) {
    				set_input_value(input, /*path*/ ctx[14].color);
    			}

    			if (dirty[0] & /*$paths*/ 32 && t4_value !== (t4_value = /*path*/ ctx[14].id + 1 + "")) set_data_dev(t4, t4_value);

    			if (dirty[0] & /*$paths*/ 32 && svg2_fill_value !== (svg2_fill_value = /*$paths*/ ctx[5].length > 1 ? "#FF474D" : "gray")) {
    				attr_dev(svg2, "fill", svg2_fill_value);
    			}

    			if (dirty[0] & /*$paths*/ 32) {
    				set_style(svg2, "cursor", /*$paths*/ ctx[5].length > 1 ? 'pointer' : 'default');
    			}

    			if (dirty[0] & /*$paths, generateBezierCurve, paths*/ 98336) {
    				each_value_1 = /*path*/ ctx[14].controlPoints;
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

    			if (dirty[0] & /*$paths*/ 32) {
    				set_style(div4, "border-color", /*path*/ ctx[14].color);
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
    		source: "(855:4) {#each $paths as path}",
    		ctx
    	});

    	return block;
    }

    // (914:5) {:else}
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
    			attr_dev(path_1, "class", "svelte-vq7zdm");
    			add_location(path_1, file, 914, 134, 26581);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24px");
    			attr_dev(svg, "viewBox", "0 -960 960 960");
    			attr_dev(svg, "width", "24px");
    			attr_dev(svg, "fill", "#FF474D");
    			attr_dev(svg, "class", "svelte-vq7zdm");
    			add_location(svg, file, 914, 6, 26453);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path_1);

    			if (!mounted) {
    				dispose = listen_dev(svg, "click", /*pausePath*/ ctx[25], false, false, false, false);
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
    		source: "(914:5) {:else}",
    		ctx
    	});

    	return block;
    }

    // (912:5) {#if !isPlaying}
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
    			attr_dev(path_1, "class", "svelte-vq7zdm");
    			add_location(path_1, file, 912, 134, 26348);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "height", "24px");
    			attr_dev(svg, "viewBox", "0 -960 960 960");
    			attr_dev(svg, "width", "24px");
    			attr_dev(svg, "fill", "#90EE90");
    			attr_dev(svg, "class", "svelte-vq7zdm");
    			add_location(svg, file, 912, 7, 26221);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path_1);

    			if (!mounted) {
    				dispose = listen_dev(svg, "click", /*playPath*/ ctx[24], false, false, false, false);
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
    		source: "(912:5) {#if !isPlaying}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div20;
    	let div1;
    	let h1;
    	let t1;
    	let div0;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let div19;
    	let div15;
    	let div12;
    	let div11;
    	let div10;
    	let h20;
    	let t7;
    	let div2;
    	let label0;
    	let t9;
    	let select;
    	let option0;
    	let option1;
    	let t12;
    	let div3;
    	let label1;
    	let t14;
    	let input0;
    	let t15;
    	let div4;
    	let label2;
    	let t17;
    	let input1;
    	let t18;
    	let h21;
    	let t20;
    	let label3;
    	let t22;
    	let div7;
    	let div5;
    	let label4;
    	let t24;
    	let t25;
    	let div6;
    	let label5;
    	let t27;
    	let t28;
    	let h22;
    	let t30;
    	let div8;
    	let label6;
    	let t32;
    	let input2;
    	let t33;
    	let div9;
    	let label7;
    	let t35;
    	let input3;
    	let t36;
    	let div13;
    	let t37;
    	let t38;
    	let svg;
    	let t39;
    	let div14;
    	let t40;
    	let button2;
    	let t42;
    	let div18;
    	let div17;
    	let div16;
    	let t43;
    	let input4;
    	let mounted;
    	let dispose;
    	let if_block0 = /*$paths*/ ctx[5].length > 0 && create_if_block_7(ctx);
    	let if_block1 = /*$paths*/ ctx[5].length > 0 && create_if_block_6(ctx);
    	let each_value_3 = /*$paths*/ ctx[5];
    	validate_each_argument(each_value_3);
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks_2[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	let if_block2 = /*$paths*/ ctx[5].length > 0 && create_if_block_5(ctx);
    	let each_value_2 = /*$paths*/ ctx[5];
    	validate_each_argument(each_value_2);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value = /*$paths*/ ctx[5];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	function select_block_type_1(ctx, dirty) {
    		if (!/*isPlaying*/ ctx[3]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block3 = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div20 = element("div");
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "JPather";
    			t1 = space();
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "Import Control Points";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Export Control Points";
    			t5 = space();
    			div19 = element("div");
    			div15 = element("div");
    			div12 = element("div");
    			div11 = element("div");
    			div10 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Robot Options";
    			t7 = space();
    			div2 = element("div");
    			label0 = element("label");
    			label0.textContent = "Units:";
    			t9 = space();
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Inches";
    			option1 = element("option");
    			option1.textContent = "Centimeters";
    			t12 = space();
    			div3 = element("div");
    			label1 = element("label");
    			label1.textContent = "Robot Length:";
    			t14 = space();
    			input0 = element("input");
    			t15 = space();
    			div4 = element("div");
    			label2 = element("label");
    			label2.textContent = "Robot Width:";
    			t17 = space();
    			input1 = element("input");
    			t18 = space();
    			h21 = element("h2");
    			h21.textContent = "Field Options";
    			t20 = space();
    			label3 = element("label");
    			label3.textContent = "Starting Position:";
    			t22 = space();
    			div7 = element("div");
    			div5 = element("div");
    			label4 = element("label");
    			label4.textContent = "X:";
    			t24 = space();
    			if (if_block0) if_block0.c();
    			t25 = space();
    			div6 = element("div");
    			label5 = element("label");
    			label5.textContent = "Y:";
    			t27 = space();
    			if (if_block1) if_block1.c();
    			t28 = space();
    			h22 = element("h2");
    			h22.textContent = "Advanced Options";
    			t30 = space();
    			div8 = element("div");
    			label6 = element("label");
    			label6.textContent = "Infinite Path Looping:";
    			t32 = space();
    			input2 = element("input");
    			t33 = space();
    			div9 = element("div");
    			label7 = element("label");
    			label7.textContent = "Auto-link Paths:";
    			t35 = space();
    			input3 = element("input");
    			t36 = space();
    			div13 = element("div");

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t37 = space();
    			if (if_block2) if_block2.c();
    			t38 = space();
    			svg = svg_element("svg");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t39 = space();
    			div14 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t40 = space();
    			button2 = element("button");
    			button2.textContent = "Add Path";
    			t42 = space();
    			div18 = element("div");
    			div17 = element("div");
    			div16 = element("div");
    			if_block3.c();
    			t43 = space();
    			input4 = element("input");
    			attr_dev(h1, "class", "page-title svelte-vq7zdm");
    			add_location(h1, file, 754, 2, 16868);
    			set_style(button0, "user-select", "none");
    			attr_dev(button0, "class", "svelte-vq7zdm");
    			add_location(button0, file, 756, 3, 16939);
    			set_style(button1, "user-select", "none");
    			attr_dev(button1, "class", "svelte-vq7zdm");
    			add_location(button1, file, 757, 3, 17039);
    			attr_dev(div0, "class", "export-import svelte-vq7zdm");
    			add_location(div0, file, 755, 2, 16907);
    			attr_dev(div1, "class", "header svelte-vq7zdm");
    			add_location(div1, file, 753, 1, 16844);
    			attr_dev(h20, "class", "section-title svelte-vq7zdm");
    			set_style(h20, "user-select", "none");
    			add_location(h20, file, 767, 6, 17306);
    			attr_dev(label0, "for", "robotUnits");
    			set_style(label0, "user-select", "none");
    			attr_dev(label0, "class", "svelte-vq7zdm");
    			add_location(label0, file, 770, 7, 17422);
    			option0.__value = "inches";
    			option0.value = option0.__value;
    			attr_dev(option0, "class", "svelte-vq7zdm");
    			add_location(option0, file, 772, 8, 17580);
    			option1.__value = "cm";
    			option1.value = option1.__value;
    			attr_dev(option1, "class", "svelte-vq7zdm");
    			add_location(option1, file, 773, 8, 17628);
    			attr_dev(select, "id", "robotUnits");
    			attr_dev(select, "class", "standard-input-box svelte-vq7zdm");
    			if (/*robotUnits*/ ctx[2] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[28].call(select));
    			add_location(select, file, 771, 7, 17495);
    			attr_dev(div2, "class", "robot-options svelte-vq7zdm");
    			add_location(div2, file, 769, 6, 17386);
    			attr_dev(label1, "for", "robot-length");
    			set_style(label1, "user-select", "none");
    			attr_dev(label1, "class", "svelte-vq7zdm");
    			add_location(label1, file, 778, 7, 17745);
    			attr_dev(input0, "id", "robot-length");
    			attr_dev(input0, "class", "standard-input-box svelte-vq7zdm");
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "step", "0.01");
    			add_location(input0, file, 779, 7, 17827);
    			attr_dev(div3, "class", "robot-options svelte-vq7zdm");
    			add_location(div3, file, 777, 6, 17709);
    			attr_dev(label2, "for", "robot-width");
    			set_style(label2, "user-select", "none");
    			attr_dev(label2, "class", "svelte-vq7zdm");
    			add_location(label2, file, 783, 7, 17994);
    			attr_dev(input1, "id", "robot-width");
    			attr_dev(input1, "class", "standard-input-box svelte-vq7zdm");
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "step", "0.01");
    			add_location(input1, file, 784, 7, 18074);
    			attr_dev(div4, "class", "robot-options svelte-vq7zdm");
    			add_location(div4, file, 782, 6, 17958);
    			attr_dev(h21, "id", "field-options");
    			attr_dev(h21, "class", "section-title svelte-vq7zdm");
    			set_style(h21, "user-select", "none");
    			add_location(h21, file, 789, 6, 18213);
    			set_style(label3, "user-select", "none");
    			attr_dev(label3, "class", "svelte-vq7zdm");
    			add_location(label3, file, 792, 6, 18376);
    			attr_dev(label4, "class", "cp-x svelte-vq7zdm");
    			set_style(label4, "user-select", "none");
    			add_location(label4, file, 798, 8, 18612);
    			attr_dev(div5, "class", "control-point-mini-box-x svelte-vq7zdm");
    			add_location(div5, file, 796, 7, 18498);
    			attr_dev(label5, "class", "cp-x svelte-vq7zdm");
    			set_style(label5, "user-select", "none");
    			add_location(label5, file, 805, 8, 19006);
    			attr_dev(div6, "class", "control-point-mini-box-y svelte-vq7zdm");
    			add_location(div6, file, 803, 7, 18892);
    			attr_dev(div7, "class", "control-point-mini-box svelte-vq7zdm");
    			add_location(div7, file, 795, 6, 18453);
    			attr_dev(h22, "id", "advanced-options");
    			attr_dev(h22, "class", "section-title svelte-vq7zdm");
    			set_style(h22, "user-select", "none");
    			add_location(h22, file, 812, 6, 19302);
    			attr_dev(label6, "for", "field-length");
    			set_style(label6, "user-select", "none");
    			attr_dev(label6, "class", "svelte-vq7zdm");
    			add_location(label6, file, 814, 7, 19444);
    			attr_dev(input2, "id", "auto-link-paths");
    			attr_dev(input2, "type", "checkbox");
    			attr_dev(input2, "class", "svelte-vq7zdm");
    			add_location(input2, file, 815, 7, 19536);
    			attr_dev(div8, "class", "advanced-options svelte-vq7zdm");
    			add_location(div8, file, 813, 6, 19405);
    			attr_dev(label7, "for", "field-length");
    			set_style(label7, "user-select", "none");
    			attr_dev(label7, "class", "svelte-vq7zdm");
    			add_location(label7, file, 818, 7, 19675);
    			attr_dev(input3, "id", "auto-link-paths");
    			attr_dev(input3, "type", "checkbox");
    			attr_dev(input3, "class", "svelte-vq7zdm");
    			add_location(input3, file, 819, 7, 19760);
    			attr_dev(div9, "class", "advanced-options svelte-vq7zdm");
    			add_location(div9, file, 817, 6, 19636);
    			attr_dev(div10, "class", "svelte-vq7zdm");
    			add_location(div10, file, 766, 5, 17293);
    			attr_dev(div11, "class", "robot-options-menu svelte-vq7zdm");
    			add_location(div11, file, 765, 4, 17254);
    			attr_dev(div12, "class", "settings-column svelte-vq7zdm");
    			add_location(div12, file, 764, 3, 17219);
    			attr_dev(svg, "viewBox", "0 0 144 144");
    			attr_dev(svg, "width", "100%");
    			attr_dev(svg, "height", "100%");
    			set_style(svg, "position", "absolute");
    			set_style(svg, "top", "0");
    			set_style(svg, "left", "0");
    			attr_dev(svg, "class", "svelte-vq7zdm");
    			add_location(svg, file, 840, 5, 20450);
    			attr_dev(div13, "class", "field svelte-vq7zdm");
    			add_location(div13, file, 825, 3, 19892);
    			set_style(button2, "user-select", "none");
    			attr_dev(button2, "class", "svelte-vq7zdm");
    			add_location(button2, file, 903, 4, 25895);
    			attr_dev(div14, "class", "paths svelte-vq7zdm");
    			add_location(div14, file, 853, 3, 20822);
    			attr_dev(div15, "class", "container svelte-vq7zdm");
    			add_location(div15, file, 763, 2, 17191);
    			attr_dev(div16, "class", "play-button svelte-vq7zdm");
    			add_location(div16, file, 909, 4, 26101);
    			attr_dev(input4, "type", "range");
    			attr_dev(input4, "id", "scrub");
    			attr_dev(input4, "min", "0");
    			attr_dev(input4, "max", "100");
    			attr_dev(input4, "step", "0.001");
    			attr_dev(input4, "class", "svelte-vq7zdm");
    			add_location(input4, file, 918, 4, 26765);
    			attr_dev(div17, "class", "scrubbing-bar svelte-vq7zdm");
    			add_location(div17, file, 908, 3, 26068);
    			attr_dev(div18, "class", "footer svelte-vq7zdm");
    			add_location(div18, file, 907, 2, 26043);
    			attr_dev(div19, "class", "main-content svelte-vq7zdm");
    			add_location(div19, file, 761, 1, 17158);
    			attr_dev(div20, "class", "svelte-vq7zdm");
    			add_location(div20, file, 752, 0, 16836);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div20, anchor);
    			append_dev(div20, div1);
    			append_dev(div1, h1);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, button0);
    			append_dev(div0, t3);
    			append_dev(div0, button1);
    			append_dev(div20, t5);
    			append_dev(div20, div19);
    			append_dev(div19, div15);
    			append_dev(div15, div12);
    			append_dev(div12, div11);
    			append_dev(div11, div10);
    			append_dev(div10, h20);
    			append_dev(div10, t7);
    			append_dev(div10, div2);
    			append_dev(div2, label0);
    			append_dev(div2, t9);
    			append_dev(div2, select);
    			append_dev(select, option0);
    			append_dev(select, option1);
    			select_option(select, /*robotUnits*/ ctx[2], true);
    			append_dev(div10, t12);
    			append_dev(div10, div3);
    			append_dev(div3, label1);
    			append_dev(div3, t14);
    			append_dev(div3, input0);
    			set_input_value(input0, /*displayLength*/ ctx[0]);
    			append_dev(div10, t15);
    			append_dev(div10, div4);
    			append_dev(div4, label2);
    			append_dev(div4, t17);
    			append_dev(div4, input1);
    			set_input_value(input1, /*displayWidth*/ ctx[1]);
    			append_dev(div10, t18);
    			append_dev(div10, h21);
    			append_dev(div10, t20);
    			append_dev(div10, label3);
    			append_dev(div10, t22);
    			append_dev(div10, div7);
    			append_dev(div7, div5);
    			append_dev(div5, label4);
    			append_dev(div5, t24);
    			if (if_block0) if_block0.m(div5, null);
    			append_dev(div7, t25);
    			append_dev(div7, div6);
    			append_dev(div6, label5);
    			append_dev(div6, t27);
    			if (if_block1) if_block1.m(div6, null);
    			append_dev(div10, t28);
    			append_dev(div10, h22);
    			append_dev(div10, t30);
    			append_dev(div10, div8);
    			append_dev(div8, label6);
    			append_dev(div8, t32);
    			append_dev(div8, input2);
    			input2.checked = /*shouldRepeatPath*/ ctx[10];
    			append_dev(div10, t33);
    			append_dev(div10, div9);
    			append_dev(div9, label7);
    			append_dev(div9, t35);
    			append_dev(div9, input3);
    			input3.checked = /*autoLinkPaths*/ ctx[11];
    			append_dev(div15, t36);
    			append_dev(div15, div13);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				if (each_blocks_2[i]) {
    					each_blocks_2[i].m(div13, null);
    				}
    			}

    			append_dev(div13, t37);
    			if (if_block2) if_block2.m(div13, null);
    			append_dev(div13, t38);
    			append_dev(div13, svg);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(svg, null);
    				}
    			}

    			append_dev(div15, t39);
    			append_dev(div15, div14);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div14, null);
    				}
    			}

    			append_dev(div14, t40);
    			append_dev(div14, button2);
    			append_dev(div19, t42);
    			append_dev(div19, div18);
    			append_dev(div18, div17);
    			append_dev(div17, div16);
    			if_block3.m(div16, null);
    			append_dev(div17, t43);
    			append_dev(div17, input4);
    			set_input_value(input4, /*linearScrubValue*/ ctx[4]);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*importControlPoints*/ ctx[18], false, false, false, false),
    					listen_dev(button1, "click", /*exportControlPoints*/ ctx[17], false, false, false, false),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[28]),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[29]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[30]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[35]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[36]),
    					listen_dev(button2, "click", /*click_handler_5*/ ctx[49], false, false, false, false),
    					listen_dev(input4, "change", /*input4_change_input_handler*/ ctx[50]),
    					listen_dev(input4, "input", /*input4_change_input_handler*/ ctx[50]),
    					listen_dev(input4, "input", /*updateRobotPosition*/ ctx[23], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*robotUnits*/ 4) {
    				select_option(select, /*robotUnits*/ ctx[2]);
    			}

    			if (dirty[0] & /*displayLength*/ 1 && to_number(input0.value) !== /*displayLength*/ ctx[0]) {
    				set_input_value(input0, /*displayLength*/ ctx[0]);
    			}

    			if (dirty[0] & /*displayWidth*/ 2 && to_number(input1.value) !== /*displayWidth*/ ctx[1]) {
    				set_input_value(input1, /*displayWidth*/ ctx[1]);
    			}

    			if (/*$paths*/ ctx[5].length > 0) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_7(ctx);
    					if_block0.c();
    					if_block0.m(div5, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*$paths*/ ctx[5].length > 0) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_6(ctx);
    					if_block1.c();
    					if_block1.m(div6, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty[0] & /*shouldRepeatPath*/ 1024) {
    				input2.checked = /*shouldRepeatPath*/ ctx[10];
    			}

    			if (dirty[0] & /*autoLinkPaths*/ 2048) {
    				input3.checked = /*autoLinkPaths*/ ctx[11];
    			}

    			if (dirty[0] & /*$paths*/ 32) {
    				each_value_3 = /*$paths*/ ctx[5];
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_2[i] = create_each_block_3(child_ctx);
    						each_blocks_2[i].c();
    						each_blocks_2[i].m(div13, t37);
    					}
    				}

    				for (; i < each_blocks_2.length; i += 1) {
    					each_blocks_2[i].d(1);
    				}

    				each_blocks_2.length = each_value_3.length;
    			}

    			if (/*$paths*/ ctx[5].length > 0) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_5(ctx);
    					if_block2.c();
    					if_block2.m(div13, t38);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (dirty[0] & /*$paths*/ 32) {
    				each_value_2 = /*$paths*/ ctx[5];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_2(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(svg, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_2.length;
    			}

    			if (dirty[0] & /*$paths, generateBezierCurve, paths, addControlPointToPath, x, y, deletePath, updatePathColor, checkAutoLinkControlPoints*/ 74559520) {
    				each_value = /*$paths*/ ctx[5];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div14, t40);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block3) {
    				if_block3.p(ctx, dirty);
    			} else {
    				if_block3.d(1);
    				if_block3 = current_block_type(ctx);

    				if (if_block3) {
    					if_block3.c();
    					if_block3.m(div16, null);
    				}
    			}

    			if (dirty[0] & /*linearScrubValue*/ 16) {
    				set_input_value(input4, /*linearScrubValue*/ ctx[4]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div20);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			destroy_each(each_blocks_2, detaching);
    			if (if_block2) if_block2.d();
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			if_block3.d();
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

    const func = point => `${point.x},${144 - point.y}`;

    function instance($$self, $$props, $$invalidate) {
    	let animTime;
    	let $paths;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let controlPoints = writable([]);
    	let paths = writable([]);
    	validate_store(paths, 'paths');
    	component_subscribe($$self, paths, value => $$invalidate(5, $paths = value));
    	let x = 0;
    	let y = 0;
    	let displayLength = 18;
    	let displayWidth = 18;
    	let robotLength = 18;
    	let robotWidth = 18;
    	let robotUnits = 'inches';

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
    			color: path.color
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
    				color: getRandomBrightColor()
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

    	function addControlPointToPath(pathId) {
    		paths.update(paths => {
    			const path = paths.find(p => p.id === pathId);

    			if (path) {
    				const angle = Math.random() * 2 * Math.PI;
    				const distance = 50;
    				$$invalidate(12, x = 72 + Math.cos(angle) * distance);
    				$$invalidate(13, y = 72 + Math.sin(angle) * distance);
    				path.controlPoints.splice(path.controlPoints.length - 1, 0, { x, y });
    				path.bezierCurvePoints = calculateBezier(path.controlPoints, 100);
    			}

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

    			return updatedPaths;
    		});
    	}

    	let scrubValue = 0;
    	let robotX = 12;
    	let robotY = 96;

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
    					$$invalidate(8, robotX = point.x);
    					$$invalidate(9, robotY = point.y);
    				}

    				break;
    			}

    			accumulatedPoints += path.bezierCurvePoints.length;
    		}
    	}

    	let isPlaying = false;
    	let wasPaused = false;
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

    	function playPath() {
    		if (isPlaying) return;
    		$$invalidate(3, isPlaying = true);

    		currentPathIndex = isStartingFromBeginning
    		? 0
    		: Math.floor(scrubValue / 100 * $paths.length);

    		pathStartTime = Date.now() - (isStartingFromBeginning
    		? 0
    		: scrubValue % (100 / $paths.length) / 100 * animTime * 1000);

    		if (wasPaused) {
    			pathStartTime = Date.now() - progress * pathAnimTime * 1000;
    		}

    		intervalId = setInterval(
    			() => {
    				elapsedTime = (Date.now() - pathStartTime) / 1000;
    				$$invalidate(14, path = $paths[currentPathIndex]);
    				pathAnimTime = animTime / $paths.length;
    				progress = elapsedTime / pathAnimTime;
    				$$invalidate(4, linearScrubValue = (currentPathIndex + progress) / $paths.length * 100);

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
    							currentPathIndex = 0;
    						} else {
    							pausePath();
    						}
    					} else {
    						currentPathIndex++;
    					}

    					pathStartTime = Date.now();
    				}
    			},
    			animInterval
    		);
    	}

    	function pausePath() {
    		$$invalidate(3, isPlaying = false);

    		if (intervalId) {
    			clearInterval(intervalId);
    			intervalId = null;
    		}

    		$$invalidate(27, wasPaused = true);
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
    				const newX = newMouseX / rect.width * 144;
    				const newY = 144 - newMouseY / rect.height * 144;

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

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		robotUnits = select_value(this);
    		$$invalidate(2, robotUnits);
    	}

    	function input0_input_handler() {
    		displayLength = to_number(this.value);
    		$$invalidate(0, displayLength);
    	}

    	function input1_input_handler() {
    		displayWidth = to_number(this.value);
    		$$invalidate(1, displayWidth);
    	}

    	function input_input_handler() {
    		$paths[0].controlPoints[0].x = to_number(this.value);
    		paths.set($paths);
    	}

    	const input_handler = () => updateRobotPosition();

    	function input_input_handler_1() {
    		$paths[0].controlPoints[0].y = to_number(this.value);
    		paths.set($paths);
    	}

    	const input_handler_1 = () => updateRobotPosition();

    	function input2_change_handler() {
    		shouldRepeatPath = this.checked;
    		$$invalidate(10, shouldRepeatPath);
    	}

    	function input3_change_handler() {
    		autoLinkPaths = this.checked;
    		$$invalidate(11, autoLinkPaths);
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

    	const input_handler_2 = path => updatePathColor(path.id, path.color);

    	const click_handler_2 = path => {
    		if ($paths.length > 1) deletePath(path.id);
    	};

    	const click_handler_3 = path => addControlPointToPath(path.id);

    	const keydown_handler = (path, e) => {
    		if (e.key === 'Enter') addControlPointToPath(path.id);
    	};

    	function input0_input_handler_1(i, each_value, path_index) {
    		each_value[path_index].controlPoints[i].x = to_number(this.value);
    		paths.set($paths);
    	}

    	const input_handler_3 = path => generateBezierCurve(path.id);

    	function input1_input_handler_1(i, each_value, path_index) {
    		each_value[path_index].controlPoints[i].y = to_number(this.value);
    		paths.set($paths);
    	}

    	const input_handler_4 = path => generateBezierCurve(path.id);

    	const click_handler_4 = (path, i) => {
    		if (path.controlPoints.length > 2) {
    			path.controlPoints.splice(i, 1);
    			generateBezierCurve(path.id);
    			paths.set($paths);
    		}
    	};

    	const click_handler_5 = () => {
    		addPath();
    		generateBezierCurve($paths.length - 1);
    	};

    	function input4_change_input_handler() {
    		linearScrubValue = to_number(this.value);
    		$$invalidate(4, linearScrubValue);
    	}

    	$$self.$capture_state = () => ({
    		linear: identity,
    		writable,
    		controlPoints,
    		paths,
    		x,
    		y,
    		displayLength,
    		displayWidth,
    		robotLength,
    		robotWidth,
    		robotUnits,
    		getRandomBrightColor,
    		generateBezierCurve,
    		calculateBezier,
    		deCasteljau,
    		exportControlPoints,
    		importControlPoints,
    		addPath,
    		addControlPointToPath,
    		updatePathColor,
    		deletePath,
    		scrubValue,
    		robotX,
    		robotY,
    		updateRobotPosition,
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
    		playPath,
    		pausePath,
    		autoLinkPaths,
    		checkAutoLinkControlPoints,
    		animTime,
    		$paths
    	});

    	$$self.$inject_state = $$props => {
    		if ('controlPoints' in $$props) controlPoints = $$props.controlPoints;
    		if ('paths' in $$props) $$invalidate(15, paths = $$props.paths);
    		if ('x' in $$props) $$invalidate(12, x = $$props.x);
    		if ('y' in $$props) $$invalidate(13, y = $$props.y);
    		if ('displayLength' in $$props) $$invalidate(0, displayLength = $$props.displayLength);
    		if ('displayWidth' in $$props) $$invalidate(1, displayWidth = $$props.displayWidth);
    		if ('robotLength' in $$props) $$invalidate(6, robotLength = $$props.robotLength);
    		if ('robotWidth' in $$props) $$invalidate(7, robotWidth = $$props.robotWidth);
    		if ('robotUnits' in $$props) $$invalidate(2, robotUnits = $$props.robotUnits);
    		if ('scrubValue' in $$props) scrubValue = $$props.scrubValue;
    		if ('robotX' in $$props) $$invalidate(8, robotX = $$props.robotX);
    		if ('robotY' in $$props) $$invalidate(9, robotY = $$props.robotY);
    		if ('isPlaying' in $$props) $$invalidate(3, isPlaying = $$props.isPlaying);
    		if ('wasPaused' in $$props) $$invalidate(27, wasPaused = $$props.wasPaused);
    		if ('isStartingFromBeginning' in $$props) isStartingFromBeginning = $$props.isStartingFromBeginning;
    		if ('intervalId' in $$props) intervalId = $$props.intervalId;
    		if ('animInterval' in $$props) $$invalidate(61, animInterval = $$props.animInterval);
    		if ('progress' in $$props) progress = $$props.progress;
    		if ('elapsedTime' in $$props) elapsedTime = $$props.elapsedTime;
    		if ('path' in $$props) $$invalidate(14, path = $$props.path);
    		if ('pathAnimTime' in $$props) pathAnimTime = $$props.pathAnimTime;
    		if ('linearScrubValue' in $$props) $$invalidate(4, linearScrubValue = $$props.linearScrubValue);
    		if ('motionBlurAmount' in $$props) $$invalidate(62, motionBlurAmount = $$props.motionBlurAmount);
    		if ('currentPathIndex' in $$props) currentPathIndex = $$props.currentPathIndex;
    		if ('pathStartTime' in $$props) pathStartTime = $$props.pathStartTime;
    		if ('shouldRepeatPath' in $$props) $$invalidate(10, shouldRepeatPath = $$props.shouldRepeatPath);
    		if ('autoLinkPaths' in $$props) $$invalidate(11, autoLinkPaths = $$props.autoLinkPaths);
    		if ('animTime' in $$props) animTime = $$props.animTime;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*robotUnits, displayLength, displayWidth*/ 7) {
    			{
    				const conversionFactor = robotUnits === 'inches' ? 1 : 2.54;
    				$$invalidate(6, robotLength = displayLength / conversionFactor);
    				$$invalidate(7, robotWidth = displayWidth / conversionFactor);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*$paths*/ 32) {
    			animTime = 1.56 * $paths.length;
    		}

    		if ($$self.$$.dirty[0] & /*isPlaying, wasPaused, $paths, linearScrubValue*/ 134217784) {
    			{
    				if (!isPlaying && wasPaused) {
    					const totalPaths = $paths.length;
    					const pathIndex = Math.floor(linearScrubValue / 100 * totalPaths);
    					const pathProgress = linearScrubValue / 100 * totalPaths - pathIndex;

    					const adjustedProgress = pathProgress < 0.5
    					? 2 * pathProgress * pathProgress
    					: -1 + (4 - 2 * pathProgress) * pathProgress;

    					scrubValue = (pathIndex + adjustedProgress) / totalPaths * 100;
    					currentPathIndex = pathIndex;
    					progress = adjustedProgress;
    					updateRobotPosition();
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*isPlaying*/ 8) {
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
    	};

    	{
    		checkAutoLinkControlPoints();
    		updateRobotPosition();
    		generateBezierCurve(1);
    	}

    	return [
    		displayLength,
    		displayWidth,
    		robotUnits,
    		isPlaying,
    		linearScrubValue,
    		$paths,
    		robotLength,
    		robotWidth,
    		robotX,
    		robotY,
    		shouldRepeatPath,
    		autoLinkPaths,
    		x,
    		y,
    		path,
    		paths,
    		generateBezierCurve,
    		exportControlPoints,
    		importControlPoints,
    		addPath,
    		addControlPointToPath,
    		updatePathColor,
    		deletePath,
    		updateRobotPosition,
    		playPath,
    		pausePath,
    		checkAutoLinkControlPoints,
    		wasPaused,
    		select_change_handler,
    		input0_input_handler,
    		input1_input_handler,
    		input_input_handler,
    		input_handler,
    		input_input_handler_1,
    		input_handler_1,
    		input2_change_handler,
    		input3_change_handler,
    		click_handler,
    		click_handler_1,
    		input_input_handler_2,
    		input_handler_2,
    		click_handler_2,
    		click_handler_3,
    		keydown_handler,
    		input0_input_handler_1,
    		input_handler_3,
    		input1_input_handler_1,
    		input_handler_4,
    		click_handler_4,
    		click_handler_5,
    		input4_change_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, null, [-1, -1, -1]);

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
