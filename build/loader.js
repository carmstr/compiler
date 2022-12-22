import { createCompiler } from "./compiler.js";
export class Loader {
    constructor(facets) {
        this.#compile = createCompiler(facets);
        this.#files = Object.create(null);
    }
    #files;
    #compile;
    async compile(source, name) {
        source[Symbol.toStringTag] = name || "";
        this.parse(source);
        for (let name in this.#files) {
            let file = this.#files[name];
            if (file.endsWith(".json")) {
                fetch(this.#files[name])
                    .then(response => response.json())
                    .then(data => this.receive(source, name, data));
            }
            else {
                import(this.#files[name])
                    .then(file => this.receive(source, name, file));
            }
        }
        console.log("done");
    }
    parse(source) {
        for (let decl in source) {
            let index = decl.indexOf("$");
            if (index) {
                let facet = decl.substring(0, index);
                if (facet == "use") {
                    let name = decl.substring(index + 1);
                    let uri = source[decl];
                    this.#files[name] = uri;
                }
            }
        }
    }
    receive(source, name, module) {
        console.debug("receive", name, module);
        source[name] = module; //the use$name: source becomes name: source.
        delete source["use$" + name];
        delete this.#files[name];
        if (!Object.keys(this.#files).length)
            this.finish(source);
    }
    finish(source) {
        if (typeof source == "object")
            source = this.#compile(source, source[Symbol.toStringTag]);
    }
}
//# sourceMappingURL=loader.js.map