import { createRequire } from "node:module";
import { access, copyFile, cp, link, lstat, mkdir, open, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, createReadStream, existsSync, openSync, readFileSync, realpathSync, watch } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { setTimeout as setTimeout$1 } from "node:timers/promises";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import z from "@deepseek-ai/schemastery";
import { homedir } from "node:os";
import { Readable } from "node:stream";
import { BlockList, createConnection, isIP } from "node:net";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { request as request$1 } from "node:http";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod, mod.exports), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
//#endregion
//#region lib/types/gallery-snapshot.js
/** Bounded revision history supports multiple tabs without sending the full library per step. */
var GallerySnapshots = class {
	versions = /* @__PURE__ */ new Map();
	project(jobs, prior) {
		const encoded = new Map(jobs.map((j) => [j.id, JSON.stringify(j)]));
		const revision = createHash("sha256").update(JSON.stringify([...encoded])).digest("hex");
		const old = prior ? this.versions.get(prior) : void 0;
		if (!this.versions.has(revision)) {
			this.versions.set(revision, encoded);
			if (this.versions.size > 16) this.versions.delete(this.versions.keys().next().value);
		}
		if (prior === revision) return { jobsRevision: revision };
		if (!old) return {
			jobsRevision: revision,
			jobs
		};
		return {
			jobsRevision: revision,
			jobChanges: jobs.filter((j) => old.get(j.id) !== encoded.get(j.id)),
			removedJobIds: [...old.keys()].filter((id) => !encoded.has(id))
		};
	}
};
//#endregion
//#region node_modules/isexe/windows.js
var require_windows = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = isexe;
	isexe.sync = sync;
	var fs = __require("fs");
	function checkPathExt(path, options) {
		var pathext = options.pathExt !== void 0 ? options.pathExt : process.env.PATHEXT;
		if (!pathext) return true;
		pathext = pathext.split(";");
		if (pathext.indexOf("") !== -1) return true;
		for (var i = 0; i < pathext.length; i++) {
			var p = pathext[i].toLowerCase();
			if (p && path.substr(-p.length).toLowerCase() === p) return true;
		}
		return false;
	}
	function checkStat(stat, path, options) {
		if (!stat.isSymbolicLink() && !stat.isFile()) return false;
		return checkPathExt(path, options);
	}
	function isexe(path, options, cb) {
		fs.stat(path, function(er, stat) {
			cb(er, er ? false : checkStat(stat, path, options));
		});
	}
	function sync(path, options) {
		return checkStat(fs.statSync(path), path, options);
	}
}));
//#endregion
//#region node_modules/isexe/mode.js
var require_mode = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = isexe;
	isexe.sync = sync;
	var fs = __require("fs");
	function isexe(path, options, cb) {
		fs.stat(path, function(er, stat) {
			cb(er, er ? false : checkStat(stat, options));
		});
	}
	function sync(path, options) {
		return checkStat(fs.statSync(path), options);
	}
	function checkStat(stat, options) {
		return stat.isFile() && checkMode(stat, options);
	}
	function checkMode(stat, options) {
		var mod = stat.mode;
		var uid = stat.uid;
		var gid = stat.gid;
		var myUid = options.uid !== void 0 ? options.uid : process.getuid && process.getuid();
		var myGid = options.gid !== void 0 ? options.gid : process.getgid && process.getgid();
		var u = parseInt("100", 8);
		var g = parseInt("010", 8);
		var o = parseInt("001", 8);
		var ug = u | g;
		return mod & o || mod & g && gid === myGid || mod & u && uid === myUid || mod & ug && myUid === 0;
	}
}));
//#endregion
//#region node_modules/isexe/index.js
var require_isexe = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	__require("fs");
	var core;
	if (process.platform === "win32" || global.TESTING_WINDOWS) core = require_windows();
	else core = require_mode();
	module.exports = isexe;
	isexe.sync = sync;
	function isexe(path, options, cb) {
		if (typeof options === "function") {
			cb = options;
			options = {};
		}
		if (!cb) {
			if (typeof Promise !== "function") throw new TypeError("callback not provided");
			return new Promise(function(resolve, reject) {
				isexe(path, options || {}, function(er, is) {
					if (er) reject(er);
					else resolve(is);
				});
			});
		}
		core(path, options || {}, function(er, is) {
			if (er) {
				if (er.code === "EACCES" || options && options.ignoreErrors) {
					er = null;
					is = false;
				}
			}
			cb(er, is);
		});
	}
	function sync(path, options) {
		try {
			return core.sync(path, options || {});
		} catch (er) {
			if (options && options.ignoreErrors || er.code === "EACCES") return false;
			else throw er;
		}
	}
}));
//#endregion
//#region node_modules/which/which.js
var require_which = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const isWindows = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys";
	const path = __require("path");
	const COLON = isWindows ? ";" : ":";
	const isexe = require_isexe();
	const getNotFoundError = (cmd) => Object.assign(/* @__PURE__ */ new Error(`not found: ${cmd}`), { code: "ENOENT" });
	const getPathInfo = (cmd, opt) => {
		const colon = opt.colon || COLON;
		const pathEnv = cmd.match(/\//) || isWindows && cmd.match(/\\/) ? [""] : [...isWindows ? [process.cwd()] : [], ...(opt.path || process.env.PATH || 
		/* istanbul ignore next: very unusual */ "").split(colon)];
		const pathExtExe = isWindows ? opt.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "";
		const pathExt = isWindows ? pathExtExe.split(colon) : [""];
		if (isWindows) {
			if (cmd.indexOf(".") !== -1 && pathExt[0] !== "") pathExt.unshift("");
		}
		return {
			pathEnv,
			pathExt,
			pathExtExe
		};
	};
	const which = (cmd, opt, cb) => {
		if (typeof opt === "function") {
			cb = opt;
			opt = {};
		}
		if (!opt) opt = {};
		const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
		const found = [];
		const step = (i) => new Promise((resolve, reject) => {
			if (i === pathEnv.length) return opt.all && found.length ? resolve(found) : reject(getNotFoundError(cmd));
			const ppRaw = pathEnv[i];
			const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
			const pCmd = path.join(pathPart, cmd);
			const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
			resolve(subStep(p, i, 0));
		});
		const subStep = (p, i, ii) => new Promise((resolve, reject) => {
			if (ii === pathExt.length) return resolve(step(i + 1));
			const ext = pathExt[ii];
			isexe(p + ext, { pathExt: pathExtExe }, (er, is) => {
				if (!er && is) {
					if (opt.all) found.push(p + ext);
					else return resolve(p + ext);
				}
				return resolve(subStep(p, i, ii + 1));
			});
		});
		return cb ? step(0).then((res) => cb(null, res), cb) : step(0);
	};
	const whichSync = (cmd, opt) => {
		opt = opt || {};
		const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
		const found = [];
		for (let i = 0; i < pathEnv.length; i++) {
			const ppRaw = pathEnv[i];
			const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
			const pCmd = path.join(pathPart, cmd);
			const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
			for (let j = 0; j < pathExt.length; j++) {
				const cur = p + pathExt[j];
				try {
					if (isexe.sync(cur, { pathExt: pathExtExe })) {
						if (opt.all) found.push(cur);
						else return cur;
					}
				} catch (ex) {}
			}
		}
		if (opt.all && found.length) return found;
		if (opt.nothrow) return null;
		throw getNotFoundError(cmd);
	};
	module.exports = which;
	which.sync = whichSync;
}));
//#endregion
//#region node_modules/path-key/index.js
var require_path_key = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const pathKey = (options = {}) => {
		const environment = options.env || process.env;
		if ((options.platform || process.platform) !== "win32") return "PATH";
		return Object.keys(environment).reverse().find((key) => key.toUpperCase() === "PATH") || "Path";
	};
	module.exports = pathKey;
	module.exports.default = pathKey;
}));
//#endregion
//#region node_modules/cross-spawn/lib/util/resolveCommand.js
var require_resolveCommand = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const path = __require("path");
	const which = require_which();
	const getPathKey = require_path_key();
	function resolveCommandAttempt(parsed, withoutPathExt) {
		const env = parsed.options.env || process.env;
		const cwd = process.cwd();
		const hasCustomCwd = parsed.options.cwd != null;
		const shouldSwitchCwd = hasCustomCwd && process.chdir !== void 0 && !process.chdir.disabled;
		if (shouldSwitchCwd) try {
			process.chdir(parsed.options.cwd);
		} catch (err) {}
		let resolved;
		try {
			resolved = which.sync(parsed.command, {
				path: env[getPathKey({ env })],
				pathExt: withoutPathExt ? path.delimiter : void 0
			});
		} catch (e) {} finally {
			if (shouldSwitchCwd) process.chdir(cwd);
		}
		if (resolved) resolved = path.resolve(hasCustomCwd ? parsed.options.cwd : "", resolved);
		return resolved;
	}
	function resolveCommand(parsed) {
		return resolveCommandAttempt(parsed) || resolveCommandAttempt(parsed, true);
	}
	module.exports = resolveCommand;
}));
//#endregion
//#region node_modules/cross-spawn/lib/util/escape.js
var require_escape = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;
	function escapeCommand(arg) {
		arg = arg.replace(metaCharsRegExp, "^$1");
		return arg;
	}
	function escapeArgument(arg, doubleEscapeMetaChars) {
		arg = `${arg}`;
		arg = arg.replace(/(?=(\\+?)?)\1"/g, "$1$1\\\"");
		arg = arg.replace(/(?=(\\+?)?)\1$/, "$1$1");
		arg = `"${arg}"`;
		arg = arg.replace(metaCharsRegExp, "^$1");
		if (doubleEscapeMetaChars) arg = arg.replace(metaCharsRegExp, "^$1");
		return arg;
	}
	module.exports.command = escapeCommand;
	module.exports.argument = escapeArgument;
}));
//#endregion
//#region node_modules/shebang-regex/index.js
var require_shebang_regex = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = /^#!(.*)/;
}));
//#endregion
//#region node_modules/shebang-command/index.js
var require_shebang_command = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const shebangRegex = require_shebang_regex();
	module.exports = (string = "") => {
		const match = string.match(shebangRegex);
		if (!match) return null;
		const [path, argument] = match[0].replace(/#! ?/, "").split(" ");
		const binary = path.split("/").pop();
		if (binary === "env") return argument;
		return argument ? `${binary} ${argument}` : binary;
	};
}));
//#endregion
//#region node_modules/cross-spawn/lib/util/readShebang.js
var require_readShebang = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const fs = __require("fs");
	const shebangCommand = require_shebang_command();
	function readShebang(command) {
		const size = 150;
		const buffer = Buffer.alloc(size);
		let fd;
		try {
			fd = fs.openSync(command, "r");
			fs.readSync(fd, buffer, 0, size, 0);
			fs.closeSync(fd);
		} catch (e) {}
		return shebangCommand(buffer.toString());
	}
	module.exports = readShebang;
}));
//#endregion
//#region node_modules/cross-spawn/lib/parse.js
var require_parse$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const path = __require("path");
	const resolveCommand = require_resolveCommand();
	const escape = require_escape();
	const readShebang = require_readShebang();
	const isWin = process.platform === "win32";
	const isExecutableRegExp = /\.(?:com|exe)$/i;
	const isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
	function detectShebang(parsed) {
		parsed.file = resolveCommand(parsed);
		const shebang = parsed.file && readShebang(parsed.file);
		if (shebang) {
			parsed.args.unshift(parsed.file);
			parsed.command = shebang;
			return resolveCommand(parsed);
		}
		return parsed.file;
	}
	function parseNonShell(parsed) {
		if (!isWin) return parsed;
		const commandFile = detectShebang(parsed);
		const needsShell = !isExecutableRegExp.test(commandFile);
		if (parsed.options.forceShell || needsShell) {
			const needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile);
			parsed.command = path.normalize(parsed.command);
			parsed.command = escape.command(parsed.command);
			parsed.args = parsed.args.map((arg) => escape.argument(arg, needsDoubleEscapeMetaChars));
			parsed.args = [
				"/d",
				"/s",
				"/c",
				`"${[parsed.command].concat(parsed.args).join(" ")}"`
			];
			parsed.command = process.env.comspec || "cmd.exe";
			parsed.options.windowsVerbatimArguments = true;
		}
		return parsed;
	}
	function parse(command, args, options) {
		if (args && !Array.isArray(args)) {
			options = args;
			args = null;
		}
		args = args ? args.slice(0) : [];
		options = Object.assign({}, options);
		const parsed = {
			command,
			args,
			options,
			file: void 0,
			original: {
				command,
				args
			}
		};
		return options.shell ? parsed : parseNonShell(parsed);
	}
	module.exports = parse;
}));
//#endregion
//#region node_modules/cross-spawn/lib/enoent.js
var require_enoent = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const isWin = process.platform === "win32";
	function notFoundError(original, syscall) {
		return Object.assign(/* @__PURE__ */ new Error(`${syscall} ${original.command} ENOENT`), {
			code: "ENOENT",
			errno: "ENOENT",
			syscall: `${syscall} ${original.command}`,
			path: original.command,
			spawnargs: original.args
		});
	}
	function hookChildProcess(cp, parsed) {
		if (!isWin) return;
		const originalEmit = cp.emit;
		cp.emit = function(name, arg1) {
			if (name === "exit") {
				const err = verifyENOENT(arg1, parsed);
				if (err) return originalEmit.call(cp, "error", err);
			}
			return originalEmit.apply(cp, arguments);
		};
	}
	function verifyENOENT(status, parsed) {
		if (isWin && status === 1 && !parsed.file) return notFoundError(parsed.original, "spawn");
		return null;
	}
	function verifyENOENTSync(status, parsed) {
		if (isWin && status === 1 && !parsed.file) return notFoundError(parsed.original, "spawnSync");
		return null;
	}
	module.exports = {
		hookChildProcess,
		verifyENOENT,
		verifyENOENTSync,
		notFoundError
	};
}));
//#endregion
//#region lib/types/commands.js
var import_cross_spawn = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const cp = __require("child_process");
	const parse = require_parse$1();
	const enoent = require_enoent();
	function spawn(command, args, options) {
		const parsed = parse(command, args, options);
		const spawned = cp.spawn(parsed.command, parsed.args, parsed.options);
		enoent.hookChildProcess(spawned, parsed);
		return spawned;
	}
	function spawnSync(command, args, options) {
		const parsed = parse(command, args, options);
		const result = cp.spawnSync(parsed.command, parsed.args, parsed.options);
		result.error = result.error || enoent.verifyENOENTSync(result.status, parsed);
		return result;
	}
	module.exports = spawn;
	module.exports.spawn = spawn;
	module.exports.sync = spawnSync;
	module.exports._parse = parse;
	module.exports._enoent = enoent;
})))(), 1);
/** Execute argv without shell interpolation; cross-spawn handles Windows batch shims. */
function runCommand(command, args, env) {
	if ([command, ...args].some((value) => /[\0\r\n]/.test(value))) return Promise.reject(Error("命令或路径包含不允许的换行/空字符"));
	return new Promise((resolve, reject) => {
		const child = (0, import_cross_spawn.default)(command, args, {
			env: {
				...process.env,
				...env
			},
			windowsHide: true,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			],
			timeout: 18e4
		});
		const stdout = [], stderr = [];
		let size = 0, overflow = false;
		const collect = (chunks, chunk) => {
			size += chunk.length;
			if (size > 2097152) {
				overflow = true;
				child.kill();
			} else chunks.push(chunk);
		};
		child.stdout.on("data", (chunk) => collect(stdout, chunk));
		child.stderr.on("data", (chunk) => collect(stderr, chunk));
		child.once("error", (error) => reject(Object.assign(Error(`无法启动 ${command}：${error.message}；请检查可执行文件路径/PATH`), {
			cause: error,
			code: error.code
		})));
		child.once("close", (code, signal) => {
			if (overflow) return reject(Error("安装器输出超过 2 MiB 限制"));
			if (code !== 0) return reject(Object.assign(Error(`${command} 执行失败（${signal || code}）：${Buffer.concat(stderr).toString("utf8").trim()}`), {
				code,
				signal
			}));
			resolve(Buffer.concat(stdout).toString("utf8"));
		});
	});
}
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
const exec$2 = promisify(execFile);
const imageId = (id) => /^[a-f0-9]{32}$/.test(id);
async function inputImagePath(dir, id) {
	if (!imageId(id)) throw Error("图片ID无效");
	const root = await realpath(dir), folder = join(root, "assets", "images", id);
	const path = join(folder, "image.png");
	try {
		if (await realpath(path) !== path) throw Error("输入图片路径无效");
		const meta = JSON.parse(await readFile(join(folder, "asset.json"), "utf8"));
		if (meta.id !== id || ![
			"source",
			"control",
			"mask"
		].includes(meta.kind)) throw Error("输入图片记录无效");
		return path;
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
}
async function managedDirectory(root, ...parts) {
	const base = join(root, "assets");
	await mkdir(base, {
		recursive: true,
		mode: 448
	});
	if (await realpath(base) !== base) throw Error("资源目录不可使用符号链接");
	const path = join(base, ...parts);
	await mkdir(path, {
		recursive: true,
		mode: 448
	});
	if (await realpath(path) !== path) throw Error("资源目录不可使用符号链接");
	return path;
}
async function validateLora(path, bytes) {
	const file = await open(path, "r");
	try {
		const size = Buffer.alloc(8);
		if ((await file.read(size, 0, 8, 0)).bytesRead !== 8) throw Error("LoRA 文件不完整");
		const length = Number(size.readBigUInt64LE());
		if (!Number.isSafeInteger(length) || length < 2 || length > 16777216 || 8 + length >= bytes) throw Error("不是有效的 safetensors 文件");
		const header = Buffer.alloc(length);
		if ((await file.read(header, 0, length, 8)).bytesRead !== length) throw Error("LoRA 文件头不完整");
		const data = JSON.parse(header.toString("utf8"));
		const entries = Object.entries(data).filter(([key]) => key !== "__metadata__");
		if (!entries.length || !entries.some(([key]) => /(?:lora_[AB]|lora_up|lora_down|lokr_w[12])(?:\.|$)/.test(key))) throw Error("请选择 LoRA 权重，而不是底模或 ControlNet 模型权重");
		for (const [, value] of entries) {
			const tensor = value;
			if (!Array.isArray(tensor.shape) || tensor.shape.some((n) => !Number.isSafeInteger(n) || Number(n) < 0) || !Array.isArray(tensor.data_offsets) || tensor.data_offsets.length !== 2 || tensor.data_offsets.some((n) => !Number.isSafeInteger(n) || n < 0) || tensor.data_offsets[0] > tensor.data_offsets[1] || tensor.data_offsets[1] > bytes - length - 8 || typeof tensor.dtype !== "string") throw Error("LoRA 张量记录无效或文件不完整");
		}
	} finally {
		await file.close();
	}
}
/** Content index for imported images. Same bytes + same kind reuse one id. */
let imageIndexCache;
let imageIndexWork;
async function imageIndex(root) {
	if (imageIndexCache?.root === root) return imageIndexCache.map;
	if (!imageIndexWork) imageIndexWork = (async () => {
		const map = /* @__PURE__ */ new Map();
		const base = join(root, "assets", "images");
		let entries = [];
		try {
			entries = await readdir(base);
		} catch {}
		for (const id of entries.filter(imageId)) try {
			const folder = join(base, id), metaPath = join(folder, "asset.json"), image = join(folder, "image.png");
			const meta = JSON.parse(await readFile(metaPath, "utf8"));
			let sha256 = meta.sha256;
			if (!sha256) {
				sha256 = createHash("sha256").update(await readFile(image)).digest("hex");
				await writeFile(metaPath, JSON.stringify({
					...meta,
					sha256
				}), { mode: 384 });
			}
			map.set(`${meta.kind}:${sha256}`, id);
		} catch {}
		imageIndexCache = {
			root,
			map
		};
		return map;
	})().finally(() => {
		imageIndexWork = void 0;
	});
	return imageIndexWork;
}
/** Own selected bytes. Never trust a client-provided local filesystem path. */
async function importAsset(dir, python, kind, name, input, signal) {
	signal?.throwIfAborted();
	if (![
		"source",
		"control",
		"mask",
		"lora"
	].includes(kind)) throw Error("资源类型无效");
	if (kind === "lora" && !name.toLowerCase().endsWith(".safetensors")) throw Error("请选择 .safetensors 文件");
	name = name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 180) || "图片";
	await mkdir(dir, { recursive: true });
	dir = await realpath(dir);
	const temp = join(await managedDirectory(dir, ".incoming"), randomUUID());
	await mkdir(temp, { mode: 448 });
	const source = join(temp, "upload"), hash = createHash("sha256");
	let bytes = 0;
	try {
		const file = await open(source, "wx", 384);
		try {
			for await (const chunk of input) {
				signal?.throwIfAborted();
				bytes += chunk.byteLength;
				if (bytes > (kind === "lora" ? 2 * 1024 ** 3 : 64 * 1024 ** 2)) throw Error(kind === "lora" ? "LoRA 文件不能超过2GB" : "图片不能超过64MB");
				hash.update(chunk);
				await file.writeFile(chunk);
			}
			if (!bytes) throw Error("没有收到文件内容");
			signal?.throwIfAborted();
			await file.sync();
		} finally {
			await file.close();
		}
		if (kind === "lora") {
			await validateLora(source, bytes);
			const id = hash.digest("hex"), folder = await managedDirectory(dir, "loras"), path = join(folder, id + ".safetensors");
			try {
				await link(source, path);
			} catch (error) {
				if (error.code !== "EEXIST") throw error;
				if (!(await lstat(path)).isFile()) throw Error("LoRA 资源路径无效");
			}
			const asset = {
				id,
				kind: "lora",
				name,
				bytes,
				path
			};
			await writeFile(join(folder, id + ".json"), JSON.stringify(asset), { mode: 384 });
			return asset;
		}
		const output = join(temp, "image.png");
		const script = resolve(dirname(fileURLToPath(import.meta.url)), "../backend/normalize_image.py");
		let dimensions;
		try {
			const result = await exec$2(python, [
				script,
				source,
				output,
				kind
			], {
				env: {
					...process.env,
					PYTHONUTF8: "1",
					PYTHONIOENCODING: "utf-8"
				},
				windowsHide: true,
				timeout: 3e4,
				maxBuffer: 65536,
				...signal ? { signal } : {}
			});
			dimensions = JSON.parse(result.stdout);
		} catch (error) {
			signal?.throwIfAborted();
			if (error.code === "ENOENT") throw Error(`找不到图片处理 Python：${python}。远程模式也需要客户端 Python + Pillow；请在设置中选择已安装 Pillow 的 Python 环境，或运行随包 scripts/setup-image-python.py。`);
			throw Error(error.stderr?.trim().split("\n")[0] || "图片导入失败，请检查图片格式及客户端 Python/Pillow 环境");
		}
		const sha256 = createHash("sha256").update(await readFile(output)).digest("hex");
		const index = await imageIndex(dir), existing = index.get(`${kind}:${sha256}`);
		if (existing) return {
			...JSON.parse(await readFile(join(dir, "assets", "images", existing, "asset.json"), "utf8")),
			deduped: true
		};
		await rm(source);
		signal?.throwIfAborted();
		const id = randomUUID().replaceAll("-", ""), asset = {
			id,
			name,
			kind,
			bytes,
			...dimensions
		};
		await writeFile(join(temp, "asset.json"), JSON.stringify({
			...asset,
			sha256
		}), { mode: 384 });
		await rename(temp, join(await managedDirectory(dir, "images"), id));
		index.set(`${kind}:${sha256}`, id);
		imageIndexCache = {
			root: dir,
			map: index
		};
		return asset;
	} finally {
		await rm(temp, {
			recursive: true,
			force: true
		});
	}
}
async function receiveAsset(req, dir, python) {
	const url = new URL(req.url ?? "", "http://localhost");
	return importAsset(dir, python, url.searchParams.get("kind") ?? "", url.searchParams.get("name") ?? "", req);
}
//#endregion
//#region lib/types/shared.js
const API = "/api/qwen-studio";
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
	try {
		for (let attempt = 0;; attempt++) try {
			await rename(temp, path);
			break;
		} catch (error) {
			if (process.platform !== "win32" || ![
				"EPERM",
				"EACCES",
				"EBUSY"
			].includes(error.code ?? "") || attempt >= 7) throw error;
			await setTimeout$1(10 * 2 ** attempt);
		}
	} finally {
		await rm(temp, { force: true }).catch(() => {});
	}
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
function restoreGalleryFlags(dir) {
	const result = mutation.then(async () => {
		const backup = parseFlags(await readFile(join(dir, "state/gallery.json.bak"), "utf8"));
		try {
			const original = await readFile(join(dir, "state/gallery.json"));
			await writeFile(join(dir, `state/gallery.damaged-${Date.now()}-${randomUUID()}.json`), original, { mode: 384 });
		} catch (e) {
			if (e.code !== "ENOENT") throw e;
		}
		await atomicJSON(join(dir, "state/gallery.json"), backup);
		invalidateGallery(dir);
		return { ok: true };
	});
	mutation = result.catch(() => {});
	return result;
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
		source_image_ids: raw.source_image_ids,
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
/** Read only the accepted task; unrelated gallery records cannot delay or break progress. */
async function readJob(dir, id) {
	if (!validId(id)) throw Error("图片ID无效");
	try {
		dir = await realpath(dir);
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
	const marks = await flags(dir);
	return await recordAt(dir, "images", id, marks) ?? await recordAt(dir, "trash", id, marks);
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
function invalidateGallery(dir) {
	indexes.get(dir)?.invalidate();
}
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
let mutation = Promise.resolve();
function batchAction(dir, ids, action, value) {
	const result = mutation.then(async () => {
		if (!Array.isArray(ids) || !ids.length || ids.length > 1e3 || ids.some((id) => !validId(id))) throw Error("请选择1–1000张图片");
		dir = await realpath(dir);
		const marks = await flags(dir);
		const selected = await Promise.all([...new Set(ids)].map(async (id) => {
			const job = await recordAt(dir, "images", id, {}) ?? await recordAt(dir, "trash", id, {});
			if (!job) throw Error("图片不存在");
			return job;
		}));
		if (selected.some(active) && action !== "favorite") throw Error("请先取消生成中的任务");
		if (["favorite", "archived"].includes(action) && typeof value !== "boolean") throw Error("操作参数无效");
		if (action === "purge" && selected.some((j) => !j.deleted)) throw Error("只能清空回收站中的图片");
		if (![
			"favorite",
			"archived",
			"delete",
			"restore",
			"purge"
		].includes(action)) throw Error("操作无效");
		const before = structuredClone(marks);
		await mkdir(join(dir, "state"), { recursive: true });
		const completed = [];
		for (const job of selected) {
			if (action === "favorite" || action === "archived") marks[job.id] = {
				...marks[job.id],
				[action]: value
			};
			else {
				const from = join(dir, job.deleted ? "trash" : "images", job.id);
				if (await realpath(from) !== from) throw Error("图片路径无效");
				if (action === "purge") {
					await rm(from, { recursive: true });
					delete marks[job.id];
				} else if (action === "delete" && !job.deleted || action === "restore" && job.deleted) {
					const to = join(dir, action === "delete" ? "trash" : "images");
					await mkdir(to, { recursive: true });
					await rename(from, join(to, job.id));
				}
			}
			completed.push(job.id);
		}
		await atomicJSON(join(dir, "state/gallery.json.bak"), before);
		await atomicJSON(join(dir, "state/gallery.json"), marks);
		invalidateGallery(dir);
		return {
			ok: true,
			ids: completed
		};
	});
	mutation = result.catch(() => {});
	return result;
}
async function imagePath(dir, id) {
	if (!validId(id)) throw Error("图片ID无效");
	const job = await readJob(dir, id);
	if (!job) {
		const input = await inputImagePath(dir, id);
		if (input) return input;
		throw Error("图片不存在");
	}
	const parent = await realpath(join(dir, job.deleted ? "trash" : "images"));
	const path = await realpath(join(parent, id, "image.png"));
	if (path !== join(parent, id, "image.png")) throw Error("图片路径无效");
	return path;
}
//#endregion
//#region lib/types/updates.js
/** Verified package updates. Model/gallery/configuration files are never package payloads. */
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
	profile = realpathSync.native(profile);
	const canonical = realpathSync.native(packageRoot);
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
	if (process.platform === "win32") {
		const bundled = [
			join(dirname(process.execPath), "resources/runtime/cli/bin/dsh.cmd"),
			join(process.env.LOCALAPPDATA || "", "Programs/DeepSeek Harness/resources/runtime/cli/bin/dsh.cmd"),
			join(process.env.ProgramFiles || "", "DeepSeek Harness/resources/runtime/cli/bin/dsh.cmd")
		].find((p) => existsSync(p));
		if (bundled) return {
			command: bundled,
			args: []
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
	constructor(packageRoot, run = runCommand) {
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
//#region lib/types/config.js
const Config = z.object({
	localMfluxDirectory: z.string().default("").volatile(),
	localMfluxIdleMinutes: z.number().default(10).volatile(),
	connectionMode: z.union(["local", "remote"]).default("local").volatile(),
	pythonPath: z.string().default("").volatile(),
	modelPath: z.string().default("").volatile(),
	hfHome: z.string().default("").volatile(),
	loraDirectory: z.string().default("").volatile(),
	remoteBaseURL: z.string().default("").volatile(),
	remoteModel: z.string().default("qwen-image").volatile(),
	remoteApiKey: z.string().default("").role("secret").volatile(),
	remoteSshHost: z.string().default("").volatile(),
	remoteSshPort: z.number().default(19488).volatile()
});
//#endregion
//#region lib/types/invocations.js
const key = (callId, prompt, sessionId) => createHash("sha256").update(JSON.stringify([
	sessionId,
	callId,
	prompt
])).digest("hex");
async function recordInvocation(dir, callId, prompt, id, error, sessionId = "") {
	const folder = join(dir, "state", "tool-calls");
	await mkdir(folder, { recursive: true });
	await atomicJSON(join(folder, key(callId, prompt, sessionId) + ".json"), {
		id,
		startedAt: Date.now(),
		...error ? { error } : {}
	});
}
async function invocationProgress(dir, callId, prompt, since = 0, sessionId = "") {
	if (!callId || callId.length > 1024 || !prompt || prompt.length > 16e3 || !Number.isFinite(since)) throw Error("调用标识无效");
	let receipt;
	try {
		receipt = JSON.parse(await readFile(join(dir, "state", "tool-calls", key(callId, prompt, sessionId) + ".json"), "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") return { status: "waiting" };
		throw error;
	}
	if (receipt.startedAt < since - 1e3) return { status: "waiting" };
	const job = await readJob(dir, receipt.id);
	if (job && !job.deleted) return {
		status: "accepted",
		job
	};
	return receipt.error ? {
		status: "failed",
		error: receipt.error
	} : { status: "submitting" };
}
//#endregion
//#region lib/types/resolved-config.js
function resolveConfig(raw, env = process.env, home = homedir()) {
	const path = (value) => resolve(/^~[\\/]/.test(value) ? join(home, value.slice(2)) : value);
	const directory = path(raw.localMfluxDirectory || join(home, ".dsh/qwen-studio"));
	const minutes = raw.localMfluxIdleMinutes ?? 10;
	if (!Number.isFinite(minutes) || minutes < .1 || minutes > 1440) throw Error("空闲时间应为0.1–1440分钟");
	const hfHome = path(raw.hfHome || env.HF_HOME || join(env.XDG_CACHE_HOME || join(home, ".cache"), "huggingface"));
	return {
		localMfluxDirectory: directory,
		localMfluxIdleMinutes: minutes,
		connectionMode: raw.connectionMode ?? "local",
		pythonPath: path(raw.pythonPath || join(directory, process.platform === "win32" ? "venv/Scripts/python.exe" : "venv/bin/python")),
		modelPath: path(raw.modelPath || join(directory, "models/qwen-image-2.1")),
		hfHome,
		loraDirectory: path(raw.loraDirectory || join(directory, "loras")),
		remoteBaseURL: raw.remoteBaseURL || "",
		remoteModel: raw.remoteModel || "qwen-image",
		remoteApiKeyConfigured: Boolean(raw.remoteApiKey),
		remoteSshHost: raw.remoteSshHost || "",
		remoteSshPort: raw.remoteSshPort ?? 19488,
		hfHomeSource: raw.hfHome ? "configured" : env.HF_HOME || env.XDG_CACHE_HOME ? "environment" : "default"
	};
}
const loraRoots = (config) => [.../* @__PURE__ */ new Set([
	join(config.localMfluxDirectory, "assets/loras"),
	join(config.localMfluxDirectory, "loras"),
	config.loraDirectory
])];
//#endregion
//#region lib/types/resources.js
async function entries(path) {
	try {
		return await readdir(path);
	} catch (error) {
		if (error.code === "ENOENT") return [];
		throw error;
	}
}
const hashes = /* @__PURE__ */ new Map();
async function fingerprint(path) {
	path = await realpath(path);
	const info = await stat(path, { bigint: true }), stamp = [
		info.size,
		info.mtimeNs,
		info.ctimeNs
	].join(":");
	const cached = hashes.get(path);
	if (cached?.stamp === stamp) return cached.hash;
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	const after = await stat(path, { bigint: true });
	if ([
		after.size,
		after.mtimeNs,
		after.ctimeNs
	].join(":") !== stamp) throw Error("资源在校验期间发生变化，请重试");
	const result = hash.digest("hex");
	if (hashes.size > 1024) hashes.clear();
	hashes.set(path, {
		stamp,
		hash: result
	});
	return result;
}
async function listResources(config) {
	const items = [], warnings = [], seen = /* @__PURE__ */ new Set(), dir = config.localMfluxDirectory;
	const roots = loraRoots(config);
	for (const [index, root] of roots.entries()) try {
		const canonicalRoot = await realpath(root);
		for (const name of await entries(canonicalRoot)) {
			if (extname(name).toLowerCase() !== ".safetensors") continue;
			try {
				const file = await realpath(join(canonicalRoot, name));
				const rel = relative(canonicalRoot, file);
				if (!rel || rel === ".." || rel.startsWith("..\\") || rel.startsWith("../") || isAbsolute(rel) || seen.has(file)) continue;
				const info = await stat(file);
				if (!info.isFile()) continue;
				seen.add(file);
				let title = name;
				if (index === 0) try {
					const meta = JSON.parse(await readFile(join(canonicalRoot, name.replace(/\.safetensors$/i, ".json")), "utf8"));
					if (typeof meta.name === "string") title = meta.name;
				} catch {}
				items.push({
					id: "lora-" + createHash("sha256").update(file).digest("hex"),
					kind: "lora",
					name: title,
					bytes: info.size,
					path: file,
					origin: index === 0 ? "imported" : root === join(dir, "loras") ? "default" : "custom"
				});
			} catch {
				warnings.push("无法读取 LoRA 文件：" + name);
			}
		}
	} catch (error) {
		if (error.code !== "ENOENT") warnings.push("无法读取 LoRA 目录：" + root);
	}
	const imageRoot = join(dir, "assets/images");
	for (const id of await entries(imageRoot)) {
		if (!/^[a-f0-9]{32}$/.test(id)) continue;
		try {
			const file = await imagePath(dir, id), info = await stat(file);
			const meta = JSON.parse(await readFile(join(imageRoot, id, "asset.json"), "utf8"));
			if (![
				"source",
				"control",
				"mask"
			].includes(meta.kind)) continue;
			items.push({
				id,
				kind: meta.kind,
				name: String(meta.name || id),
				bytes: info.size,
				origin: "imported"
			});
		} catch {
			warnings.push("输入资源不可用：" + id.slice(0, 8));
		}
	}
	for (const job of await readJobs(dir)) {
		if (job.status !== "complete" || job.deleted) continue;
		try {
			const info = await stat(await imagePath(dir, job.id));
			items.push({
				id: job.id,
				kind: "image",
				name: "作品 " + job.id.slice(0, 8),
				bytes: info.size,
				origin: "gallery"
			});
		} catch {}
	}
	return {
		items,
		warnings
	};
}
async function resourceFingerprint(config, resource) {
	return resource.fingerprint || fingerprint(resource.kind === "lora" ? resource.path : await imagePath(config.localMfluxDirectory, resource.id));
}
//#endregion
//#region lib/types/remote-protocol.js
const requiredFeatures = [
	"lora",
	"controlnet",
	"mask",
	"img2img",
	"negative_prompt",
	"guidance",
	"progress",
	"cancel"
];
async function responseJSON(response) {
	const value = await response.json();
	if (!response.ok) throw Error(`远程 HTTP ${response.status}：${typeof value.error === "string" ? value.error : value.error?.message || "请求失败"}`);
	return value;
}
function advancedParameters(data, capabilities) {
	const result = {};
	for (const key of [
		"negative_prompt",
		"guidance",
		"scheduler",
		"source_image_id",
		"source_image_ids",
		"reference_mode",
		"change_strength",
		"controlnet_image_id",
		"controlnet_strength",
		"mask_image_id",
		"lora_paths",
		"lora_scales",
		"lora_names"
	]) if (data[key] != null) result[key] = data[key];
	const negative = result.negative_prompt ?? "";
	if (result.reference_mode !== void 0 && !["variation", "edit"].includes(result.reference_mode)) throw Error("参考图模式无效");
	const sourceIds = result.source_image_ids;
	if (sourceIds !== void 0) {
		if (!Array.isArray(sourceIds) || sourceIds.length < 2 || sourceIds.length > 8 || sourceIds.some((id) => !validId(id))) throw Error("多图参考需要 2–8 个有效图片ID");
		if (!capabilities.features.includes("multi_image")) throw Error("远程网关尚未支持多图参考，请更新网关；不会退回单图");
		if (result.source_image_id || result.mask_image_id || result.controlnet_image_id || result.change_strength !== void 0) throw Error("多图参考不与 source_image_id、蒙版、结构控制或变化幅度同用");
		if (result.reference_mode !== "edit") throw Error("多图参考只用于 reference_mode=edit");
	}
	if (result.reference_mode === "edit") {
		if (!capabilities.features.includes("reference_edit")) throw Error("远程网关尚未支持原生参考编辑，请更新网关；不会退回参考变体");
		if (!result.source_image_id && !sourceIds?.length || result.mask_image_id || result.controlnet_image_id || result.change_strength !== void 0 || (result.scheduler ?? "linear") !== "linear" || Number(data.width ?? 1024) % 32 || Number(data.height ?? 1024) % 32) throw Error("原生参考编辑需要原图、linear和32倍数尺寸，不使用变化幅度、蒙版或结构控制");
	}
	if (typeof negative !== "string" || negative.length > 8e3) throw Error("负向提示词无效");
	const guidance = result.guidance ?? 1;
	if (!Number.isFinite(guidance) || guidance < 1 || guidance > 10) throw Error("CFG 范围1–10");
	if (!capabilities.schedulers.includes(result.scheduler ?? "linear")) throw Error("远程服务不支持所选调度器");
	for (const key of [
		"source_image_id",
		"controlnet_image_id",
		"mask_image_id"
	]) if (result[key] && !validId(result[key])) throw Error("图片ID无效");
	if (result.mask_image_id && !result.source_image_id) throw Error("蒙版需要原图");
	if (result.change_strength !== void 0 && (!result.source_image_id || result.mask_image_id || !Number.isFinite(result.change_strength) || result.change_strength < .05 || result.change_strength > .95)) throw Error("参考图变化幅度无效，蒙版不使用变化幅度");
	if (result.controlnet_strength !== void 0 && (!result.controlnet_image_id || !Number.isFinite(result.controlnet_strength) || result.controlnet_strength < 0 || result.controlnet_strength > 1)) throw Error("控制强度无效");
	if ((result.controlnet_image_id || result.mask_image_id) && result.scheduler && result.scheduler !== "linear") throw Error("结构控制和蒙版需要 linear 调度器");
	const paths = result.lora_paths ?? [], scales = result.lora_scales ?? paths.map(() => 1);
	if (!Array.isArray(paths) || paths.length > 8 || paths.some((p) => typeof p !== "string") || !Array.isArray(scales) || scales.length !== paths.length || scales.some((s) => !Number.isFinite(s) || s < 0 || s > 2)) throw Error("LoRA 路径与权重无效");
	if (paths.length) result.lora_scales = scales;
	if (negative.trim() && guidance <= 1) {
		result.guidance = 2.5;
		result.guidance_auto_raised = true;
	}
	return result;
}
async function runExtended({ base, headers, dir, config, job, signal, patch, accepted, reconnect }) {
	const inputs = [];
	const body = {
		id: job.id,
		model: config.remoteModel || "qwen-image",
		prompt: job.prompt,
		width: job.width,
		height: job.height,
		steps: job.steps,
		seed: job.seed,
		loras: []
	};
	for (const k of [
		"negative_prompt",
		"guidance",
		"scheduler",
		"reference_mode",
		"change_strength",
		"controlnet_strength"
	]) if (job[k] != null) body[k] = job[k];
	const sourceIds = job.source_image_ids?.length ? job.source_image_ids : job.source_image_id ? [job.source_image_id] : [];
	for (const [index, id] of sourceIds.entries()) inputs.push({
		path: await imagePath(dir, id),
		kind: "image",
		field: `source_sha_${index}`
	});
	for (const [key, field] of [["controlnet_image_id", "control_sha"], ["mask_image_id", "mask_sha"]]) if (job[key]) inputs.push({
		path: await imagePath(dir, job[key]),
		kind: "image",
		field
	});
	if (job.lora_paths?.length) {
		const resources = await listResources(resolveConfig({
			...config,
			localMfluxDirectory: dir
		}));
		for (const [index, path] of job.lora_paths.entries()) {
			const canonical = await realpath(path);
			if (!resources.items.some((r) => r.kind === "lora" && r.path === canonical)) throw Error("LoRA 必须来自配置的资源目录");
			const info = await stat(canonical);
			if (!info.isFile() || info.size > 2 * 1024 ** 3) throw Error("LoRA 文件无效或超过2GB");
			await validateLora(canonical, info.size);
			inputs.push({
				path: canonical,
				kind: "lora",
				field: "loras",
				scale: job.lora_scales?.[index] ?? 1
			});
		}
	}
	const sourceShas = [];
	for (const [i, input] of inputs.entries()) {
		signal.throwIfAborted();
		await patch({
			status: "uploading",
			phase: `同步资源 ${i + 1}/${inputs.length}：${input.kind === "lora" ? basename(input.path) : "图片"}`
		});
		if (input.field.startsWith("source_sha_")) {
			const index = Number(input.field.slice(11));
			await copyFile(input.path, join(dir, "images", job.id, sourceIds.length > 1 ? `reference-${index + 1}.png` : "reference.png"));
		}
		const sha = await fingerprint(input.path);
		const url = `${base}/qwen/assets/${sha}?kind=${input.kind}`;
		const exists = await fetch(url, {
			method: "HEAD",
			headers,
			signal,
			redirect: "error"
		});
		if (exists.status !== 200) {
			if (exists.status !== 404) throw Error(`远程资源检查失败：HTTP ${exists.status}`);
			const stream = (await open(input.path, constants.O_RDONLY | constants.O_NOFOLLOW)).createReadStream();
			try {
				await responseJSON(await fetch(url, {
					method: "PUT",
					headers: {
						...headers,
						"content-type": "application/octet-stream",
						"content-length": String((await stat(input.path)).size)
					},
					body: Readable.toWeb(stream),
					duplex: "half",
					signal,
					redirect: "error"
				}));
			} finally {
				stream.destroy();
			}
		}
		if (input.field === "loras") body.loras.push({
			sha,
			scale: input.scale
		});
		else if (input.field.startsWith("source_sha_")) sourceShas[Number(input.field.slice(11))] = sha;
		else body[input.field] = sha;
	}
	if (sourceShas.length === 1) body.source_sha = sourceShas[0];
	else if (sourceShas.length > 1) body.source_shas = sourceShas;
	signal.throwIfAborted();
	accepted();
	await responseJSON(await fetch(base + "/qwen/jobs", {
		method: "POST",
		headers,
		body: JSON.stringify(body),
		signal,
		redirect: "error"
	}));
	const started = Date.now();
	while (true) {
		signal.throwIfAborted();
		let response;
		try {
			response = await fetch(base + "/qwen/jobs/" + job.id, {
				headers,
				signal,
				redirect: "error"
			});
			if ([
				502,
				503,
				504
			].includes(response.status)) throw Error("Remote temporarily unavailable");
		} catch (error) {
			signal.throwIfAborted();
			await patch({ phase: "连接中断，正在重连；不会重新提交" });
			if (reconnect) await reconnect().catch(() => {});
			await setTimeout$1(1500, void 0, { signal });
			continue;
		}
		const remote = await responseJSON(response);
		const status = [
			"queued",
			"loading",
			"running",
			"saving",
			"cancelling",
			"complete",
			"cancelled",
			"failed"
		].includes(remote.status) ? remote.status : "running";
		await patch({
			status: status === "complete" ? "saving" : status,
			phase: String(remote.phase || ""),
			step: Number(remote.step) || 0,
			sampling_steps: Number(remote.sampling_steps) || job.steps,
			progress_supported: true,
			elapsed_seconds: (Date.now() - started) / 1e3
		});
		if (status === "failed") throw Error(remote.error || "远程生成失败");
		if (status === "cancelled") throw Error("远程任务已取消");
		if (status === "complete") {
			const response = await fetch(base + "/qwen/jobs/" + job.id + "/image", {
				headers,
				signal,
				redirect: "error"
			});
			if (!response.ok) throw Error("远程结果暂不可用，请查询原任务，勿重复提交");
			if (Number(response.headers.get("content-length")) > 64 * 1024 ** 2) throw Error("远程图片超过64MB");
			return Buffer.from(await response.arrayBuffer());
		}
		await setTimeout$1(500, void 0, { signal });
	}
}
//#endregion
//#region lib/types/remote.js
function remoteURL(config) {
	const url = new URL(config.remoteBaseURL ?? "");
	if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error("请填写不含账号、查询参数的HTTP(S)接口地址");
	return url.toString().replace(/\/$/, "");
}
function headers(config) {
	return {
		"content-type": "application/json",
		...config.remoteApiKey ? { authorization: `Bearer ${config.remoteApiKey}` } : {}
	};
}
var RemoteQueue = class {
	disposed = false;
	admission = Promise.resolve();
	tail = Promise.resolve();
	pending = /* @__PURE__ */ new Map();
	configs = /* @__PURE__ */ new Map();
	capabilityCache = /* @__PURE__ */ new Map();
	capabilities(config) {
		const key = JSON.stringify([remoteURL(config), config.remoteApiKey]);
		const cached = this.capabilityCache.get(key);
		if (cached && cached.until > Date.now()) return cached.value;
		const value = (async () => {
			const response = await fetch(remoteURL(config) + "/qwen/capabilities", {
				headers: headers(config),
				redirect: "error",
				signal: AbortSignal.timeout(5e3)
			});
			if ([404, 405].includes(response.status)) return null;
			if (!response.ok) throw Error(`远程能力检查失败：HTTP ${response.status}`);
			const data = await response.json();
			if (data.protocol !== "dsh-qwen" || data.version !== 1 || !Array.isArray(data.features) || !requiredFeatures.every((f) => data.features.includes(f)) || !Array.isArray(data.schedulers)) return null;
			return {
				protocol: data.protocol,
				version: 1,
				features: data.features,
				schedulers: data.schedulers
			};
		})();
		this.capabilityCache.set(key, {
			until: Date.now() + 1e4,
			value
		});
		value.catch(() => this.capabilityCache.delete(key));
		return value;
	}
	submit(dir, config, data, settled, reconnect) {
		if (this.disposed) return Promise.reject(Error("插件正在退出，请重新提交任务"));
		const result = this.admission.then(() => this.admit(dir, config, data, settled, reconnect));
		this.admission = result.catch(() => {});
		return result;
	}
	async admit(dir, config, data, settled, reconnect) {
		const capabilities = await this.capabilities(config);
		if (!capabilities && (data.source_image_id != null || data.change_strength != null || data.reference_mode != null)) throw Error("当前远程接口仅支持文生图，不能忽略参考图继续生成；请切换本地模式或移除参考图");
		if (!capabilities && (data.negative_prompt != null || data.guidance != null || data.scheduler != null)) throw Error("负向提示词、CFG 与调度器目前仅接入本地模式；远程接口不会忽略这些参数继续生成");
		if (!capabilities && [
			"lora_paths",
			"lora_scales",
			"controlnet_image_id",
			"controlnet_strength",
			"mask_image_id"
		].some((key) => data[key] !== void 0)) throw Error("LoRA、ControlNet 与蒙版目前仅支持本地模式；远程不会忽略这些参数继续生成");
		remoteURL(config);
		const id = data.id;
		if (!validId(id)) throw Error("任务ID无效");
		const prompt = data.prompt, width = data.width ?? 1024, height = data.height ?? 1024, steps = data.steps ?? 40, seed = data.seed ?? null;
		if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 16e3) throw Error("请填写1–16000字的描述");
		if ([width, height].some((v) => typeof v !== "number" || !Number.isInteger(v) || v < 512 || v > 2048 || v % 16)) throw Error("尺寸无效");
		if (typeof steps !== "number" || !Number.isInteger(steps) || steps < 1 || steps > 60) throw Error("步数应为1–60");
		if (seed !== null && (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32)) throw Error("种子无效");
		const request = {
			...capabilities ? advancedParameters(data, capabilities) : {},
			prompt,
			width,
			height,
			steps,
			seed
		}, folder = join(dir, "images", id), file = join(folder, "job.json");
		try {
			const old = JSON.parse(await readFile(file, "utf8"));
			if (JSON.stringify(old.request) !== JSON.stringify(request)) throw Error("任务ID参数冲突");
			settled?.();
			return old;
		} catch (e) {
			if (e.code !== "ENOENT") throw e;
		}
		if (this.pending.size >= 4) throw Error("远程队列已满");
		const job = {
			id,
			...request,
			seed: seed ?? Math.floor(Math.random() * 2 ** 32),
			status: "queued",
			source: "remote",
			progress_supported: Boolean(capabilities),
			started_at: Date.now() / 1e3,
			worker_pid: process.pid,
			request
		};
		await mkdir(folder, { recursive: true });
		await atomicJSON(file, job);
		this.pending.set(id, new AbortController());
		this.configs.set(id, {
			dir,
			config: { ...config },
			settled,
			reconnect
		});
		this.tail = this.tail.then(() => this.run(job)).catch(() => {});
		return job;
	}
	async run(job) {
		const controller = this.pending.get(job.id), { dir, config, settled, reconnect } = this.configs.get(job.id), folder = join(dir, "images", job.id), file = join(folder, "job.json"), start = Date.now();
		const timer = setTimeout(() => controller.abort(Error("远程生成超过30分钟")), 18e5);
		const patch = async (value) => {
			const old = JSON.parse(await readFile(file, "utf8"));
			await atomicJSON(file, {
				...old,
				...value
			});
		};
		let extendedAccepted = false;
		let extended = false;
		try {
			controller.signal.throwIfAborted();
			extended = Boolean(await this.capabilities(config));
			await patch({ status: "running" });
			let bytes;
			if (extended) bytes = await runExtended({
				base: remoteURL(config),
				headers: headers(config),
				dir,
				config,
				job,
				signal: controller.signal,
				patch,
				reconnect,
				accepted: () => {
					extendedAccepted = true;
				}
			});
			else {
				const response = await fetch(remoteURL(config) + "/images/generations", {
					method: "POST",
					headers: headers(config),
					redirect: "error",
					signal: controller.signal,
					body: JSON.stringify({
						model: config.remoteModel || "qwen-image",
						prompt: job.prompt,
						size: `${job.width}x${job.height}`,
						n: 1,
						response_format: "b64_json",
						seed: job.seed,
						num_inference_steps: job.steps
					})
				});
				if (!response.ok) throw Error(`远程服务返回HTTP ${response.status}，请检查服务日志或接口配置`);
				const item = (await response.json()).data?.[0];
				if (!item?.b64_json) throw Error("远程接口需返回 data[0].b64_json（PNG），当前不支持图片URL返回");
				bytes = Buffer.from(item.b64_json, "base64");
			}
			if (bytes.length > 67108864 || bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([
				137,
				80,
				78,
				71,
				13,
				10,
				26,
				10
			]))) throw Error("远程返回不是有效PNG或超过64MB");
			controller.signal.throwIfAborted();
			await patch({ status: "saving" });
			await writeFile(join(folder, "image.pending.png"), bytes);
			await rename(join(folder, "image.pending.png"), join(folder, "image.png"));
			await patch({
				status: "complete",
				width: bytes.readUInt32BE(16),
				height: bytes.readUInt32BE(20),
				step: extended ? JSON.parse(await readFile(file, "utf8")).sampling_steps ?? job.steps : job.steps,
				elapsed_seconds: Math.round((Date.now() - start) / 10) / 100
			});
		} catch (e) {
			if (controller.signal.aborted && extended && extendedAccepted) try {
				await fetch(remoteURL(config) + "/qwen/jobs/" + job.id + "/cancel", {
					method: "POST",
					headers: headers(config),
					redirect: "error",
					signal: AbortSignal.timeout(5e3)
				});
			} catch {}
			await patch({
				status: controller.signal.aborted ? "cancelled" : "failed",
				error: controller.signal.aborted ? extended ? "已停止等待并请求取消远程任务；连接中断时请检查远程状态" : "已停止等待；远程服务可能仍在计算" : e instanceof Error ? e.message : String(e)
			});
		} finally {
			clearTimeout(timer);
			this.pending.delete(job.id);
			this.configs.delete(job.id);
			settled?.();
		}
	}
	cancel(id) {
		const controller = this.pending.get(id);
		if (!controller) throw Error("远程任务已结束或当前DSH进程不持有该任务");
		controller.abort();
		return { ok: true };
	}
	get size() {
		return this.pending.size;
	}
	async dispose() {
		this.disposed = true;
		await this.admission;
		for (const controller of this.pending.values()) controller.abort();
		await this.tail;
	}
};
//#endregion
//#region lib/types/worker-upgrade.js
/** Release only a known idle worker; never interrupt another session's generation. */
async function upgradeIdleWorker(health, unload, readHealth, pause = (ms) => new Promise((r) => setTimeout(r, ms))) {
	if (health.status !== "ok" || health.closing || health.version === 8) return health;
	if (health.busy) throw Error("旧版生图服务正在完成其他任务，请完成后再提交；不会中断现有任务");
	if (![
		4,
		5,
		6,
		7
	].includes(health.version ?? 0)) throw Error("生图服务版本未知，请在空闲时手动释放模型后重试");
	await unload();
	for (let n = 0; n < 40; n++) {
		await pause(100);
		const next = await readHealth();
		if (next.status === "offline" || next.status === "ok" && next.version === 8 && !next.closing) return next;
	}
	throw Error("旧生图服务正在退出，请稍后重试；未提交新任务");
}
//#endregion
//#region lib/types/remote-lifecycle.js
function sshOptions(config) {
	const host = config.remoteSshHost?.trim();
	if (!host) return null;
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_.@-]{0,252}$/.test(host)) throw Error("SSH 主机请填写已有的 SSH 别名或 user@host，不包含命令或选项");
	const url = new URL(config.remoteBaseURL || "");
	if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password || url.search || url.hash) throw Error("按需 SSH 的接口地址须为 http://127.0.0.1:本机端口/v1");
	const remotePort = config.remoteSshPort ?? 19488;
	if (!Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535) throw Error("远程网关端口应为1–65535");
	return {
		host,
		port: Number(url.port),
		remotePort
	};
}
const probe = (port) => new Promise((resolve) => {
	const socket = createConnection({
		host: "127.0.0.1",
		port
	});
	const done = (value) => {
		socket.destroy();
		resolve(value);
	};
	socket.setTimeout(400);
	socket.once("connect", () => done(true));
	socket.once("error", () => done(false));
	socket.once("timeout", () => done(false));
});
function sshExecutable() {
	if (process.env.DSH_QWEN_SSH) return process.env.DSH_QWEN_SSH;
	if (process.platform === "win32") {
		const executable = [
			join(process.env.SystemRoot || "C:\\Windows", "System32/OpenSSH/ssh.exe"),
			join(process.env.ProgramFiles || "C:\\Program Files", "Git/usr/bin/ssh.exe"),
			join(process.env.ProgramFiles || "C:\\Program Files", "OpenSSH/ssh.exe")
		].find((p) => existsSync(p));
		if (executable) return executable;
	}
	return "ssh";
}
var SshTunnel = class {
	child;
	exitHandler = () => {
		this.child?.kill();
	};
	constructor() {
		process.once("exit", this.exitHandler);
	}
	get connected() {
		return Boolean(this.child && this.child.exitCode === null && !this.child.killed);
	}
	async connect(config) {
		if (this.connected) return;
		const target = sshOptions(config);
		if (!target) throw Error("未配置按需 SSH");
		if (await probe(target.port)) throw Error("SSH 本机端口已被其他进程占用；请先停用旧常驻隧道或换端口");
		const child = spawn(sshExecutable(), [
			"-N",
			"-T",
			"-o",
			"BatchMode=yes",
			"-o",
			"StrictHostKeyChecking=yes",
			"-o",
			"ExitOnForwardFailure=yes",
			"-o",
			"ConnectTimeout=12",
			"-o",
			"ControlMaster=no",
			"-o",
			"ControlPath=none",
			"-o",
			"ControlPersist=no",
			"-o",
			"ServerAliveInterval=20",
			"-o",
			"ServerAliveCountMax=3",
			"-L",
			`127.0.0.1:${target.port}:127.0.0.1:${target.remotePort}`,
			target.host
		], {
			stdio: [
				"ignore",
				"ignore",
				"pipe"
			],
			windowsHide: true
		});
		this.child = child;
		let error = "";
		child.stderr?.on("data", (chunk) => {
			error = (error + String(chunk)).slice(-2e3);
		});
		child.once("error", (e) => {
			error = e.code === "ENOENT" ? "找不到 SSH 客户端。Windows 请安装 OpenSSH Client 或 Git for Windows；也可用 DSH_QWEN_SSH 指定 ssh.exe。" : e.message;
		});
		try {
			for (let i = 0; i < 160; i++) {
				if (child.exitCode !== null || child.killed || error && !child.pid) throw Error("SSH 连接失败：" + (error.trim() || "进程已退出"));
				if (await probe(target.port)) return;
				await setTimeout$1(100);
			}
			throw Error("SSH 连接超时；请检查已保存的主机密钥、SSH 别名和服务器状态");
		} catch (e) {
			await this.disconnect();
			throw e;
		}
	}
	async disconnect() {
		const child = this.child;
		this.child = void 0;
		if (!child || child.exitCode !== null) return;
		child.kill("SIGTERM");
		for (let i = 0; child.exitCode === null && i < 25; i++) await setTimeout$1(40);
		if (child.exitCode === null) child.kill("SIGKILL");
	}
	dispose() {
		process.removeListener("exit", this.exitHandler);
	}
};
/** A lease covers admission, upload, queueing, sampling and saving, not just POST. */
var RemoteLifecycle = class {
	current;
	tunnel;
	io;
	now;
	gate = Promise.resolve();
	active = 0;
	last = 0;
	config;
	appliedSeconds = 0;
	timer;
	sweeping = false;
	disposed = false;
	error = "";
	constructor(current, tunnel, io, now = Date.now) {
		this.current = current;
		this.tunnel = tunnel;
		this.io = io;
		this.now = now;
	}
	serial(fn) {
		const result = this.gate.then(fn);
		this.gate = result.catch(() => {});
		return result;
	}
	get connected() {
		return this.tunnel.connected;
	}
	get remaining() {
		return this.active ? void 0 : Math.max(0, this.seconds() - (this.now() - this.last) / 1e3);
	}
	seconds() {
		return Math.round((this.current().localMfluxIdleMinutes ?? 10) * 60);
	}
	async configure() {
		const seconds = this.seconds();
		if (seconds < 6 || seconds > 86400 || !Number.isFinite(seconds)) throw Error("空闲时间应为0.1–1440分钟");
		if (seconds !== this.appliedSeconds) {
			await this.io.configure(this.config, seconds);
			this.appliedSeconds = seconds;
		}
	}
	acquire(config) {
		return this.serial(async () => {
			if (this.disposed) throw Error("插件正在退出，请重新提交任务");
			const key = (c) => JSON.stringify([
				sshOptions(c),
				c.remoteBaseURL,
				c.remoteApiKey
			]);
			if (this.config && key(config) !== key(this.config)) {
				if (this.active) throw Error("已有远程任务，请结束后再切换 SSH 连接设置");
				await this.close();
			}
			if (!this.tunnel.connected && this.active) throw Error("SSH 已断线，等待原任务恢复后再提交");
			if (!this.tunnel.connected) this.appliedSeconds = 0;
			await this.tunnel.connect(config);
			this.config = { ...config };
			try {
				await this.configure();
			} catch (e) {
				if (!this.active) await this.tunnel.disconnect();
				this.appliedSeconds = 0;
				throw e;
			}
			this.active++;
			this.error = "";
			if (!this.timer) {
				this.timer = setInterval(() => {
					if (this.sweeping) return;
					this.sweeping = true;
					this.sweep().catch(() => {}).finally(() => {
						this.sweeping = false;
					});
				}, 1e3);
				this.timer.unref();
			}
			let released = false;
			return () => {
				if (!released) {
					released = true;
					this.active--;
					this.last = this.now();
				}
			};
		});
	}
	async close() {
		if (this.tunnel.connected) {
			await this.io.unload(this.config);
			await this.tunnel.disconnect();
		}
		this.appliedSeconds = 0;
		if (this.timer) clearInterval(this.timer);
		this.timer = void 0;
	}
	sweep() {
		return this.serial(async () => {
			if (!this.tunnel.connected) return;
			try {
				await this.configure();
				if (this.active) return;
				if (this.remaining === 0) await this.close();
				this.error = "";
			} catch (e) {
				this.error = e instanceof Error ? e.message : String(e);
				throw e;
			}
		});
	}
	unload() {
		return this.serial(async () => {
			if (this.active) throw Error("远程仍有任务，暂不卸载");
			await this.close();
		});
	}
	reconnect(config) {
		return this.serial(async () => {
			if (this.disposed || !this.active || this.tunnel.connected) return;
			await this.tunnel.connect(config);
			this.appliedSeconds = 0;
			await this.configure();
		});
	}
	async dispose() {
		this.disposed = true;
		if (this.timer) clearInterval(this.timer);
		try {
			await this.serial(async () => {
				try {
					if (!this.active && this.tunnel.connected) await this.io.unload(this.config);
				} finally {
					await this.tunnel.disconnect();
				}
			});
		} finally {
			if (this.tunnel instanceof SshTunnel) this.tunnel.dispose();
		}
	}
};
//#endregion
//#region lib/types/worker.js
const BASE = "http://127.0.0.1:19388";
const exec$1 = promisify(execFile);
var Worker = class {
	config;
	remote = new RemoteQueue();
	transportConfig() {
		return {
			...this.config(),
			...resolveConfig(this.config())
		};
	}
	mode() {
		return resolveConfig(this.config()).connectionMode;
	}
	starting;
	editProbe;
	async referenceEditing() {
		if (this.mode() === "remote") return {
			supported: Boolean((await this.capabilities().catch(() => null))?.features.includes("reference_edit")),
			verification: this.managedSSH() ? "on_generation" : "handshake"
		};
		const { pythonPath, modelPath } = resolveConfig(this.config()), key = JSON.stringify([pythonPath, modelPath]);
		if (this.editProbe?.key === key && this.editProbe.expires > Date.now()) return this.editProbe.value;
		const bundled = resolve(dirname(fileURLToPath(import.meta.url)), "../backend/server.py");
		const value = exec$1(pythonPath, [
			bundled,
			"--check-reference-edit",
			modelPath
		], {
			timeout: 15e3,
			maxBuffer: 65536,
			env: {
				...process.env,
				HF_HUB_OFFLINE: "1"
			}
		}).then(({ stdout }) => {
			const result = JSON.parse(stdout.trim());
			if (typeof result.supported !== "boolean") throw Error("MFLUX 能力检测响应无效");
			return result;
		}).catch((e) => ({
			supported: false,
			reason: `本机原生编辑检查失败：${e.message}`
		}));
		this.editProbe = {
			key,
			expires: Date.now() + 3e4,
			value
		};
		return value;
	}
	modeGate = Promise.resolve();
	serialized(fn) {
		const result = this.modeGate.then(fn);
		this.modeGate = result.catch(() => {});
		return result;
	}
	switchConnection(mode, persist) {
		return this.serialized(async () => {
			if (mode === this.mode()) return;
			if (this.remote.size) throw Error("有远程任务正在上传、排队或生成，结束后再切换");
			try {
				const r = await fetch(BASE + "/health", { signal: AbortSignal.timeout(1500) });
				if (r.ok && (await r.json()).busy) throw Error("有本机生图任务正在运行，结束后再切换");
			} catch (e) {
				if (e instanceof Error && e.message.includes("本机生图任务")) throw e;
			}
			if (mode === "local") {
				const local = resolveConfig(this.config());
				await access(local.pythonPath);
				await access(local.modelPath);
			} else {
				remoteURL(this.transportConfig());
				sshOptions(this.transportConfig());
			}
			if (this.mode() === "remote" && this.managedSSH()) await this.lifecycle.unload();
			if (this.mode() === "local") {
				if ((await this.health()).status === "ok") await this.post("/v1/unload", {});
			}
			await persist();
			if (this.mode() !== mode) throw Error("宿主尚未确认运行位置更新，请重新读取状态");
		});
	}
	settingsKey = "";
	lifecycle;
	constructor(config) {
		this.config = config;
		this.lifecycle = new RemoteLifecycle(() => this.transportConfig(), new SshTunnel(), {
			configure: (c, seconds) => this.configureRemote(c, seconds),
			unload: (c) => this.unloadRemote(c)
		});
	}
	managedSSH() {
		return this.mode() === "remote" && Boolean(this.transportConfig().remoteSshHost?.trim());
	}
	async capabilities() {
		if (this.managedSSH() && !this.lifecycle.connected) {
			sshOptions(this.transportConfig());
			return {
				protocol: "dsh-qwen",
				version: 1,
				features: [
					...requiredFeatures,
					"reference_edit",
					"multi_image"
				],
				schedulers: [
					"linear",
					"flow_match_euler_discrete",
					"seedvr2_euler"
				],
				verification: "on_generation"
			};
		}
		return this.remote.capabilities(this.transportConfig());
	}
	async configureRemote(config, seconds) {
		const r = await fetch(remoteURL(config) + "/qwen/runtime-config", {
			method: "POST",
			headers: headers(config),
			body: JSON.stringify({ idle_seconds: seconds }),
			signal: AbortSignal.timeout(5e3),
			redirect: "error"
		});
		if (!r.ok) throw Error(`远程空闲设置失败：HTTP ${r.status}；请更新配套 Qwen 网关`);
		if ((await r.json()).idle_seconds !== seconds) throw Error("远程空闲时间未确认，请检查网关版本");
	}
	async unloadRemote(config) {
		const r = await fetch(remoteURL(config) + "/qwen/unload", {
			method: "POST",
			headers: headers(config),
			body: "{}",
			signal: AbortSignal.timeout(45e3),
			redirect: "error"
		});
		if (!r.ok || !(await r.json()).unloaded) throw Error("远程仍有任务或模型卸载未确认；保留连接稍后重试");
		const h = await fetch(remoteURL(config) + "/qwen/health", {
			headers: headers(config),
			signal: AbortSignal.timeout(5e3),
			redirect: "error"
		});
		if (!h.ok) throw Error("未能核对远程模型已卸载，保留连接");
		const health = await h.json();
		if (health.loaded || health.busy) throw Error("远程仍有任务或模型尚未退出，保留连接");
	}
	async dispose() {
		await this.remote.dispose();
		await this.lifecycle.dispose();
	}
	directory() {
		return resolveConfig(this.config()).localMfluxDirectory;
	}
	async sync() {
		const effective = resolveConfig(this.config()), dir = effective.localMfluxDirectory, minutes = effective.localMfluxIdleMinutes, loraDirectory = effective.loraDirectory;
		const key = JSON.stringify([
			dir,
			minutes,
			loraDirectory
		]);
		if (key === this.settingsKey) return;
		await mkdir(join(dir, "state"), { recursive: true });
		await atomicJSON(join(dir, "state/runtime-config.json"), {
			idle_seconds: Math.round(minutes * 60),
			lora_directory: loraDirectory
		});
		this.settingsKey = key;
	}
	async health() {
		try {
			if (this.mode() === "remote") {
				if (this.managedSSH() && !this.lifecycle.connected) return {
					status: "remote",
					loaded: false,
					busy: this.remote.size > 0,
					ssh_status: "disconnected"
				};
				if (!await this.capabilities()) return {
					status: "remote",
					busy: this.remote.size > 0
				};
				const r = await fetch(remoteURL(this.transportConfig()) + "/qwen/health", {
					headers: headers(this.transportConfig()),
					signal: AbortSignal.timeout(2e3),
					redirect: "error"
				});
				if (!r.ok) throw Error("远程状态不可用");
				return {
					...await r.json(),
					status: "remote",
					...this.managedSSH() ? {
						ssh_status: "connected",
						...this.lifecycle.remaining !== void 0 ? { idle_remaining_seconds: this.lifecycle.remaining } : {},
						connection_error: this.lifecycle.error
					} : {}
				};
			}
			const r = await fetch(BASE + "/health", { signal: AbortSignal.timeout(1500) });
			if (!r.ok) throw Error();
			return await r.json();
		} catch {
			return { status: "offline" };
		}
	}
	async ensure() {
		if (!this.starting) this.starting = this.start().finally(() => {
			this.starting = void 0;
		});
		return this.starting;
	}
	async start() {
		await this.sync();
		let h = await upgradeIdleWorker(await this.health(), () => this.post("/v1/unload", {}), () => this.health());
		if (h.status === "ok" && !h.closing) {
			if (h.version !== 8) throw Error("旧版生图服务尚未退出，请等待空闲卸载后重试");
			return;
		}
		for (let n = 0; h.closing && n < 20; n++) {
			await new Promise((r) => setTimeout(r, 200));
			h = await this.health();
		}
		const dir = this.directory(), python = resolveConfig(this.config()).pythonPath;
		const model = resolveConfig(this.config()).modelPath;
		await access(model);
		const bundled = resolve(dirname(fileURLToPath(import.meta.url)), "../backend/server.py");
		await copyFile(bundled, join(dir, "server.py"));
		await access(python);
		const fd = openSync(join(dir, "state/service.log"), "a", 384);
		const child = spawn(python, ["-u", join(dir, "server.py")], {
			cwd: dir,
			stdio: [
				"ignore",
				fd,
				fd
			],
			env: {
				...process.env,
				HF_HUB_OFFLINE: "1",
				QWEN_DATA_DIR: dir,
				QWEN_MODEL_PATH: model,
				HF_HOME: resolveConfig(this.config()).hfHome
			}
		});
		closeSync(fd);
		child.unref();
		let error;
		child.once("error", (e) => {
			error = e;
		});
		for (let i = 0; i < 100; i++) {
			if (error) throw error;
			if (child.exitCode !== null) throw Error("本地服务启动失败，请查看service.log");
			h = await this.health();
			if (h.status === "ok" && h.version === 8 && !h.closing) return;
			await new Promise((r) => setTimeout(r, 150));
		}
		throw Error("本地服务启动超时");
	}
	async check() {
		if (this.mode() === "remote") {
			if (this.managedSSH() && !this.lifecycle.connected) {
				sshOptions(this.transportConfig());
				return {
					ok: true,
					message: "按需 SSH 配置格式有效。当前未连接；真正提交生图时才建立连接并验证服务器，不启动模型。"
				};
			}
			const response = await fetch(remoteURL(this.transportConfig()) + "/models", {
				headers: headers(this.transportConfig()),
				signal: AbortSignal.timeout(8e3),
				redirect: "error"
			});
			if (!response.ok) throw Error(`远程连接失败：HTTP ${response.status}`);
			const data = await response.json();
			return {
				ok: true,
				message: await this.remote.capabilities(this.transportConfig()) ? "Qwen 远程网关可达；支持 LoRA、结构控制、蒙版、参考变体和真实步数进度。" : "远程接口可达；基础 Images API，仅支持文生图。",
				models: data.data?.map((m) => m.id) ?? []
			};
		}
		this.directory();
		const python = resolveConfig(this.config()).pythonPath, model = resolveConfig(this.config()).modelPath;
		await access(python);
		try {
			await Promise.any([
				"model_index.json",
				"config.json",
				"transformer/config.json"
			].map((file) => access(join(model, file))));
		} catch {
			throw Error("模型目录中未找到model_index.json或模型配置文件，请选择完整的Qwen模型目录");
		}
		return {
			ok: true,
			message: "Python与模型目录存在。首次生成会验证MFLUX及模型组件。",
			python,
			model
		};
	}
	transfers = 0;
	maintenance = false;
	retired = false;
	async withActivity(fn) {
		if (this.maintenance || this.retired) throw Error("插件正在维护或等待手动重启，请稍后再试");
		this.transfers++;
		try {
			return await fn();
		} finally {
			this.transfers--;
		}
	}
	withMaintenance(fn) {
		return this.serialized(async () => {
			if (this.transfers || this.remote.size) throw Error("正在上传、排队或生成，更新已延后；任务结束后重试");
			this.maintenance = true;
			try {
				if ((await readJobs(this.directory())).some((j) => [
					"queued",
					"uploading",
					"loading",
					"running",
					"saving",
					"cancelling"
				].includes(j.status))) throw Error("图库仍有未结束任务，更新已延后");
				if ((await this.health()).busy) throw Error("生图服务正在工作，更新已延后");
				let localBusy = false;
				try {
					const r = await fetch(BASE + "/health", { signal: AbortSignal.timeout(1500) });
					if (r.ok) localBusy = Boolean((await r.json()).busy);
				} catch {}
				if (localBusy) throw Error("本机仍有生图任务，更新已延后");
				const result = await fn();
				this.retired = true;
				return result;
			} finally {
				this.maintenance = false;
			}
		});
	}
	async post(path, data, start = false) {
		if (start) return this.serialized(() => this.withActivity(() => this.submit(path, data)));
		return this.submit(path, data, false);
	}
	async submit(path, data, start = true) {
		const referenceMode = data?.reference_mode;
		const sourceIds = data?.source_image_ids;
		if (path === "/v1/jobs" && Array.isArray(sourceIds) && sourceIds.length && this.mode() !== "remote") throw Error("多图参考仅支持已更新的远程 Qwen 网关；本机请用单张 source_image_id");
		if (path === "/v1/jobs" && referenceMode === "edit" && this.mode() === "local") {
			const support = await this.referenceEditing();
			if (!support.supported) throw Error(support.reason || "当前本机 MFLUX 或模型不支持原生参考编辑；不会自动切换后端");
		}
		if (start && this.mode() === "remote") {
			const config = this.transportConfig();
			let release;
			try {
				if (this.managedSSH()) release = await this.lifecycle.acquire(config);
				else if (await this.capabilities()) await this.configureRemote(config, Math.round((config.localMfluxIdleMinutes ?? 10) * 60));
				return await this.remote.submit(this.directory(), config, data, release, this.managedSSH() ? () => this.lifecycle.reconnect(config) : void 0);
			} catch (e) {
				release?.();
				throw e;
			}
		}
		if (path === "/v1/unload" && this.mode() === "remote") {
			if (this.managedSSH()) {
				await this.lifecycle.unload();
				return {
					unloaded: true,
					disconnected: true
				};
			}
			if (!await this.remote.capabilities(this.transportConfig())) throw Error("普通远程接口不支持释放模型");
			const r = await fetch(remoteURL(this.transportConfig()) + "/qwen/unload", {
				method: "POST",
				headers: headers(this.transportConfig()),
				body: "{}",
				signal: AbortSignal.timeout(45e3),
				redirect: "error"
			});
			if (!r.ok) throw Error("远程仍有任务或释放失败，请查询当前任务状态");
			return r.json();
		}
		if (path === "/v1/cancel") {
			const id = data.id;
			if ((await readJobs(this.directory())).find((j) => j.id === id)?.source === "remote") return this.remote.cancel(id);
		}
		if (start) await this.ensure();
		const token = (await readFile(join(this.directory(), "state/api-key"), "utf8")).trim();
		const response = await fetch(BASE + path, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${token}`
			},
			body: JSON.stringify(data),
			signal: AbortSignal.timeout(1e4)
		});
		const value = await response.json();
		if (!response.ok) throw Error(value.error ?? "本地任务请求失败");
		return value;
	}
};
//#endregion
//#region lib/types/generation-parameters.js
const generationParameters = {
	prompt: {
		type: "string",
		required: true,
		description: "Visual description: subject, composition, lighting, style and exact text if needed."
	},
	width: {
		type: "integer",
		description: "Width in pixels, 512–2048, multiple of16; default1024."
	},
	height: {
		type: "integer",
		description: "Height in pixels, 512–2048, multiple of16; default1024."
	},
	steps: {
		type: "integer",
		description: "Sampling steps1–60, default40."
	},
	seed: {
		type: "integer",
		description: "Optional reproducible seed0–4294967295."
	},
	source_image_ids: {
		type: "array",
		items: { type: "string" },
		description: "Qwen 2.1 native multi-image edit: 2–8 imported image ids. Use only with reference_mode=edit; the prompt addresses them as <image1>, <image2>, …. Do not combine with source_image_id, change_strength, mask or ControlNet. Remote gateway only."
	},
	source_image_id: {
		type: "string",
		description: "Optional real 32-character image id from qwen_image_import, qwen_image_resources or an earlier qwen_generate_image result. Import new URLs/files/attachments with qwen_image_import first. Img2img on local or the Qwen gateway; never invent an id or pass a filesystem path. Omit for a new composition."
	},
	change_strength: {
		type: "number",
		description: "Only with source_image_id and variation mode (never edit): variation strength 0.05–0.95, default 0.45. Lower preserves more of the source; higher changes more. Not a guarantee of exact local edits."
	},
	reference_mode: {
		type: "string",
		description: "variation (default, preserves old presets) uses partial denoising and change_strength; edit uses native Qwen 2.1 image+text reference conditioning and the full sampling schedule for instruction/style edits. edit requires supported local MFLUX with a complete vision-capable checkpoint or the updated Qwen remote gateway, source_image_id, linear scheduler and dimensions divisible by32; do not supply change_strength, mask or ControlNet. Query qwen_image_resources reference_edit.supported for the current backend. Use edit for watercolor/style transfer or requested changes; variation may strongly reconstruct the photo despite a different prompt."
	},
	negative_prompt: {
		type: "string",
		description: "Qwen-Image-Edit officially recommends an empty or whitespace negative prompt. A long list fights the reference attributes and raises guidance to 2.5 (about 2× slower); use at most a few targeted terms. For text-to-image, a short quality list is enough. Omit to skip the negative branch entirely."
	},
	guidance: {
		type: "number",
		description: "Local or Qwen gateway: true CFG strength 1–10, default 1. For plain text-to-image it requires a nonempty negative_prompt. ControlNet/mask branches can use it with an empty negative prompt. Not a general quality control."
	},
	scheduler: {
		type: "string",
		description: "Local or Qwen gateway: linear (default), flow_match_euler_discrete, or seedvr2_euler. Use linear unless the user requests another supported scheduler."
	},
	lora_paths: {
		type: "array",
		items: { type: "string" },
		description: "Local or Qwen gateway: absolute paths of 1–8 LoRA .safetensors files, stacked on the base model. The files must exist and live under one of the allowed LoRA roots. Pair with lora_scales."
	},
	lora_scales: {
		type: "array",
		items: { type: "number" },
		description: "One weight per lora_paths entry, 0.0–2.0. Omit to use 1.0 for every entry. Use weights compatible with the specific LoRA; do not invent paths."
	},
	controlnet_image_id: {
		type: "string",
		description: "Local or Qwen gateway: 32-character id of an imported or gallery control image (line art, Canny, depth, pose). Structure comes from the control image and content from the prompt, so it pins composition and pose. Import new control images with qwen_image_import(kind=control) or select an existing id with qwen_image_resources; never invent an id or pass a filesystem path."
	},
	controlnet_strength: {
		type: "number",
		description: "Only with controlnet_image_id: 0.0–1.0, default 1.0 (strongest); 0 turns the control off. 0.7–1.0 is the common range."
	},
	mask_image_id: {
		type: "string",
		description: "Inpaint on local or Qwen gateway. 32-character id of an imported or gallery mask where white is redrawn from the prompt and black is preserved. Import new masks with qwen_image_import(kind=mask). Requires source_image_id as the source image; black areas are copied from the source at output size. Do not pass change_strength with a mask. ControlNet and masks require a complete Union checkpoint on the executing server and the default scheduler; source_image_id with ControlNet requires a mask."
	}
};
//#endregion
//#region lib/types/client/creation-draft.js
const draftDefaults = {
	prompt: "",
	negativePrompt: "",
	guidance: 1,
	scheduler: "linear",
	size: "1024x1024",
	steps: 40,
	seed: "",
	sourceId: "",
	sourceName: "",
	additionalSourceIds: [],
	additionalSourceNames: [],
	referenceMode: "variation",
	changeStrength: .45,
	loras: [],
	controlId: "",
	controlName: "",
	controlEnabled: false,
	controlStrength: 1,
	maskId: "",
	maskName: "",
	maskEnabled: false,
	maskSourceId: "",
	maskSourceName: ""
};
const controlled = (draft) => Boolean(draft.controlEnabled || draft.maskEnabled);
function generationPayload$1(draft, remote, id) {
	const loras = draft.loras.filter((l) => l.enabled !== false), sourceId = draft.maskEnabled ? draft.maskSourceId || draft.sourceId : draft.sourceId;
	const [width, height] = draft.size.split("x").map(Number), seed = draft.seed.trim() === "" ? null : Number(draft.seed);
	if (!["variation", "edit"].includes(draft.referenceMode ?? "variation")) throw Error("参考图模式无效");
	const additional = (draft.additionalSourceIds ?? []).filter(Boolean);
	const allSources = sourceId ? [sourceId, ...additional] : [];
	if (additional.length && (draft.referenceMode !== "edit" || draft.maskEnabled || draft.controlEnabled)) throw Error("多图参考只用于原生参考编辑，不能叠加蒙版或结构控制");
	if (allSources.length > 8) throw Error("多图参考最多8张");
	const editing = draft.referenceMode === "edit" && Boolean(sourceId) && !draft.maskEnabled;
	if (editing && (draft.controlEnabled || draft.scheduler !== "linear" || width % 32 || height % 32)) throw Error("原生参考编辑需要 linear、32的倍数尺寸，且不能叠加结构控制");
	if (loras.some((l) => l.missing)) throw Error("请重新选择失效的 LoRA，或停用它");
	const missing = draft.missingResources ?? {};
	if (draft.maskEnabled && (missing.maskSourceId || !draft.maskSourceId && missing.sourceId || missing.maskId) || draft.controlEnabled && missing.controlId || !draft.maskEnabled && missing.sourceId) throw Error("预设引用的图片已失效，请重新选择或移除失效引用");
	if (missing.sourceExtra) throw Error("多图参考中有图片已失效，请重新选择或移除");
	if (!Number.isFinite(draft.guidance) || draft.guidance < 1 || draft.guidance > 10 || draft.negativePrompt.length > 8e3) throw Error("负向提示词或引导强度无效");
	if (![
		"linear",
		"flow_match_euler_discrete",
		"seedvr2_euler"
	].includes(draft.scheduler)) throw Error("调度器无效");
	if (controlled(draft) && draft.scheduler !== "linear") throw Error("结构控制与局部重绘仅支持 linear 调度器，请切换后再生成");
	if (remote && (draft.negativePrompt.trim() || draft.guidance !== 1 || draft.scheduler !== "linear")) throw Error("当前远程接口不支持负向提示词、CFG 与调度器");
	if (!draft.prompt.trim()) throw Error("先描述你想看到的画面");
	if (seed !== null && (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32)) throw Error("种子需为0–4294967295的整数");
	if (!Number.isInteger(draft.steps) || draft.steps < 1 || draft.steps > 60) throw Error("步数需为1–60");
	if ([width, height].some((n) => !Number.isInteger(n) || Number(n) < 512 || Number(n) > 2048 || Number(n) % 16)) throw Error("输出尺寸无效");
	if (remote && (sourceId || additional.length || loras.length || controlled(draft))) throw Error("参考图、LoRA、ControlNet 和蒙版仅支持本地模式；请切换本地模式或移除已选参数");
	if (draft.controlEnabled && !draft.controlId) throw Error("请先选择 ControlNet 控制图，或关闭结构控制");
	if (draft.maskEnabled && (!draft.maskId || !sourceId)) throw Error("局部重绘需要同时选择原图和蒙版，或关闭局部重绘");
	if (draft.controlEnabled && sourceId && !draft.maskEnabled) throw Error("控制图与参考原图同时使用时，请开启局部重绘并选择蒙版；仅用结构控制时可移除原图");
	if (sourceId && !draft.maskEnabled && !additional.length && (!Number.isFinite(draft.changeStrength) || draft.changeStrength < .05 || draft.changeStrength > .95)) throw Error("参考图变化幅度范围5%–95%");
	if (draft.loras.length > 8 || loras.some((l) => !Number.isFinite(l.scale) || l.scale < 0 || l.scale > 2)) throw Error("LoRA 最多8个，权重范围0–2");
	if (draft.controlEnabled && (!Number.isFinite(draft.controlStrength) || draft.controlStrength < 0 || draft.controlStrength > 1)) throw Error("控制强度范围0–1");
	return {
		id,
		prompt: draft.prompt,
		width,
		height,
		steps: draft.steps,
		seed,
		...!remote ? {
			negative_prompt: draft.negativePrompt.trim() || null,
			guidance: draft.guidance,
			scheduler: draft.scheduler
		} : {},
		...allSources.length > 1 ? {
			source_image_ids: allSources,
			reference_mode: "edit"
		} : sourceId ? {
			source_image_id: sourceId,
			...!draft.maskEnabled ? editing ? { reference_mode: "edit" } : { change_strength: draft.changeStrength } : {}
		} : {},
		...loras.length ? {
			lora_paths: loras.map((l) => l.path),
			lora_scales: loras.map((l) => l.scale),
			lora_names: loras.map((l) => l.name)
		} : {},
		...draft.controlEnabled ? {
			controlnet_image_id: draft.controlId,
			controlnet_strength: draft.controlStrength
		} : {},
		...draft.maskEnabled ? { mask_image_id: draft.maskId } : {}
	};
}
function reuseDraft(job, asReference) {
	return {
		prompt: job.prompt,
		negativePrompt: job.negative_prompt ?? "",
		guidance: job.guidance ?? 1,
		scheduler: job.scheduler ?? "linear",
		missingResources: {},
		size: `${job.width}x${job.height}`,
		steps: job.steps,
		seed: String(job.seed),
		sourceId: asReference ? job.id : job.mask_image_id ? "" : job.source_image_ids?.[0] ?? job.source_image_id ?? "",
		sourceName: asReference ? "上一张生成结果" : "参考原图",
		additionalSourceIds: !asReference && !job.mask_image_id ? job.source_image_ids?.slice(1) ?? [] : [],
		additionalSourceNames: !asReference && !job.mask_image_id ? job.source_image_ids?.slice(1).map(() => "多图参考") ?? [] : [],
		referenceMode: asReference ? "variation" : job.reference_mode ?? "variation",
		changeStrength: asReference ? .45 : job.change_strength ?? .45,
		controlId: asReference ? "" : job.controlnet_image_id ?? "",
		controlName: "控制图",
		controlEnabled: !asReference && Boolean(job.controlnet_image_id),
		maskSourceId: asReference || !job.mask_image_id ? "" : job.source_image_id ?? "",
		maskSourceName: "参考原图",
		maskId: asReference ? "" : job.mask_image_id ?? "",
		maskName: "蒙版",
		maskEnabled: !asReference && Boolean(job.mask_image_id),
		controlStrength: job.controlnet_strength ?? 1,
		loras: (job.lora_paths ?? []).map((path, i) => ({
			path,
			name: job.lora_names?.[i] ?? path.split("/").at(-1) ?? "LoRA",
			scale: job.lora_scales?.[i] ?? 1
		}))
	};
}
//#endregion
//#region lib/types/presets.js
const imageKeys = [
	"sourceId",
	"controlId",
	"maskId",
	"maskSourceId"
];
const cleanName = (name) => {
	if (typeof name !== "string" || !name.trim() || name.trim().length > 80) throw Error("预设名称需为1–80个字符");
	return name.trim();
};
const id = () => randomUUID().replaceAll("-", "");
function presetValues(input) {
	if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("预设参数格式无效");
	const value = input, allowed = Object.keys(draftDefaults).filter((k) => k !== "prompt");
	if (Object.keys(value).some((k) => !allowed.includes(k))) throw Error("预设含有不支持的字段；连接配置、路径设置和密钥不可导入");
	const d = {
		...draftDefaults,
		...value
	};
	if (!["variation", "edit"].includes(d.referenceMode)) throw Error("参考图模式无效");
	delete d.prompt;
	for (const key of [
		"size",
		"seed",
		"sourceId",
		"sourceName",
		"controlId",
		"controlName",
		"maskId",
		"maskName",
		"maskSourceId",
		"maskSourceName",
		"negativePrompt"
	]) if (typeof d[key] !== "string") throw Error("预设文本字段无效");
	for (const key of imageKeys) if (d[key] && !/^[a-f0-9]{32}$/.test(d[key])) throw Error("图片资源 ID 无效");
	if (!Array.isArray(d.additionalSourceIds) || d.additionalSourceIds.length > 7 || d.additionalSourceIds.some((id) => typeof id !== "string" || !/^[a-f0-9]{32}$/.test(id)) || new Set(d.additionalSourceIds).size !== d.additionalSourceIds.length || d.sourceId && d.additionalSourceIds.includes(d.sourceId)) throw Error("多图参考 ID 无效或重复");
	if (!Array.isArray(d.additionalSourceNames) || d.additionalSourceNames.length !== d.additionalSourceIds.length || d.additionalSourceNames.some((name) => typeof name !== "string" || name.length > 180)) throw Error("多图参考名称无效");
	if (!/^\d+x\d+$/.test(d.size) || d.size.split("x").some((n) => !Number.isInteger(+n) || +n < 512 || +n > 2048 || +n % 16)) throw Error("预设尺寸无效");
	if (!Number.isInteger(d.steps) || d.steps < 1 || d.steps > 60 || d.seed !== "" && (!/^\d+$/.test(d.seed) || +d.seed >= 2 ** 32)) throw Error("预设步数或种子无效");
	for (const [key, min, max] of [
		[
			"changeStrength",
			.05,
			.95
		],
		[
			"controlStrength",
			0,
			1
		],
		[
			"guidance",
			1,
			10
		]
	]) if (!Number.isFinite(d[key]) || d[key] < min || d[key] > max) throw Error("预设参数范围无效：" + key);
	for (const key of ["controlEnabled", "maskEnabled"]) if (typeof d[key] !== "boolean") throw Error("预设开关无效");
	if (d.negativePrompt.length > 8e3 || ![
		"linear",
		"flow_match_euler_discrete",
		"seedvr2_euler"
	].includes(d.scheduler)) throw Error("负向提示词或调度器无效");
	if (!Array.isArray(d.loras) || d.loras.length > 8) throw Error("预设最多8个 LoRA");
	d.loras = d.loras.map((l) => {
		if (!l || typeof l.path !== "string" || typeof l.name !== "string" || l.name.length > 180 || !Number.isFinite(l.scale) || l.scale < 0 || l.scale > 2 || l.enabled !== void 0 && typeof l.enabled !== "boolean") throw Error("预设 LoRA 无效");
		return {
			path: l.path,
			name: l.name,
			scale: l.scale,
			enabled: l.enabled !== false
		};
	});
	return d;
}
async function reference(config, r) {
	return {
		id: r.id,
		kind: r.kind,
		name: r.name,
		bytes: r.bytes,
		fingerprint: await resourceFingerprint(config, r)
	};
}
async function capturePreset(config, name, input) {
	const values = presetValues(input), { items } = await listResources(config), resources = {};
	for (const key of imageKeys) if (values[key]) {
		const r = items.find((r) => r.kind !== "lora" && r.id === values[key]);
		if (!r) throw Error("图片资源已失效，请重新选择：" + key);
		resources[key] = await reference(config, r);
	}
	for (const [i, id] of values.additionalSourceIds.entries()) {
		const r = items.find((r) => r.kind !== "lora" && r.id === id);
		if (!r) throw Error("多图参考图片已失效：" + id);
		resources[`sourceExtra:${i}`] = await reference(config, r);
	}
	for (const [i, l] of values.loras.entries()) {
		const canonical = await realpath(l.path).catch(() => null), r = items.find((r) => r.kind === "lora" && r.path === canonical);
		if (!r) throw Error("LoRA 不在可用资源库：" + l.name);
		resources["lora:" + i] = await reference(config, r);
	}
	return {
		id: id(),
		name: cleanName(name),
		values,
		resources
	};
}
async function loadPreset(config, preset) {
	const draft = {
		...draftDefaults,
		...preset.values,
		prompt: "",
		loras: preset.values.loras.map((l) => ({ ...l })),
		additionalSourceIds: [],
		additionalSourceNames: []
	}, issues = [], missingResources = {};
	const { items } = await listResources(config);
	for (const [key, ref] of Object.entries(preset.resources)) {
		let found;
		const candidates = items.filter((r) => ref.kind === "lora" === (r.kind === "lora") && r.bytes === ref.bytes);
		candidates.sort((a, b) => Number(b.id === ref.id) - Number(a.id === ref.id));
		for (const r of candidates) if (await resourceFingerprint(config, r) === ref.fingerprint) {
			found = r;
			break;
		}
		const match = /^lora:(\d)$/.exec(key);
		if (match) {
			const l = draft.loras[+match[1]];
			if (!l) throw Error("预设 LoRA 引用无效");
			l.path = found?.path || "";
			l.name = found?.name || ref.name;
			l.missing = !found;
		} else if (key.startsWith("sourceExtra:")) {
			const index = Number(key.slice(12));
			if (!Number.isInteger(index) || index < 0 || index >= 7) throw Error("预设多图引用无效");
			draft.additionalSourceIds[index] = found?.id || "";
			draft.additionalSourceNames[index] = found?.name || ref.name;
			if (!found) missingResources["sourceExtra"] = ref.name;
		} else if (imageKeys.includes(key)) {
			draft[key] = found?.id || "";
			if (!found) missingResources[key] = ref.name;
		} else throw Error("预设资源引用无效");
		if (!found) issues.push("缺失或已变化：" + ref.name);
	}
	draft.missingResources = missingResources;
	return {
		draft,
		issues
	};
}
function validatePreset(p) {
	if (!p || typeof p !== "object" || !p.resources || typeof p.resources !== "object" || Array.isArray(p.resources)) throw Error("预设记录无效");
	const values = presetValues(p.values), resources = {};
	for (const [key, value] of Object.entries(p.resources)) {
		const r = value;
		if (!imageKeys.includes(key) && !/^sourceExtra:[0-6]$/.test(key) && !/^lora:[0-7]$/.test(key) || !r || typeof r.name !== "string" || r.name.length > 180 || ![
			"lora",
			"source",
			"control",
			"mask",
			"image"
		].includes(r.kind) || !Number.isSafeInteger(r.bytes) || r.bytes < 0 || !/^[a-f0-9]{64}$/.test(r.fingerprint) || /^lora:/.test(key) !== (r.kind === "lora")) throw Error("预设资源清单无效");
		resources[key] = {
			kind: r.kind,
			name: r.name,
			bytes: r.bytes,
			fingerprint: r.fingerprint,
			...typeof r.id === "string" && /^(?:lora-)?[a-f0-9]{32,64}$/.test(r.id) ? { id: r.id } : {}
		};
	}
	for (const [i] of values.loras.entries()) if (!resources["lora:" + i]) throw Error("LoRA 缺少资源清单");
	for (const key of imageKeys) if (values[key] && !resources[key]) throw Error("图片缺少资源清单");
	return {
		id: typeof p.id === "string" && /^[a-f0-9]{32}$/.test(p.id) ? p.id : id(),
		name: cleanName(p.name),
		values,
		resources
	};
}
function exportPresets(store, selectedId) {
	return {
		format: "qwen-studio-presets",
		schemaVersion: 1,
		items: (selectedId ? store.items.filter((p) => p.id === selectedId) : store.items).map((p) => {
			const values = structuredClone(p.values);
			values.loras.forEach((l) => l.path = "");
			imageKeys.forEach((key) => values[key] = "");
			values.additionalSourceIds = [];
			values.additionalSourceNames = [];
			return {
				...p,
				values,
				resources: Object.fromEntries(Object.entries(p.resources).map(([key, r]) => {
					const { id: _, ...portable } = r;
					return [key, portable];
				}))
			};
		})
	};
}
async function readPresets(dir) {
	try {
		const data = JSON.parse(await readFile(join(dir, "state/presets.json"), "utf8"));
		if (data.schemaVersion !== 1 || !Array.isArray(data.items) || !Number.isSafeInteger(data.revision)) throw Error("预设文件格式无效");
		return {
			...data,
			items: data.items.map(validatePreset)
		};
	} catch (error) {
		if (error.code === "ENOENT") return {
			schemaVersion: 1,
			revision: 0,
			defaultId: null,
			items: []
		};
		throw error;
	}
}
const locks = /* @__PURE__ */ new Map();
function mutatePresets(config, data) {
	const dir = config.localMfluxDirectory;
	const next = (locks.get(dir) || Promise.resolve()).catch(() => {}).then(async () => {
		const store = await readPresets(dir);
		if (data.revision !== store.revision) throw Error("预设已在其他页面更新，请刷新后重试");
		const item = store.items.find((p) => p.id === data.id);
		if (data.action === "save") {
			const created = await capturePreset(config, data.name, data.values);
			if (data.id && !item) throw Error("预设不存在");
			if (item) {
				created.id = item.id;
				store.items[store.items.indexOf(item)] = created;
			} else store.items.push(created);
		} else if (data.action === "rename") {
			if (!item) throw Error("预设不存在");
			item.name = cleanName(data.name);
		} else if (data.action === "delete") {
			if (!item) throw Error("预设不存在");
			store.items = store.items.filter((p) => p !== item);
			if (store.defaultId === item.id) store.defaultId = null;
		} else if (data.action === "default") {
			if (data.id !== null && !item) throw Error("预设不存在");
			store.defaultId = data.id;
		} else if (data.action === "restore") {
			const backup = JSON.parse(await readFile(join(dir, "state/presets.backup.json"), "utf8"));
			if (backup.schemaVersion !== 1 || !Array.isArray(backup.items)) throw Error("没有可恢复的预设");
			store.items = backup.items.map(validatePreset);
			store.defaultId = backup.defaultId;
		} else if (data.action === "import") {
			const document = data.document;
			if (document?.format !== "qwen-studio-presets" || document.schemaVersion !== 1 || !Array.isArray(document.items) || document.items.length > 100) throw Error("不支持的预设文件");
			const incoming = document.items.map(validatePreset);
			for (const p of incoming) {
				p.id = id();
				store.items.push(p);
			}
		} else throw Error("预设操作无效");
		if (store.items.length > 100) throw Error("最多保存100个预设");
		const state = join(dir, "state");
		await mkdir(state, { recursive: true });
		if (await realpath(state) !== join(await realpath(dir), "state")) throw Error("预设目录不可使用符号链接");
		if (store.revision) await atomicJSON(join(state, "presets.backup.json"), await readPresets(dir));
		store.revision++;
		await atomicJSON(join(state, "presets.json"), store);
		return store;
	});
	locks.set(dir, next);
	next.finally(() => {
		if (locks.get(dir) === next) locks.delete(dir);
	}).catch(() => {});
	return next;
}
//#endregion
//#region lib/types/image-dns.js
const fakePool = new BlockList();
fakePool.addSubnet("198.18.0.0", 15, "ipv4");
/** Fake-IP TUN DNS cannot establish whether a destination is public. Resolve only
* these synthetic answers over HTTPS, then let the importer validate and pin them.
* This is per-request DNS, never a change to the machine's proxy/DNS settings. */
async function imageAddresses(host, signal) {
	const literal = isIP(host);
	if (literal) return [{
		address: host,
		family: literal
	}];
	const system = await lookup(host, {
		all: true,
		verbatim: true
	});
	if (!system.length || !system.every((a) => isIP(a.address) === 4 && fakePool.check(a.address, "ipv4"))) return system;
	for (const endpoint of ["https://dns.alidns.com/resolve", "https://cloudflare-dns.com/dns-query"]) {
		signal.throwIfAborted();
		try {
			const url = new URL(endpoint);
			url.searchParams.set("name", host);
			url.searchParams.set("type", "A");
			const body = await new Promise((accept, reject) => {
				const req = request(url, {
					agent: false,
					signal: AbortSignal.any([signal, AbortSignal.timeout(8e3)]),
					headers: { Accept: "application/dns-json" }
				}, (res) => {
					if (res.statusCode !== 200) {
						res.destroy();
						reject(Error("DNS response status"));
						return;
					}
					let body = "";
					res.on("data", (chunk) => {
						body += chunk;
						if (body.length > 65536) res.destroy(Error("DNS response too large"));
					});
					res.on("error", reject);
					res.on("end", () => accept(body));
				});
				req.on("error", reject);
				req.end();
			});
			const data = JSON.parse(body);
			if (data.Status !== 0) throw Error("DNS query failed");
			const answers = (data.Answer ?? []).filter((a) => a.type === 1 && isIP(a.data) === 4).map((a) => ({
				address: a.data,
				family: 4
			}));
			if (!answers.length) throw Error("DNS query returned no IPv4 address");
			return answers;
		} catch {
			signal.throwIfAborted();
		}
	}
	throw Error("当前 DNS 返回代理虚拟地址，真实公网地址核验失败；请换用可访问的图片链接或本机文件");
}
//#endregion
//#region lib/types/image-import.js
const limit = 67108864;
const blocked4 = new BlockList();
const blocked6 = new BlockList();
const global6 = new BlockList();
global6.addSubnet("2000::", 3, "ipv6");
for (const [network, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.0.2.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["198.51.100.0", 24],
	["203.0.113.0", 24],
	["224.0.0.0", 3]
]) blocked4.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
	["::", 96],
	["::ffff:0:0", 96],
	["64:ff9b::", 96],
	["64:ff9b:1::", 48],
	["100::", 64],
	["2001::", 23],
	["2001:db8::", 32],
	["2002::", 16],
	["fc00::", 7],
	["fe80::", 10],
	["ff00::", 8]
]) blocked6.addSubnet(network, prefix, "ipv6");
function isPublicImageAddress(address) {
	const family = isIP(address);
	return family === 4 ? !blocked4.check(address, "ipv4") : family === 6 && global6.check(address, "ipv6") && !blocked6.check(address, "ipv6");
}
/** Validate every hop and pin DNS to the checked address; never forward cookies or auth. */
async function openPublicImage(input, signal) {
	let url;
	try {
		url = new URL(input);
	} catch {
		throw Error("请提供图片的完整 HTTP/HTTPS 地址");
	}
	for (let hop = 0; hop <= 5; hop++) {
		signal.throwIfAborted();
		if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("图片地址仅支持无用户名密码的 HTTP/HTTPS 链接");
		const addresses = await imageAddresses(url.hostname.replace(/^\[|\]$/g, ""), signal);
		signal.throwIfAborted();
		if (!addresses.length || addresses.some(({ address }) => !isPublicImageAddress(address))) throw Error("网址导入仅支持公网图片；本机文件请使用 path，不能访问本机、内网或 Tailscale 地址");
		const selected = addresses.find((a) => a.family === 4) ?? addresses[0];
		const response = await new Promise((accept, reject) => {
			const request$2 = (url.protocol === "https:" ? request : request$1)(url, {
				agent: false,
				signal,
				headers: {
					Accept: "image/png,image/jpeg,image/webp",
					"User-Agent": "DSH-Qwen-Studio image-import"
				},
				lookup: (_hostname, options, callback) => {
					if (options.all) callback(null, [{
						address: selected.address,
						family: selected.family
					}]);
					else callback(null, selected.address, selected.family);
				}
			}, accept);
			request$2.on("error", reject);
			request$2.end();
		});
		if ([
			301,
			302,
			303,
			307,
			308
		].includes(response.statusCode ?? 0)) {
			response.destroy();
			if (!response.headers.location || hop === 5) throw Error("图片重定向过多或缺少目标地址");
			url = new URL(response.headers.location, url);
			continue;
		}
		if (response.statusCode !== 200) {
			response.destroy();
			throw Error(`图片下载失败（HTTP ${response.statusCode}）；请选择可公开访问的图片直链`);
		}
		const type = (response.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
		if (type && ![
			"image/png",
			"image/jpeg",
			"image/webp",
			"application/octet-stream",
			"binary/octet-stream"
		].includes(type)) {
			response.destroy();
			throw Error("网址未返回 PNG/JPEG/WebP 图片，请从搜索结果取得图片直链，不要传网页地址");
		}
		if (Number(response.headers["content-length"] ?? 0) > limit) {
			response.destroy();
			throw Error("图片不能超过64MiB");
		}
		let name = "网络参考图";
		try {
			name = basename(decodeURIComponent(url.pathname)) || name;
		} catch {}
		return {
			response,
			name
		};
	}
	throw Error("图片重定向过多");
}
async function* one(data) {
	yield data;
}
/** Import into the same managed library as the file picker, without starting inference/SSH. */
async function importImage(args, options) {
	const kind = args.kind ?? "source";
	if (![
		"source",
		"control",
		"mask"
	].includes(kind)) throw Error("图片用途必须为 source、control 或 mask");
	if ([
		args.url,
		args.path,
		args.attachment
	].filter((value) => value !== void 0).length !== 1) throw Error("必须且只能提供 url、path、attachment 其中一项");
	const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(6e4)]) : AbortSignal.timeout(6e4);
	signal.throwIfAborted();
	const save = (name, data) => importAsset(options.directory, options.python, kind, args.name || name, data, signal);
	if (args.url !== void 0) {
		const { response, name } = await openPublicImage(args.url, signal);
		try {
			return await save(name, response);
		} finally {
			response.destroy();
		}
	}
	if (args.path !== void 0) {
		const path = args.path.startsWith("~/") ? join(homedir(), args.path.slice(2)) : args.path;
		if (!isAbsolute(path)) throw Error("本机图片需要绝对路径或 ~/ 路径；不要传服务器路径或 file:// 链接");
		const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
		try {
			const info = await file.stat();
			if (!info.isFile() || !info.size || info.size > limit) throw Error("请选择不超过64MiB的本机普通图片文件");
			const stream = file.createReadStream({
				autoClose: false,
				signal
			});
			try {
				return await save(basename(path), stream);
			} finally {
				stream.destroy();
			}
		} finally {
			await file.close();
		}
	}
	const ref = args.attachment;
	if (!ref || typeof ref.attachmentId !== "string" || ![
		"image/png",
		"image/jpeg",
		"image/webp"
	].includes(ref.mediaType) || !Number.isInteger(ref.bytes) || ref.bytes < 1 || ref.bytes > limit || !Number.isInteger(ref.width) || ref.width < 1 || !Number.isInteger(ref.height) || ref.height < 1) throw Error("请传入对话中真实的 PNG/JPEG/WebP 图片附件引用，不要猜 attachmentId 或把附件 ID 当图库 ID");
	const stored = await options.readAttachment(ref, signal);
	return save(ref.name || "会话参考图", one(stored.data));
}
//#endregion
//#region lib/types/workspace-tools.js
function draftFromSettings(p) {
	const allowed = Object.keys(generationParameters).filter((k) => k !== "prompt");
	if (Object.keys(p).some((k) => !allowed.includes(k))) throw Error("预设仅接受生图参数，不能保存提示词正文、连接设置或密钥");
	const d = {
		...draftDefaults,
		prompt: "preset validation",
		size: `${p.width ?? 1024}x${p.height ?? 1024}`,
		steps: p.steps ?? 40,
		seed: p.seed == null ? "" : String(p.seed),
		negativePrompt: p.negative_prompt ?? "",
		guidance: p.guidance ?? 1,
		scheduler: p.scheduler ?? "linear",
		changeStrength: p.change_strength ?? .45,
		referenceMode: p.reference_mode ?? "variation",
		sourceId: p.mask_image_id ? "" : p.source_image_ids?.[0] ?? p.source_image_id ?? "",
		additionalSourceIds: p.mask_image_id ? [] : p.source_image_ids?.slice(1) ?? [],
		additionalSourceNames: p.mask_image_id ? [] : p.source_image_ids?.slice(1).map(() => "多图参考") ?? [],
		maskSourceId: p.mask_image_id ? p.source_image_id ?? "" : "",
		maskId: p.mask_image_id ?? "",
		maskEnabled: Boolean(p.mask_image_id),
		controlId: p.controlnet_image_id ?? "",
		controlEnabled: Boolean(p.controlnet_image_id),
		controlStrength: p.controlnet_strength ?? 1,
		loras: (p.lora_paths ?? []).map((path, i) => ({
			path,
			name: basename(path),
			scale: p.lora_scales?.[i] ?? 1,
			enabled: true
		}))
	};
	if (p.lora_scales && p.lora_scales.length !== d.loras.length) throw Error("每个 LoRA 必须对应一个权重");
	if (p.mask_image_id && p.change_strength !== void 0) throw Error("蒙版重绘不使用 change_strength");
	if (p.reference_mode === "edit" && (!p.source_image_id && !p.source_image_ids?.length || p.mask_image_id || p.change_strength !== void 0)) throw Error("原生参考编辑需要原图，且不能使用变化幅度或蒙版");
	generationPayload$1(d, false, "");
	return d;
}
function settingsFromDraft(draft) {
	const { id: _, prompt: __, lora_names: ___, ...data } = generationPayload$1({
		...draft,
		prompt: "preset validation"
	}, false, "");
	return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null));
}
async function workspacePreset(worker, args) {
	const config = resolveConfig(worker.transportConfig()), store = await readPresets(config.localMfluxDirectory);
	const selected = store.items.find((p) => p.id === args.id);
	if (args.action === "list") return {
		revision: store.revision,
		default_id: store.defaultId,
		presets: store.items.map((p) => ({
			id: p.id,
			name: p.name,
			is_default: p.id === store.defaultId
		})),
		note: "与高级设置共用预设。只读取，不改变面板草稿，也不启动生图。"
	};
	if (args.action === "load") {
		if (!selected) throw Error("预设不存在；先 list 获取真实 ID");
		const loaded = await loadPreset(config, selected);
		let settings = null;
		const issues = [...loaded.issues];
		if (!issues.length) try {
			settings = settingsFromDraft(loaded.draft);
		} catch (e) {
			issues.push(e.message);
		}
		return {
			id: selected.id,
			name: selected.name,
			revision: store.revision,
			mode: worker.mode(),
			reference_edit: await worker.referenceEditing(),
			remote_capabilities: worker.mode() === "remote" ? await worker.capabilities() : null,
			settings,
			issues,
			note: "这是供 qwen_generate_image 使用的参数，不会自动生图或覆盖面板草稿。保留用户当前 prompt，与 settings 合并调用。当前原生编辑能力以 reference_edit.supported 为准，远程高级能力以 remote_capabilities 为准；不支持的参数不要静默删除。"
		};
	}
	if (args.action === "export") {
		if (args.id && !selected) throw Error("预设不存在");
		return exportPresets(store, args.id);
	}
	if (!Number.isInteger(args.revision)) throw Error("写入前先 list，传入返回的 revision，避免覆盖其他页面的修改");
	const mutation = {
		action: args.action,
		id: args.id,
		revision: args.revision,
		name: args.name
	};
	if (args.action === "save") {
		if (Boolean(args.from_job_id) === Boolean(args.settings)) throw Error("save 需要且只能提供 from_job_id 或 settings 其中之一");
		let draft;
		if (args.from_job_id) {
			const job = await readJob(config.localMfluxDirectory, args.from_job_id);
			if (!job || job.deleted || job.status !== "complete") throw Error("只能从有效且已完成的图片任务保存参数");
			draft = {
				...draftDefaults,
				...reuseDraft(job, false)
			};
		} else draft = draftFromSettings(args.settings);
		const { prompt: _, missingResources: __, ...values } = draft;
		mutation.values = values;
		mutation.id = args.id ?? null;
	} else if (args.action === "set_default" || args.action === "clear_default") {
		mutation.action = "default";
		mutation.id = args.action === "clear_default" ? null : args.id;
	} else if (args.action === "import") {
		if (typeof args.document_json !== "string" || Buffer.byteLength(args.document_json) > 1048576) throw Error("导入 JSON 需小于 1MiB");
		mutation.document = JSON.parse(args.document_json);
	} else if (!["rename", "delete"].includes(args.action)) throw Error("预设操作无效");
	const next = await mutatePresets(config, mutation);
	return {
		revision: next.revision,
		default_id: next.defaultId,
		presets: next.items.map((p) => ({
			id: p.id,
			name: p.name
		})),
		note: "已保存到与高级设置共用的预设库。不会启动模型、创建图片或改动已提交任务；已打开的预设列表可用管理中的刷新列表读取，也可重新进入高级设置。"
	};
}
const output$4 = {
	schema: {
		type: "object",
		properties: { result: {
			type: "string",
			required: true
		} },
		additionalProperties: false
	},
	render: (_args, value) => [{
		type: "text",
		text: value.result
	}]
};
function registerWorkspaceTools(ctx, worker) {
	ctx.tools.register(defineTool({
		name: "qwen_image_import",
		description: "Import a reference image, control image or mask into the Qwen Image resource library without generating or starting the model/SSH. Accepts exactly one public HTTP(S) image URL, absolute local file path, or real conversation image attachment reference. For web-reference img2img, first use available search/browser tools to find a suitable image and its direct image URL, then import it here; do not ask the user to open the gallery or run a downloader script. Returns the real 32-character id, dimensions and parameter name for qwen_generate_image and presets. PNG/JPEG/WebP up to 64MiB; rejects HTML pages, private-network URLs and unsupported files. Original files are unchanged; imported inputs are resources, not generated gallery works. Remote Qwen automatically synchronizes selected resources on generation.",
		timeoutMs: 9e4,
		parameters: {
			kind: {
				type: "string",
				description: "source (default) for img2img/inpaint source; control for an actual structure/pose/edge image; mask for a white-redraw/black-keep mask. Import does not extract edges, pose or create a mask."
			},
			url: {
				type: "string",
				description: "Public direct HTTP/HTTPS image URL, not a search-result page. Mutually exclusive with path and attachment. No login/cookies required; private/Tailscale URLs are rejected."
			},
			path: {
				type: "string",
				description: "Existing absolute or ~/ image path on the DSH host (Mac), obtained from user context or actual file tools. Not a Windows server path; never guess. Mutually exclusive with url and attachment."
			},
			name: {
				type: "string",
				description: "Optional recognizable resource name, e.g. mountain-reference.jpg."
			},
			attachment: {
				type: "object",
				additionalProperties: false,
				description: "Exact image attachment reference from conversation context, not just its hash. Mutually exclusive with url and path; never invent fields.",
				properties: {
					attachmentId: {
						type: "string",
						required: true
					},
					mediaType: {
						type: "string",
						required: true
					},
					bytes: {
						type: "integer",
						required: true
					},
					width: {
						type: "integer",
						required: true
					},
					height: {
						type: "integer",
						required: true
					},
					name: { type: "string" },
					originalDimensions: {
						type: "object",
						additionalProperties: false,
						properties: {
							width: {
								type: "integer",
								required: true
							},
							height: {
								type: "integer",
								required: true
							}
						}
					}
				}
			}
		},
		output: output$4,
		async execute(args, exec) {
			const config = resolveConfig(worker.transportConfig());
			const { attachment, ...input } = args;
			const asset = await (worker.withActivity ? worker.withActivity.bind(worker) : async (fn) => fn())(() => importImage({
				...input,
				...attachment ? { attachment } : {}
			}, {
				directory: config.localMfluxDirectory,
				python: config.pythonPath,
				signal: exec.signal,
				readAttachment: (ref, signal) => ctx.attachments.readImage(ref, signal)
			}));
			const parameter = asset.kind === "control" ? "controlnet_image_id" : asset.kind === "mask" ? "mask_image_id" : "source_image_id";
			return { result: JSON.stringify({
				...asset,
				parameter,
				settings: { [parameter]: asset.id },
				note: "已导入资源库，尚未生图，也不覆盖面板草稿。用户要求生成时，把此 ID 与完整目标 prompt 交给 qwen_generate_image；不要把 URL、文件路径或附件哈希当图库 ID。"
			}) };
		}
	}));
	ctx.tools.register(defineTool({
		name: "qwen_image_import_many",
		description: "Import 1–20 existing host image files in one call into the managed source/control/mask library, without starting inference or SSH. Each path must be absolute or ~/; identical normalized bytes with the same kind reuse one resource id (deduped=true) instead of creating duplicates. Returns one item per path with real ids, dimensions and the parameter name; per-path failures never stop the rest. Use qwen_image_import for URLs or conversation attachments.",
		timeoutMs: 18e4,
		parameters: {
			paths: {
				type: "array",
				required: true,
				items: { type: "string" },
				description: "1–20 existing absolute or ~/ image paths on the DSH host. Not Windows/server paths."
			},
			kind: {
				type: "string",
				description: "source (default), control or mask; same kind is required for dedupe."
			},
			name_prefix: {
				type: "string",
				description: "Optional name prefix; each item gets prefix-1, prefix-2, …"
			}
		},
		output: output$4,
		async execute({ paths, kind = "source", name_prefix: prefix }, exec) {
			if (!Array.isArray(paths) || !paths.length || paths.length > 20) throw Error("paths 需要 1–20 个本机图片路径");
			const config = resolveConfig(worker.transportConfig());
			const run = worker.withActivity ? worker.withActivity.bind(worker) : async (fn) => fn();
			const items = [], failed = [];
			for (const [index, path] of paths.entries()) {
				exec.signal.throwIfAborted();
				try {
					const asset = await run(() => importImage({
						path,
						kind,
						...prefix ? { name: `${prefix}-${index + 1}` } : {}
					}, {
						directory: config.localMfluxDirectory,
						python: config.pythonPath,
						signal: exec.signal,
						readAttachment: async () => {
							throw Error("批量本机导入不读取对话附件");
						}
					}));
					const parameter = asset.kind === "control" ? "controlnet_image_id" : asset.kind === "mask" ? "mask_image_id" : "source_image_id";
					items.push({
						...asset,
						parameter,
						settings: { [parameter]: asset.id }
					});
				} catch (error) {
					if (exec.signal.aborted) throw error;
					failed.push({
						index,
						path,
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}
			return { result: JSON.stringify({
				items,
				failed,
				imported: items.length,
				note: "已导入资源库，尚未生图。deduped=true 表示同内容同用途已存在，直接复用该 ID。"
			}) };
		}
	}));
	ctx.tools.register(defineTool({
		name: "qwen_image_resources",
		description: "List existing Qwen Image LoRAs and image inputs for advanced settings or presets. Read-only, no model startup, no generated image. Returns reference_edit.supported for the current local/remote backend; local probing checks MFLUX and vision checkpoint files without loading weights. Returns real resource ids/LoRA paths, names and sources; never invent them or search with shell. Image inputs can be used as source/control/mask according to their actual contents. Query by name; private image pixels and prompts are not returned.",
		parameters: {
			kind: {
				type: "string",
				description: "all (default), lora, or image. image includes imported source/control/mask and gallery images."
			},
			query: {
				type: "string",
				description: "Optional filename substring; use it to narrow a long list."
			},
			limit: {
				type: "integer",
				description: "1–100, default 50."
			}
		},
		output: output$4,
		async execute({ kind = "all", query = "", limit = 50 }) {
			if (![
				"all",
				"lora",
				"image"
			].includes(kind) || !Number.isInteger(limit) || limit < 1 || limit > 100) throw Error("无效的资源筛选条件");
			const catalog = await listResources(resolveConfig(worker.transportConfig()));
			const items = catalog.items.filter((r) => (kind === "all" || (kind === "lora" ? r.kind === "lora" : r.kind !== "lora")) && r.name.toLowerCase().includes(query.toLowerCase()));
			return { result: JSON.stringify({
				items: items.slice(0, limit),
				total: items.length,
				truncated: items.length > limit,
				warnings: catalog.warnings,
				mode: worker.mode(),
				reference_edit: await worker.referenceEditing(),
				remote_capabilities: worker.mode() === "remote" ? await worker.capabilities() : null
			}) };
		}
	}));
	const { prompt: _, ...settings } = generationParameters;
	ctx.tools.register(defineTool({
		name: "qwen_image_presets",
		description: "Manage complete Qwen Image creation presets shared with the advanced-settings panel. List/load/export are read-only and do not generate. Save from a completed job id, or supply a complete settings combination using generation parameter names. For changes first list and pass its revision. Names/ids must come from actual results. load returns settings to merge with the user's prompt in qwen_generate_image; it does not change panel draft or start inference. Missing resources are reported and must be resolved before generating. Do not put prompts, connection paths or API keys in presets. delete affects only a preset, never images or weight files.",
		timeoutMs: 12e4,
		parameters: {
			action: {
				type: "string",
				required: true,
				description: "list, load, save, rename, delete, set_default, clear_default, export, import."
			},
			id: {
				type: "string",
				description: "Existing preset id from list. Omit on save to create a new preset; provide it only for an explicitly requested overwrite."
			},
			name: {
				type: "string",
				description: "Required on save/rename, 1–80 characters."
			},
			revision: {
				type: "integer",
				description: "Required for writes. Use revision from latest list/result; on conflict re-read and check before retrying."
			},
			from_job_id: {
				type: "string",
				description: "save only: exact full id of a completed image; saves its advanced parameters without its prompt. Mutually exclusive with settings."
			},
			settings: {
				type: "object",
				properties: settings,
				additionalProperties: false,
				description: "save only: full parameter combination; omitted values use built-in defaults, so load first and merge returned settings when editing an existing preset. No prompt. Mutually exclusive with from_job_id."
			},
			document_json: {
				type: "string",
				description: "import only: portable JSON from export, at most 1MiB. Contains resource fingerprints, not image/model binaries."
			}
		},
		output: output$4,
		async execute(args) {
			return { result: JSON.stringify(await workspacePreset(worker, args)) };
		}
	}));
}
//#endregion
//#region lib/types/status-tool.js
/** Recovery never starts inference, submits a new task, or changes gallery flags. */
function registerStatusTool(ctx, worker) {
	ctx.tools.register(defineTool({
		name: "qwen_image_status",
		description: "Read an existing Qwen image task by its full returned id; recover progress or the completed visible image attachment after a timeout, interruption, or later request. Read-only: never starts the model or submits again. Do not use shell/file search or a standalone script to recover results. Do not poll repeatedly in a tight loop; active tasks continue in the image workspace and original conversation progress card.",
		parameters: { id: {
			type: "string",
			required: true,
			description: "The exact 32-character task id returned by qwen_generate_image or its error. Never invent an id or use a filesystem path."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					id: {
						type: "string",
						required: true
					},
					status: {
						type: "string",
						required: true
					},
					prompt: {
						type: "string",
						required: true
					},
					step: { type: "integer" },
					steps: {
						type: "integer",
						required: true
					},
					error: { type: "string" },
					attachment: {
						type: "object",
						additionalProperties: false,
						properties: {
							attachmentId: {
								type: "string",
								required: true
							},
							mediaType: {
								type: "string",
								required: true
							},
							bytes: {
								type: "integer",
								required: true
							},
							width: {
								type: "integer",
								required: true
							},
							height: {
								type: "integer",
								required: true
							},
							name: { type: "string" },
							originalDimensions: {
								type: "object",
								additionalProperties: false,
								properties: {
									width: {
										type: "integer",
										required: true
									},
									height: {
										type: "integer",
										required: true
									}
								}
							}
						}
					}
				}
			},
			presentationMeta: (_args, value) => value.attachment ? {
				kind: "qwen-studio",
				id: value.id,
				prompt: value.prompt,
				attachment: value.attachment
			} : {
				kind: "qwen-studio-status",
				id: value.id
			},
			render: (_args, value) => [{
				type: "text",
				text: `图像任务 ${value.id}：${value.status}；${value.step ?? 0}/${value.steps} 步。${value.error ?? ""}${value.attachment ? "图片已附在对话中，图库归属不影响对话显示。" : "未重新提交，也未启动模型。"}`
			}, ...value.attachment ? [{
				type: "image",
				attachment: value.attachment
			}] : []]
		},
		async execute({ id }) {
			const dir = worker.directory(), job = await readJob(dir, id);
			if (!job) throw Error(`任务 ${id} 不存在，请确认原始 ID；未提交新任务。`);
			const attachment = job.status === "complete" && !job.deleted ? await ctx.attachments.saveImage({
				data: await readFile(await imagePath(dir, id)),
				mediaType: "image/png",
				name: `qwen-${id.slice(0, 8)}.png`
			}) : void 0;
			return {
				id,
				status: job.deleted ? "trashed" : job.status,
				prompt: job.prompt,
				steps: job.sampling_steps ?? job.steps,
				...job.step !== void 0 ? { step: job.step } : {},
				...job.error ? { error: job.error } : {},
				...attachment ? { attachment } : {}
			};
		},
		presentResult: (_args, result) => ({
			card: "generic",
			title: "图像任务",
			content: result.content
		})
	}));
}
//#endregion
//#region lib/types/gallery-tool.js
/** Pure filter shared by the gallery tool and tests. `started_at` is in seconds. */
function selectJobs(jobs, query) {
	const text = query.query?.trim().toLowerCase();
	return jobs.filter((job) => {
		if (!query.includeDeleted && job.deleted && query.status !== "trashed") return false;
		if (query.seed !== void 0 && job.seed !== query.seed) return false;
		if (query.favorite !== void 0 && Boolean(job.favorite) !== query.favorite) return false;
		if (query.archived !== void 0 && Boolean(job.archived) !== query.archived) return false;
		if (query.sourceImageId && job.source_image_id !== query.sourceImageId && !job.source_image_ids?.includes(query.sourceImageId)) return false;
		if (query.status) {
			if (query.status === "active") {
				if (!active(job)) return false;
			} else if (query.status === "trashed") {
				if (!job.deleted) return false;
			} else if (job.status !== query.status || job.deleted) return false;
		}
		if (query.since !== void 0 && job.started_at < query.since) return false;
		if (query.until !== void 0 && job.started_at > query.until) return false;
		if (text && !job.prompt.toLowerCase().includes(text)) return false;
		return true;
	});
}
function summary(job) {
	return {
		id: job.id,
		status: job.deleted ? "trashed" : job.status,
		prompt: job.prompt,
		seed: job.seed,
		width: job.width,
		height: job.height,
		steps: job.steps,
		...job.step !== void 0 ? { step: job.step } : {},
		source: job.source ?? "local",
		...job.source_image_id ? { source_image_id: job.source_image_id } : {},
		...job.source_image_ids?.length ? { source_image_ids: job.source_image_ids } : {},
		...job.reference_mode ? { reference_mode: job.reference_mode } : {},
		...job.lora_names?.length ? { lora_names: job.lora_names } : {},
		...job.elapsed_seconds !== void 0 ? { elapsed_seconds: job.elapsed_seconds } : {},
		started_at: job.started_at,
		...job.error ? { error: job.error } : {},
		...job.favorite ? { favorite: true } : {},
		...job.archived ? { archived: true } : {},
		...job.deleted ? { deleted: true } : {}
	};
}
const output$3 = {
	schema: {
		type: "object",
		properties: { result: {
			type: "string",
			required: true
		} },
		additionalProperties: false
	},
	render: (_args, value) => [{
		type: "text",
		text: value.result
	}]
};
const STATUSES = [
	"queued",
	"uploading",
	"loading",
	"running",
	"saving",
	"cancelling",
	"complete",
	"failed",
	"cancelled",
	"active",
	"trashed"
];
function timestamp(value, name) {
	if (value === void 0 || value === "") return void 0;
	const ms = Date.parse(value);
	if (!Number.isFinite(ms)) throw Error(`${name} 需要 ISO 8601 时间，例如 2026-10-18T12:00:00Z`);
	return ms / 1e3;
}
function registerGalleryTools(ctx, worker) {
	ctx.tools.register(defineTool({
		name: "qwen_image_jobs",
		description: "Read the Qwen image task queue and batch-read task states without starting inference. Use ids[] to check up to 200 tasks in one call; omit ids to snapshot the active queue (queued/uploading/loading/running/saving/cancelling) plus status counts. Read-only: never submits, cancels or changes gallery flags. For one completed image with its attachment, use qwen_image_status instead.",
		timeoutMs: 3e4,
		parameters: {
			ids: {
				type: "array",
				items: { type: "string" },
				description: "Optional exact 32-character task ids, up to 200. Omit for a queue snapshot."
			},
			status: {
				type: "string",
				description: "Optional filter: queued, uploading, loading, running, saving, cancelling, complete, failed, cancelled, active, trashed."
			},
			limit: {
				type: "integer",
				description: "Max tasks returned, 1–200, default 50."
			}
		},
		output: output$3,
		async execute({ ids, status, limit = 50 }) {
			if (status !== void 0 && !STATUSES.includes(status)) throw Error("状态筛选无效");
			if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw Error("limit 需为 1–200");
			const dir = worker.directory(), all = await readJobs(dir);
			let jobs;
			const missing = [];
			if (ids?.length) {
				if (ids.length > 200 || ids.some((id) => !validId(id))) throw Error("ids 需要 1–200 个 32 位十六进制任务 ID");
				jobs = [];
				for (const id of ids) {
					const job = all.find((item) => item.id === id) ?? await readJob(dir, id);
					if (job) jobs.push(job);
					else missing.push(id);
				}
			} else jobs = all;
			if (status) jobs = selectJobs(jobs, {
				status,
				includeDeleted: true
			});
			jobs.sort((a, b) => b.started_at - a.started_at);
			const counts = {};
			for (const job of all) {
				const key = job.deleted ? "trashed" : job.status;
				counts[key] = (counts[key] ?? 0) + 1;
			}
			const queue = all.filter(active).sort((a, b) => a.started_at - b.started_at).map(summary);
			return { result: JSON.stringify({
				jobs: jobs.slice(0, limit).map(summary),
				total: jobs.length,
				returned: Math.min(jobs.length, limit),
				truncated: jobs.length > limit,
				missing,
				active: queue.length,
				queue,
				counts,
				note: "只读快照；取消任务用 qwen_image_cancel。远程任务的队列由当前 DSH 进程持有。"
			}) };
		}
	}));
	ctx.tools.register(defineTool({
		name: "qwen_image_cancel",
		description: "Request cancellation for up to 50 Qwen image tasks by id, without deleting images or changing gallery flags. Unknown or already-finished tasks are reported per id and never fail the whole batch. Local worker cancellation is immediate; a remote task can only be cancelled while the current DSH process still holds its pending request. This tool never submits or retries generation.",
		timeoutMs: 6e4,
		parameters: { ids: {
			type: "array",
			items: { type: "string" },
			required: true,
			description: "1–50 exact 32-character task ids to cancel."
		} },
		output: output$3,
		async execute({ ids }) {
			if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some((id) => !validId(id))) throw Error("ids 需要 1–50 个 32 位十六进制任务 ID");
			const dir = worker.directory(), results = [];
			for (const id of ids) {
				const job = await readJob(dir, id);
				if (!job) {
					results.push({
						id,
						ok: false,
						error: "任务不存在"
					});
					continue;
				}
				if (!active(job)) {
					results.push({
						id,
						ok: false,
						error: `任务已结束（${job.deleted ? "trashed" : job.status}）`
					});
					continue;
				}
				try {
					await worker.post("/v1/cancel", { id });
					await setTimeout$1(150);
					const next = await readJob(dir, id);
					results.push({
						id,
						ok: true,
						status: next?.deleted ? "trashed" : next?.status ?? "cancelling"
					});
				} catch (error) {
					results.push({
						id,
						ok: false,
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}
			return { result: JSON.stringify({
				results,
				requested: ids.length,
				note: "取消只影响任务，不删除图片；稍后用 qwen_image_jobs 复核最终状态。"
			}) };
		}
	}));
	ctx.tools.register(defineTool({
		name: "qwen_image_gallery",
		description: "Search the Qwen image gallery read-only by prompt substring, seed, status, favorite/archive flag, source image id or start time, and page through results. Returns task metadata and lineage fields (seed, source_image_id, reference_mode, lora_names, elapsed_seconds) — never pixels, attachments or filesystem paths. Zero writes: cannot favorite, archive, delete or submit. Use qwen_image_resources for importable image ids and qwen_image_status for one image's attachment.",
		timeoutMs: 3e4,
		parameters: {
			query: {
				type: "string",
				description: "Case-insensitive substring of the prompt."
			},
			seed: {
				type: "integer",
				description: "Exact seed."
			},
			status: {
				type: "string",
				description: "queued, uploading, loading, running, saving, cancelling, complete, failed, cancelled, active or trashed."
			},
			favorite: {
				type: "boolean",
				description: "Filter by favorite flag."
			},
			archived: {
				type: "boolean",
				description: "Filter by archived flag."
			},
			source_image_id: {
				type: "string",
				description: "Exact 32-character source image id used for img2img or reference edit."
			},
			since: {
				type: "string",
				description: "Inclusive ISO 8601 start time, e.g. 2026-10-18T00:00:00+08:00."
			},
			until: {
				type: "string",
				description: "Inclusive ISO 8601 end time."
			},
			include_deleted: {
				type: "boolean",
				description: "Include trashed tasks, default false."
			},
			limit: {
				type: "integer",
				description: "Page size 1–200, default 50."
			},
			offset: {
				type: "integer",
				description: "Page offset, default 0."
			}
		},
		output: output$3,
		async execute(args) {
			const { query, seed, status, favorite, archived, source_image_id: sourceImageId, since, until, include_deleted: includeDeleted = false, limit = 50, offset = 0 } = args;
			if (status !== void 0 && !STATUSES.includes(status)) throw Error("状态筛选无效");
			if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw Error("limit 需为 1–200");
			if (!Number.isInteger(offset) || offset < 0) throw Error("offset 需为非负整数");
			if (sourceImageId !== void 0 && !validId(sourceImageId)) throw Error("source_image_id 无效");
			const from = timestamp(since, "since"), to = timestamp(until, "until");
			if (from !== void 0 && to !== void 0 && from > to) throw Error("since 不能晚于 until");
			const jobs = selectJobs(await readJobs(worker.directory()), {
				...query ? { query } : {},
				...seed !== void 0 ? { seed } : {},
				...status ? { status } : {},
				...favorite !== void 0 ? { favorite } : {},
				...archived !== void 0 ? { archived } : {},
				...sourceImageId ? { sourceImageId } : {},
				...from !== void 0 ? { since: from } : {},
				...to !== void 0 ? { until: to } : {},
				includeDeleted
			});
			jobs.sort((a, b) => b.started_at - a.started_at);
			const page = jobs.slice(offset, offset + limit);
			return { result: JSON.stringify({
				jobs: page.map(summary),
				total: jobs.length,
				offset,
				limit,
				returned: page.length,
				has_more: offset + page.length < jobs.length,
				note: "只读检索，未触碰 gallery.json；favorite/archived 来自现有收藏记录。"
			}) };
		}
	}));
	ctx.tools.register(defineTool({
		name: "qwen_image_export",
		description: "Copy 1–50 completed, non-trashed Qwen jobs into a caller-selected directory as <id>/image.png plus <id>/job.json, and write manifest.json with lineage fields. This is a copy-only handoff for an external library/tool (for example an encrypted reference library); originals stay in the gallery and no flags change. Existing target files are never overwritten. Returns absolute paths.",
		timeoutMs: 12e4,
		parameters: {
			ids: {
				type: "array",
				required: true,
				items: { type: "string" },
				description: "1–50 exact 32-character task ids."
			},
			out_dir: {
				type: "string",
				required: true,
				description: "Absolute or ~/ destination directory; created if missing."
			}
		},
		output: output$3,
		async execute({ ids, out_dir: outDir }) {
			if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some((id) => !validId(id))) throw Error("ids 需要 1–50 个 32 位十六进制任务 ID");
			const root = outDir.startsWith("~/") ? join(homedir(), outDir.slice(2)) : outDir;
			if (!isAbsolute(root)) throw Error("out_dir 需要绝对路径或 ~/ 路径");
			await mkdir(root, { recursive: true });
			const dir = worker.directory(), files = [], failed = [], manifest = [];
			for (const id of ids) {
				const job = await readJob(dir, id);
				if (!job) {
					failed.push({
						id,
						error: "任务不存在"
					});
					continue;
				}
				if (job.deleted) {
					failed.push({
						id,
						error: "任务在回收站"
					});
					continue;
				}
				if (job.status !== "complete") {
					failed.push({
						id,
						error: `任务未完成（${job.status}）`
					});
					continue;
				}
				try {
					const target = join(root, id);
					await mkdir(target, { recursive: true });
					const image = join(target, "image.png"), record = join(target, "job.json");
					await copyFile(await imagePath(dir, id), image, constants.COPYFILE_EXCL);
					await writeFile(record, JSON.stringify(job, null, 2), {
						mode: 384,
						flag: "wx"
					});
					files.push(image, record);
					manifest.push(summary(job));
				} catch (error) {
					failed.push({
						id,
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}
			if (manifest.length) {
				const body = JSON.stringify({ jobs: manifest }, null, 2);
				try {
					await writeFile(join(root, "manifest.json"), body, {
						mode: 384,
						flag: "wx"
					});
				} catch (error) {
					if (error.code !== "EEXIST") throw error;
					await writeFile(join(root, `manifest-${Date.now()}.json`), body, {
						mode: 384,
						flag: "wx"
					});
				}
			}
			return { result: JSON.stringify({
				out_dir: root,
				files,
				failed,
				exported: manifest.length,
				note: "只复制，不移动、不改图库；目标已存在时拒绝覆盖。可交给外部图库工具或 外部图库的复制导入 使用。"
			}) };
		}
	}));
}
//#endregion
//#region lib/types/generation-request.js
/** Same validation as the single-image tool, shared with batch submission. */
function validateGeneration(args) {
	if (args.reference_mode !== void 0 && !["variation", "edit"].includes(args.reference_mode)) throw Error("参考图模式无效");
	if (args.source_image_ids?.length) {
		if (args.reference_mode !== "edit") throw Error("多图参考只用于 reference_mode=edit");
		if (args.source_image_id) throw Error("source_image_ids 与 source_image_id 只能二选一");
		if (args.source_image_ids.length < 2 || args.source_image_ids.length > 8) throw Error("多图参考需要 2–8 张图片");
		if (args.change_strength !== void 0 || args.mask_image_id || args.controlnet_image_id) throw Error("多图参考不使用变化幅度、蒙版或结构控制");
	} else if (args.reference_mode === "edit" && (!args.source_image_id || args.change_strength !== void 0 || args.mask_image_id || args.controlnet_image_id)) throw Error("原生参考编辑需要 source_image_id 或 source_image_ids，不使用变化幅度、蒙版或结构控制");
	if (args.mask_image_id && args.change_strength !== void 0) throw Error("蒙版重绘不使用 change_strength，请移除此参数");
	if (args.change_strength !== void 0 && !args.source_image_id) throw Error("变化幅度必须配合上一张图片的source_image_id");
	if (args.lora_paths && args.lora_scales && args.lora_paths.length !== args.lora_scales.length) throw Error("每个 LoRA 必须对应一个权重");
}
function newJobId() {
	return randomUUID().replaceAll("-", "");
}
/** Build the worker payload; callers submit it through the same queue. */
function generationPayload(args, id) {
	return {
		id,
		prompt: args.prompt,
		width: args.width ?? 1024,
		height: args.height ?? 1024,
		steps: args.steps ?? 40,
		seed: args.seed ?? null,
		...args.source_image_ids?.length ? {
			source_image_ids: args.source_image_ids,
			reference_mode: "edit"
		} : args.source_image_id ? {
			source_image_id: args.source_image_id,
			...!args.mask_image_id ? args.reference_mode === "edit" ? { reference_mode: "edit" } : { change_strength: args.change_strength ?? .45 } : {}
		} : {},
		...args.negative_prompt ? { negative_prompt: args.negative_prompt } : {},
		...args.guidance !== void 0 ? { guidance: args.guidance } : {},
		...args.scheduler ? { scheduler: args.scheduler } : {},
		...args.lora_paths ? { lora_paths: args.lora_paths } : {},
		...args.lora_scales ? { lora_scales: args.lora_scales } : {},
		...args.controlnet_image_id ? { controlnet_image_id: args.controlnet_image_id } : {},
		...args.controlnet_strength !== void 0 ? { controlnet_strength: args.controlnet_strength } : {},
		...args.mask_image_id ? { mask_image_id: args.mask_image_id } : {}
	};
}
//#endregion
//#region lib/types/batch-tool.js
const output$2 = {
	schema: {
		type: "object",
		properties: { result: {
			type: "string",
			required: true
		} },
		additionalProperties: false
	},
	render: (_args, value) => [{
		type: "text",
		text: value.result
	}]
};
async function slot(dir, maxParallel, deadline) {
	for (;;) {
		if ((await readJobs(dir)).filter(active).length < maxParallel) return;
		if (Date.now() > deadline) throw Error("等待队列空位超时；已提交的任务保留，请用 qwen_image_jobs 查看");
		await setTimeout$1(500);
	}
}
async function visible(dir, id, deadline) {
	while (Date.now() < deadline) {
		if ((await readJobs(dir)).some((job) => job.id === id)) return;
		await setTimeout$1(200);
	}
}
function registerBatchTool(ctx, worker) {
	ctx.tools.register(defineTool({
		name: "qwen_image_batch",
		description: "Submit 1–10 independent Qwen image jobs in one call, then return their real task ids without waiting for pixels. Each job accepts the same parameters as qwen_generate_image. Submission auto-waves to the backend's 4-job admission limit; a failed job is reported per index and never stops the rest. This tool only submits: poll qwen_image_jobs / qwen_image_status for progress, and use qwen_image_gallery for lineage. Never invent ids, never retry accepted jobs automatically.",
		timeoutMs: 9e5,
		parameters: {
			jobs: {
				type: "array",
				required: true,
				description: "1–10 independent jobs. Each item requires prompt and accepts the same generation parameters as qwen_generate_image.",
				items: {
					type: "object",
					properties: generationParameters,
					additionalProperties: false
				}
			},
			max_parallel: {
				type: "integer",
				description: "How many jobs may be active before the next submission, 1–4, default 4 (backend admission cap)."
			}
		},
		output: output$2,
		async execute({ jobs, max_parallel: maxParallel = 4 }, exec) {
			if (!Array.isArray(jobs) || !jobs.length || jobs.length > 10) throw Error("jobs 需要 1–10 个独立任务");
			if (!Number.isInteger(maxParallel) || maxParallel < 1 || maxParallel > 4) throw Error("max_parallel 需为 1–4");
			const dir = worker.directory(), deadline = Date.now() + 9e5;
			const accepted = [];
			const failed = [];
			for (const [index, raw] of jobs.entries()) {
				exec.signal.throwIfAborted();
				const args = raw;
				try {
					if (!args.prompt?.trim()) throw Error("prompt 不能为空");
					validateGeneration(args);
					await slot(dir, maxParallel, deadline);
					const id = newJobId();
					await recordInvocation(dir, `${exec.callId}:${index}`, args.prompt, id, void 0, exec.agent?.id ?? "");
					try {
						await worker.post("/v1/jobs", generationPayload(args, id), true);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						await recordInvocation(dir, `${exec.callId}:${index}`, args.prompt, id, message, exec.agent?.id ?? "");
						throw error;
					}
					await visible(dir, id, Math.min(deadline, Date.now() + 5e3));
					accepted.push({
						index,
						id,
						...args.seed !== void 0 ? { seed: args.seed } : {}
					});
				} catch (error) {
					if (exec.signal.aborted) throw error;
					failed.push({
						index,
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}
			return { result: JSON.stringify({
				accepted,
				failed,
				submitted: accepted.length,
				note: "任务已异步提交，图片尚未生成；用 qwen_image_jobs 或 qwen_image_status 查进度。失败项未重试，确认原因后再提交。"
			}) };
		}
	}));
}
//#endregion
//#region lib/types/scoring.js
const exec = promisify(execFile);
async function scoreImage(directory, pythonPath, id) {
	const script = resolve(dirname(fileURLToPath(import.meta.url)), "../backend/score_image.py");
	const result = await exec(pythonPath, [script, await imagePath(directory, id)], {
		env: {
			...process.env,
			PYTHONUTF8: "1",
			PYTHONIOENCODING: "utf-8"
		},
		windowsHide: true,
		timeout: 3e4,
		maxBuffer: 1048576
	});
	return JSON.parse(result.stdout.trim());
}
//#endregion
//#region lib/types/score-tool.js
const output$1 = {
	schema: {
		type: "object",
		properties: { result: {
			type: "string",
			required: true
		} },
		additionalProperties: false
	},
	render: (_args, value) => [{
		type: "text",
		text: value.result
	}]
};
function registerScoreTool(ctx, worker) {
	ctx.tools.register(defineTool({
		name: "qwen_image_score",
		description: "Compute objective local QA metrics for 1–30 completed Qwen images: edge/detail strength, high-frequency grain, saturation, brightness, skin ratio, highlight/shadow clipping. Reports provisional flags such as heavy-grain or texture-overload; this is a diagnostic report, not a pass/fail gate. Optional write=true stores qa.json inside each job folder; images and gallery flags are untouched. Does not start the model or SSH.",
		timeoutMs: 3e5,
		parameters: {
			ids: {
				type: "array",
				required: true,
				items: { type: "string" },
				description: "1–30 completed 32-character task ids."
			},
			write: {
				type: "boolean",
				description: "Write qa.json into each job folder. Default false; read-only."
			}
		},
		output: output$1,
		async execute({ ids, write = false }) {
			if (!Array.isArray(ids) || !ids.length || ids.length > 30 || ids.some((id) => !/^[a-f0-9]{32}$/.test(id))) throw Error("ids 需要 1–30 个 32 位十六进制任务 ID");
			const config = resolveConfig(worker.transportConfig());
			const items = [];
			const counts = {};
			for (const id of ids) {
				const job = await readJob(worker.directory(), id);
				if (!job) {
					items.push({
						id,
						error: "任务不存在"
					});
					continue;
				}
				if (job.deleted) {
					items.push({
						id,
						error: "任务在回收站"
					});
					continue;
				}
				if (job.status !== "complete") {
					items.push({
						id,
						error: `任务未完成（${job.status}）`
					});
					continue;
				}
				try {
					const path = await imagePath(worker.directory(), id);
					const score = await scoreImage(worker.directory(), config.pythonPath, id);
					items.push({
						id,
						...score
					});
					for (const flag of score.flags) counts[flag] = (counts[flag] ?? 0) + 1;
					if (write) await writeFile(join(dirname(path), "qa.json"), JSON.stringify({
						...score,
						scored_at: (/* @__PURE__ */ new Date()).toISOString()
					}, null, 2), { mode: 384 });
				} catch (error) {
					items.push({
						id,
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}
			return { result: JSON.stringify({
				items,
				flag_counts: counts,
				scored: items.filter((item) => item.metrics).length,
				note: "客观指标报告，不是质量门禁；阈值待人工 ground truth 校准。write=true 只新增 qa.json，不改图片或收藏。"
			}) };
		}
	}));
}
//#endregion
//#region lib/types/reroll-tool.js
const DEFAULT_FLAGS = ["heavy-grain", "texture-overload"];
/** Rebuild the original request from a completed job, advancing the seed by one. */
function jobToGenerationArgs(job, stride = 1) {
	const seed = Number.isFinite(job.seed) ? (job.seed + stride) % 4294967296 : void 0;
	return {
		prompt: job.prompt,
		width: job.width,
		height: job.height,
		steps: job.steps,
		...seed !== void 0 ? { seed } : {},
		...job.negative_prompt ? { negative_prompt: job.negative_prompt } : {},
		...job.guidance !== void 0 ? { guidance: job.guidance } : {},
		...job.scheduler ? { scheduler: job.scheduler } : {},
		...job.source_image_ids?.length ? { source_image_ids: [...job.source_image_ids] } : job.source_image_id ? { source_image_id: job.source_image_id } : {},
		...job.reference_mode ? { reference_mode: job.reference_mode } : {},
		...job.change_strength !== void 0 && !job.mask_image_id && job.reference_mode !== "edit" ? { change_strength: job.change_strength } : {},
		...job.controlnet_image_id ? { controlnet_image_id: job.controlnet_image_id } : {},
		...job.controlnet_strength !== void 0 ? { controlnet_strength: job.controlnet_strength } : {},
		...job.mask_image_id ? { mask_image_id: job.mask_image_id } : {},
		...job.lora_paths ? { lora_paths: job.lora_paths } : {},
		...job.lora_scales ? { lora_scales: job.lora_scales } : {}
	};
}
const output = {
	schema: {
		type: "object",
		properties: { result: {
			type: "string",
			required: true
		} },
		additionalProperties: false
	},
	render: (_args, value) => [{
		type: "text",
		text: value.result
	}]
};
function registerRerollTool(ctx, worker) {
	ctx.tools.register(defineTool({
		name: "qwen_image_reroll",
		description: "Re-score completed Qwen images and automatically submit a new job (seed + 1, same prompt/params) only when a requested QA flag is present, by default heavy-grain or texture-overload. Returns new task ids; originals are kept for comparison and never deleted. Bounded to 20 ids per call; does not wait for the new images and never retries a task that did not match a flag.",
		timeoutMs: 18e4,
		parameters: {
			ids: {
				type: "array",
				required: true,
				items: { type: "string" },
				description: "1–20 completed 32-character task ids."
			},
			flags: {
				type: "array",
				items: { type: "string" },
				description: "QA flags that trigger a reroll; default heavy-grain, texture-overload."
			},
			seed_stride: {
				type: "integer",
				description: "Seed advance for the new job, default 1."
			}
		},
		output,
		async execute({ ids, flags = DEFAULT_FLAGS, seed_stride: stride = 1 }, exec) {
			if (!Array.isArray(ids) || !ids.length || ids.length > 20 || ids.some((id) => !/^[a-f0-9]{32}$/.test(id))) throw Error("ids 需要 1–20 个 32 位十六进制任务 ID");
			if (!Array.isArray(flags) || !flags.length) throw Error("flags 不能为空");
			if (!Number.isInteger(stride) || stride < 1 || stride > 1e6) throw Error("seed_stride 需为 1–1000000");
			const config = resolveConfig(worker.transportConfig()), dir = worker.directory();
			const rerolled = [], skipped = [];
			for (const id of ids) {
				exec.signal.throwIfAborted();
				const job = await readJob(dir, id);
				if (!job) {
					skipped.push({
						id,
						reason: "任务不存在"
					});
					continue;
				}
				if (job.deleted) {
					skipped.push({
						id,
						reason: "任务在回收站"
					});
					continue;
				}
				if (job.status !== "complete") {
					skipped.push({
						id,
						reason: `任务未完成（${job.status}）`
					});
					continue;
				}
				try {
					const score = await scoreImage(dir, config.pythonPath, id);
					const hits = score.flags.filter((flag) => flags.includes(flag));
					if (!hits.length) {
						skipped.push({
							id,
							reason: "没有命中的 QA 标记",
							flags: score.flags
						});
						continue;
					}
					const args = jobToGenerationArgs(job, stride);
					validateGeneration(args);
					const next = newJobId();
					await recordInvocation(dir, `${exec.callId}:${id}`, args.prompt, next, void 0, exec.agent?.id ?? "");
					await worker.post("/v1/jobs", generationPayload(args, next), true);
					rerolled.push({
						from: id,
						to: next,
						flags: hits,
						seed: args.seed
					});
				} catch (error) {
					skipped.push({
						id,
						reason: error instanceof Error ? error.message : String(error)
					});
				}
			}
			return { result: JSON.stringify({
				rerolled,
				skipped,
				submitted: rerolled.length,
				note: "只重投命中标记的图，原图保留；新任务异步执行，用 qwen_image_jobs 查进度。新图再次评分后再决定是否继续重抽。"
			}) };
		}
	}));
}
//#endregion
//#region lib/types/tools.js
function registerTools(ctx, worker) {
	registerStatusTool(ctx, worker);
	registerWorkspaceTools(ctx, worker);
	registerGalleryTools(ctx, worker);
	registerBatchTool(ctx, worker);
	registerScoreTool(ctx, worker);
	registerRerollTool(ctx, worker);
	ctx.tools.register(defineTool({
		name: "qwen_generate_image",
		description: "Default DSH image-generation route: generate with this tool so the conversation, live progress and gallery stay synchronized. Create images with the configured local Qwen Image or self-hosted server. Use for requests to draw, illustrate, make a poster/product image, or generate a picture (画一张、配图、生图). To make a variation of a previous result while retaining its composition, pass that result's source_image_id and change_strength (local or Qwen gateway). Describe the complete desired image, not just an edit instruction. source_image_id alone is strength-based img2img. For style transfer or instruction edits, query capabilities and use reference_mode=edit on supported local MFLUX or an updated Qwen gateway, with full desired edits and no change_strength; legacy variation may reconstruct the original photo. Check qwen_image_resources reference_edit.supported first. Local editing requires MFLUX with QwenImage21Edit and a complete vision-capable checkpoint. Native editing requires linear and dimensions divisible by32, and cannot combine with masks/ControlNet. For a web URL, local file or conversation reference attachment, first call qwen_image_import and use its returned id; no manual gallery import or downloader script is needed. For two to eight reference images in one edit, pass source_image_ids (remote Qwen 2.1 gateway only), reference_mode=edit, and address them as <image1>, <image2>, … in the prompt; do not combine with change_strength, mask or ControlNet. Local and the Qwen gateway support negative_prompt / guidance / scheduler; query qwen_image_resources for remote_capabilities, ordinary Images servers may support text-to-image only. Negative prompts require guidance above 1; the worker uses 2.5 if a negative prompt is supplied with the default guidance. lora_paths / lora_scales stack LoRAs on the base model. controlnet_image_id pins composition and pose from a control image, where structure comes from the control image and content from the prompt. mask_image_id performs masked inpainting over source_image_id: white mask areas are redrawn from the prompt while black areas are copied from the source resized to output dimensions. Returns a visible image attachment plus an id for follow-up variations. Selected Mac assets are synchronized and cached automatically on the configured Qwen gateway; do not invent Windows paths or upload files with scripts. Use qwen_image_resources for real LoRA paths and imported image ids; use qwen_image_presets to list/load/save advanced settings. Preset configuration alone must not trigger generation. No shell, manual server startup, file search, or manual skill installation is needed. If an accepted task times out, query qwen_image_status with its full id; never resubmit or switch to a standalone script automatically.",
		timeoutMs: 12e5,
		parameters: generationParameters,
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					id: {
						type: "string",
						required: true
					},
					attachment: {
						type: "object",
						required: true,
						additionalProperties: false,
						properties: {
							attachmentId: {
								type: "string",
								required: true
							},
							mediaType: {
								type: "string",
								required: true
							},
							bytes: {
								type: "integer",
								required: true
							},
							width: {
								type: "integer",
								required: true
							},
							height: {
								type: "integer",
								required: true
							},
							name: { type: "string" },
							originalDimensions: {
								type: "object",
								additionalProperties: false,
								properties: {
									width: {
										type: "integer",
										required: true
									},
									height: {
										type: "integer",
										required: true
									}
								}
							}
						}
					}
				}
			},
			presentationMeta: (args, value) => ({
				kind: "qwen-studio",
				id: value.id,
				prompt: args.prompt,
				attachment: value.attachment
			}),
			render: (_args, value) => [{
				type: "text",
				text: `图像任务${value.id}已完成。图片已自动入库并附在对话中，无需搜索或重新读取。`
			}, {
				type: "image",
				attachment: value.attachment
			}]
		},
		async execute(args, exec) {
			validateGeneration(args);
			const id = newJobId(), dir = worker.directory();
			await recordInvocation(dir, exec.callId, args.prompt, id, void 0, exec.agent?.id ?? "");
			try {
				await worker.post("/v1/jobs", generationPayload(args, id), true);
			} catch (error) {
				await recordInvocation(dir, exec.callId, args.prompt, id, error instanceof Error ? error.message : String(error), exec.agent?.id ?? "");
				throw Error(`提交任务 ${id} 未确认：${error instanceof Error ? error.message : String(error)}。先用 qwen_image_status 查询该 ID，勿自动重试或运行脚本。`);
			}
			const started = Date.now();
			while (Date.now() - started < 12e5) {
				if (exec.signal.aborted) throw Error(`等待已取消，任务 ${id} 仍保留；用 qwen_image_status 查询或在图像中取消。`);
				const job = await readJob(dir, id);
				if (job && !active(job)) {
					if (job.status !== "complete") throw Error(`任务 ${id}：${job.error ?? job.status}。可用 qwen_image_status 查看，勿自动换脚本或重复提交。`);
					const data = await readFile(await imagePath(dir, id));
					return {
						id,
						attachment: await ctx.attachments.saveImage({
							data,
							mediaType: "image/png",
							name: `qwen-${id.slice(0, 8)}.png`
						})
					};
				}
				try {
					await setTimeout$1(1e3, void 0, { signal: exec.signal });
				} catch {
					throw Error(`等待已取消，任务 ${id} 仍保留；用 qwen_image_status 查询或在图像中取消。`);
				}
			}
			throw Error(`等待超时，任务 ${id} 仍保留；用 qwen_image_status 查询，不要重复提交或改跑脚本。`);
		},
		presentResult: (_args, result) => ({
			card: "generic",
			title: "图像",
			content: result.content
		})
	}));
}
//#endregion
//#region lib/types/skill.js
/** The bundled DSH skill uses single-line frontmatter; never maintain a second catalog summary. */
function parseImageSkill(source) {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
	if (!match) throw Error("qwen-image/SKILL.md 缺少 frontmatter");
	const meta = {};
	for (const line of match[1].split(/\r?\n/).filter((line) => line.trim())) {
		const field = line.match(/^(name|description|whenToUse):\s*(.+)$/);
		if (!field || meta[field[1]]) throw Error("图像技能 frontmatter 需为不重复的单行 name / description / whenToUse");
		const value = field[2].trim();
		if (value === ">" || value === "|") throw Error("图像技能简介请使用单行文本");
		meta[field[1]] = value;
	}
	if (meta.name !== "qwen-image" || !meta.description || !meta.whenToUse || !match[2].trim()) throw Error("图像技能需要 qwen-image 名称、description、whenToUse 和正文");
	return {
		name: meta.name,
		description: meta.description,
		whenToUse: meta.whenToUse,
		content: match[2].trim()
	};
}
function bundledImageSkill() {
	const path = fileURLToPath(new URL("../skills/qwen-image/SKILL.md", import.meta.url));
	return {
		...parseImageSkill(readFileSync(path, "utf8")),
		path,
		source: "图像",
		invocation: {
			modelInvocable: true,
			userInvocable: true
		}
	};
}
//#endregion
//#region lib/types/connection-tools.js
async function connectionOperation(worker, settings, args) {
	const descriptor = settings.describe({ redactSecrets: true }).find((d) => d.ns === "qwen-studio");
	if (!descriptor) throw Error("图像插件的宿主设置尚未加载");
	const action = args.action ?? "status";
	if (action !== "status") {
		if (!Number.isInteger(args.revision)) throw Error("先 status 读取 revision，写入时带回该修订号");
		if (args.revision !== descriptor.revision) throw Error("连接设置已被其他页面修改，请重新 status 核对");
		if (action === "switch") {
			if (args.mode !== "local" && args.mode !== "remote") throw Error("运行位置应为 local 或 remote");
			const mode = args.mode;
			await worker.switchConnection(mode, () => settings.mutate("qwen-studio", [{
				op: "set",
				path: ["connectionMode"],
				value: mode
			}], descriptor.revision));
		} else if (action === "set_idle") {
			const n = args.idle_minutes;
			if (typeof n !== "number" || !Number.isFinite(n) || n < .1 || n > 1440) throw Error("空闲时间应为0.1–1440分钟");
			await settings.mutate("qwen-studio", [{
				op: "set",
				path: ["localMfluxIdleMinutes"],
				value: n
			}], descriptor.revision);
		} else throw Error("action 应为 status、switch 或 set_idle");
	}
	const config = worker.transportConfig();
	return {
		mode: worker.mode(),
		revision: settings.describe({ redactSecrets: true }).find((d) => d.ns === "qwen-studio")?.revision,
		idle_minutes: config.localMfluxIdleMinutes ?? 10,
		health: await worker.health(),
		remote_configured: Boolean(config.remoteBaseURL),
		ssh_managed: Boolean(config.remoteSshHost),
		restart_required: false,
		note: "已配置的本机/远程连接可以实时切换并持久保存，无需重启。只改运行位置或空闲时间，不改图库、预设、模型路径或密钥；不启动模型或 SSH。首次生图时才验证服务器。"
	};
}
function registerConnectionTool(ctx, worker, settings) {
	ctx.tools.register(defineTool({
		name: "qwen_image_connection",
		description: "Read or change the Qwen Image plugin execution location and shared idle timeout LIVE, without restarting DSH or editing configuration files/scripts. Use status first to obtain mode/revision; only on the user's request use switch with mode local/remote, or set_idle with idle_minutes, and pass revision. Reuses already configured paths, API key and SSH alias; preserves all presets/gallery. Busy generation/upload/queue blocks switching. Does not start SSH, load a model, or generate an image. Do not claim connectionMode requires a restart or tell the user to edit files when this tool is available. Never silently switch backends as a fallback.",
		timeoutMs: 12e4,
		parameters: {
			action: {
				type: "string",
				description: "status (default), switch, or set_idle."
			},
			mode: {
				type: "string",
				description: "switch only: local for this Mac, remote for the already configured server."
			},
			idle_minutes: {
				type: "number",
				description: "set_idle only: 0.1–1440 minutes, shared by local and the Qwen remote gateway."
			},
			revision: {
				type: "integer",
				description: "For writes, use the latest revision returned by status."
			}
		},
		output: {
			schema: {
				type: "object",
				properties: { result: {
					type: "string",
					required: true
				} },
				additionalProperties: false
			},
			render: (_args, value) => [{
				type: "text",
				text: value.result
			}]
		},
		async execute(args) {
			return { result: JSON.stringify(await connectionOperation(worker, settings, args)) };
		}
	}));
}
//#endregion
//#region lib/types/index.js
const name = "qwen-studio";
const inject = [
	"webServer",
	"tools",
	"attachments"
];
async function body(req, limit = 65536) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.length;
		if (size > limit) throw Error("请求过大");
		chunks.push(Buffer.from(chunk));
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function apply(ctx, config = {}) {
	const current = () => Object.fromEntries(Object.entries(config).map(([k, v]) => [k, v && typeof v === "object" && "get" in v ? v.get() : v]));
	const worker = new Worker(current);
	const gallerySnapshots = new GallerySnapshots();
	ctx.effect(() => () => {
		worker.dispose().catch(() => {});
	}, "qwen-studio SSH lifecycle");
	let updater;
	let updateError = "";
	const updateReady = (async () => {
		try {
			const installer = new PackageInstaller();
			const version = JSON.parse(await readFile(join(installer.paths.packageRoot, "package.json"), "utf8")).version;
			updater = new UpdateController(installer.paths.state, version, (fn) => worker.withMaintenance(fn), installer);
			await updater.init();
		} catch (e) {
			updateError = e instanceof Error ? e.message : String(e);
		}
	})();
	ctx.effect(() => () => {
		updater?.stop();
		closeGalleryIndexes();
	}, "qwen-studio updates and gallery index");
	registerTools(ctx, worker);
	ctx.inject(["settings"], (owner) => {
		registerConnectionTool(owner, worker, owner.get("settings"));
	});
	ctx.inject(["skills"], (owner) => {
		const skills = owner.get("skills");
		owner.effect(() => skills.register(bundledImageSkill()), "图像 skill");
	});
	for (const route of [
		"updates",
		"gallery-restore",
		"state",
		"progress",
		"jobs",
		"image",
		"action",
		"check",
		"attachment",
		"assets-upload",
		"settings",
		"resources",
		"presets"
	]) ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: `${API}/${route}`,
		handler: async (req, res) => {
			const json = (status, value) => {
				res.writeHead(status, {
					"content-type": "application/json",
					"cache-control": "no-store"
				});
				res.end(JSON.stringify(value));
			};
			try {
				if (route === "attachment" && req.method === "POST") {
					const data = await body(req);
					const stored = await ctx.attachments.readImage(data.attachment);
					res.writeHead(200, {
						"content-type": stored.ref.mediaType,
						"cache-control": "private, max-age=86400"
					});
					res.end(stored.data);
					return;
				}
				const dir = worker.directory();
				if (route === "updates") {
					await updateReady;
					if (!updater) throw Error(updateError || "更新服务不可用");
					if (req.method === "GET") return json(200, {
						...updater.snapshot(),
						backups: await updater.backups()
					});
					if (req.method === "POST") {
						const data = await body(req);
						if (data.action === "preferences") return json(200, await updater.preferences(data.preferences));
						if (data.action === "check") return json(200, await updater.check());
						if (data.action === "install") return json(200, await updater.install());
						if (data.action === "rollback" && data.confirm === true) return json(200, await updater.rollback(data.id));
						throw Error("更新操作无效；回滚需要明确确认");
					}
				}
				if (route === "gallery-restore" && req.method === "POST") {
					if ((await body(req)).confirm !== true) throw Error("恢复收藏备份需要明确确认");
					return json(200, await restoreGalleryFlags(dir));
				}
				if (route === "settings") {
					const data = req.method === "POST" ? await body(req) : {};
					const effective = resolveConfig({
						...current(),
						...data.config ?? {}
					});
					if (effective.connectionMode === "remote") sshOptions(effective);
					return json(200, {
						effective,
						health: await worker.health()
					});
				}
				if (route === "resources" && req.method === "GET") return json(200, await listResources(resolveConfig(current())));
				if (route === "presets") {
					const effective = resolveConfig(current());
					if (req.method === "GET") return json(200, await readPresets(dir));
					if (req.method === "POST") {
						const data = await body(req, 1048576);
						if (data.action === "load" || data.action === "export") {
							const store = await readPresets(dir), preset = store.items.find((p) => p.id === data.id);
							if (data.action === "export") {
								if (data.id && !preset) throw Error("预设不存在");
								return json(200, exportPresets(store, data.id));
							}
							if (!preset) throw Error("预设不存在");
							return json(200, await loadPreset(effective, preset));
						}
						return json(200, await mutatePresets(effective, data));
					}
				}
				if (route === "assets-upload" && req.method === "POST") {
					if (worker.mode() === "remote" && !await worker.capabilities()) throw Error("该远程服务不支持高级资源，请使用 Qwen 网关");
					return json(201, await worker.withActivity(() => receiveAsset(req, dir, resolveConfig(current()).pythonPath)));
				}
				if (route === "progress" && req.method === "POST") {
					const data = await body(req);
					return json(200, await invocationProgress(dir, data.call_id ?? "", data.prompt ?? "", Number(data.since ?? 0), data.session_id ?? ""));
				}
				if (route === "state" && req.method === "GET") {
					await worker.sync();
					const [jobs, health] = await Promise.all([readJobs(dir), worker.health()]);
					for (const job of jobs) if (active(job) && job.worker_pid && (job.source === "remote" || health.status === "offline")) try {
						process.kill(job.worker_pid, 0);
					} catch {
						job.status = "failed";
						job.error = "服务已停止，任务未完成，请重试";
					}
					const prior = new URL(req.url ?? "", "http://localhost").searchParams.get("revision");
					return json(200, {
						...gallerySnapshots.project(jobs, prior),
						apiVersion: 10,
						remoteAdvanced: worker.mode() === "remote" && Boolean(await worker.capabilities().catch(() => null)),
						referenceEditSupported: (await worker.referenceEditing()).supported,
						health: worker.mode() === "remote" ? {
							...health,
							busy: Boolean(health.busy || worker.remote.size > 0)
						} : health,
						directory: dir,
						idleMinutes: current().localMfluxIdleMinutes ?? 10,
						mode: worker.mode(),
						configured: worker.mode() === "remote" ? Boolean(current().remoteBaseURL) : await Promise.all([access(resolveConfig(current()).pythonPath), access(resolveConfig(current()).modelPath)]).then(() => true).catch(() => false)
					});
				}
				if (route === "check" && req.method === "POST") return json(200, await worker.check());
				if (route === "jobs" && req.method === "POST") return json(202, await worker.post("/v1/jobs", await body(req), true));
				if (route === "action" && req.method === "POST") {
					const data = await body(req);
					if (data.action === "unload") return json(200, await worker.post("/v1/unload", {}));
					if (data.action === "cancel") {
						if (!validId(data.id ?? "")) throw Error("任务ID无效");
						return json(200, await worker.post("/v1/cancel", { id: data.id }));
					}
					if (data.action === "purge" && data.confirm !== true) throw Error("永久删除需要明确确认");
					return json(200, await batchAction(dir, data.ids ?? [data.id], data.action, data.value));
				}
				if (route === "image" && req.method === "GET") {
					const url = new URL(req.url ?? "", "http://localhost"), id = url.searchParams.get("id") ?? "";
					if (!validId(id)) throw Error("图片ID无效");
					let path = await imagePath(dir, id);
					if (url.searchParams.get("reference") === "1") {
						const expected = join(dirname(path), "reference.png");
						path = await realpath(expected);
						if (path !== expected) throw Error("参考图片路径无效");
					}
					const image = await readFile(path);
					res.writeHead(200, {
						"content-type": "image/png",
						"cache-control": "private, max-age=86400",
						...url.searchParams.has("download") ? { "content-disposition": `attachment; filename="qwen-${id.slice(0, 8)}.png"` } : {}
					});
					res.end(image);
					return;
				}
				json(405, { error: "不支持的请求" });
			} catch (error) {
				if (!res.headersSent) json(500, { error: error instanceof Error ? error.message : String(error) });
			}
		}
	}), "qwen-studio: " + route);
}
//#endregion
export { Config, apply, inject, name };
