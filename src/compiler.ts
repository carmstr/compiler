export const TYPE = Symbol("type");
export type compile = (source: source, name?: string) => object;

export type facet = (descriptor: Descriptor) => void;

export class Type {
	constructor(source: source, name: string) {
		source[TYPE] = this;
		this[NAME] = "Type";
		this.id = NEXT_ID++;
		this.name = name;
		this.definedIn = source[SCOPE] ? source[SCOPE][TYPE].prototype : null;
		this.descriptors = Object.create(null);
		this.mixins = Object.create(null);

		this.prototype = Object.create(source.prototype$ || null);
		this.prototype[TYPE] = this;
		//Name the property if it has a proper name
		if (name.at(0) == name.at(0).toUpperCase()) {
			this.prototype[Symbol.toStringTag] = name;
		}
	}
	definedIn?: object;
	id: number;
	name: string;
	prototype: object;
	descriptors: bundle<Descriptor>;
	mixins: bundle<Type>;
	declare conf?: bundle<any>;

	instance() {
		return Object.create(this.prototype);
	}
	implementOn(object: object) {
		for (let name in this.descriptors) {
			let defined = this.descriptors[name].define(object);
			if (!defined) console.warn(`Could not define "${this.name}.${name}" `)
		}
		return object;
	}
}
let NEXT_ID = 1;

export interface Declaration {
	facet: string;
	name: string;
	expr: unknown;
}
export class Descriptor implements Declaration {
	constructor(facet: facet, name: string, expr: unknown) {
		this.name = name;
		this.expr = expr;
		this.facet = facet.name;
		facet.call(this);
	}
	facet: string;
	name: string;
	expr: unknown;

	configurable: boolean;
	enumerable: boolean;
	declare writable?: boolean;
	declare value?: unknown;
	declare get?: fn;
	declare set?: fn;

	define(object: object): boolean {
		return undefined;
	}
}
export type fn = (args: any) => unknown;

export function createCompiler(facets: bundle<facet>): compile {
	let factory = new Compiler(facets);
	return factory.compile.bind(factory);
}

type bundle<T> = {
	[key: string | symbol]: T
}
type source = bundle<any>;

const NAME = Symbol.toStringTag;

const SCOPE = Symbol("scope");
const STATUS = Symbol("status");

const TYPE_PROP = "type$";

class Compiler  {
	constructor(facets: bundle<facet>) {
		this.#facets = facets;
	}
	#facets: bundle<facet>;

	compile(source: source, name?: string): object {
		if (source[TYPE]) return source[TYPE].prototype;
		let type = this.compileType(source, name);
		return type.implementOn(type.prototype);
	}
	compileType(source: source, name: string) {
		let type = new Type(source, name);
		console.debug(`Compiling ${type.name}`, type);

		type[STATUS] = "extending";
		this.compileMixins(source);
		delete type[STATUS];

		this.compileDescriptors(source);
		return Object.freeze(type);
	}
	compileMixins(source: source) {
		let typeNames = (source[TYPE_PROP] || "").split(" ");
		for (let typeName of typeNames) {
			//handle multiple spaces
			if (typeName) try {
				this.mixin(source, typeName);
			} catch (e) {	
				throw new Error(`Compiling "${source[TYPE].name || "(unnamed)"}" implementing "${typeName}": ${e.message}`);
			}
		}
	}
	mixin(source: source, typeName: string) {
		let mixin = this.forName(source, typeName);
		if (!mixin) throw new Error(`"${typeName}" not found.`)
		let mixinType =  mixin[TYPE];
		if (mixinType[STATUS])throw new Error("Type cycle detected.");

		let type = source[TYPE];
		for (let member in mixinType.descriptors) {
			if (type.descriptors[member] === undefined) {
				type.descriptors[member] = mixinType.descriptors[member];
			}
		}
		type.mixins[typeName] = mixinType;
	}
	compileDescriptors(source: source) {
		let descriptors = source[TYPE].descriptors;
		for (let decl in source) {
			if (!decl.endsWith("$")) {
				let desc = this.createDescriptor(decl, source);
				descriptors[desc.name] = desc;
			}
		}
	}
	createDescriptor(decl: string, scope: any) {
		let [name, facet] = this.parseDeclaration(decl);
		let source = scope[decl];
		if (typeof source == "object" && Object.hasOwn(source, TYPE_PROP)) {
			source[SCOPE] = scope;
			source = this.forName(source as source, name);
		}
		return new Descriptor(facet, name, source);
	}
	parseDeclaration(decl: string): [property: string, facet: facet] {
		let index = decl.indexOf("$");
		let facetName = "";
		if (index) facetName = decl.substring(0, index);
		let ffn = this.#facets.var;
		if (facetName) {
			ffn = this.#facets[facetName];
			if (!ffn) throw new Error(`Facet "${facetName}" is not defined.`);	
		}
		return [decl.substring(index + 1), ffn];
	}
	forName(source: source, name: string) {
		for (let scope = source; scope; scope = scope[SCOPE] as source) {
			let value = scope[name];
			if (value) {
				if (value[TYPE]) return value[TYPE].prototype;
				if (Object.hasOwn(value, "type$")) {
					value[SCOPE] = scope;
					return this.compile(value, name);
				}
				return value;
			}
		}
	}
}
