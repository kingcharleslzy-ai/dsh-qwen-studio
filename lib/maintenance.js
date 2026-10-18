import { cp, lstat, mkdir, open, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { existsSync, realpathSync, watch } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod, mod.exports), cb = null), mod.exports);
//#endregion
//#region node_modules/semver/internal/constants.js
var require_constants = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = {
		MAX_LENGTH: 256,
		MAX_SAFE_COMPONENT_LENGTH: 16,
		MAX_SAFE_BUILD_LENGTH: 250,
		MAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER || 
		/* istanbul ignore next */ 9007199254740991,
		RELEASE_TYPES: [
			"major",
			"premajor",
			"minor",
			"preminor",
			"patch",
			"prepatch",
			"prerelease"
		],
		SEMVER_SPEC_VERSION: "2.0.0",
		FLAG_INCLUDE_PRERELEASE: 1,
		FLAG_LOOSE: 2
	};
}));
//#endregion
//#region node_modules/semver/internal/debug.js
var require_debug = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {};
}));
//#endregion
//#region node_modules/semver/internal/re.js
var require_re = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { MAX_SAFE_COMPONENT_LENGTH, MAX_SAFE_BUILD_LENGTH, MAX_LENGTH } = require_constants();
	const debug = require_debug();
	exports = module.exports = {};
	const re = exports.re = [];
	const safeRe = exports.safeRe = [];
	const src = exports.src = [];
	const safeSrc = exports.safeSrc = [];
	const t = exports.t = {};
	let R = 0;
	const LETTERDASHNUMBER = "[a-zA-Z0-9-]";
	const safeRegexReplacements = [
		["\\s", 1],
		["\\d", MAX_LENGTH],
		[LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
	];
	const makeSafeRegex = (value) => {
		for (const [token, max] of safeRegexReplacements) value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
		return value;
	};
	const createToken = (name, value, isGlobal) => {
		const safe = makeSafeRegex(value);
		const index = R++;
		debug(name, index, value);
		t[name] = index;
		src[index] = value;
		safeSrc[index] = safe;
		re[index] = new RegExp(value, isGlobal ? "g" : void 0);
		safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
	};
	createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
	createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
	createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
	createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
	createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
	createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
	createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
	createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
	createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
	createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
	createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
	createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
	createToken("FULL", `^${src[t.FULLPLAIN]}$`);
	createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
	createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
	createToken("GTLT", "((?:<|>)?=?)");
	createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
	createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
	createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
	createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
	createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
	createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("COERCEPLAIN", `(^|[^\\d])(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
	createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
	createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
	createToken("COERCERTL", src[t.COERCE], true);
	createToken("COERCERTLFULL", src[t.COERCEFULL], true);
	createToken("LONETILDE", "(?:~>?)");
	createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
	exports.tildeTrimReplace = "$1~";
	createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
	createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("LONECARET", "(?:\\^)");
	createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
	exports.caretTrimReplace = "$1^";
	createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
	createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
	createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
	createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
	createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
	exports.comparatorTrimReplace = "$1$2$3";
	createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
	createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
	createToken("STAR", "(<|>)?=?\\s*\\*");
	createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
	createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
}));
//#endregion
//#region node_modules/semver/internal/parse-options.js
var require_parse_options = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const looseOption = Object.freeze({ loose: true });
	const emptyOpts = Object.freeze({});
	const parseOptions = (options) => {
		if (!options) return emptyOpts;
		if (typeof options !== "object") return looseOption;
		return options;
	};
	module.exports = parseOptions;
}));
//#endregion
//#region node_modules/semver/internal/identifiers.js
var require_identifiers = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const numeric = /^[0-9]+$/;
	const compareIdentifiers = (a, b) => {
		const anum = numeric.test(a);
		const bnum = numeric.test(b);
		if (anum && bnum) {
			a = +a;
			b = +b;
		}
		return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
	};
	const rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
	module.exports = {
		compareIdentifiers,
		rcompareIdentifiers
	};
}));
//#endregion
//#region node_modules/semver/classes/semver.js
var require_semver$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const debug = require_debug();
	const { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
	const { safeRe: re, t } = require_re();
	const parseOptions = require_parse_options();
	const { compareIdentifiers } = require_identifiers();
	module.exports = class SemVer {
		constructor(version, options) {
			options = parseOptions(options);
			if (version instanceof SemVer) {
				if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) return version;
				else version = version.version;
			} else if (typeof version !== "string") throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
			if (version.length > MAX_LENGTH) throw new TypeError(`version is longer than ${MAX_LENGTH} characters`);
			debug("SemVer", version, options);
			this.options = options;
			this.loose = !!options.loose;
			this.includePrerelease = !!options.includePrerelease;
			const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
			if (!m) throw new TypeError(`Invalid Version: ${version}`);
			this.raw = version;
			this.major = +m[1];
			this.minor = +m[2];
			this.patch = +m[3];
			if (this.major > MAX_SAFE_INTEGER || this.major < 0) throw new TypeError("Invalid major version");
			if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) throw new TypeError("Invalid minor version");
			if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) throw new TypeError("Invalid patch version");
			if (!m[4]) this.prerelease = [];
			else this.prerelease = m[4].split(".").map((id) => {
				if (/^[0-9]+$/.test(id)) {
					const num = +id;
					if (num >= 0 && num < MAX_SAFE_INTEGER) return num;
				}
				return id;
			});
			this.build = m[5] ? m[5].split(".") : [];
			this.format();
		}
		format() {
			this.version = `${this.major}.${this.minor}.${this.patch}`;
			if (this.prerelease.length) this.version += `-${this.prerelease.join(".")}`;
			return this.version;
		}
		toString() {
			return this.version;
		}
		compare(other) {
			debug("SemVer.compare", this.version, this.options, other);
			if (!(other instanceof SemVer)) {
				if (typeof other === "string" && other === this.version) return 0;
				other = new SemVer(other, this.options);
			}
			if (other.version === this.version) return 0;
			return this.compareMain(other) || this.comparePre(other);
		}
		compareMain(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			return compareIdentifiers(this.major, other.major) || compareIdentifiers(this.minor, other.minor) || compareIdentifiers(this.patch, other.patch);
		}
		comparePre(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			if (this.prerelease.length && !other.prerelease.length) return -1;
			else if (!this.prerelease.length && other.prerelease.length) return 1;
			else if (!this.prerelease.length && !other.prerelease.length) return 0;
			let i = 0;
			do {
				const a = this.prerelease[i];
				const b = other.prerelease[i];
				debug("prerelease compare", i, a, b);
				if (a === void 0 && b === void 0) return 0;
				else if (b === void 0) return 1;
				else if (a === void 0) return -1;
				else if (a === b) continue;
				else return compareIdentifiers(a, b);
			} while (++i);
		}
		compareBuild(other) {
			if (!(other instanceof SemVer)) other = new SemVer(other, this.options);
			let i = 0;
			do {
				const a = this.build[i];
				const b = other.build[i];
				debug("build compare", i, a, b);
				if (a === void 0 && b === void 0) return 0;
				else if (b === void 0) return 1;
				else if (a === void 0) return -1;
				else if (a === b) continue;
				else return compareIdentifiers(a, b);
			} while (++i);
		}
		inc(release, identifier, identifierBase) {
			if (release.startsWith("pre")) {
				if (!identifier && identifierBase === false) throw new Error("invalid increment argument: identifier is empty");
				if (identifier) {
					const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
					if (!match || match[1] !== identifier) throw new Error(`invalid identifier: ${identifier}`);
				}
			}
			switch (release) {
				case "premajor":
					this.prerelease.length = 0;
					this.patch = 0;
					this.minor = 0;
					this.major++;
					this.inc("pre", identifier, identifierBase);
					break;
				case "preminor":
					this.prerelease.length = 0;
					this.patch = 0;
					this.minor++;
					this.inc("pre", identifier, identifierBase);
					break;
				case "prepatch":
					this.prerelease.length = 0;
					this.inc("patch", identifier, identifierBase);
					this.inc("pre", identifier, identifierBase);
					break;
				case "prerelease":
					if (this.prerelease.length === 0) this.inc("patch", identifier, identifierBase);
					this.inc("pre", identifier, identifierBase);
					break;
				case "release":
					if (this.prerelease.length === 0) throw new Error(`version ${this.raw} is not a prerelease`);
					this.prerelease.length = 0;
					break;
				case "major":
					if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) this.major++;
					this.minor = 0;
					this.patch = 0;
					this.prerelease = [];
					break;
				case "minor":
					if (this.patch !== 0 || this.prerelease.length === 0) this.minor++;
					this.patch = 0;
					this.prerelease = [];
					break;
				case "patch":
					if (this.prerelease.length === 0) this.patch++;
					this.prerelease = [];
					break;
				case "pre": {
					const base = Number(identifierBase) ? 1 : 0;
					if (this.prerelease.length === 0) this.prerelease = [base];
					else {
						let i = this.prerelease.length;
						while (--i >= 0) if (typeof this.prerelease[i] === "number") {
							this.prerelease[i]++;
							i = -2;
						}
						if (i === -1) {
							if (identifier === this.prerelease.join(".") && identifierBase === false) throw new Error("invalid increment argument: identifier already exists");
							this.prerelease.push(base);
						}
					}
					if (identifier) {
						let prerelease = [identifier, base];
						if (identifierBase === false) prerelease = [identifier];
						if (compareIdentifiers(this.prerelease[0], identifier) === 0) {
							if (isNaN(this.prerelease[1])) this.prerelease = prerelease;
						} else this.prerelease = prerelease;
					}
					break;
				}
				default: throw new Error(`invalid increment argument: ${release}`);
			}
			this.raw = this.format();
			if (this.build.length) this.raw += `+${this.build.join(".")}`;
			return this;
		}
	};
}));
//#endregion
//#region node_modules/semver/functions/parse.js
var require_parse = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const parse = (version, options, throwErrors = false) => {
		if (version instanceof SemVer) return version;
		try {
			return new SemVer(version, options);
		} catch (er) {
			if (!throwErrors) return null;
			throw er;
		}
	};
	module.exports = parse;
}));
//#endregion
//#region node_modules/semver/functions/valid.js
var require_valid$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const parse = require_parse();
	const valid = (version, options) => {
		const v = parse(version, options);
		return v ? v.version : null;
	};
	module.exports = valid;
}));
//#endregion
//#region node_modules/semver/functions/clean.js
var require_clean = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const parse = require_parse();
	const clean = (version, options) => {
		const s = parse(version.trim().replace(/^[=v]+/, ""), options);
		return s ? s.version : null;
	};
	module.exports = clean;
}));
//#endregion
//#region node_modules/semver/functions/inc.js
var require_inc = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const inc = (version, release, options, identifier, identifierBase) => {
		if (typeof options === "string") {
			identifierBase = identifier;
			identifier = options;
			options = void 0;
		}
		try {
			return new SemVer(version instanceof SemVer ? version.version : version, options).inc(release, identifier, identifierBase).version;
		} catch (er) {
			return null;
		}
	};
	module.exports = inc;
}));
//#endregion
//#region node_modules/semver/functions/diff.js
var require_diff = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const parse = require_parse();
	const diff = (version1, version2) => {
		const v1 = parse(version1, null, true);
		const v2 = parse(version2, null, true);
		const comparison = v1.compare(v2);
		if (comparison === 0) return null;
		const v1Higher = comparison > 0;
		const highVersion = v1Higher ? v1 : v2;
		const lowVersion = v1Higher ? v2 : v1;
		const highHasPre = !!highVersion.prerelease.length;
		if (!!lowVersion.prerelease.length && !highHasPre) {
			if (!lowVersion.patch && !lowVersion.minor) return "major";
			if (lowVersion.compareMain(highVersion) === 0) {
				if (lowVersion.minor && !lowVersion.patch) return "minor";
				return "patch";
			}
		}
		const prefix = highHasPre ? "pre" : "";
		if (v1.major !== v2.major) return prefix + "major";
		if (v1.minor !== v2.minor) return prefix + "minor";
		if (v1.patch !== v2.patch) return prefix + "patch";
		return "prerelease";
	};
	module.exports = diff;
}));
//#endregion
//#region node_modules/semver/functions/major.js
var require_major = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const major = (a, loose) => new SemVer(a, loose).major;
	module.exports = major;
}));
//#endregion
//#region node_modules/semver/functions/minor.js
var require_minor = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const minor = (a, loose) => new SemVer(a, loose).minor;
	module.exports = minor;
}));
//#endregion
//#region node_modules/semver/functions/patch.js
var require_patch = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const patch = (a, loose) => new SemVer(a, loose).patch;
	module.exports = patch;
}));
//#endregion
//#region node_modules/semver/functions/prerelease.js
var require_prerelease = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const parse = require_parse();
	const prerelease = (version, options) => {
		const parsed = parse(version, options);
		return parsed && parsed.prerelease.length ? parsed.prerelease : null;
	};
	module.exports = prerelease;
}));
//#endregion
//#region node_modules/semver/functions/compare.js
var require_compare = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
	module.exports = compare;
}));
//#endregion
//#region node_modules/semver/functions/rcompare.js
var require_rcompare = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const rcompare = (a, b, loose) => compare(b, a, loose);
	module.exports = rcompare;
}));
//#endregion
//#region node_modules/semver/functions/compare-loose.js
var require_compare_loose = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const compareLoose = (a, b) => compare(a, b, true);
	module.exports = compareLoose;
}));
//#endregion
//#region node_modules/semver/functions/compare-build.js
var require_compare_build = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const compareBuild = (a, b, loose) => {
		const versionA = new SemVer(a, loose);
		const versionB = new SemVer(b, loose);
		return versionA.compare(versionB) || versionA.compareBuild(versionB);
	};
	module.exports = compareBuild;
}));
//#endregion
//#region node_modules/semver/functions/sort.js
var require_sort = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compareBuild = require_compare_build();
	const sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
	module.exports = sort;
}));
//#endregion
//#region node_modules/semver/functions/rsort.js
var require_rsort = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compareBuild = require_compare_build();
	const rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
	module.exports = rsort;
}));
//#endregion
//#region node_modules/semver/functions/gt.js
var require_gt = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const gt = (a, b, loose) => compare(a, b, loose) > 0;
	module.exports = gt;
}));
//#endregion
//#region node_modules/semver/functions/lt.js
var require_lt = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const lt = (a, b, loose) => compare(a, b, loose) < 0;
	module.exports = lt;
}));
//#endregion
//#region node_modules/semver/functions/eq.js
var require_eq = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const eq = (a, b, loose) => compare(a, b, loose) === 0;
	module.exports = eq;
}));
//#endregion
//#region node_modules/semver/functions/neq.js
var require_neq = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const neq = (a, b, loose) => compare(a, b, loose) !== 0;
	module.exports = neq;
}));
//#endregion
//#region node_modules/semver/functions/gte.js
var require_gte = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const gte = (a, b, loose) => compare(a, b, loose) >= 0;
	module.exports = gte;
}));
//#endregion
//#region node_modules/semver/functions/lte.js
var require_lte = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const compare = require_compare();
	const lte = (a, b, loose) => compare(a, b, loose) <= 0;
	module.exports = lte;
}));
//#endregion
//#region node_modules/semver/functions/cmp.js
var require_cmp = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const eq = require_eq();
	const neq = require_neq();
	const gt = require_gt();
	const gte = require_gte();
	const lt = require_lt();
	const lte = require_lte();
	const cmp = (a, op, b, loose) => {
		switch (op) {
			case "===":
				if (typeof a === "object") a = a.version;
				if (typeof b === "object") b = b.version;
				return a === b;
			case "!==":
				if (typeof a === "object") a = a.version;
				if (typeof b === "object") b = b.version;
				return a !== b;
			case "":
			case "=":
			case "==": return eq(a, b, loose);
			case "!=": return neq(a, b, loose);
			case ">": return gt(a, b, loose);
			case ">=": return gte(a, b, loose);
			case "<": return lt(a, b, loose);
			case "<=": return lte(a, b, loose);
			default: throw new TypeError(`Invalid operator: ${op}`);
		}
	};
	module.exports = cmp;
}));
//#endregion
//#region node_modules/semver/functions/coerce.js
var require_coerce = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const parse = require_parse();
	const { safeRe: re, t } = require_re();
	const coerce = (version, options) => {
		if (version instanceof SemVer) return version;
		if (typeof version === "number") version = String(version);
		if (typeof version !== "string") return null;
		options = options || {};
		let match = null;
		if (!options.rtl) match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
		else {
			const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
			let next;
			while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
				if (!match || next.index + next[0].length !== match.index + match[0].length) match = next;
				coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
			}
			coerceRtlRegex.lastIndex = -1;
		}
		if (match === null) return null;
		const major = match[2];
		const minor = match[3] || "0";
		const patch = match[4] || "0";
		const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
		const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
		return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
	};
	module.exports = coerce;
}));
//#endregion
//#region node_modules/semver/internal/lrucache.js
var require_lrucache = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var LRUCache = class {
		constructor() {
			this.max = 1e3;
			this.map = /* @__PURE__ */ new Map();
		}
		get(key) {
			const value = this.map.get(key);
			if (value === void 0) return;
			else {
				this.map.delete(key);
				this.map.set(key, value);
				return value;
			}
		}
		delete(key) {
			return this.map.delete(key);
		}
		set(key, value) {
			if (!this.delete(key) && value !== void 0) {
				if (this.map.size >= this.max) {
					const firstKey = this.map.keys().next().value;
					this.delete(firstKey);
				}
				this.map.set(key, value);
			}
			return this;
		}
	};
	module.exports = LRUCache;
}));
//#endregion
//#region node_modules/semver/classes/range.js
var require_range = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SPACE_CHARACTERS = /\s+/g;
	module.exports = class Range {
		constructor(range, options) {
			options = parseOptions(options);
			if (range instanceof Range) {
				if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) return range;
				else return new Range(range.raw, options);
			}
			if (range instanceof Comparator) {
				this.raw = range.value;
				this.set = [[range]];
				this.formatted = void 0;
				return this;
			}
			this.options = options;
			this.loose = !!options.loose;
			this.includePrerelease = !!options.includePrerelease;
			this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
			this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
			if (!this.set.length) throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
			if (this.set.length > 1) {
				const first = this.set[0];
				this.set = this.set.filter((c) => !isNullSet(c[0]));
				if (this.set.length === 0) this.set = [first];
				else if (this.set.length > 1) {
					for (const c of this.set) if (c.length === 1 && isAny(c[0])) {
						this.set = [c];
						break;
					}
				}
			}
			this.formatted = void 0;
		}
		get range() {
			if (this.formatted === void 0) {
				this.formatted = "";
				for (let i = 0; i < this.set.length; i++) {
					if (i > 0) this.formatted += "||";
					const comps = this.set[i];
					for (let k = 0; k < comps.length; k++) {
						if (k > 0) this.formatted += " ";
						this.formatted += comps[k].toString().trim();
					}
				}
			}
			return this.formatted;
		}
		format() {
			return this.range;
		}
		toString() {
			return this.range;
		}
		parseRange(range) {
			const memoKey = ((this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE)) + ":" + range;
			const cached = cache.get(memoKey);
			if (cached) return cached;
			const loose = this.options.loose;
			const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
			range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
			debug("hyphen replace", range);
			range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
			debug("comparator trim", range);
			range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
			debug("tilde trim", range);
			range = range.replace(re[t.CARETTRIM], caretTrimReplace);
			debug("caret trim", range);
			let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
			if (loose) rangeList = rangeList.filter((comp) => {
				debug("loose invalid filter", comp, this.options);
				return !!comp.match(re[t.COMPARATORLOOSE]);
			});
			debug("range list", rangeList);
			const rangeMap = /* @__PURE__ */ new Map();
			const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
			for (const comp of comparators) {
				if (isNullSet(comp)) return [comp];
				rangeMap.set(comp.value, comp);
			}
			if (rangeMap.size > 1 && rangeMap.has("")) rangeMap.delete("");
			const result = [...rangeMap.values()];
			cache.set(memoKey, result);
			return result;
		}
		intersects(range, options) {
			if (!(range instanceof Range)) throw new TypeError("a Range is required");
			return this.set.some((thisComparators) => {
				return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
					return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
						return rangeComparators.every((rangeComparator) => {
							return thisComparator.intersects(rangeComparator, options);
						});
					});
				});
			});
		}
		test(version) {
			if (!version) return false;
			if (typeof version === "string") try {
				version = new SemVer(version, this.options);
			} catch (er) {
				return false;
			}
			for (let i = 0; i < this.set.length; i++) if (testSet(this.set[i], version, this.options)) return true;
			return false;
		}
	};
	const cache = new (require_lrucache())();
	const parseOptions = require_parse_options();
	const Comparator = require_comparator();
	const debug = require_debug();
	const SemVer = require_semver$1();
	const { safeRe: re, t, comparatorTrimReplace, tildeTrimReplace, caretTrimReplace } = require_re();
	const { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
	const isNullSet = (c) => c.value === "<0.0.0-0";
	const isAny = (c) => c.value === "";
	const isSatisfiable = (comparators, options) => {
		let result = true;
		const remainingComparators = comparators.slice();
		let testComparator = remainingComparators.pop();
		while (result && remainingComparators.length) {
			result = remainingComparators.every((otherComparator) => {
				return testComparator.intersects(otherComparator, options);
			});
			testComparator = remainingComparators.pop();
		}
		return result;
	};
	const parseComparator = (comp, options) => {
		debug("comp", comp, options);
		comp = replaceCarets(comp, options);
		debug("caret", comp);
		comp = replaceTildes(comp, options);
		debug("tildes", comp);
		comp = replaceXRanges(comp, options);
		debug("xrange", comp);
		comp = replaceStars(comp, options);
		debug("stars", comp);
		return comp;
	};
	const isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
	const replaceTildes = (comp, options) => {
		return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
	};
	const replaceTilde = (comp, options) => {
		const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
		return comp.replace(r, (_, M, m, p, pr) => {
			debug("tilde", comp, _, M, m, p, pr);
			let ret;
			if (isX(M)) ret = "";
			else if (isX(m)) ret = `>=${M}.0.0 <${+M + 1}.0.0-0`;
			else if (isX(p)) ret = `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`;
			else if (pr) {
				debug("replaceTilde pr", pr);
				ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
			} else ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
			debug("tilde return", ret);
			return ret;
		});
	};
	const replaceCarets = (comp, options) => {
		return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
	};
	const replaceCaret = (comp, options) => {
		debug("caret", comp, options);
		const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
		const z = options.includePrerelease ? "-0" : "";
		return comp.replace(r, (_, M, m, p, pr) => {
			debug("caret", comp, _, M, m, p, pr);
			let ret;
			if (isX(M)) ret = "";
			else if (isX(m)) ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
			else if (isX(p)) {
				if (M === "0") ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
				else ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
			} else if (pr) {
				debug("replaceCaret pr", pr);
				if (M === "0") {
					if (m === "0") ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
					else ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
				} else ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
			} else {
				debug("no pr");
				if (M === "0") {
					if (m === "0") ret = `>=${M}.${m}.${p}${z} <${M}.${m}.${+p + 1}-0`;
					else ret = `>=${M}.${m}.${p}${z} <${M}.${+m + 1}.0-0`;
				} else ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
			}
			debug("caret return", ret);
			return ret;
		});
	};
	const replaceXRanges = (comp, options) => {
		debug("replaceXRanges", comp, options);
		return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
	};
	const replaceXRange = (comp, options) => {
		comp = comp.trim();
		const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
		return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
			debug("xRange", comp, ret, gtlt, M, m, p, pr);
			const xM = isX(M);
			const xm = xM || isX(m);
			const xp = xm || isX(p);
			const anyX = xp;
			if (gtlt === "=" && anyX) gtlt = "";
			pr = options.includePrerelease ? "-0" : "";
			if (xM) {
				if (gtlt === ">" || gtlt === "<") ret = "<0.0.0-0";
				else ret = "*";
			} else if (gtlt && anyX) {
				if (xm) m = 0;
				p = 0;
				if (gtlt === ">") {
					gtlt = ">=";
					if (xm) {
						M = +M + 1;
						m = 0;
						p = 0;
					} else {
						m = +m + 1;
						p = 0;
					}
				} else if (gtlt === "<=") {
					gtlt = "<";
					if (xm) M = +M + 1;
					else m = +m + 1;
				}
				if (gtlt === "<") pr = "-0";
				ret = `${gtlt + M}.${m}.${p}${pr}`;
			} else if (xm) ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
			else if (xp) ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
			debug("xRange return", ret);
			return ret;
		});
	};
	const replaceStars = (comp, options) => {
		debug("replaceStars", comp, options);
		return comp.trim().replace(re[t.STAR], "");
	};
	const replaceGTE0 = (comp, options) => {
		debug("replaceGTE0", comp, options);
		return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
	};
	const hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
		if (isX(fM)) from = "";
		else if (isX(fm)) from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
		else if (isX(fp)) from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
		else if (fpr) from = `>=${from}`;
		else from = `>=${from}${incPr ? "-0" : ""}`;
		if (isX(tM)) to = "";
		else if (isX(tm)) to = `<${+tM + 1}.0.0-0`;
		else if (isX(tp)) to = `<${tM}.${+tm + 1}.0-0`;
		else if (tpr) to = `<=${tM}.${tm}.${tp}-${tpr}`;
		else if (incPr) to = `<${tM}.${tm}.${+tp + 1}-0`;
		else to = `<=${to}`;
		return `${from} ${to}`.trim();
	};
	const testSet = (set, version, options) => {
		for (let i = 0; i < set.length; i++) if (!set[i].test(version)) return false;
		if (version.prerelease.length && !options.includePrerelease) {
			for (let i = 0; i < set.length; i++) {
				debug(set[i].semver);
				if (set[i].semver === Comparator.ANY) continue;
				if (set[i].semver.prerelease.length > 0) {
					const allowed = set[i].semver;
					if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) return true;
				}
			}
			return false;
		}
		return true;
	};
}));
//#endregion
//#region node_modules/semver/classes/comparator.js
var require_comparator = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const ANY = Symbol("SemVer ANY");
	module.exports = class Comparator {
		static get ANY() {
			return ANY;
		}
		constructor(comp, options) {
			options = parseOptions(options);
			if (comp instanceof Comparator) {
				if (comp.loose === !!options.loose) return comp;
				else comp = comp.value;
			}
			comp = comp.trim().split(/\s+/).join(" ");
			debug("comparator", comp, options);
			this.options = options;
			this.loose = !!options.loose;
			this.parse(comp);
			if (this.semver === ANY) this.value = "";
			else this.value = this.operator + this.semver.version;
			debug("comp", this);
		}
		parse(comp) {
			const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
			const m = comp.match(r);
			if (!m) throw new TypeError(`Invalid comparator: ${comp}`);
			this.operator = m[1] !== void 0 ? m[1] : "";
			if (this.operator === "=") this.operator = "";
			if (!m[2]) this.semver = ANY;
			else this.semver = new SemVer(m[2], this.options.loose);
		}
		toString() {
			return this.value;
		}
		test(version) {
			debug("Comparator.test", version, this.options.loose);
			if (this.semver === ANY || version === ANY) return true;
			if (typeof version === "string") try {
				version = new SemVer(version, this.options);
			} catch (er) {
				return false;
			}
			return cmp(version, this.operator, this.semver, this.options);
		}
		intersects(comp, options) {
			if (!(comp instanceof Comparator)) throw new TypeError("a Comparator is required");
			if (this.operator === "") {
				if (this.value === "") return true;
				return new Range(comp.value, options).test(this.value);
			} else if (comp.operator === "") {
				if (comp.value === "") return true;
				return new Range(this.value, options).test(comp.semver);
			}
			options = parseOptions(options);
			if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) return false;
			if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) return false;
			if (this.operator.startsWith(">") && comp.operator.startsWith(">")) return true;
			if (this.operator.startsWith("<") && comp.operator.startsWith("<")) return true;
			if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) return true;
			if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) return true;
			if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) return true;
			return false;
		}
	};
	const parseOptions = require_parse_options();
	const { safeRe: re, t } = require_re();
	const cmp = require_cmp();
	const debug = require_debug();
	const SemVer = require_semver$1();
	const Range = require_range();
}));
//#endregion
//#region node_modules/semver/functions/satisfies.js
var require_satisfies = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Range = require_range();
	const satisfies = (version, range, options) => {
		try {
			range = new Range(range, options);
		} catch (er) {
			return false;
		}
		return range.test(version);
	};
	module.exports = satisfies;
}));
//#endregion
//#region node_modules/semver/ranges/to-comparators.js
var require_to_comparators = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Range = require_range();
	const toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
	module.exports = toComparators;
}));
//#endregion
//#region node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const Range = require_range();
	const maxSatisfying = (versions, range, options) => {
		let max = null;
		let maxSV = null;
		let rangeObj = null;
		try {
			rangeObj = new Range(range, options);
		} catch (er) {
			return null;
		}
		versions.forEach((v) => {
			if (rangeObj.test(v)) {
				if (!max || maxSV.compare(v) === -1) {
					max = v;
					maxSV = new SemVer(max, options);
				}
			}
		});
		return max;
	};
	module.exports = maxSatisfying;
}));
//#endregion
//#region node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const Range = require_range();
	const minSatisfying = (versions, range, options) => {
		let min = null;
		let minSV = null;
		let rangeObj = null;
		try {
			rangeObj = new Range(range, options);
		} catch (er) {
			return null;
		}
		versions.forEach((v) => {
			if (rangeObj.test(v)) {
				if (!min || minSV.compare(v) === 1) {
					min = v;
					minSV = new SemVer(min, options);
				}
			}
		});
		return min;
	};
	module.exports = minSatisfying;
}));
//#endregion
//#region node_modules/semver/ranges/min-version.js
var require_min_version = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const Range = require_range();
	const gt = require_gt();
	const minVersion = (range, loose) => {
		range = new Range(range, loose);
		let minver = new SemVer("0.0.0");
		if (range.test(minver)) return minver;
		minver = new SemVer("0.0.0-0");
		if (range.test(minver)) return minver;
		minver = null;
		for (let i = 0; i < range.set.length; ++i) {
			const comparators = range.set[i];
			let setMin = null;
			comparators.forEach((comparator) => {
				const compver = new SemVer(comparator.semver.version);
				switch (comparator.operator) {
					case ">":
						if (compver.prerelease.length === 0) compver.patch++;
						else compver.prerelease.push(0);
						compver.raw = compver.format();
					case "":
					case ">=":
						if (!setMin || gt(compver, setMin)) setMin = compver;
						break;
					case "<":
					case "<=": break;
					/* istanbul ignore next */
					default: throw new Error(`Unexpected operation: ${comparator.operator}`);
				}
			});
			if (setMin && (!minver || gt(minver, setMin))) minver = setMin;
		}
		if (minver && range.test(minver)) return minver;
		return null;
	};
	module.exports = minVersion;
}));
//#endregion
//#region node_modules/semver/ranges/valid.js
var require_valid = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Range = require_range();
	const validRange = (range, options) => {
		try {
			return new Range(range, options).range || "*";
		} catch (er) {
			return null;
		}
	};
	module.exports = validRange;
}));
//#endregion
//#region node_modules/semver/ranges/outside.js
var require_outside = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const SemVer = require_semver$1();
	const Comparator = require_comparator();
	const { ANY } = Comparator;
	const Range = require_range();
	const satisfies = require_satisfies();
	const gt = require_gt();
	const lt = require_lt();
	const lte = require_lte();
	const gte = require_gte();
	const outside = (version, range, hilo, options) => {
		version = new SemVer(version, options);
		range = new Range(range, options);
		let gtfn, ltefn, ltfn, comp, ecomp;
		switch (hilo) {
			case ">":
				gtfn = gt;
				ltefn = lte;
				ltfn = lt;
				comp = ">";
				ecomp = ">=";
				break;
			case "<":
				gtfn = lt;
				ltefn = gte;
				ltfn = gt;
				comp = "<";
				ecomp = "<=";
				break;
			default: throw new TypeError("Must provide a hilo val of \"<\" or \">\"");
		}
		if (satisfies(version, range, options)) return false;
		for (let i = 0; i < range.set.length; ++i) {
			const comparators = range.set[i];
			let high = null;
			let low = null;
			comparators.forEach((comparator) => {
				if (comparator.semver === ANY) comparator = new Comparator(">=0.0.0");
				high = high || comparator;
				low = low || comparator;
				if (gtfn(comparator.semver, high.semver, options)) high = comparator;
				else if (ltfn(comparator.semver, low.semver, options)) low = comparator;
			});
			if (high.operator === comp || high.operator === ecomp) return false;
			if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) return false;
			else if (low.operator === ecomp && ltfn(version, low.semver)) return false;
		}
		return true;
	};
	module.exports = outside;
}));
//#endregion
//#region node_modules/semver/ranges/gtr.js
var require_gtr = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const outside = require_outside();
	const gtr = (version, range, options) => outside(version, range, ">", options);
	module.exports = gtr;
}));
//#endregion
//#region node_modules/semver/ranges/ltr.js
var require_ltr = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const outside = require_outside();
	const ltr = (version, range, options) => outside(version, range, "<", options);
	module.exports = ltr;
}));
//#endregion
//#region node_modules/semver/ranges/intersects.js
var require_intersects = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Range = require_range();
	const intersects = (r1, r2, options) => {
		r1 = new Range(r1, options);
		r2 = new Range(r2, options);
		return r1.intersects(r2, options);
	};
	module.exports = intersects;
}));
//#endregion
//#region node_modules/semver/ranges/simplify.js
var require_simplify = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const satisfies = require_satisfies();
	const compare = require_compare();
	module.exports = (versions, range, options) => {
		const set = [];
		let first = null;
		let prev = null;
		const v = versions.sort((a, b) => compare(a, b, options));
		for (const version of v) if (satisfies(version, range, options)) {
			prev = version;
			if (!first) first = version;
		} else {
			if (prev) set.push([first, prev]);
			prev = null;
			first = null;
		}
		if (first) set.push([first, null]);
		const ranges = [];
		for (const [min, max] of set) if (min === max) ranges.push(min);
		else if (!max && min === v[0]) ranges.push("*");
		else if (!max) ranges.push(`>=${min}`);
		else if (min === v[0]) ranges.push(`<=${max}`);
		else ranges.push(`${min} - ${max}`);
		const simplified = ranges.join(" || ");
		const original = typeof range.raw === "string" ? range.raw : String(range);
		return simplified.length < original.length ? simplified : range;
	};
}));
//#endregion
//#region node_modules/semver/ranges/subset.js
var require_subset = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Range = require_range();
	const Comparator = require_comparator();
	const { ANY } = Comparator;
	const satisfies = require_satisfies();
	const compare = require_compare();
	const subset = (sub, dom, options = {}) => {
		if (sub === dom) return true;
		sub = new Range(sub, options);
		dom = new Range(dom, options);
		let sawNonNull = false;
		OUTER: for (const simpleSub of sub.set) {
			for (const simpleDom of dom.set) {
				const isSub = simpleSubset(simpleSub, simpleDom, options);
				sawNonNull = sawNonNull || isSub !== null;
				if (isSub) continue OUTER;
			}
			if (sawNonNull) return false;
		}
		return true;
	};
	const minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
	const minimumVersion = [new Comparator(">=0.0.0")];
	const simpleSubset = (sub, dom, options) => {
		if (sub === dom) return true;
		if (sub.length === 1 && sub[0].semver === ANY) {
			if (dom.length === 1 && dom[0].semver === ANY) return true;
			else if (options.includePrerelease) sub = minimumVersionWithPreRelease;
			else sub = minimumVersion;
		}
		if (dom.length === 1 && dom[0].semver === ANY) {
			if (options.includePrerelease) return true;
			else dom = minimumVersion;
		}
		const eqSet = /* @__PURE__ */ new Set();
		let gt, lt;
		for (const c of sub) if (c.operator === ">" || c.operator === ">=") gt = higherGT(gt, c, options);
		else if (c.operator === "<" || c.operator === "<=") lt = lowerLT(lt, c, options);
		else eqSet.add(c.semver);
		if (eqSet.size > 1) return null;
		let gtltComp;
		if (gt && lt) {
			gtltComp = compare(gt.semver, lt.semver, options);
			if (gtltComp > 0) return null;
			else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) return null;
		}
		for (const eq of eqSet) {
			if (gt && !satisfies(eq, String(gt), options)) return null;
			if (lt && !satisfies(eq, String(lt), options)) return null;
			for (const c of dom) if (!satisfies(eq, String(c), options)) return false;
			return true;
		}
		let higher, lower;
		let hasDomLT, hasDomGT;
		let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
		let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
		if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) needDomLTPre = false;
		for (const c of dom) {
			hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
			hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
			if (gt) {
				if (needDomGTPre) {
					if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) needDomGTPre = false;
				}
				if (c.operator === ">" || c.operator === ">=") {
					higher = higherGT(gt, c, options);
					if (higher === c && higher !== gt) return false;
				} else if (gt.operator === ">=" && !satisfies(gt.semver, String(c), options)) return false;
			}
			if (lt) {
				if (needDomLTPre) {
					if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) needDomLTPre = false;
				}
				if (c.operator === "<" || c.operator === "<=") {
					lower = lowerLT(lt, c, options);
					if (lower === c && lower !== lt) return false;
				} else if (lt.operator === "<=" && !satisfies(lt.semver, String(c), options)) return false;
			}
			if (!c.operator && (lt || gt) && gtltComp !== 0) return false;
		}
		if (gt && hasDomLT && !lt && gtltComp !== 0) return false;
		if (lt && hasDomGT && !gt && gtltComp !== 0) return false;
		if (needDomGTPre || needDomLTPre) return false;
		return true;
	};
	const higherGT = (a, b, options) => {
		if (!a) return b;
		const comp = compare(a.semver, b.semver, options);
		return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
	};
	const lowerLT = (a, b, options) => {
		if (!a) return b;
		const comp = compare(a.semver, b.semver, options);
		return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
	};
	module.exports = subset;
}));
//#endregion
//#region lib/types/assets.js
var import_semver = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const internalRe = require_re();
	const constants = require_constants();
	const SemVer = require_semver$1();
	const identifiers = require_identifiers();
	module.exports = {
		parse: require_parse(),
		valid: require_valid$1(),
		clean: require_clean(),
		inc: require_inc(),
		diff: require_diff(),
		major: require_major(),
		minor: require_minor(),
		patch: require_patch(),
		prerelease: require_prerelease(),
		compare: require_compare(),
		rcompare: require_rcompare(),
		compareLoose: require_compare_loose(),
		compareBuild: require_compare_build(),
		sort: require_sort(),
		rsort: require_rsort(),
		gt: require_gt(),
		lt: require_lt(),
		eq: require_eq(),
		neq: require_neq(),
		gte: require_gte(),
		lte: require_lte(),
		cmp: require_cmp(),
		coerce: require_coerce(),
		Comparator: require_comparator(),
		Range: require_range(),
		satisfies: require_satisfies(),
		toComparators: require_to_comparators(),
		maxSatisfying: require_max_satisfying(),
		minSatisfying: require_min_satisfying(),
		minVersion: require_min_version(),
		validRange: require_valid(),
		outside: require_outside(),
		gtr: require_gtr(),
		ltr: require_ltr(),
		intersects: require_intersects(),
		simplifyRange: require_simplify(),
		subset: require_subset(),
		SemVer,
		re: internalRe.re,
		src: internalRe.src,
		tokens: internalRe.t,
		SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
		RELEASE_TYPES: constants.RELEASE_TYPES,
		compareIdentifiers: identifiers.compareIdentifiers,
		rcompareIdentifiers: identifiers.rcompareIdentifiers
	};
})))();
promisify(execFile);
//#endregion
//#region lib/types/shared.js
const active = (job) => [
	"queued",
	"uploading",
	"loading",
	"running",
	"saving",
	"cancelling"
].includes(job.status);
//#endregion
//#region lib/types/storage.js
const validId = (id) => /^[a-f0-9]{32}$/.test(id);
async function atomicJSON(path, value) {
	const temp = `${path}.${randomUUID()}.tmp`;
	await writeFile(temp, JSON.stringify(value, null, 2), { mode: 384 });
	await rename(temp, path);
}
function parseFlags(text) {
	const value = JSON.parse(text);
	if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("收藏记录格式错误");
	for (const [id, mark] of Object.entries(value)) if (!validId(id) || !mark || typeof mark !== "object" || Array.isArray(mark) || Object.entries(mark).some(([k, v]) => !["favorite", "archived"].includes(k) || typeof v !== "boolean")) throw Error("收藏记录格式错误");
	return value;
}
async function flags(dir) {
	try {
		return parseFlags(await readFile(join(dir, "state/gallery.json"), "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") try {
			await accessBackup(dir);
		} catch (e) {
			if (e.code === "ENOENT") return {};
			throw e;
		}
		throw Error("收藏记录无法读取，已停止写入以保护收藏。请在插件设置中恢复收藏备份；原文件保留。", { cause: error });
	}
}
async function accessBackup(dir) {
	await stat(join(dir, "state/gallery.json.bak"));
}
function jobRecord(raw, id, marks, folder) {
	return {
		id,
		worker_pid: raw.worker_pid,
		prompt: raw.prompt,
		status: raw.status,
		width: raw.width,
		height: raw.height,
		steps: raw.steps,
		sampling_steps: raw.sampling_steps,
		progress_supported: raw.progress_supported,
		phase: raw.phase,
		negative_prompt: raw.negative_prompt,
		guidance: raw.guidance,
		scheduler: raw.scheduler,
		guidance_auto_raised: raw.guidance_auto_raised,
		source_image_id: raw.source_image_id,
		reference_mode: raw.reference_mode,
		controlnet_image_id: raw.controlnet_image_id,
		controlnet_strength: raw.controlnet_strength,
		mask_image_id: raw.mask_image_id,
		lora_paths: raw.lora_paths,
		lora_scales: raw.lora_scales,
		lora_names: raw.lora_names,
		change_strength: raw.change_strength,
		seed: raw.seed,
		started_at: raw.started_at,
		step: raw.step,
		elapsed_seconds: raw.elapsed_seconds,
		error: raw.error,
		source: raw.source ?? "local",
		...marks[id],
		deleted: folder === "trash"
	};
}
async function recordAt(dir, folder, id, marks) {
	const path = join(dir, folder, id, "job.json");
	try {
		if (await realpath(path) !== path) throw Error("任务路径无效");
		return jobRecord(JSON.parse(await readFile(path, "utf8")), id, marks, folder);
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
}
/** Incremental gallery index. Terminal records are read once, then only on change.
* Recursive watches catch external worker writes; periodic reconciliation covers
* dropped/unsupported watch events. Active tasks are always read afresh. */
var GalleryIndex = class {
	dir;
	jobs = /* @__PURE__ */ new Map();
	dirty = /* @__PURE__ */ new Set();
	watchers = [];
	rescan = true;
	refreshed = 0;
	foldersKey = "";
	serial = Promise.resolve();
	metrics = {
		recordReads: 0,
		scans: 0
	};
	constructor(dir) {
		this.dir = dir;
		for (const folder of ["images", "trash"]) try {
			const watcher = watch(join(dir, folder), {
				recursive: true,
				persistent: false
			}, (_event, filename) => {
				const id = String(filename ?? "").split(/[\\/]/)[0] ?? "";
				if (validId(id)) this.dirty.add(id);
				else this.rescan = true;
			});
			watcher.on("error", () => {
				this.rescan = true;
			});
			this.watchers.push(watcher);
		} catch {}
	}
	invalidate() {
		this.rescan = true;
	}
	close() {
		this.watchers.forEach((w) => w.close());
		this.watchers = [];
	}
	read() {
		const next = this.serial.then(async () => {
			const marks = await flags(this.dir);
			const key = (await Promise.all(["images", "trash"].map(async (folder) => {
				try {
					const s = await stat(join(this.dir, folder));
					return `${s.mtimeMs}:${s.ctimeMs}`;
				} catch (e) {
					if (e.code === "ENOENT") return "missing";
					throw e;
				}
			}))).join("|");
			if (key !== this.foldersKey) this.rescan = true;
			if (this.rescan || Date.now() - this.refreshed > 3e4) {
				const present = /* @__PURE__ */ new Set();
				this.metrics.scans++;
				for (const folder of ["images", "trash"]) {
					let entries;
					try {
						entries = await readdir(join(this.dir, folder));
					} catch (e) {
						if (e.code === "ENOENT") entries = [];
						else throw e;
					}
					for (const id of entries.filter(validId)) {
						present.add(id);
						this.dirty.add(id);
					}
				}
				for (const id of this.jobs.keys()) if (!present.has(id)) this.jobs.delete(id);
				this.rescan = false;
				this.refreshed = Date.now();
				this.foldersKey = key;
			}
			for (const job of this.jobs.values()) if (active(job)) this.dirty.add(job.id);
			const pending = [...this.dirty];
			this.dirty.clear();
			for (const id of pending) {
				this.metrics.recordReads++;
				try {
					const job = await recordAt(this.dir, "images", id, {}) ?? await recordAt(this.dir, "trash", id, {});
					if (job) this.jobs.set(id, job);
					else this.jobs.delete(id);
				} catch {
					this.jobs.delete(id);
				}
			}
			return [...this.jobs.values()].map((j) => ({
				...j,
				...marks[j.id]
			})).sort((a, b) => b.started_at - a.started_at);
		});
		this.serial = next.catch(() => {});
		return next;
	}
};
const indexes = /* @__PURE__ */ new Map();
function closeGalleryIndexes() {
	for (const index of indexes.values()) index.close();
	indexes.clear();
}
async function readJobs(dir) {
	try {
		dir = await realpath(dir);
	} catch (e) {
		if (e.code === "ENOENT") return [];
		throw e;
	}
	let index = indexes.get(dir);
	if (!index) {
		if (indexes.size >= 8) {
			const oldest = indexes.keys().next().value;
			indexes.get(oldest)?.close();
			indexes.delete(oldest);
		}
		indexes.set(dir, index = new GalleryIndex(dir));
	}
	return index.read();
}
Promise.resolve();
//#endregion
//#region lib/types/updates.js
/** Verified package updates. Model/gallery/configuration files are never package payloads. */
const exec = promisify(execFile);
const REPO = "kingcharleslzy-ai/dsh-qwen-studio";
const PACKAGE = "dsh-qwen-studio";
const defaults = {
	autoCheck: true,
	autoInstall: false,
	intervalHours: 6
};
function validatePreferences(value) {
	const v = value;
	if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some((k) => !Object.hasOwn(defaults, k)) || typeof v.autoCheck !== "boolean" || typeof v.autoInstall !== "boolean" || !Number.isInteger(v.intervalHours) || v.intervalHours < 1 || v.intervalHours > 168) throw Error("更新设置无效：检查间隔为 1–168 小时，检查与安装为独立开关");
	return v;
}
function newer(a, b) {
	const parse = (v) => {
		if (!/^\d+\.\d+\.\d+$/.test(v)) throw Error("仅支持正式版版本号");
		return v.split(".").map(Number);
	};
	const x = parse(a), y = parse(b);
	for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
	return false;
}
async function json(path, fallback) {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch (e) {
		if (e.code === "ENOENT") return fallback;
		throw Error(`无法读取更新状态：${basename(path)}`, { cause: e });
	}
}
async function download(url, limit, fetcher = fetch) {
	const u = new URL(url);
	if (u.protocol !== "https:" || !["api.github.com", "github.com"].includes(u.hostname) || u.username || u.password) throw Error("更新来源无效");
	const r = await fetcher(url, {
		headers: {
			accept: "application/vnd.github+json",
			"user-agent": PACKAGE
		},
		signal: AbortSignal.timeout(9e4)
	});
	if (!r.ok) throw Error(`GitHub 更新请求失败：HTTP ${r.status}`);
	const chunks = [];
	let size = 0;
	if (!r.body) throw Error("更新响应为空");
	for await (const part of r.body) {
		size += part.length;
		if (size > limit) throw Error("更新文件超过大小限制");
		chunks.push(part);
	}
	return Buffer.concat(chunks);
}
async function latestRelease(fetcher = fetch) {
	const r = JSON.parse((await download(`https://api.github.com/repos/${REPO}/releases/latest`, 1048576, fetcher)).toString());
	if (r.draft || r.prerelease || !/^v\d+\.\d+\.\d+$/.test(r.tag_name)) throw Error("不是有效的正式发布版本");
	const version = r.tag_name.slice(1), name = `${PACKAGE}-${version}.tgz`;
	const base = `https://github.com/${REPO}/releases/download/${r.tag_name}/`;
	if (!r.assets?.some((a) => a.name === name && a.browser_download_url === base + name) || !r.assets.some((a) => a.name === "SHA256SUMS.txt" && a.browser_download_url === base + "SHA256SUMS.txt")) throw Error("发行版缺少安装包或校验文件");
	const sha256 = (await download(base + "SHA256SUMS.txt", 65536, fetcher)).toString().split(/\r?\n/).map((l) => l.trim().split(/\s+\*?/)).find((a) => a[1] === name)?.[0];
	if (!sha256 || !/^[a-f0-9]{64}$/.test(sha256)) throw Error("安装包 SHA256 无效");
	return {
		version,
		url: base + name,
		sha256
	};
}
/** Validate archive entries before extraction, rejecting links and runtime data. */
function inspectPackage(archive, expectedVersion) {
	if (!/^\d+\.\d+\.\d+$/.test(expectedVersion)) throw Error("发行版本号无效");
	const raw = gunzipSync(archive, { maxOutputLength: 10485760 }), files = /* @__PURE__ */ new Map();
	for (let at = 0; at + 512 <= raw.length;) {
		const h = raw.subarray(at, at + 512);
		if (h.every((v) => v === 0)) break;
		const str = (a, b) => h.subarray(a, b).toString().replace(/\0.*$/s, "");
		const name = (str(345, 500) ? str(345, 500) + "/" : "") + str(0, 100), kind = str(156, 157), size = parseInt(str(124, 136).trim() || "0", 8);
		const checksum = parseInt(str(148, 156).trim(), 8);
		let sum = 0;
		for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : h[i];
		if (sum !== checksum || !Number.isSafeInteger(size) || size < 0 || at + 512 + size > raw.length) throw Error("安装包归档损坏");
		if (![
			"",
			"0",
			"5"
		].includes(kind) || !name.startsWith("package/") || name.includes("\\") || name.split("/").some((p) => p === ".." || p === ".") || /^(?:package\/)?\//.test(name) || /(^|\/)(?:state|images|trash|models|node_modules|\.git|venv|\.venv)(\/|$)/.test(name)) throw Error("安装包包含不允许的路径或链接");
		if (kind !== "5") {
			if (files.has(name)) throw Error("安装包存在重复路径");
			files.set(name, raw.subarray(at + 512, at + 512 + size));
		}
		at += 512 + Math.ceil(size / 512) * 512;
	}
	const pkg = JSON.parse(files.get("package/package.json")?.toString() ?? "{}");
	if (pkg.name !== "dsh-qwen-studio" || pkg.version !== expectedVersion || pkg.repository?.url !== `git+https://github.com/kingcharleslzy-ai/dsh-qwen-studio.git` || pkg.dependencies && Object.keys(pkg.dependencies).length) throw Error("安装包身份或依赖不符合独立发行约定");
	for (const p of [
		"lib/index.js",
		"lib/client.js",
		"lib/maintenance.js",
		"backend/server.py",
		"skills/qwen-image/SKILL.md",
		"cordis.patch.yml"
	]) if (!files.has("package/" + p)) throw Error(`安装包缺少 ${p}`);
	return files;
}
function installedPaths(packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")) {
	let profile = resolve(packageRoot, "../..");
	while (basename(dirname(profile)) !== "profiles" && dirname(profile) !== profile) profile = dirname(profile);
	if (basename(packageRoot) !== "dsh-qwen-studio" || basename(dirname(packageRoot)) !== "node_modules" || basename(dirname(profile)) !== "profiles" || !existsSync(join(profile, "package.json"))) throw Error("更新只能用于 DSH profile 中的正式安装；开发源码请使用 Git 更新");
	profile = realpathSync(profile);
	const canonical = realpathSync(packageRoot);
	if (!canonical.startsWith(join(profile, "node_modules") + "/") && !canonical.startsWith(join(profile, "node_modules") + "\\")) throw Error("开发源码链接不自动覆盖，请使用正式安装包");
	return {
		packageRoot: canonical,
		profile,
		state: join(profile, "qwen-studio-updates")
	};
}
function cliCommand() {
	if (process.env.DSH_QWEN_CLI) return {
		command: process.env.DSH_QWEN_CLI,
		args: []
	};
	if (process.platform === "darwin") {
		const bundled = "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh";
		if (existsSync(bundled)) return {
			command: "/bin/sh",
			args: [bundled]
		};
	}
	return {
		command: process.platform === "win32" ? "dsh.cmd" : "dsh",
		args: []
	};
}
var PackageInstaller = class {
	run;
	paths;
	constructor(packageRoot, run = (command, args, env) => exec(command, args, {
		timeout: 18e4,
		maxBuffer: 2097152,
		windowsHide: true,
		env: {
			...process.env,
			...env
		}
	}).then(({ stdout }) => stdout)) {
		this.run = run;
		this.paths = installedPaths(packageRoot);
	}
	async invoke(tarball) {
		const profileName = basename(this.paths.profile), home = resolve(this.paths.profile, "../../");
		if (resolve(home, "profiles", profileName) !== this.paths.profile) throw Error("仅支持 DSH_HOME/profiles/<名称> 的标准安装");
		const cli = cliCommand();
		await this.run(cli.command, [
			...cli.args,
			"plugin",
			"--profile",
			profileName,
			"add",
			tarball
		], { DSH_HOME: home });
	}
	async backups() {
		const root = join(this.paths.state, "backups");
		const entries = await readdir(root).catch((e) => {
			if (e.code === "ENOENT") return [];
			throw e;
		});
		return Promise.all(entries.filter((n) => /^\d{13}-[a-f0-9-]+$/.test(n)).sort().reverse().map(async (id) => ({
			id,
			...await json(join(root, id, "manifest.json"), {})
		})));
	}
	async locked(fn) {
		await mkdir(this.paths.state, {
			recursive: true,
			mode: 448
		});
		const lock = join(this.paths.state, "install.lock");
		const fd = await open(lock, "wx", 384).catch(() => {
			throw Error("另一个安装/回滚正在进行；如进程异常退出，请确认任务停止后移除 install.lock");
		});
		await fd.writeFile(JSON.stringify({
			pid: process.pid,
			at: (/* @__PURE__ */ new Date()).toISOString()
		}));
		try {
			return await fn();
		} finally {
			await fd.close();
			await rm(lock, { force: true });
		}
	}
	async install(release, fetcher = fetch) {
		return this.locked(() => this.installUnlocked(release, fetcher));
	}
	async installUnlocked(release, fetcher = fetch) {
		const archive = await download(release.url, 5242880, fetcher);
		if (createHash("sha256").update(archive).digest("hex") !== release.sha256) throw Error("安装包校验失败，未修改安装");
		const payload = inspectPackage(archive, release.version);
		const manifest = JSON.parse(payload.get("package/package.json").toString());
		const cli = cliCommand();
		const hostVersion = (await this.run(cli.command, [...cli.args, "--version"]))?.trim();
		if (!hostVersion || !manifest.engines?.dsh || !(0, import_semver.satisfies)(hostVersion, manifest.engines.dsh, { includePrerelease: true })) throw Error("当前 DSH 版本与新版插件不兼容或版本未确认，未修改安装");
		if ((await lstat(this.paths.packageRoot)).isSymbolicLink() || await realpath(this.paths.packageRoot) !== this.paths.packageRoot) throw Error("开发链接安装不自动覆盖，请先改用正式安装包");
		const id = `${Date.now()}-${randomUUID()}`, folder = join(this.paths.state, "backups", id);
		await mkdir(folder, {
			recursive: true,
			mode: 448
		});
		const old = await json(join(this.paths.packageRoot, "package.json"), { version: "" });
		await cp(this.paths.packageRoot, join(folder, "package"), {
			recursive: true,
			filter: (source) => !["node_modules", ".git"].includes(basename(source))
		});
		const snapshotManifest = { ...old };
		snapshotManifest.scripts = { ...snapshotManifest.scripts ?? {} };
		for (const hook of [
			"prepare",
			"preinstall",
			"install",
			"postinstall",
			"prepublish",
			"prepublishOnly"
		]) delete snapshotManifest.scripts[hook];
		await atomicJSON(join(folder, "package/package.json"), snapshotManifest);
		await this.run("tar", [
			"-czf",
			join(folder, "previous.tgz"),
			"-C",
			folder,
			"package"
		]);
		await rm(join(folder, "package"), { recursive: true });
		await atomicJSON(join(folder, "manifest.json"), {
			version: old.version,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		});
		const archivePath = join(this.paths.state, `${PACKAGE}-${release.version}-${release.sha256.slice(0, 12)}.tgz`);
		await writeFile(archivePath, archive, { mode: 384 });
		try {
			await this.invoke(archivePath);
			if ((await json(join(this.paths.profile, "node_modules", "dsh-qwen-studio", "package.json"), { version: "" })).version !== release.version) throw Error("安装后的版本未确认");
		} catch (e) {
			try {
				await this.invoke(join(folder, "previous.tgz"));
			} catch {
				throw Error(`安装失败且自动回滚失败；备份 ${id} 已保留，请手动回滚`, { cause: e });
			}
			throw Error("安装失败，已重新安装原版本；备份已保留", { cause: e });
		}
		return {
			backupId: id,
			pendingVersion: release.version,
			restartRequired: true
		};
	}
	async rollback(id) {
		return this.locked(() => this.rollbackUnlocked(id));
	}
	async rollbackUnlocked(id) {
		if (!/^\d{13}-[a-f0-9-]+$/.test(id)) throw Error("备份 ID 无效");
		const folder = join(this.paths.state, "backups", id), m = await json(join(folder, "manifest.json"), { version: "" });
		if (!/^\d+\.\d+\.\d+$/.test(m.version)) throw Error("备份不存在或版本无效");
		await this.invoke(join(folder, "previous.tgz"));
		if ((await json(join(this.paths.profile, "node_modules", "dsh-qwen-studio", "package.json"), { version: "" })).version !== m.version) throw Error("回滚后的版本未确认，请检查原生安装器");
		return {
			pendingVersion: m.version,
			restartRequired: true,
			backupId: id
		};
	}
};
var UpdateController = class {
	root;
	runningVersion;
	guard;
	installer;
	latest;
	state = {};
	prefs = { ...defaults };
	timer;
	inflight;
	stopped = false;
	cachedRelease;
	constructor(root, runningVersion, guard, installer, latest = latestRelease) {
		this.root = root;
		this.runningVersion = runningVersion;
		this.guard = guard;
		this.installer = installer;
		this.latest = latest;
	}
	async init() {
		await mkdir(this.root, {
			recursive: true,
			mode: 448
		});
		this.prefs = validatePreferences(await json(join(this.root, "preferences.json"), { ...defaults }));
		this.state = await json(join(this.root, "status.json"), {});
		if (this.state.pendingVersion === this.runningVersion) await this.record({
			restartRequired: false,
			pendingVersion: "",
			hasUpdate: this.state.availableVersion ? newer(this.state.availableVersion, this.runningVersion) : false
		});
		this.schedule(3e4);
		return this.snapshot();
	}
	snapshot() {
		return {
			preferences: { ...this.prefs },
			...this.state,
			runningVersion: this.runningVersion
		};
	}
	async record(patch) {
		this.state = {
			...this.state,
			...patch
		};
		await atomicJSON(join(this.root, "status.json"), this.state);
	}
	schedule(delay = this.prefs.intervalHours * 36e5) {
		clearTimeout(this.timer);
		if (this.stopped || !this.prefs.autoCheck) return;
		this.timer = setTimeout(() => {
			this.check(true).catch(() => {}).finally(() => this.schedule(this.state.deferred ? 6e4 : void 0));
		}, delay);
		this.timer.unref?.();
	}
	stop() {
		this.stopped = true;
		clearTimeout(this.timer);
	}
	async preferences(patch) {
		const value = validatePreferences({
			...this.prefs,
			...patch
		});
		await atomicJSON(join(this.root, "preferences.json"), value);
		this.prefs = value;
		this.schedule(3e4);
		return this.snapshot();
	}
	async check(automatic = false) {
		if (this.inflight) return this.inflight;
		this.inflight = (async () => {
			try {
				if (automatic && !this.prefs.autoCheck) return this.snapshot();
				const r = automatic && this.cachedRelease && Date.now() - this.cachedRelease.at < 6e5 ? this.cachedRelease.value : await this.latest();
				this.cachedRelease = {
					at: Date.now(),
					value: r
				};
				await this.record({
					checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
					availableVersion: r.version,
					hasUpdate: newer(r.version, this.runningVersion),
					error: "",
					deferred: ""
				});
				if (automatic && !this.stopped && this.prefs.autoCheck && this.prefs.autoInstall && this.state.hasUpdate && !this.state.restartRequired) await this.installRelease(r);
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				await this.record({
					error,
					deferred: /延后|正在上传|正在工作/.test(error) ? error : ""
				});
				if (!automatic) throw e;
			}
			return this.snapshot();
		})().finally(() => {
			this.inflight = void 0;
		});
		return this.inflight;
	}
	async installRelease(r) {
		await this.guard(async () => {
			await this.record(await this.installer.install(r));
		});
	}
	async install() {
		if (this.inflight) throw Error("更新操作进行中");
		if (this.state.restartRequired) throw Error("更新已安装，请先手动重新打开 DSH");
		this.inflight = (async () => {
			try {
				const r = await this.latest();
				if (!newer(r.version, this.runningVersion)) return this.snapshot();
				await this.installRelease(r);
				return this.snapshot();
			} catch (e) {
				await this.record({ error: e instanceof Error ? e.message : String(e) });
				throw e;
			}
		})().finally(() => {
			this.inflight = void 0;
		});
		return this.inflight;
	}
	async backups() {
		return this.installer.backups();
	}
	async rollback(id) {
		if (this.inflight) throw Error("更新操作进行中");
		this.inflight = this.guard(async () => {
			await this.record(await this.installer.rollback(id));
			return this.snapshot();
		}).finally(() => {
			this.inflight = void 0;
		});
		return this.inflight;
	}
};
//#endregion
//#region lib/types/maintenance.js
async function main(args = process.argv.slice(2)) {
	const installer = new PackageInstaller(), p = installer.paths;
	const version = JSON.parse(await readFile(join(p.packageRoot, "package.json"), "utf8")).version;
	const controller = new UpdateController(p.state, version, async (fn) => {
		const raw = (await readFile(join(p.profile, "cordis.patch.yml"), "utf8").catch(() => "")).match(/^\s+localMfluxDirectory:\s*(.+)\s*$/m)?.[1]?.trim() ?? join(homedir(), ".dsh/qwen-studio");
		let directory = raw;
		if (raw.startsWith("\"")) directory = JSON.parse(raw);
		else if (raw.startsWith("'")) directory = raw.slice(1, -1).replaceAll("''", "'");
		if (directory.startsWith("~/")) directory = join(homedir(), directory.slice(2));
		if ((await readJobs(directory)).some(active)) throw Error("仍有未结束任务，请在 DSH 插件设置中维护或等任务结束");
		const r = await fetch("http://127.0.0.1:19388/health", { signal: AbortSignal.timeout(1500) }).catch(() => null);
		if (r?.ok && (await r.json()).busy) throw Error("本机仍在生图");
		return fn();
	}, installer);
	try {
		await controller.init();
		const command = args[0] ?? "status";
		let result;
		if (command === "status") result = controller.snapshot();
		else if (command === "check") result = await controller.check();
		else if (command === "install") result = await controller.install();
		else if (command === "backups") result = await controller.backups();
		else if (command === "rollback" && args[1]) result = await controller.rollback(args[1]);
		else if (command === "preferences" && args[1]) result = await controller.preferences(JSON.parse(args[1]));
		else throw Error("用法：qwen-studio-maintain status | check | install | backups | rollback <ID> | preferences <JSON>");
		process.stdout.write(JSON.stringify(result, null, 2) + "\n");
	} finally {
		controller.stop();
		closeGalleryIndexes();
	}
}
//#endregion
export { main };
