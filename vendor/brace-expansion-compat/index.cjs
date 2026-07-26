"use strict";

const core = require("brace-expansion-core");
const expand = typeof core === "function" ? core : core.expand;

// Minimatch <=3 expects the package itself to be callable, while newer
// versions use the named `expand` export. Expose both APIs over the patched
// brace-expansion implementation.
module.exports = expand;
Object.assign(module.exports, core, { expand });
