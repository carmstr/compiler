export const TYPE = Symbol("type");
export class Type {
    constructor(source, name) {
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
    definedIn;
    id;
    name;
    prototype;
    descriptors;
    mixins;
    instance() {
        return Object.create(this.prototype);
    }
    implementOn(object) {
        for (let name in this.descriptors) {
            let defined = this.descriptors[name].define(object);
            if (!defined)
                console.warn(`Could not define "${this.name}.${name}" `);
        }
        return object;
    }
}
let NEXT_ID = 1;
export class Descriptor {
    constructor(facet, name, expr) {
        this.name = name;
        this.expr = expr;
        this.facet = facet.name;
        facet.call(this);
    }
    facet;
    name;
    expr;
    configurable;
    enumerable;
    define(object) {
        return undefined;
    }
}
export function createCompiler(facets) {
    let factory = new Compiler(facets);
    return factory.compile.bind(factory);
}
const NAME = Symbol.toStringTag;
const SCOPE = Symbol("scope");
const STATUS = Symbol("status");
const TYPE_PROP = "type$";
class Compiler {
    constructor(facets) {
        this.#facets = facets;
    }
    #facets;
    compile(source, name) {
        if (source[TYPE])
            return source[TYPE].prototype;
        let type = this.compileType(source, name);
        return type.implementOn(type.prototype);
    }
    compileType(source, name) {
        let type = new Type(source, name);
        console.debug(`Compiling ${type.name}`, type);
        type[STATUS] = "extending";
        this.compileMixins(source);
        delete type[STATUS];
        this.compileDescriptors(source);
        return Object.freeze(type);
    }
    compileMixins(source) {
        let typeNames = (source[TYPE_PROP] || "").split(" ");
        for (let typeName of typeNames) {
            //handle multiple spaces
            if (typeName)
                try {
                    this.mixin(source, typeName);
                }
                catch (e) {
                    throw new Error(`Compiling "${source[TYPE].name || "(unnamed)"}" implementing "${typeName}": ${e.message}`);
                }
        }
    }
    mixin(source, typeName) {
        let mixin = this.forName(source, typeName);
        if (!mixin)
            throw new Error(`"${typeName}" not found.`);
        let mixinType = mixin[TYPE];
        if (mixinType[STATUS])
            throw new Error("Type cycle detected.");
        let type = source[TYPE];
        for (let member in mixinType.descriptors) {
            if (type.descriptors[member] === undefined) {
                type.descriptors[member] = mixinType.descriptors[member];
            }
        }
        type.mixins[typeName] = mixinType;
    }
    compileDescriptors(source) {
        let descriptors = source[TYPE].descriptors;
        for (let decl in source) {
            if (!decl.endsWith("$")) {
                let desc = this.createDescriptor(decl, source);
                descriptors[desc.name] = desc;
            }
        }
    }
    createDescriptor(decl, scope) {
        let [name, facet] = this.parseDeclaration(decl);
        let source = scope[decl];
        if (typeof source == "object" && Object.hasOwn(source, TYPE_PROP)) {
            source[SCOPE] = scope;
            source = this.forName(source, name);
        }
        return new Descriptor(facet, name, source);
    }
    parseDeclaration(decl) {
        let index = decl.indexOf("$");
        let facetName = "";
        if (index)
            facetName = decl.substring(0, index);
        let ffn = this.#facets.var;
        if (facetName) {
            ffn = this.#facets[facetName];
            if (!ffn)
                throw new Error(`Facet "${facetName}" is not defined.`);
        }
        return [decl.substring(index + 1), ffn];
    }
    forName(source, name) {
        for (let scope = source; scope; scope = scope[SCOPE]) {
            let value = scope[name];
            if (value) {
                if (value[TYPE])
                    return value[TYPE].prototype;
                if (Object.hasOwn(value, "type$")) {
                    value[SCOPE] = scope;
                    return this.compile(value, name);
                }
                return value;
            }
        }
    }
}
//# sourceMappingURL=compiler.js.map