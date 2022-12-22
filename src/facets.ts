//facet$name - protected
//facet_name - public

import { Descriptor, facet, fn } from "./compiler.js";

interface bundle<T> {
	[key: string | symbol]: T
}

export const base: bundle<facet> = {
	var(this: Descriptor) {
		this.configurable = true;
		this.enumerable = true;
		this.writable = true;
		this.value = this.expr;
		this.define = function(object) {
			return Reflect.defineProperty(object, this.name, this);
		}
	},
	const(this: Descriptor) {
		this.configurable = true;
		this.enumerable = true;
		this.value = this.expr;
		this.define = function(object) {
			return Reflect.defineProperty(object, this.name, this);
		}
	},
	//supports re-definition of a property via a "set once" mechanism.
	//May be required for frozen prototypes.
	oncevar(this: Descriptor) {
		this.configurable = true;
		this.enumerable = true;
		this.get = function getVar() {
			return this.expr;
		}
		this.set = function setVar(value) {
			Reflect.defineProperty(this, this.name, {
				configurable: true,
				enumerable: true,
				writable: true,
				value: value
			});
		}
		this.define = function(object) {
			return Reflect.defineProperty(object, this.name, this);
		}
	},
	get(this: Descriptor) {
		this.configurable = true;
		this.enumerable = true;
		if (typeof this.expr == "function") {
			this.get = this.expr as () => unknown;				
		} else {
			console.warn("get facet requires a function. Creating a value property instead.");
			this.value = this.expr;
		}
		this.define = function(object) {
			return Reflect.defineProperty(object, this.name, this);
		}
		return this;
	},
	virtual(this: Descriptor) {
		this.configurable = true;
		this.enumerable = true;
		if (typeof this.expr == "function") {
			//uses the same function for get & set. The arguments is inspected to determine how it was called.
			this.get = this.expr as fn;
			this.set = this.expr as fn;
		} else {
			console.warn("virtual facet requires a function. Creating a value property instead.");
			this.value = this.expr;
		}
		this.define = function(object) {
			return Reflect.defineProperty(object, this.name, this);
		}
		return this;
	},
	once(this: Descriptor) {
		this.configurable = true;
		const source = this.expr as fn;
		if (typeof source != "function") {
			console.error("once facet requires a function. Creating a value property instead.");
		}
		this.set = function setOnce(value) {
			Reflect.defineProperty(this, this.name, {
				configurable: true,
				enumerable: true,
				writable: true,
				value: value
			});
		}
		this.get = function getOnce() {
			//sys2 rollout 
			if (this[Symbol["status"]]) {
				console.error("once$ called during compile.");
				return;
			}
			let value = source.call(this);
			this.set.call(this, value);
			return value;
		};
		this.define = function(object) {
			return Reflect.defineProperty(object, this.name, this);
		}
	},
	/** 
	 * Extends a prototype's object property and the declared object.

	 */
	extend(this: Descriptor) {
		if (typeof this.expr != "object") console.error("extend facet requires an object or array expression.");
		this.define = function(object) {
			let ext = Object.create(object[this.name] || null);
			for (let name in this.expr) {
				let expr = this.expr[name];
				if (typeof expr == "function" && !expr.$super && typeof ext[name] == "function") {
					expr.$super = ext[name];
				}
				ext[name] = expr;
			}
			return Reflect.defineProperty(object, this.name, {
				value: ext
			});
		}
	}
}

	// type(this: Descriptor) {
	// 	let this = new Descriptor(name, expr, facetName);
	// 	if (typeof this.expr != "string") {
	// 		throw new Error("type facet requires a string.");
	// 	}
	// 	let sys = this;
	// 	this.configurable = true;
	// 	this.enumerable = true;
	// 	this.get = function getType() {
	// 		try {
	// 			return sys.forName(this.expr)
	// 		}	
	// 		catch (error) {
	// 			//TODO add back:this.pathname 
	// 			throw new Error(`In ${this.name}: ${error.message}`);
	// 		}
	// 	}
	// 	this.define = function(object) {
	// 		return Reflect.defineProperty(object, this.name, this);
	// 	}
	// },
	// symbol(this: Descriptor) {
	// 	let this = new Descriptor(name, expr, facetName);
	// 	this.symbol = this.symbolOf(this.name);
	// 	if (!this.symbol) throw new Error(`Symbol "${this.name}" is not defined.`);
	// 	this.configurable = true;
	// 	this.value = this.expr;
	// 	this.define = function(object) {
	// 		delete object[this.name];
	// 		return Reflect.defineProperty(object, this.symbol, this);
	// 	}
	// }
