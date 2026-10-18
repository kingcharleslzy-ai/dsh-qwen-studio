window.__ModuleLoader__.load({
	id: "dsh-qwen-studio",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let react_dom = require("react-dom");
		//#region node_modules/lucide-react/dist/esm/shared/src/utils/toKebabCase.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const toKebabCase = (string) => string?.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
		//#endregion
		//#region node_modules/lucide-react/dist/esm/shared/src/utils/toLucideIconData.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		function toLucideIconData(iconName, iconNode, aliases = []) {
			if (iconNode == null) throw new Error("[lucide]: iconNode is required when icon name is used");
			return {
				name: toKebabCase(iconName),
				size: 24,
				node: iconNode,
				...aliases.length > 0 ? { aliases } : {}
			};
		}
		//#endregion
		//#region node_modules/lucide-react/dist/esm/shared/src/utils/toCamelCase.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const toCamelCase = (string) => {
			let out = "";
			let upperNext = false;
			for (const ch of string) {
				if (ch === "-" || ch === "_" || ch <= " ") {
					upperNext = out.length > 0;
					continue;
				}
				if (out.length === 0) out += ch.toLowerCase();
				else out += upperNext ? ch.toUpperCase() : ch;
				upperNext = false;
			}
			return out;
		};
		//#endregion
		//#region node_modules/lucide-react/dist/esm/shared/src/utils/toPascalCase.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const toPascalCase = (string) => {
			const camelCase = toCamelCase(string);
			return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
		};
		//#endregion
		//#region node_modules/lucide-react/dist/esm/shared/src/utils/mergeClasses.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const mergeClasses = (...classes) => classes.filter((className, index, array) => {
			return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
		}).join(" ").trim();
		//#endregion
		//#region node_modules/lucide-react/dist/esm/shared/src/build/defaultAttributes.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const defaultAttributes = {
			xmlns: "http://www.w3.org/2000/svg",
			width: 24,
			height: 24,
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			"stroke-width": 2,
			"stroke-linecap": "round",
			"stroke-linejoin": "round"
		};
		//#endregion
		//#region node_modules/lucide-react/dist/esm/shared/src/build/buildLucideIconNode.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		function isDefined(value) {
			return value !== null && value !== void 0;
		}
		function buildLucideIconNode(icon, params = {}) {
			const attributeNames = params.attributeNames ?? {};
			const getAttributeName = (attributeName) => attributeNames[attributeName] ?? attributeName;
			const viewBoxWidth = icon.size ?? icon.width ?? defaultAttributes["width"];
			const viewBoxHeight = icon.size ?? icon.height ?? defaultAttributes["height"];
			const aliasClassNames = icon.aliases?.filter((alias) => typeof alias === "string" && alias.trim() !== "").map((alias) => `lucide-${alias}`) ?? [];
			const iconClassNames = [...icon.name ? [`lucide-${icon.name}`] : [], ...aliasClassNames];
			const classNamesFromClassName = params.className?.split(" ").filter(Boolean) ?? [];
			const className = params.includeDefaultClasses === false ? mergeClasses(...classNamesFromClassName) : mergeClasses("lucide", ...iconClassNames, ...classNamesFromClassName);
			const calculatedStrokeWidth = params.absoluteStrokeWidth ? Number(params.strokeWidth ?? defaultAttributes["stroke-width"]) * Number(icon.size ?? icon.width ?? defaultAttributes["width"]) / Number(params.size ?? params.width ?? defaultAttributes["width"]) : params.strokeWidth ?? defaultAttributes["stroke-width"];
			return [
				"svg",
				{
					...Object.entries(defaultAttributes).reduce((attrs, [attrName, value]) => {
						attrs[getAttributeName(attrName)] = value;
						return attrs;
					}, {}),
					..."color" in params && params.color && { [getAttributeName("stroke")]: params.color },
					..."size" in params && isDefined(params.size) && {
						[getAttributeName("width")]: params.size,
						[getAttributeName("height")]: params.size
					},
					..."width" in params && isDefined(params.width) && { [getAttributeName("width")]: params.width },
					..."height" in params && isDefined(params.height) && { [getAttributeName("height")]: params.height },
					[getAttributeName("stroke-width")]: calculatedStrokeWidth,
					...className && { [getAttributeName("class")]: className },
					[getAttributeName("viewBox")]: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
					...params.hasA11yProp === false ? { [getAttributeName("aria-hidden")]: "true" } : {},
					..."attributes" in params && params.attributes
				},
				icon.node.map((child) => {
					const [name, attrs, children] = child;
					const nextAttrs = params.nonScalingStroke ? {
						[getAttributeName("vector-effect")]: "non-scaling-stroke",
						...attrs
					} : attrs;
					return children ? [
						name,
						nextAttrs,
						children
					] : [name, nextAttrs];
				})
			];
		}
		//#endregion
		//#region node_modules/lucide-react/dist/esm/shared/src/build/buildLucideIconForReact.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		function buildLucideIconForReact(icon, params = {}) {
			return buildLucideIconNode(icon, {
				...params,
				attributeNames: {
					...params.attributeNames,
					class: "className",
					"stroke-width": "strokeWidth",
					"stroke-linecap": "strokeLinecap",
					"stroke-linejoin": "strokeLinejoin",
					"vector-effect": "vectorEffect"
				}
			});
		}
		//#endregion
		//#region node_modules/lucide-react/dist/esm/shared/src/utils/hasA11yProp.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const hasA11yProp = (props) => {
			for (const prop in props) if (prop.startsWith("aria-") || prop === "role" || prop === "title") return true;
			return false;
		};
		//#endregion
		//#region node_modules/lucide-react/dist/esm/context.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const LucideContext = (0, react.createContext)({});
		const useLucideContext = () => (0, react.useContext)(LucideContext);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/Icon.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const Icon = (0, react.forwardRef)(({ color, size, width, height, strokeWidth, absoluteStrokeWidth, nonScalingStroke, className = "", children, iconNode = [], icon = {
			node: iconNode,
			aliases: [],
			size: 24
		}, ...rest }, ref) => {
			const { size: contextSize = 24, strokeWidth: contextStrokeWidth = 2, absoluteStrokeWidth: contextAbsoluteStrokeWidth = false, nonScalingStroke: contextNonScalingStroke = false, color: contextColor = "currentColor", className: contextClass = "" } = useLucideContext() ?? {};
			const hasAccessibleProp = Boolean(children) || hasA11yProp(rest);
			const [name, svgAttributes, builtIconNode = []] = buildLucideIconForReact(icon, {
				color: color ?? contextColor,
				width: width ?? size ?? contextSize,
				height: height ?? size ?? contextSize,
				strokeWidth: strokeWidth ?? contextStrokeWidth,
				absoluteStrokeWidth: absoluteStrokeWidth ?? contextAbsoluteStrokeWidth,
				nonScalingStroke: nonScalingStroke ?? contextNonScalingStroke,
				className: mergeClasses(contextClass, className),
				hasA11yProp: hasAccessibleProp,
				attributes: rest
			});
			return (0, react.createElement)(name, {
				ref,
				...svgAttributes
			}, [...builtIconNode.map(([tag, attrs]) => (0, react.createElement)(tag, attrs)), ...Array.isArray(children) ? children : [children]]);
		});
		//#endregion
		//#region node_modules/lucide-react/dist/esm/createLucideIcon.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		function createLucideIcon(iconDataOrName, iconNode = [], aliases = []) {
			const iconData = typeof iconDataOrName === "string" ? toLucideIconData(iconDataOrName, iconNode, aliases) : iconDataOrName;
			const Component = (0, react.forwardRef)(({ className, ...props }, ref) => (0, react.createElement)(Icon, {
				ref,
				icon: iconData,
				className,
				...props
			}));
			if (iconData.name) Component.displayName = toPascalCase(iconData.name);
			return Component;
		}
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/archive.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$18 = {
			name: "archive",
			size: 24,
			node: [
				["rect", {
					width: "20",
					height: "5",
					x: "2",
					y: "3",
					rx: "1",
					key: "1wp1u1"
				}],
				["path", {
					d: "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8",
					key: "1s80jp"
				}],
				["path", {
					d: "M10 12h4",
					key: "a56b0p"
				}]
			]
		};
		__iconData$18.node;
		const Archive = createLucideIcon(__iconData$18);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/arrow-left.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$17 = {
			name: "arrow-left",
			size: 24,
			node: [["path", {
				d: "m12 19-7-7 7-7",
				key: "1l729n"
			}], ["path", {
				d: "M19 12H5",
				key: "x3x0zl"
			}]]
		};
		__iconData$17.node;
		const ArrowLeft = createLucideIcon(__iconData$17);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/arrow-up.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$16 = {
			name: "arrow-up",
			size: 24,
			node: [["path", {
				d: "m5 12 7-7 7 7",
				key: "hav0vg"
			}], ["path", {
				d: "M12 19V5",
				key: "x0mq9r"
			}]]
		};
		__iconData$16.node;
		const ArrowUp = createLucideIcon(__iconData$16);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/check.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$15 = {
			name: "check",
			size: 24,
			node: [["path", {
				d: "M20 6 9 17l-5-5",
				key: "1gmf2c"
			}]]
		};
		__iconData$15.node;
		const Check = createLucideIcon(__iconData$15);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/circle-question-mark.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$14 = {
			name: "circle-question-mark",
			size: 24,
			node: [
				["circle", {
					cx: "12",
					cy: "12",
					r: "10",
					key: "1mglay"
				}],
				["path", {
					d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",
					key: "1u773s"
				}],
				["path", {
					d: "M12 17h.01",
					key: "p32p05"
				}]
			],
			aliases: ["help-circle", "circle-help"]
		};
		__iconData$14.node;
		const CircleQuestionMark = createLucideIcon(__iconData$14);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/download.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$13 = {
			name: "download",
			size: 24,
			node: [
				["path", {
					d: "M12 15V3",
					key: "m9g1x1"
				}],
				["path", {
					d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
					key: "ih7n3h"
				}],
				["path", {
					d: "m7 10 5 5 5-5",
					key: "brsn70"
				}]
			]
		};
		__iconData$13.node;
		const Download = createLucideIcon(__iconData$13);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/file.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$12 = {
			name: "file",
			size: 24,
			node: [["path", {
				d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
				key: "1oefj6"
			}], ["path", {
				d: "M14 2v5a1 1 0 0 0 1 1h5",
				key: "wfsgrz"
			}]]
		};
		__iconData$12.node;
		const File = createLucideIcon(__iconData$12);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/folder-open.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$11 = {
			name: "folder-open",
			size: 24,
			node: [["path", {
				d: "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",
				key: "usdka0"
			}]]
		};
		__iconData$11.node;
		const FolderOpen = createLucideIcon(__iconData$11);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/image.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$10 = {
			name: "image",
			size: 24,
			node: [
				["rect", {
					width: "18",
					height: "18",
					x: "3",
					y: "3",
					rx: "2",
					ry: "2",
					key: "1m3agn"
				}],
				["circle", {
					cx: "9",
					cy: "9",
					r: "2",
					key: "af1f0g"
				}],
				["path", {
					d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",
					key: "1xmnt7"
				}]
			]
		};
		__iconData$10.node;
		const Image = createLucideIcon(__iconData$10);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/images.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$9 = {
			name: "images",
			size: 24,
			node: [
				["path", {
					d: "m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16",
					key: "9kzy35"
				}],
				["path", {
					d: "M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2",
					key: "1t0f0t"
				}],
				["circle", {
					cx: "13",
					cy: "7",
					r: "1",
					fill: "currentColor",
					key: "1obus6"
				}],
				["rect", {
					x: "8",
					y: "2",
					width: "14",
					height: "14",
					rx: "2",
					key: "1gvhby"
				}]
			]
		};
		__iconData$9.node;
		const Images = createLucideIcon(__iconData$9);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/loader-circle.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$8 = {
			name: "loader-circle",
			size: 24,
			node: [["path", {
				d: "M21 12a9 9 0 1 1-6.219-8.56",
				key: "13zald"
			}]],
			aliases: ["loader-2"]
		};
		__iconData$8.node;
		const LoaderCircle = createLucideIcon(__iconData$8);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/plus.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$7 = {
			name: "plus",
			size: 24,
			node: [["path", {
				d: "M5 12h14",
				key: "1ays0h"
			}], ["path", {
				d: "M12 5v14",
				key: "s699le"
			}]]
		};
		__iconData$7.node;
		const Plus = createLucideIcon(__iconData$7);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/rotate-ccw.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$6 = {
			name: "rotate-ccw",
			size: 24,
			node: [["path", {
				d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",
				key: "1357e3"
			}], ["path", {
				d: "M3 3v5h5",
				key: "1xhq8a"
			}]]
		};
		__iconData$6.node;
		const RotateCcw = createLucideIcon(__iconData$6);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/search.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$5 = {
			name: "search",
			size: 24,
			node: [["path", {
				d: "m21 21-4.34-4.34",
				key: "14j7rj"
			}], ["circle", {
				cx: "11",
				cy: "11",
				r: "8",
				key: "4ej97u"
			}]]
		};
		__iconData$5.node;
		const Search = createLucideIcon(__iconData$5);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/sliders-horizontal.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$4 = {
			name: "sliders-horizontal",
			size: 24,
			node: [
				["path", {
					d: "M10 5H3",
					key: "1qgfaw"
				}],
				["path", {
					d: "M12 19H3",
					key: "yhmn1j"
				}],
				["path", {
					d: "M14 3v4",
					key: "1sua03"
				}],
				["path", {
					d: "M16 17v4",
					key: "1q0r14"
				}],
				["path", {
					d: "M21 12h-9",
					key: "1o4lsq"
				}],
				["path", {
					d: "M21 19h-5",
					key: "1rlt1p"
				}],
				["path", {
					d: "M21 5h-7",
					key: "1oszz2"
				}],
				["path", {
					d: "M8 10v4",
					key: "tgpxqk"
				}],
				["path", {
					d: "M8 12H3",
					key: "a7s4jb"
				}]
			]
		};
		__iconData$4.node;
		const SlidersHorizontal = createLucideIcon(__iconData$4);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/star.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$3 = {
			name: "star",
			size: 24,
			node: [["path", {
				d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
				key: "r04s7s"
			}]]
		};
		__iconData$3.node;
		const Star = createLucideIcon(__iconData$3);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/trash.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$2 = {
			name: "trash",
			size: 24,
			node: [
				["path", {
					d: "M10 11v6",
					key: "nco0om"
				}],
				["path", {
					d: "M14 11v6",
					key: "outv1u"
				}],
				["path", {
					d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
					key: "miytrc"
				}],
				["path", {
					d: "M3 6h18",
					key: "d0wm0j"
				}],
				["path", {
					d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
					key: "e791ji"
				}]
			],
			aliases: ["trash-2"]
		};
		__iconData$2.node;
		const Trash = createLucideIcon(__iconData$2);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/upload.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData$1 = {
			name: "upload",
			size: 24,
			node: [
				["path", {
					d: "M12 3v12",
					key: "1x0j5s"
				}],
				["path", {
					d: "m17 8-5-5-5 5",
					key: "7q97r8"
				}],
				["path", {
					d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
					key: "ih7n3h"
				}]
			]
		};
		__iconData$1.node;
		const Upload = createLucideIcon(__iconData$1);
		//#endregion
		//#region node_modules/lucide-react/dist/esm/icons/x.mjs
		/**
		* @license lucide-react v1.58.0 - ISC
		*
		* This source code is licensed under the ISC license.
		* See the LICENSE file in the root directory of this source tree.
		*/
		const __iconData = {
			name: "x",
			size: 24,
			node: [["path", {
				d: "M18 6 6 18",
				key: "1bl5f8"
			}], ["path", {
				d: "m6 6 12 12",
				key: "d8bk6v"
			}]]
		};
		__iconData.node;
		const X = createLucideIcon(__iconData);
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
		const statusLabel = (s) => ({
			queued: "排队中",
			uploading: "同步资源",
			loading: "加载模型",
			running: "生成中",
			saving: "保存图片",
			complete: "已完成",
			failed: "失败",
			cancelling: "正在取消",
			cancelled: "已取消"
		})[s] ?? s;
		//#endregion
		//#region lib/types/client/api.js
		var APIError = class extends Error {
			status;
			constructor(message, status) {
				super(message);
				this.status = status;
			}
		};
		async function request(path, data) {
			const r = await fetch(`${API}/${path}`, data === void 0 ? {
				cache: "no-store",
				signal: AbortSignal.timeout(5e3)
			} : {
				method: "POST",
				signal: AbortSignal.timeout(["presets", "updates"].includes(path) ? 24e4 : 15e3),
				headers: { "content-type": "application/json" },
				body: JSON.stringify(data)
			});
			let value;
			try {
				value = await r.json();
			} catch {
				if (!r.ok) throw new APIError(`请求失败 (${r.status})`, r.status);
				throw new APIError("服务返回了无效的 JSON 数据", r.status);
			}
			if (!r.ok) throw new APIError(typeof value?.error === "string" ? value.error : `请求失败 (${r.status})`, r.status);
			return value;
		}
		const imageURL = (id) => `${API}/image?id=${id}`;
		async function download(id) {
			const r = await fetch(imageURL(id));
			if (!r.ok) throw Error("无法读取图片");
			const blob = await r.blob(), url = URL.createObjectURL(blob), a = document.createElement("a");
			a.href = url;
			a.download = `qwen-${id.slice(0, 8)}.png`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 6e4);
		}
		let lastSnapshot;
		function cache(snapshot) {
			lastSnapshot = snapshot;
		}
		/** Unchanged gallery responses contain only health/capabilities and a revision. */
		async function pollSnapshot(previous) {
			const data = await request(`state${previous?.jobsRevision ? "?revision=" + encodeURIComponent(previous.jobsRevision) : ""}`);
			if (!data.jobs && !previous) throw Error("图库快照缺少初始记录");
			if (data.jobs) return {
				...data,
				jobs: data.jobs
			};
			if (!data.jobChanges) return {
				...data,
				jobs: previous.jobs
			};
			const jobs = new Map(previous.jobs.map((j) => [j.id, j]));
			for (const id of data.removedJobIds ?? []) jobs.delete(id);
			for (const job of data.jobChanges) jobs.set(job.id, job);
			return {
				...data,
				jobs: [...jobs.values()].sort((a, b) => b.started_at - a.started_at)
			};
		}
		//#endregion
		//#region lib/types/client/style.js
		const STYLE = `
.q2 {
 --q-bg:var(--dsw-alias-bg-base,#fff); --q-surface:var(--dsw-alias-bg-layer-1,#f5f5f5);
 --q-text:var(--dsw-alias-label-primary,#202124); --q-muted:var(--dsw-alias-label-secondary,#686b70);
 --q-line:var(--dsw-alias-border-l3,#ddd); --q-accent:var(--dsw-alias-state-business-primary,#4d6bfe);
 color:var(--q-text);font-family:inherit;font-size:var(--dsh-content-font-size,14px);line-height:1.5;box-sizing:border-box;isolation:isolate;
}
.q2 *{box-sizing:border-box}.q2 h2,.q2 h3,.q2 p{margin:0}.q2 svg{width:1.15em;height:1.15em;flex-shrink:0}
.q2 button,.q2 input,.q2 select,.q2 textarea{font:inherit;color:inherit}
.q2 button{display:inline-flex;align-items:center;justify-content:center;gap:.45em;cursor:pointer;background:transparent;border:1px solid var(--q-line);padding:.45em .8em;border-radius:var(--dsw-radius-md,8px);white-space:nowrap;box-shadow:none;background-image:none;transition:background-color .12s ease,color .12s ease,border-color .12s ease}
.q2 button:hover:not(:disabled){box-shadow:none;filter:none;transform:none;background:var(--dsw-alias-interactive-bg-hover,var(--q-surface))}.q2 button:disabled{opacity:.4;cursor:not-allowed}
.q2 :focus-visible{outline:1px solid var(--q-accent);outline-offset:2px}
.q2 input,.q2 select,.q2 textarea{min-width:0;background:var(--q-surface);border:1px solid var(--q-line);border-radius:var(--dsw-radius-md,8px);padding:.55em .7em}
.q2 label,.q2-path-field{display:flex;flex-direction:column;gap:.6em}.q2 small,.q2-muted{color:var(--q-muted);font-size:.875em}
.q2-studio{height:100%;min-height:0;overflow:hidden;display:flex;flex-direction:column;background:var(--q-bg);position:relative;container-type:inline-size}
.q2-brand{display:flex;justify-content:space-between;align-items:center;padding:4px 24px;gap:24px;flex-shrink:0;border-bottom:1px solid var(--q-line);min-height:48px}
.q2-brand h2{font:inherit;font-size:1em;font-weight:600;line-height:1.5}.q2-status{display:flex;align-items:center;gap:.5em;color:var(--q-muted);font-size:.875em;white-space:nowrap}
.q2-status i{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#699b7d)}.q2-status i.working{background:var(--q-accent)}
.q2-nav{display:flex;gap:20px;padding:0;border-bottom:0;flex:1;min-width:0}
.q2-nav button{border:0;border-radius:0;padding:.6em 0;color:var(--q-muted);position:relative}.q2-nav button[aria-pressed=true]{color:var(--q-text)}
.q2-nav button[aria-pressed=true]:after{content:'';position:absolute;bottom:-1px;height:2px;background:var(--q-accent);left:0;right:0}
.q2 .q2-nav button:hover:not(:disabled){background:transparent;color:var(--q-text);box-shadow:none}.q2-nav button span{color:var(--q-muted);font-size:.875em}.q2-nav .q2-unload{margin-left:auto}
.q2-toolbar{display:flex;gap:12px;align-items:center;padding:16px 24px;flex-shrink:0}.q2-search{flex:1;min-width:60px;position:relative}
.q2-search svg{position:absolute;left:0;top:.7em;color:var(--q-muted)}.q2 .q2-search input{width:100%;border:0;background:transparent;padding:.55em .3em .55em 1.8em}
.q2-toolbar select{border:0;background:transparent;max-width:10em}.q2-gallery-scroll{flex:1;min-height:0;overflow:auto;padding:0 24px 24px;scrollbar-gutter:stable}
.q2-masonry{columns:3;column-gap:20px}.q2-card{break-inside:avoid;margin-bottom:22px;position:relative}
.q2 .q2-thumb{padding:0;display:block;width:100%;border:0;border-radius:var(--dsw-radius-md,8px);overflow:hidden;position:relative;text-align:left;background:var(--q-surface);line-height:0}
.q2-thumb img{width:100%;height:auto;display:block}.q2-caption{display:flex;gap:6px;align-items:center;padding:8px 1px 0;min-width:0;font-size:.875em;color:var(--q-muted)}
.q2-caption>span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.q2 .q2-caption button{padding:3px;border:0}.q2-caption button[aria-pressed=true]{color:var(--q-accent)}
.q2-card.selected .q2-thumb{outline:1px solid var(--q-accent);outline-offset:2px}.q2-check{position:absolute;top:10px;left:10px;border:1px solid #fffa;background:#202126cc;width:24px;height:24px;border-radius:6px;display:grid;place-items:center;color:white}.q2-card.selected .q2-check{background:var(--q-accent);border-color:var(--q-accent)}
.q2-archived{position:absolute;bottom:10px;left:10px;background:#131417c0;color:#fff;padding:.35em .6em;font-size:.875em;line-height:1.5;border-radius:6px}
.q2-batch{display:flex;align-items:center;flex-wrap:wrap;gap:8px;background:var(--q-surface);margin:0 24px 16px;padding:8px 12px;border-radius:8px}.q2-batch button{border:0}.q2-batch>span{color:var(--q-muted);margin-right:auto}
.q2 .q2-danger{color:var(--dsw-alias-state-error-primary,#b53e3e)}.q2-empty{text-align:center;padding:64px 24px}.q2-empty>svg{width:32px;height:32px;color:var(--q-muted);margin-bottom:16px}.q2-empty h3{font:inherit;font-weight:500;font-size:1.1em}.q2-empty p{color:var(--q-muted);margin:8px 0 20px}
/* Persistent preview beside an editor; only the editor scrolls at the outer edge. */
.q2-create{padding:16px 24px;overflow:hidden;scrollbar-gutter:stable;min-height:0;flex:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,36%);gap:24px;align-items:stretch}
.q2-prompt-label{min-width:0;display:flex;flex-direction:column}.q2 textarea{resize:vertical;min-height:112px;line-height:1.7;background:var(--q-surface);padding:12px}
.q2-options{min-width:0;display:flex;flex-direction:column;gap:16px}.q2-option-label{margin-bottom:-8px}.q2-presets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.q2-presets button{padding:.5em .25em;font-variant-numeric:tabular-nums}.q2-presets button[aria-pressed=true]{color:var(--q-accent);border-color:var(--q-accent);background:var(--q-surface)}
.q2 summary{cursor:pointer;color:var(--q-muted);padding:.4em 0}.q2-advanced summary{display:flex;align-items:center;gap:.5em}.q2-advanced summary span{display:none}.q2-param-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:8px 0}.q2-param-grid label:first-child{grid-column:1/-1}.q2-param-grid input,.q2-param-grid select{width:100%}
.q2-submit{flex-shrink:0;padding-top:12px;background:var(--q-bg)}.q2-submit p{font-size:.875em;color:var(--q-muted);margin-bottom:12px}.q2 .q2-primary{background:var(--dsw-alias-button-primary-fill,#4d6bfe);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff);font-weight:500;padding:.65em 1em;min-height:2.6em}.q2 .q2-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#3c55db)}.q2-submit>.q2-primary{width:100%}.q2-primary small{margin-left:auto;color:inherit;opacity:.7}
.q2-retry{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.q2-alert,.q2-notice{margin:12px 24px 0;padding:8px 12px;border-radius:8px;display:flex;gap:8px;align-items:center;flex-shrink:0}.q2-alert{color:var(--dsw-alias-state-error-primary,#b53e3e);background:var(--q-surface)}.q2-notice{color:var(--q-muted);background:var(--q-surface)}.q2-alert button,.q2-notice button{padding:2px;border:0;margin-left:auto}
.q2-running{display:flex;gap:8px;align-items:center;margin:0 24px 16px;color:var(--q-muted)}.q2-running small{margin-left:auto}.q2-task{min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px;line-height:1.5;text-align:center}.q2-task span{font-size:.875em;color:var(--q-muted)}.q2-progress{height:4px;background:var(--q-line);width:100%;overflow:hidden;border-radius:4px}.q2-progress i{display:block;height:100%;background:var(--q-accent)}
.q2-overlay{position:absolute;inset:0;z-index:4;background:var(--q-bg)}.q2-detail{height:100%;display:flex;flex-direction:column}.q2-detail>header{padding:12px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--q-line);flex-shrink:0}.q2-detail>header button{border:0}.q2-detail-scroll{overflow:auto;min-height:0;flex:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,30%);align-items:start}.q2-original{display:block;width:100%;height:auto;max-height:100%;object-fit:contain;align-self:center}.q2-detail-copy{padding:24px}.q2-eyebrow{font-size:.875em;color:var(--q-muted)}.q2-detail-copy>p{line-height:1.8;margin-top:12px;overflow-wrap:anywhere}.q2-metadata{display:flex;flex-wrap:wrap;gap:8px 16px;color:var(--q-muted);font-size:.875em;margin-top:20px}.q2-detail footer{display:flex;gap:8px;padding:16px 24px;border-top:1px solid var(--q-line);flex-shrink:0}.q2-detail footer>button:first-child{margin-right:auto}
.q2-confirm-backdrop{position:absolute;inset:0;z-index:6;background:#0006;display:grid;place-items:center;padding:24px}.q2-confirm{background:var(--q-bg);border:1px solid var(--q-line);border-radius:16px;padding:24px;max-width:440px;box-shadow:0 16px 50px #0002}.q2-confirm>svg{color:var(--dsw-alias-state-error-primary,#b53e3e);margin-bottom:16px}.q2-confirm h3{font:inherit;font-weight:600;font-size:1.1em}.q2-confirm p{color:var(--q-muted);margin:12px 0 24px}.q2 .q2-danger-fill{background:var(--dsw-alias-state-error-primary,#b53e3e);border-color:transparent;color:white}.q2-actions{display:flex;gap:10px;flex-wrap:wrap}
.q2-settings{max-width:900px;padding:8px 0 24px;display:flex;flex-direction:column;gap:20px}.q2-settings .q2-brand{padding:0}.q2-segment{display:flex;gap:4px;background:var(--q-surface);padding:4px;border-radius:10px;align-self:flex-start}.q2-segment button{border:0}.q2-segment button[aria-pressed=true]{background:var(--q-bg)}.q2-settings label input{width:100%}.q2-input-unit{display:flex;align-items:center;gap:10px;color:var(--q-muted)}.q2-input-unit input{max-width:120px}.q2-settings details p{padding-top:10px;color:var(--q-muted)}.q2-message{color:var(--q-accent)}.q2-path-row{display:flex;gap:8px;align-items:center}.q2-path-row input{min-width:0;flex:1}.q2-path-row button{flex-shrink:0}
.q2-editor{min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:0}.q2-editor-scroll{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:2px 4px 8px 2px;scrollbar-gutter:stable}.q2-editor .q2-options{gap:12px;flex-shrink:0}.q2-editor textarea{height:7em;min-height:5em;max-height:30vh}.q2-parameter-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--q-muted)}.q2-preview{min-width:0;min-height:0;display:flex;flex-direction:column;gap:12px}.q2-preview>header{display:flex;align-items:center;justify-content:space-between;gap:12px}.q2-preview>header small{color:var(--q-muted)}.q2-preview-stage{flex:1;min-height:180px;position:relative;background:var(--q-surface);border:1px solid var(--q-line);border-radius:var(--dsw-radius-md,8px);overflow:hidden;display:flex;align-items:center;justify-content:center}.q2-preview-stage>img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.q2-preview-empty{display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px;text-align:center;color:var(--q-muted);max-width:440px}.q2-preview-empty>svg{width:28px;height:28px}.q2-preview-empty progress{width:180px;height:4px;accent-color:var(--q-accent)}.q2-result-actions{display:flex;gap:8px;flex-wrap:wrap}.q2-result-actions button{font-size:.875em;border:0;background:var(--q-surface)}.q2-history{display:flex;gap:8px;overflow-x:auto;padding:3px;flex-shrink:0}.q2-history button{padding:0;width:56px;height:56px;flex-shrink:0;overflow:hidden}.q2-history img{width:100%;height:100%;object-fit:cover}.q2-history span{font-size:.75em;white-space:normal}.q2-history button[aria-pressed=true]{outline:1px solid var(--q-accent);outline-offset:2px}.q2-reference{background:var(--q-surface);border:1px solid var(--q-line);border-radius:var(--dsw-radius-md,8px);padding:12px;display:flex;flex-direction:column;gap:10px}.q2-reference-head{display:flex;gap:10px;align-items:center}.q2-reference-head img{width:48px;height:48px;object-fit:cover;border-radius:4px}.q2-reference-head>div{flex:1;min-width:0;display:flex;flex-direction:column}.q2-reference-head button{border:0;padding:4px}.q2-reference label{display:flex;flex-direction:row;align-items:center;flex-wrap:wrap;font-size:.875em}.q2-reference label>span{margin-left:auto;color:var(--q-muted)}.q2 input[type=range]{width:100%;height:16px;padding:0;border:0;background:transparent;accent-color:var(--q-accent)}
.q2-gallery-hint{padding:0 24px 12px;color:var(--q-muted);font-size:.875em}
.q2-field-title{display:flex;align-items:center;gap:6px}.q2-help{position:relative;display:inline-flex;font-weight:400}.q2 .q2-help button{padding:2px;border:0;color:var(--q-muted);line-height:1}.q2-tooltip-layer{position:fixed;z-index:2147483647;width:300px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;padding:10px 12px;border:1px solid var(--q-line);border-radius:8px;background:var(--q-bg);box-shadow:0 4px 16px #0002;color:var(--q-text);line-height:1.6;white-space:normal;overflow-wrap:anywhere}
.q2 .q2-advanced-link{align-self:flex-start;border:0;padding:4px 0;color:var(--q-muted)}.q2-advanced-page{overflow:auto;flex:1;min-height:0;padding:24px;display:flex;flex-direction:column;gap:24px}.q2-advanced-page>section,.q2-advanced-page>footer,.q2-advanced-page>p{width:100%;max-width:720px;margin:0 auto}.q2-advanced-page section{display:flex;flex-direction:column;gap:14px;padding-bottom:24px;border-bottom:1px solid var(--q-line)}.q2-advanced-page h3{font:inherit;font-weight:600}.q2-advanced-fields{display:grid;grid-template-columns:1fr 1fr;gap:20px}.q2-advanced-page section>button{align-self:flex-start}.q2-advanced-page footer{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.q2-preview>header{flex-wrap:wrap}.q2-preview>header small{margin-left:auto}.q2 .q2-clear-preview{border:0;padding:4px 6px;font-size:.875em;color:var(--q-muted)}.q2-result-actions button[aria-pressed=true]{color:var(--q-accent)}
.q2-privacy-setting{display:grid;grid-template-columns:1fr auto;gap:10px 24px;padding:16px;border:1px solid var(--q-line);border-radius:8px}.q2-privacy-setting h3{font:inherit;font-weight:600;margin-bottom:6px}.q2-privacy-setting>small{grid-column:1/-1}.q2 .q2-switch{padding:3px;width:38px;height:22px;border:0;border-radius:20px;background:var(--q-line);align-self:center;justify-content:flex-start}.q2 .q2-switch[aria-checked=true]{background:var(--q-accent)}.q2-switch::before{content:"";display:block;flex-shrink:0;height:16px;width:16px;border-radius:50%;background:#fff;transition:transform .15s}.q2-switch[aria-checked=true]::before{transform:translateX(16px)}
.q2-live-tasks{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.q2-live-tasks button{font-size:.875em}.q2-chat-progress{margin:12px 0;max-width:512px;border:1px solid var(--q-line);border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:10px}.q2-chat-progress>div{display:flex;align-items:center;gap:8px}.q2-chat-progress>div>span{margin-left:auto;color:var(--q-muted);font-size:.875em}.q2-chat-progress strong{font-weight:500}.q2-chat-progress progress{width:100%;height:5px;accent-color:var(--q-accent)}.q2-chat-progress>img{width:100%;height:auto;border-radius:6px}
.q2-spin{animation:q2-spin 1.5s linear infinite}@keyframes q2-spin{to{transform:rotate(360deg)}}.q2-indeterminate i{width:35%;animation:q2-progress-slide 1.6s ease-in-out infinite alternate}@keyframes q2-progress-slide{to{transform:translateX(185%)}}
@container(min-width:1200px){.q2-masonry{columns:4}}
@container(max-width:760px){.q2-create{grid-template-columns:1fr;align-items:start;gap:24px}.q2-create{overflow:auto}.q2-editor{overflow:visible}.q2-editor-scroll{overflow:visible;flex:none}.q2-preview{min-height:360px}.q2-preview-stage{min-height:260px}.q2-prompt-label{min-height:0}.q2-options{gap:12px}.q2-submit{margin-top:0}.q2-masonry{columns:2}.q2-detail-scroll{display:block}.q2-original{max-height:none}}
@container(max-width:420px){.q2-brand,.q2-create,.q2-toolbar{padding:12px 16px}.q2-nav{padding:0;gap:12px}.q2-brand{gap:12px;flex-wrap:wrap}.q2-gallery-scroll{padding:0 16px 16px}.q2-status{font-size:.875em}.q2-toolbar{gap:6px}.q2-masonry{columns:1}}
@media(prefers-reduced-motion:reduce){.q2 *{animation:none!important;transition:none!important}}

/* Advanced effects use the host typography, compact cards and a single outer scrollbar. */
.q2-effects-page{gap:16px;padding:20px 24px;scrollbar-gutter:stable}.q2 .q2-effects-page>div,.q2 .q2-effects-page>section,.q2 .q2-effects-page>details,.q2 .q2-effects-page>footer,.q2 .q2-effects-page>p{width:100%;max-width:1180px;margin:0 auto}.q2-effects-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}.q2-effects-page .q2-effect-section{min-width:0;border:1px solid var(--q-line);border-radius:var(--dsw-radius-md,8px);padding:18px;gap:14px}.q2-effect-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.q2-effect-heading h3{font-size:1em}.q2-effect-heading p{color:var(--q-muted);font-size:.875em;margin-top:4px}.q2-effect-tag{font-size:.8em;color:var(--q-muted);border:1px solid var(--q-line);padding:2px 7px;border-radius:5px}.q2 label.q2-inline-check{display:flex;flex-direction:row;align-items:center;gap:7px;white-space:nowrap}.q2-inline-check input{accent-color:var(--q-accent)}.q2-effect-empty{background:var(--q-surface);color:var(--q-muted);padding:18px;border-radius:6px;font-size:.875em;line-height:1.8}.q2-file-upload{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.q2-file-progress{color:var(--q-muted);font-size:.875em;overflow-wrap:anywhere}.q2-lora-list{display:flex;flex-direction:column;gap:10px}.q2-lora-item{display:flex;align-items:center;gap:10px;border:1px solid var(--q-line);padding:10px;border-radius:6px;flex-wrap:wrap}.q2-lora-item>.q2-inline-check{flex:1;min-width:120px}.q2-lora-item .q2-inline-check span{overflow:hidden;text-overflow:ellipsis;max-width:23em;white-space:nowrap}.q2 .q2-lora-weight{flex-direction:row;align-items:center;gap:8px;color:var(--q-muted);font-size:.875em}.q2-lora-weight input{width:5em}.q2-lora-item>button{border:0;padding:4px}.q2-selected-image{display:flex;align-items:center;gap:10px;min-width:0;border:1px solid var(--q-line);border-radius:6px;padding:8px}.q2-selected-image img{width:72px;height:72px;object-fit:contain;background:var(--q-surface);border-radius:4px}.q2-selected-image>span{flex:1;min-width:0;overflow-wrap:anywhere;font-size:.875em}.q2-selected-image>button{border:0;padding:4px}.q2-mask-section{grid-column:1/-1}.q2-mask-inputs{display:grid;grid-template-columns:1fr 1fr;gap:20px}.q2-mask-inputs>div{display:flex;flex-direction:column;gap:10px}.q2-mask-legend{display:flex;gap:24px;flex-wrap:wrap;font-size:.875em;color:var(--q-muted)}.q2-mask-legend span{display:flex;align-items:center;gap:7px}.q2-mask-legend i{display:inline-block;width:14px;height:14px;border:1px solid var(--q-line);border-radius:3px}.q2-mask-legend .white{background:#fff}.q2-mask-legend .black{background:#111}.q2-effect-note,.q2-effect-error{padding:10px 12px;background:var(--q-surface);border:1px solid var(--q-line);border-radius:6px;font-size:.875em}.q2-effect-error{color:var(--dsw-alias-state-error-primary,#b53e3e);display:flex;align-items:center;gap:10px}.q2-effect-error button{margin-left:auto;border:0;padding:3px}.q2-base-settings{border:1px solid var(--q-line);border-radius:6px;padding:12px 18px}.q2-base-settings>summary{color:var(--q-text)}.q2-base-settings .q2-advanced-fields{margin-top:14px;gap:16px}.q2-effects-page>footer{border:0;padding:0;gap:12px;align-items:center}.q2-effects-page>footer .q2-primary{margin-left:auto}.q2 .q2-advanced-summary{border:0;padding:4px 0;margin-bottom:6px;color:var(--q-accent);font-size:.875em;max-width:100%;white-space:normal;text-align:left}
@container(max-width:760px){.q2-effects-grid,.q2-mask-inputs{grid-template-columns:1fr}.q2-mask-section{grid-column:auto}.q2-effects-page{padding:16px}.q2-effect-heading{flex-wrap:wrap}.q2-base-settings .q2-advanced-fields{grid-template-columns:1fr}}

.q2-settings-fields{border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:18px;min-width:0}.q2-config-origin{display:flex;align-items:center;justify-content:space-between;color:var(--q-muted);font-size:.8em;margin-top:5px;gap:12px}.q2-config-origin button{border:0;padding:2px 4px;font-size:inherit}.q2-settings dd{overflow-wrap:anywhere;font-size:.85em}.q2 .q2-effects-page>section.q2-preset-library{position:relative;max-width:1180px;background:var(--q-bg,var(--dsw-alias-background-primary,#181818));padding:12px;border:1px solid var(--q-line);border-radius:8px;display:flex;flex-direction:column;gap:10px}.q2-preset-row,.q2-preset-manage,.q2-resource-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:10px}.q2-preset-row>details[open]{flex-basis:100%}.q2-preset-row>label{min-width:180px;flex:1}.q2-preset-row>label select{width:100%}.q2-preset-library p{margin:0}.q2-preset-manage{padding:12px 0}.q2-preset-manage label{min-width:180px}.q2-resource-toolbar{justify-content:space-between}.q2-resource-toolbar>button{font-size:.875em}.q2-effect-heading .q2-field-title{gap:6px}.q2-effect-heading .q2-help{flex-shrink:0}.q2-effects-page .q2-effect-section{gap:12px;padding:16px}.q2-effects-page .q2-effect-empty{padding:10px 12px}.q2-preset-library .q2-preset-row{align-items:center}.q2-resource-picker{border-top:1px solid var(--q-line);padding-top:10px}.q2-resource-picker>input{margin:10px 0;width:100%}.q2-resource-list{display:flex;flex-direction:column;max-height:300px;overflow:auto;gap:4px}.q2-resource-list>button{width:100%;display:flex;text-align:left;gap:10px;justify-content:space-between;min-width:0}.q2-resource-list>button[aria-pressed=true]{border-color:var(--q-accent)}.q2-resource-list img{width:40px;height:40px;object-fit:contain;flex-shrink:0}.q2-resource-list strong,.q2-resource-list small{display:block;overflow-wrap:anywhere}.q2-resource-list strong{font-size:.875em;font-weight:500}.q2-resource-list small{font-size:.75em;color:var(--q-muted)}.q2-resource-list>button>span:first-of-type{flex:1}.q2 .q2-text-controls{display:flex;flex-direction:column;gap:12px;border:1px solid var(--q-line);border-radius:8px;padding:18px}.q2-text-controls textarea{min-height:90px}.q2-settings input,.q2-settings select{max-width:100%}

.q2-update-settings{border-top:1px solid var(--q-line);padding-top:20px;display:flex;flex-direction:column;gap:12px}.q2-update-settings h3{margin:0;font-size:1em;font-weight:600}.q2-update-toggles{display:flex;flex-wrap:wrap;gap:18px}.q2-settings .q2-update-toggles label{display:flex;align-items:center;gap:8px}.q2-settings .q2-update-toggles input{width:16px;height:16px;min-height:0;margin:0;accent-color:var(--q-accent)}
`;
		//#endregion
		//#region lib/types/client/conversation-progress.js
		const PROGRESS_KIND = "qwen-studio-image-progress";
		function parseProgress(event) {
			if (event.type !== "tool/call" || event.data.name !== "qwen_generate_image" || typeof event.data.callId !== "string") return;
			try {
				const args = typeof event.data.arguments === "string" ? JSON.parse(event.data.arguments) : event.data.arguments;
				if (typeof args?.prompt !== "string" || !args.prompt.trim()) return;
				return {
					callId: event.data.callId,
					prompt: args.prompt,
					seq: event.seq,
					since: event.time ?? 0
				};
			} catch {
				return;
			}
		}
		const progressDefinition = {
			kind: PROGRESS_KIND,
			target: "chat",
			match(event) {
				const call = parseProgress(event);
				if (call) return {
					id: call.callId,
					role: "start"
				};
				const callId = event.type === "tool/result" ? event.data.message?.toolCallId : void 0;
				return typeof callId === "string" ? {
					id: callId,
					role: "update"
				} : null;
			},
			start(_context, match) {
				return parseProgress(match.event);
			},
			update(context, match) {
				return match.event.type === "tool/result" && context.state ? {
					...context.state,
					ended: true
				} : context.state;
			},
			buildViewNode(context) {
				if (!context.state) return null;
				return {
					key: context.key,
					kind: PROGRESS_KIND,
					id: context.id,
					target: "chat",
					anchorSeq: context.state.seq,
					location: { kind: "session" },
					visibility: context.state.ended ? "hidden" : "visible",
					data: context.state
				};
			}
		};
		function ConversationProgress({ node, sessionId = "" }) {
			const { callId, prompt, since } = node.data;
			const [state, setState] = (0, react.useState)({ status: "waiting" });
			const [disconnected, setDisconnected] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let alive = true, pending = false, finished = false;
				const poll = async () => {
					if (pending || finished) return;
					pending = true;
					try {
						const next = await request("progress", {
							call_id: callId,
							prompt,
							since,
							session_id: sessionId
						});
						if (alive) {
							setState(next);
							setDisconnected(false);
						}
						finished = next.status === "failed" || Boolean(next.job && !active(next.job));
					} catch (error) {
						if (alive && error instanceof APIError && error.status === 404) {
							setState({
								status: "failed",
								error: "请正常退出并重新打开 DSH，加载本版生图进度接口。"
							});
							finished = true;
						} else if (alive) setDisconnected(true);
					} finally {
						pending = false;
					}
				};
				poll();
				const timer = setInterval(() => void poll(), 1500);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, [
				callId,
				prompt,
				since,
				sessionId
			]);
			const job = state.job, total = job?.sampling_steps ?? job?.steps ?? 1;
			return (0, react_jsx_runtime.jsxs)("section", {
				className: "q2 q2-chat-progress",
				"aria-label": "图像生成进度",
				children: [
					(0, react_jsx_runtime.jsx)("style", { children: STYLE }),
					(0, react_jsx_runtime.jsxs)("div", { children: [
						(0, react_jsx_runtime.jsx)(LoaderCircle, { className: job && !active(job) ? "" : "q2-spin" }),
						(0, react_jsx_runtime.jsx)("strong", { children: "图像" }),
						(0, react_jsx_runtime.jsx)("span", {
							role: "status",
							children: disconnected ? "连接中断，正在重连…" : job ? statusLabel(job.status) : state.status === "failed" ? "提交失败" : "正在提交任务…"
						})
					] }),
					job && active(job) && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("progress", {
						max: total,
						value: job.source === "remote" && !job.progress_supported || ["queued", "loading"].includes(job.status) ? void 0 : job.step ?? 0
					}), (0, react_jsx_runtime.jsx)("small", { children: job.source === "remote" && !job.progress_supported ? "远程服务处理中，暂不提供逐步进度" : `${job.phase ? job.phase + " · " : ""}${job.step ?? 0} / ${total} 步` })] }),
					job?.status === "complete" && (0, react_jsx_runtime.jsx)("img", {
						src: imageURL(job.id),
						alt: prompt
					}),
					(state.error || job?.error) && (0, react_jsx_runtime.jsx)("small", { children: state.error ?? job?.error }),
					(0, react_jsx_runtime.jsx)("small", { children: "进度同步到左侧「图像」，切换页面不会取消任务。" })
				]
			});
		}
		//#endregion
		//#region lib/types/client/creation-preview.js
		function CreationPreview({ job, history, remote, select, reuse, reference, save, cancel, clear, favorite }) {
			const [before, setBefore] = (0, react.useState)(false);
			(0, react.useEffect)(() => setBefore(false), [job?.id]);
			const total = job?.sampling_steps ?? job?.steps ?? 1;
			return (0, react_jsx_runtime.jsxs)("section", {
				className: "q2-preview",
				"aria-label": "创作结果",
				children: [
					(0, react_jsx_runtime.jsxs)("header", { children: [
						(0, react_jsx_runtime.jsx)("span", { children: "结果预览" }),
						(0, react_jsx_runtime.jsx)("small", { children: job ? active(job) ? "任务已保存 · 切换页面仍会继续" : statusLabel(job.status) : "生成结果会显示在这里" }),
						(job || history.length > 0) && (0, react_jsx_runtime.jsxs)("button", {
							className: "q2-clear-preview",
							onClick: clear,
							title: "清空当前预览和缩略图，不删除图库作品，也不取消后台任务",
							children: [(0, react_jsx_runtime.jsx)(X, {}), "清除预览"]
						})
					] }),
					(0, react_jsx_runtime.jsx)("div", {
						className: "q2-preview-stage",
						"aria-live": "polite",
						children: job?.status === "complete" ? (0, react_jsx_runtime.jsx)("img", {
							src: imageURL(job.id) + (before ? "&reference=1" : ""),
							alt: before ? "本次生成使用的参考原图" : job.prompt
						}) : job && active(job) ? (0, react_jsx_runtime.jsxs)("div", {
							className: "q2-preview-empty",
							children: [
								(0, react_jsx_runtime.jsx)(LoaderCircle, { className: "q2-spin" }),
								(0, react_jsx_runtime.jsx)("p", { children: statusLabel(job.status) }),
								(0, react_jsx_runtime.jsx)("span", { children: job.source === "remote" && !job.progress_supported ? "远程服务正在处理" : `${job.phase ? job.phase + " · " : ""}${job.step ?? 0} / ${total} 步` }),
								(0, react_jsx_runtime.jsx)("progress", {
									max: total,
									value: job.source === "remote" && !job.progress_supported ? void 0 : job.step ?? 0
								}),
								(0, react_jsx_runtime.jsx)("button", {
									onClick: () => cancel(job.id),
									children: "取消任务"
								})
							]
						}) : job ? (0, react_jsx_runtime.jsxs)("div", {
							className: "q2-preview-empty",
							children: [
								(0, react_jsx_runtime.jsx)("p", { children: statusLabel(job.status) }),
								(0, react_jsx_runtime.jsx)("small", { children: job.error ?? "可以复用参数后重新生成" }),
								(0, react_jsx_runtime.jsx)("button", {
									onClick: () => reuse(job),
									children: "复用参数"
								})
							]
						}) : (0, react_jsx_runtime.jsxs)("div", {
							className: "q2-preview-empty",
							children: [
								(0, react_jsx_runtime.jsx)(Image, {}),
								(0, react_jsx_runtime.jsx)("p", { children: "先描述画面，再生成" }),
								(0, react_jsx_runtime.jsx)("small", { children: "完成后可在这里调整参数、用作参考，继续创作。" })
							]
						})
					}),
					job?.status === "complete" && (0, react_jsx_runtime.jsxs)("div", {
						className: "q2-result-actions",
						children: [
							(0, react_jsx_runtime.jsxs)("button", {
								"aria-pressed": Boolean(job.favorite),
								onClick: () => favorite(job),
								children: [(0, react_jsx_runtime.jsx)(Star, { fill: job.favorite ? "currentColor" : "none" }), job.favorite ? "已收藏" : "收藏"]
							}),
							job.source_image_id && (0, react_jsx_runtime.jsx)("button", {
								"aria-pressed": before,
								onClick: () => setBefore(!before),
								children: before ? "查看结果" : "对比原图"
							}),
							!remote && (0, react_jsx_runtime.jsx)("button", {
								onClick: () => reference(job),
								children: "用作参考"
							}),
							(0, react_jsx_runtime.jsxs)("button", {
								onClick: () => reuse(job),
								children: [(0, react_jsx_runtime.jsx)(RotateCcw, {}), "复用参数"]
							}),
							(0, react_jsx_runtime.jsxs)("button", {
								onClick: () => save(job.id),
								children: [(0, react_jsx_runtime.jsx)(Download, {}), "下载"]
							})
						]
					}),
					history.length > 0 && (0, react_jsx_runtime.jsx)("div", {
						className: "q2-history",
						"aria-label": "最近创作记录",
						children: history.map((item) => (0, react_jsx_runtime.jsx)("button", {
							"aria-label": `查看创作记录：${item.prompt}`,
							"aria-pressed": item.id === job?.id,
							onClick: () => select(item.id),
							children: item.status === "complete" ? (0, react_jsx_runtime.jsx)("img", {
								src: imageURL(item.id),
								alt: ""
							}) : (0, react_jsx_runtime.jsx)("span", { children: statusLabel(item.status) })
						}, item.id))
					})
				]
			});
		}
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
		function generationPayload(draft, remote, id) {
			const loras = draft.loras.filter((l) => l.enabled !== false), sourceId = draft.maskEnabled ? draft.maskSourceId || draft.sourceId : draft.sourceId;
			const [width, height] = draft.size.split("x").map(Number), seed = draft.seed.trim() === "" ? null : Number(draft.seed);
			if (!["variation", "edit"].includes(draft.referenceMode ?? "variation")) throw Error("参考图模式无效");
			const editing = draft.referenceMode === "edit" && Boolean(sourceId) && !draft.maskEnabled;
			if (editing && (draft.controlEnabled || draft.scheduler !== "linear" || width % 32 || height % 32)) throw Error("原生参考编辑需要 linear、32的倍数尺寸，且不能叠加结构控制");
			if (loras.some((l) => l.missing)) throw Error("请重新选择失效的 LoRA，或停用它");
			const missing = draft.missingResources ?? {};
			if (draft.maskEnabled && (missing.maskSourceId || !draft.maskSourceId && missing.sourceId || missing.maskId) || draft.controlEnabled && missing.controlId || !draft.maskEnabled && missing.sourceId) throw Error("预设引用的图片已失效，请重新选择或移除失效引用");
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
			if (remote && (sourceId || loras.length || controlled(draft))) throw Error("参考图、LoRA、ControlNet 和蒙版仅支持本地模式；请切换本地模式或移除已选参数");
			if (draft.controlEnabled && !draft.controlId) throw Error("请先选择 ControlNet 控制图，或关闭结构控制");
			if (draft.maskEnabled && (!draft.maskId || !sourceId)) throw Error("局部重绘需要同时选择原图和蒙版，或关闭局部重绘");
			if (draft.controlEnabled && sourceId && !draft.maskEnabled) throw Error("控制图与参考原图同时使用时，请开启局部重绘并选择蒙版；仅用结构控制时可移除原图");
			if (sourceId && !draft.maskEnabled && (!Number.isFinite(draft.changeStrength) || draft.changeStrength < .05 || draft.changeStrength > .95)) throw Error("参考图变化幅度范围5%–95%");
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
				...sourceId ? {
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
				sourceId: asReference ? job.id : job.mask_image_id ? "" : job.source_image_id ?? "",
				sourceName: asReference ? "上一张生成结果" : "参考原图",
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
		//#region lib/types/client/parameter-help.js
		const STEPS_HELP = "步数是模型逐步生成图像的次数。更多步数通常耗时更长，并不保证更好。可先用 20 步试构图，再尝试 40 步；不同模型的合适值不同。";
		const SEED_HELP = "种子决定生成时使用的随机起点。留空会随机选择；固定种子并保持模型、描述和参数一致，有助于复现和比较。改变描述仍会改变画面，不同运行环境不保证完全一致。";
		function ParameterHelp({ name, text }) {
			const id = (0, react.useId)();
			const trigger = (0, react.useRef)(null);
			const tooltip = (0, react.useRef)(null);
			const timer = (0, react.useRef)();
			const [open, setOpen] = (0, react.useState)(false);
			const [position, setPosition] = (0, react.useState)({
				left: 0,
				top: 0,
				fontFamily: "inherit",
				fontSize: "14px"
			});
			const show = () => {
				clearTimeout(timer.current);
				setOpen(true);
			};
			const hide = () => {
				clearTimeout(timer.current);
				timer.current = setTimeout(() => {
					if (document.activeElement !== trigger.current) setOpen(false);
				}, 120);
			};
			(0, react.useEffect)(() => () => clearTimeout(timer.current), []);
			(0, react.useLayoutEffect)(() => {
				if (!open) return;
				const place = () => {
					if (!trigger.current || !tooltip.current) return;
					const rect = trigger.current.getBoundingClientRect();
					const box = tooltip.current.getBoundingClientRect();
					const font = getComputedStyle(trigger.current);
					const gap = 8, margin = 12;
					const left = Math.max(margin, Math.min(rect.left, window.innerWidth - box.width - margin));
					const top = rect.top - box.height - gap >= margin ? rect.top - box.height - gap : Math.min(rect.bottom + gap, Math.max(margin, window.innerHeight - box.height - margin));
					setPosition({
						left,
						top,
						fontFamily: font.fontFamily,
						fontSize: font.fontSize
					});
				};
				const escape = (event) => {
					if (event.key === "Escape") {
						setOpen(false);
						event.stopPropagation();
					}
				};
				place();
				const observer = new ResizeObserver(place);
				if (tooltip.current) observer.observe(tooltip.current);
				window.addEventListener("resize", place);
				window.addEventListener("scroll", place, true);
				document.addEventListener("keydown", escape, true);
				return () => {
					observer.disconnect();
					window.removeEventListener("resize", place);
					window.removeEventListener("scroll", place, true);
					document.removeEventListener("keydown", escape, true);
				};
			}, [open]);
			return (0, react_jsx_runtime.jsxs)("span", {
				className: "q2-help",
				onMouseEnter: show,
				onMouseLeave: hide,
				children: [(0, react_jsx_runtime.jsx)("button", {
					ref: trigger,
					type: "button",
					"aria-label": `${name}说明`,
					"aria-describedby": open ? id : void 0,
					onFocus: show,
					onBlur: () => {
						clearTimeout(timer.current);
						setOpen(false);
					},
					onClick: (e) => {
						e.preventDefault();
						show();
					},
					children: (0, react_jsx_runtime.jsx)(CircleQuestionMark, {})
				}), open && (0, react_dom.createPortal)((0, react_jsx_runtime.jsx)("span", {
					ref: tooltip,
					id,
					role: "tooltip",
					className: "q2 q2-tooltip-layer",
					style: position,
					onMouseEnter: show,
					onMouseLeave: hide,
					children: text
				}), document.body)]
			});
		}
		//#endregion
		//#region lib/types/client/preset-bar.js
		const KEY$1 = "qwen-studio-active-preset";
		function draftSignature(draft) {
			return JSON.stringify(Object.fromEntries(Object.keys(draftDefaults).filter((k) => k !== "prompt").map((k) => [k, k === "loras" ? draft.loras.map(({ missing: _, ...l }) => ({
				...l,
				enabled: l.enabled !== false
			})) : draft[k]])));
		}
		async function defaultDraft() {
			const store = await request("presets");
			if (!store.defaultId) return {
				...draftDefaults,
				missingResources: {}
			};
			return (await request("presets", {
				action: "load",
				id: store.defaultId
			})).draft;
		}
		function PresetBar({ draft, update, onError }) {
			const [store, setStore] = (0, react.useState)(), [active, setActive] = (0, react.useState)(() => {
				try {
					return JSON.parse(localStorage.getItem(KEY$1) || "{}");
				} catch {
					return {};
				}
			}), [name, setName] = (0, react.useState)("我的预设"), [busy, setBusy] = (0, react.useState)(false), [notice, setNotice] = (0, react.useState)(""), [confirm, setConfirm] = (0, react.useState)(false), [undo, setUndo] = (0, react.useState)(false), [copy, setCopy] = (0, react.useState)(false);
			const input = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				request("presets").then((s) => {
					if (alive) setStore(s);
				}).catch((e) => onError(e.message));
				return () => {
					alive = false;
				};
			}, []);
			const selected = store?.items.find((p) => p.id === active.id), modified = Boolean(selected && active.signature !== draftSignature(draft));
			const remember = (id, values) => {
				const v = {
					id,
					signature: draftSignature(values)
				};
				setActive(v);
				localStorage.setItem(KEY$1, JSON.stringify(v));
			};
			async function load(id) {
				setBusy(true);
				onError("");
				try {
					const result = await request("presets", {
						action: "load",
						id
					});
					const { prompt: _, ...values } = result.draft;
					update(values);
					remember(id, result.draft);
					setNotice(result.issues.length ? result.issues.join("；") : "已加载，画面描述保持不变");
					setCopy(false);
				} catch (e) {
					onError(e.message);
				} finally {
					setBusy(false);
				}
			}
			async function mutate(action, extra = {}) {
				setBusy(true);
				onError("");
				try {
					const next = await request("presets", {
						action,
						revision: store?.revision,
						id: selected?.id,
						...extra
					});
					setStore(next);
					setNotice("预设已保存到本机");
					setUndo(action === "delete");
					setConfirm(false);
					if (action === "save") {
						const p = next.items.find((p) => p.id === selected?.id && extra.id !== null) || next.items.at(-1);
						if (p) remember(p.id, draft);
						setCopy(false);
					}
					if (action === "delete") {
						setActive({});
						localStorage.removeItem(KEY$1);
					}
				} catch (e) {
					onError(e.message);
					try {
						setStore(await request("presets"));
					} catch {}
				} finally {
					setBusy(false);
				}
			}
			async function save(asNew = false) {
				const { prompt: _, missingResources: __, ...values } = draft;
				await mutate("save", {
					name: asNew || !selected ? name : selected.name,
					values,
					id: asNew ? null : selected?.id ?? null
				});
			}
			async function exportJSON() {
				setBusy(true);
				try {
					const data = await request("presets", {
						action: "export",
						...selected ? { id: selected.id } : {}
					});
					const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
					const a = document.createElement("a");
					a.href = url;
					a.download = "qwen-presets.json";
					a.click();
					setTimeout(() => URL.revokeObjectURL(url), 1e3);
				} catch (e) {
					onError(e.message);
				} finally {
					setBusy(false);
				}
			}
			return (0, react_jsx_runtime.jsxs)("section", {
				className: "q2-preset-library",
				"aria-label": "整套创作预设",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "q2-preset-row",
						children: [
							(0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsxs)("span", {
								className: "q2-field-title",
								children: ["创作预设", (0, react_jsx_runtime.jsx)(ParameterHelp, {
									name: "创作预设",
									text: "保存整套高级参数与资源选择，加载时保留当前画面描述。修改后可重新加载或覆盖保存；管理中可重命名、设默认、删除、导入和导出。JSON 仅包含参数与资源指纹，分享前请检查其中的文件名称和负向词；不含图片、权重文件或连接密钥。"
								})]
							}), (0, react_jsx_runtime.jsxs)("select", {
								"aria-label": "选择创作预设",
								value: selected?.id ?? "",
								disabled: busy || !store,
								onChange: (e) => {
									if (e.target.value) load(e.target.value);
									else {
										setActive({});
										localStorage.removeItem(KEY$1);
									}
								},
								children: [(0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: "自定义参数"
								}), store?.items.map((p) => (0, react_jsx_runtime.jsxs)("option", {
									value: p.id,
									children: [p.name, p.id === store.defaultId ? " · 默认" : ""]
								}, p.id))]
							})] }),
							(0, react_jsx_runtime.jsx)("span", {
								className: "q2-muted",
								children: modified ? "已修改" : selected ? "已加载" : "按当前参数创作"
							}),
							selected && (0, react_jsx_runtime.jsx)("button", {
								disabled: busy,
								onClick: () => void load(selected.id),
								children: "重新加载"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								disabled: busy || !store,
								onClick: () => {
									if (selected) save();
									else {
										setCopy(true);
										setName("我的预设");
									}
								},
								children: "保存预设"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								disabled: busy || !store,
								onClick: () => {
									setCopy(true);
									setName(selected ? selected.name + " 副本" : "我的预设");
								},
								children: "另存为"
							}),
							(0, react_jsx_runtime.jsxs)("details", { children: [(0, react_jsx_runtime.jsx)("summary", { children: "管理" }), (0, react_jsx_runtime.jsxs)("div", {
								className: "q2-preset-manage",
								children: [
									(0, react_jsx_runtime.jsxs)("label", { children: ["预设名称", (0, react_jsx_runtime.jsx)("input", {
										"aria-label": "预设新名称",
										value: name,
										maxLength: 80,
										onChange: (e) => setName(e.target.value)
									})] }),
									(0, react_jsx_runtime.jsx)("button", {
										disabled: !selected || busy,
										onClick: () => void mutate("rename", { name }),
										children: "重命名"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										disabled: !selected || busy,
										onClick: () => void mutate("default", { id: store?.defaultId === selected?.id ? null : selected?.id }),
										children: store?.defaultId === selected?.id ? "取消默认" : "设为默认"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										disabled: !selected || busy,
										onClick: () => setConfirm(true),
										children: "删除预设"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										disabled: busy,
										onClick: () => {
											request("presets").then(setStore).catch((e) => onError(e.message));
										},
										children: "刷新列表"
									}),
									(0, react_jsx_runtime.jsxs)("button", {
										disabled: busy || !store,
										onClick: () => void exportJSON(),
										children: [selected ? "导出当前" : "导出全部", " JSON"]
									}),
									(0, react_jsx_runtime.jsx)("button", {
										disabled: busy || !store,
										onClick: () => input.current?.click(),
										children: "导入 JSON"
									}),
									undo && (0, react_jsx_runtime.jsx)("button", {
										disabled: busy,
										onClick: () => void mutate("restore"),
										children: "撤销删除"
									})
								]
							})] })
						]
					}),
					copy && (0, react_jsx_runtime.jsxs)("div", {
						className: "q2-preset-row",
						children: [
							(0, react_jsx_runtime.jsxs)("label", { children: ["新预设名称", (0, react_jsx_runtime.jsx)("input", {
								"aria-label": "新预设名称",
								value: name,
								maxLength: 80,
								onChange: (e) => setName(e.target.value)
							})] }),
							(0, react_jsx_runtime.jsx)("button", {
								disabled: busy || !name.trim(),
								onClick: () => void save(true),
								children: "保存新预设"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								onClick: () => setCopy(false),
								children: "取消另存"
							})
						]
					}),
					confirm && (0, react_jsx_runtime.jsxs)("div", {
						className: "q2-preset-row",
						role: "alert",
						children: [
							(0, react_jsx_runtime.jsxs)("span", { children: [
								"删除「",
								selected?.name,
								"」？不会删除图片或权重。"
							] }),
							(0, react_jsx_runtime.jsx)("button", {
								disabled: busy,
								onClick: () => void mutate("delete"),
								children: "确认删除预设"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								onClick: () => setConfirm(false),
								children: "保留预设"
							})
						]
					}),
					notice && (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						className: "q2-muted",
						children: notice
					}),
					draft.missingResources && Object.keys(draft.missingResources).length > 0 && (0, react_jsx_runtime.jsxs)("div", {
						className: "q2-effect-note",
						role: "alert",
						children: [
							"失效图片：",
							Object.values(draft.missingResources).join("、"),
							"。请重新选择；或",
							(0, react_jsx_runtime.jsx)("button", {
								onClick: () => update({
									sourceId: "",
									maskSourceId: "",
									maskId: "",
									controlId: "",
									controlEnabled: false,
									maskEnabled: false,
									missingResources: {}
								}),
								children: "移除失效图片引用"
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("input", {
						hidden: true,
						type: "file",
						accept: ".json,application/json",
						ref: input,
						"aria-label": "导入预设 JSON 文件",
						onChange: (e) => {
							const f = e.target.files?.[0];
							e.target.value = "";
							if (!f) return;
							if (f.size > 1048576) {
								onError("预设文件不能超过1MB");
								return;
							}
							f.text().then((text) => mutate("import", { document: JSON.parse(text) })).catch((error) => onError(error.message));
						}
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/asset-upload.js
		async function uploadAsset(file, kind, signal) {
			const response = await fetch(`${API}/assets-upload?kind=${kind}&name=${encodeURIComponent(file.name)}`, {
				method: "POST",
				headers: { "content-type": "application/octet-stream" },
				body: file,
				signal
			});
			let value;
			try {
				value = await response.json();
			} catch {
				throw Error(response.status === 404 ? "请重新打开 DSH，加载本机文件导入接口" : `文件导入失败 (${response.status})`);
			}
			if (!response.ok) throw Error(value.error ?? `文件导入失败 (${response.status})`);
			return value;
		}
		function AssetUpload({ kind, label, disabled = false, maxFiles = 1, onAssets, onError }) {
			const input = (0, react.useRef)(null), controller = (0, react.useRef)();
			const [busy, setBusy] = (0, react.useState)(false), [progress, setProgress] = (0, react.useState)("");
			(0, react.useEffect)(() => () => controller.current?.abort(), []);
			async function selected(files) {
				if (!files.length) return;
				if (files.length > maxFiles) {
					onError(`最多还可添加 ${maxFiles} 个文件`);
					return;
				}
				const current = new AbortController();
				controller.current = current;
				setBusy(true);
				onError("");
				try {
					const assets = [];
					for (const [i, file] of files.entries()) {
						if (file.size > (kind === "lora" ? 2 * 1024 ** 3 : 64 * 1024 ** 2)) throw Error(kind === "lora" ? "LoRA 文件不能超过2GB" : "图片不能超过64MB");
						setProgress(`正在导入 ${i + 1}/${files.length} · ${file.name}`);
						assets.push(await uploadAsset(file, kind, current.signal));
					}
					if (!current.signal.aborted) onAssets(assets);
				} catch (error) {
					if (!current.signal.aborted) onError(error instanceof Error ? error.message : String(error));
				} finally {
					if (!current.signal.aborted) {
						setBusy(false);
						setProgress("");
					}
				}
			}
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "q2-file-upload",
				children: [
					(0, react_jsx_runtime.jsx)("input", {
						ref: input,
						type: "file",
						hidden: true,
						tabIndex: -1,
						"aria-label": label + "文件",
						accept: kind === "lora" ? ".safetensors" : ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp",
						multiple: kind === "lora" && maxFiles > 1,
						onChange: (e) => {
							const files = Array.from(e.target.files ?? []);
							e.target.value = "";
							selected(files);
						}
					}),
					(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						disabled: disabled || busy || maxFiles < 1,
						onClick: () => input.current?.click(),
						children: [busy ? (0, react_jsx_runtime.jsx)(LoaderCircle, { className: "q2-spin" }) : (0, react_jsx_runtime.jsx)(Upload, {}), busy ? "正在导入…" : label]
					}),
					busy && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
						role: "status",
						className: "q2-file-progress",
						children: progress
					}), (0, react_jsx_runtime.jsxs)("button", {
						"aria-label": "取消文件导入",
						onClick: () => {
							controller.current?.abort();
							setBusy(false);
							setProgress("");
						},
						children: [(0, react_jsx_runtime.jsx)(X, {}), "取消"]
					})] })
				]
			});
		}
		//#endregion
		//#region lib/types/client/resource-picker.js
		function ResourcePicker({ resources, kind, label, selected, onChoose, disabled = false }) {
			const [query, setQuery] = (0, react.useState)(""), [open, setOpen] = (0, react.useState)(false);
			const items = resources.filter((r) => (kind === "lora" ? r.kind === "lora" : r.kind !== "lora") && r.name.toLowerCase().includes(query.toLowerCase()));
			const origin = {
				imported: "已导入",
				default: "默认文件夹",
				custom: "自定义文件夹",
				gallery: "图库作品"
			};
			return (0, react_jsx_runtime.jsxs)("details", {
				className: "q2-resource-picker",
				open,
				onToggle: (e) => setOpen(e.currentTarget.open),
				children: [(0, react_jsx_runtime.jsxs)("summary", { children: [label, " · 从资源库选择"] }), open && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("input", {
					"aria-label": `搜索${label}`,
					placeholder: "搜索文件名称",
					value: query,
					onChange: (e) => setQuery(e.target.value)
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: "q2-resource-list",
					"aria-label": `${label}可选资源`,
					children: [items.map((r) => (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						disabled,
						"aria-pressed": selected.includes(r.path ?? r.id),
						onClick: () => onChoose(r),
						children: [
							r.kind !== "lora" && (0, react_jsx_runtime.jsx)("img", {
								src: imageURL(r.id),
								alt: "",
								loading: "lazy"
							}),
							(0, react_jsx_runtime.jsxs)("span", { children: [(0, react_jsx_runtime.jsx)("strong", { children: r.name }), (0, react_jsx_runtime.jsxs)("small", { children: [
								origin[r.origin],
								" · ",
								(r.bytes / 1024 / 1024).toFixed(1),
								" MB"
							] })] }),
							(0, react_jsx_runtime.jsx)("span", { children: selected.includes(r.path ?? r.id) ? "已选" : "选择" })
						]
					}, r.id)), !items.length && (0, react_jsx_runtime.jsx)("p", {
						className: "q2-muted",
						children: "没有可用资源。可导入文件后刷新。"
					})]
				})] })]
			});
		}
		//#endregion
		//#region lib/types/client/advanced-settings.js
		function SelectedImage({ id, name, remove }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "q2-selected-image",
				children: [
					(0, react_jsx_runtime.jsx)("img", {
						src: imageURL(id),
						alt: name
					}),
					(0, react_jsx_runtime.jsx)("span", {
						title: name,
						children: name
					}),
					(0, react_jsx_runtime.jsx)("button", {
						"aria-label": `移除${name}`,
						onClick: remove,
						children: (0, react_jsx_runtime.jsx)(X, {})
					})
				]
			});
		}
		function AdvancedSettings({ draft, update, remote, nativeEdit = false, ready, close }) {
			const root = (0, react.useRef)(null), current = (0, react.useRef)(draft);
			current.current = draft;
			const [error, setError] = (0, react.useState)("");
			const disabled = remote || !ready;
			const [catalog, setCatalog] = (0, react.useState)({
				items: [],
				warnings: []
			});
			const refreshResources = () => request("resources").then(setCatalog).catch((e) => setError(e.message));
			(0, react.useEffect)(() => {
				let alive = true;
				if (ready) request("resources").then((v) => {
					if (alive) setCatalog(v);
				}).catch((e) => {
					if (alive) setError(e.message);
				});
				return () => {
					alive = false;
				};
			}, [ready]);
			(0, react.useEffect)(() => {
				const previous = document.activeElement;
				root.current?.querySelector("button")?.focus();
				const onKey = (event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						close();
					}
					if (event.key === "Tab") {
						const nodes = [...root.current?.querySelectorAll("button:not(:disabled),input:not(:disabled):not([hidden]),select:not(:disabled),textarea:not(:disabled),summary") ?? []].filter((n) => n.getClientRects().length);
						const first = nodes[0], last = nodes.at(-1);
						if (event.shiftKey && document.activeElement === first) {
							event.preventDefault();
							last?.focus();
						}
						if (!event.shiftKey && document.activeElement === last) {
							event.preventDefault();
							first?.focus();
						}
					}
				};
				window.addEventListener("keydown", onKey);
				return () => {
					window.removeEventListener("keydown", onKey);
					previous?.focus();
				};
			}, [close]);
			const importedImage = (values) => {
				update(values);
				refreshResources();
			};
			const sourceId = draft.maskSourceId || draft.sourceId;
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: root,
				className: "q2-overlay q2-detail",
				role: "dialog",
				"aria-modal": "true",
				"aria-label": "高级生成设置",
				children: [(0, react_jsx_runtime.jsxs)("header", { children: [
					(0, react_jsx_runtime.jsxs)("button", {
						"aria-label": "返回创作",
						onClick: close,
						children: [(0, react_jsx_runtime.jsx)(ArrowLeft, {}), "返回创作"]
					}),
					(0, react_jsx_runtime.jsx)("strong", { children: "高级设置" }),
					(0, react_jsx_runtime.jsx)("span", {
						className: "q2-muted",
						children: "自动保存到草稿"
					})
				] }), (0, react_jsx_runtime.jsxs)("div", {
					className: "q2-advanced-page q2-effects-page",
					children: [
						ready && (0, react_jsx_runtime.jsx)(PresetBar, {
							draft,
							update,
							onError: setError
						}),
						error && (0, react_jsx_runtime.jsxs)("div", {
							className: "q2-effect-error",
							role: "alert",
							children: [error, (0, react_jsx_runtime.jsx)("button", {
								"aria-label": "关闭高级设置提示",
								onClick: () => setError(""),
								children: (0, react_jsx_runtime.jsx)(X, {})
							})]
						}),
						remote ? (0, react_jsx_runtime.jsx)("p", {
							role: "status",
							className: "q2-effect-note",
							children: "该远程接口没有公布高级能力。请连接配套 Qwen 网关，或切回本地；已选资源会保留。"
						}) : !ready && (0, react_jsx_runtime.jsx)("p", {
							role: "status",
							className: "q2-effect-note",
							children: "请重新打开 DSH，加载本机文件导入接口。"
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: "q2-resource-toolbar",
							children: [(0, react_jsx_runtime.jsxs)("span", {
								className: "q2-field-title q2-muted",
								children: ["资源库", (0, react_jsx_runtime.jsx)(ParameterHelp, {
									name: "资源库",
									text: "清单合并已导入文件、图库下的 loras 文件夹、自定义 LoRA 目录和图库作品。选中新文件会复制到本机资源库，原文件不变；移除选项不会删除文件。图片支持 PNG、JPEG、WebP，单张不超过 64MB。刷新清单不会启动模型。"
								})]
							}), (0, react_jsx_runtime.jsx)("button", {
								onClick: () => void refreshResources(),
								disabled: !ready,
								children: "刷新资源清单"
							})]
						}),
						catalog.warnings.length > 0 && (0, react_jsx_runtime.jsx)("p", {
							role: "status",
							className: "q2-effect-note",
							children: catalog.warnings.join("；")
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: "q2-effects-grid",
							children: [
								(0, react_jsx_runtime.jsxs)("section", {
									className: "q2-effect-section",
									children: [
										(0, react_jsx_runtime.jsx)("div", {
											className: "q2-effect-heading",
											children: (0, react_jsx_runtime.jsx)("div", { children: (0, react_jsx_runtime.jsxs)("h3", {
												className: "q2-field-title",
												children: ["LoRA 风格", (0, react_jsx_runtime.jsx)(ParameterHelp, {
													name: "LoRA 风格",
													text: "为 Qwen Image 2.1 叠加兼容的风格或细节 LoRA。支持 .safetensors，最多 8 个，单文件不超过 2GB。权重越大通常影响越强，具体范围以作者说明为准。取消勾选可暂时停用；移除不会删除文件。"
												})]
											}) })
										}),
										(0, react_jsx_runtime.jsx)(AssetUpload, {
											kind: "lora",
											label: "添加 LoRA 文件",
											disabled,
											maxFiles: 8 - draft.loras.length,
											onError: setError,
											onAssets: (assets) => {
												const items = [...current.current.loras];
												for (const asset of assets) if (asset.path && !items.some((l) => l.path === asset.path)) items.push({
													path: asset.path,
													name: asset.name,
													scale: .8
												});
												update({ loras: items.slice(0, 8) });
												refreshResources();
											}
										}),
										(0, react_jsx_runtime.jsx)(ResourcePicker, {
											resources: catalog.items,
											kind: "lora",
											label: "LoRA",
											disabled,
											selected: draft.loras.map((l) => l.path),
											onChoose: (r) => {
												if (draft.loras.some((l) => l.path === r.path)) update({ loras: draft.loras.filter((l) => l.path !== r.path) });
												else if (draft.loras.length >= 8) setError("最多8个 LoRA");
												else update({ loras: [...draft.loras, {
													path: r.path,
													name: r.name,
													scale: .8,
													enabled: true
												}] });
											}
										}),
										!draft.loras.length && (0, react_jsx_runtime.jsx)("div", {
											className: "q2-effect-empty",
											children: "未选择 LoRA"
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: "q2-lora-list",
											children: draft.loras.map((lora, i) => (0, react_jsx_runtime.jsxs)("div", {
												className: "q2-lora-item",
												children: [
													(0, react_jsx_runtime.jsxs)("label", {
														className: "q2-inline-check",
														children: [(0, react_jsx_runtime.jsx)("input", {
															type: "checkbox",
															"aria-label": `启用 LoRA ${lora.name}`,
															checked: lora.enabled !== false,
															disabled,
															onChange: (e) => update({ loras: draft.loras.map((l, j) => j === i ? {
																...l,
																enabled: e.target.checked
															} : l) })
														}), (0, react_jsx_runtime.jsxs)("span", {
															title: lora.name,
															children: [lora.name, lora.missing ? " · 资源失效" : ""]
														})]
													}),
													(0, react_jsx_runtime.jsxs)("label", {
														className: "q2-lora-weight",
														children: ["权重", (0, react_jsx_runtime.jsx)("input", {
															"aria-label": `LoRA 权重 ${lora.name}`,
															type: "number",
															min: "0",
															max: "2",
															step: "0.05",
															disabled: disabled || lora.enabled === false,
															value: lora.scale,
															onChange: (e) => update({ loras: draft.loras.map((l, j) => j === i ? {
																...l,
																scale: Number(e.target.value)
															} : l) })
														})]
													}),
													(0, react_jsx_runtime.jsx)("button", {
														"aria-label": `移除 LoRA ${lora.name}`,
														onClick: () => update({ loras: draft.loras.filter((_, j) => j !== i) }),
														children: (0, react_jsx_runtime.jsx)(X, {})
													})
												]
											}, lora.path))
										})
									]
								}),
								(0, react_jsx_runtime.jsxs)("section", {
									className: "q2-effect-section",
									children: [
										(0, react_jsx_runtime.jsxs)("div", {
											className: "q2-effect-heading",
											children: [(0, react_jsx_runtime.jsx)("div", { children: (0, react_jsx_runtime.jsxs)("h3", {
												className: "q2-field-title",
												children: ["结构控制", (0, react_jsx_runtime.jsx)(ParameterHelp, {
													name: "结构控制",
													text: "用线稿、姿态、深度或边缘图约束构图。这里选择控制图片，不是模型权重；本机模型目录需已配置 Qwen Image 2.1 Union ControlNet。画面内容仍由描述决定。"
												})]
											}) }), (0, react_jsx_runtime.jsxs)("label", {
												className: "q2-inline-check",
												children: [(0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													"aria-label": "启用结构控制",
													disabled,
													checked: draft.controlEnabled,
													onChange: (e) => update({ controlEnabled: e.target.checked })
												}), "启用"]
											})]
										}),
										(0, react_jsx_runtime.jsx)(AssetUpload, {
											kind: "control",
											label: draft.controlId ? "更换控制图" : "选择控制图",
											disabled,
											onError: setError,
											onAssets: ([a]) => a && importedImage({
												controlId: a.id,
												controlName: a.name,
												controlEnabled: true
											})
										}),
										(0, react_jsx_runtime.jsx)(ResourcePicker, {
											resources: catalog.items,
											kind: "control",
											label: "控制图",
											disabled,
											selected: [draft.controlId],
											onChoose: (r) => update({
												controlId: r.id,
												controlName: r.name,
												controlEnabled: true
											})
										}),
										draft.controlId && (0, react_jsx_runtime.jsx)(SelectedImage, {
											id: draft.controlId,
											name: draft.controlName || "控制图",
											remove: () => update({
												controlId: "",
												controlName: "",
												controlEnabled: false
											})
										}),
										(0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsxs)("span", {
											className: "q2-field-title",
											children: [
												"控制强度 · ",
												Math.round(draft.controlStrength * 100),
												"%",
												(0, react_jsx_runtime.jsx)(ParameterHelp, {
													name: "控制强度",
													text: "0 为关闭控制，100% 约束最强。提高强度通常更接近控制图的结构，画面内容仍由描述决定。"
												})
											]
										}), (0, react_jsx_runtime.jsx)("input", {
											"aria-label": "结构控制强度",
											type: "range",
											min: "0",
											max: "1",
											step: "0.05",
											disabled: disabled || !draft.controlEnabled,
											value: draft.controlStrength,
											onChange: (e) => update({ controlStrength: Number(e.target.value) })
										})] })
									]
								}),
								(0, react_jsx_runtime.jsxs)("section", {
									className: "q2-effect-section q2-mask-section",
									children: [
										(0, react_jsx_runtime.jsxs)("div", {
											className: "q2-effect-heading",
											children: [(0, react_jsx_runtime.jsx)("div", { children: (0, react_jsx_runtime.jsxs)("h3", {
												className: "q2-field-title",
												children: ["局部重绘", (0, react_jsx_runtime.jsx)(ParameterHelp, {
													name: "局部重绘",
													text: "选择原图与蒙版，白色区域重画，黑色区域保留。灰色按亮度中点划分黑白，不作渐变蒙版；透明区域按保留区处理。输入按输出尺寸缩放，保持原尺寸才能保留原始像素。局部重绘不使用参考图变化幅度。"
												})]
											}) }), (0, react_jsx_runtime.jsxs)("label", {
												className: "q2-inline-check",
												children: [(0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													"aria-label": "启用局部重绘",
													disabled,
													checked: draft.maskEnabled,
													onChange: (e) => update({ maskEnabled: e.target.checked })
												}), "启用"]
											})]
										}),
										(0, react_jsx_runtime.jsxs)("div", {
											className: "q2-mask-inputs",
											children: [(0, react_jsx_runtime.jsxs)("div", { children: [
												(0, react_jsx_runtime.jsx)("span", {
													className: "q2-option-label",
													children: "原图"
												}),
												(0, react_jsx_runtime.jsx)(AssetUpload, {
													kind: "source",
													label: sourceId ? "更换重绘原图" : "选择重绘原图",
													disabled,
													onError: setError,
													onAssets: ([a]) => a && importedImage({
														maskSourceId: a.id,
														maskSourceName: a.name
													})
												}),
												(0, react_jsx_runtime.jsx)(ResourcePicker, {
													resources: catalog.items,
													kind: "source",
													label: "重绘原图",
													disabled,
													selected: [sourceId],
													onChoose: (r) => update({
														maskSourceId: r.id,
														maskSourceName: r.name
													})
												}),
												sourceId && (0, react_jsx_runtime.jsx)(SelectedImage, {
													id: sourceId,
													name: draft.maskSourceName || draft.sourceName || "参考原图",
													remove: () => update({
														maskSourceId: "",
														maskSourceName: "",
														sourceId: "",
														sourceName: ""
													})
												})
											] }), (0, react_jsx_runtime.jsxs)("div", { children: [
												(0, react_jsx_runtime.jsx)("span", {
													className: "q2-option-label",
													children: "蒙版"
												}),
												(0, react_jsx_runtime.jsx)(AssetUpload, {
													kind: "mask",
													label: draft.maskId ? "更换蒙版" : "选择蒙版",
													disabled,
													onError: setError,
													onAssets: ([a]) => a && importedImage({
														maskId: a.id,
														maskName: a.name,
														maskEnabled: true
													})
												}),
												(0, react_jsx_runtime.jsx)(ResourcePicker, {
													resources: catalog.items,
													kind: "mask",
													label: "蒙版",
													disabled,
													selected: [draft.maskId],
													onChoose: (r) => update({
														maskId: r.id,
														maskName: r.name,
														maskEnabled: true
													})
												}),
												draft.maskId && (0, react_jsx_runtime.jsx)(SelectedImage, {
													id: draft.maskId,
													name: draft.maskName || "蒙版",
													remove: () => update({
														maskId: "",
														maskName: "",
														maskEnabled: false
													})
												})
											] })]
										}),
										(0, react_jsx_runtime.jsxs)("div", {
											className: "q2-mask-legend",
											children: [(0, react_jsx_runtime.jsxs)("span", { children: [(0, react_jsx_runtime.jsx)("i", { className: "white" }), "白色：重新生成"] }), (0, react_jsx_runtime.jsxs)("span", { children: [(0, react_jsx_runtime.jsx)("i", { className: "black" }), "黑色：保留原图"] })]
										}),
										draft.maskEnabled && (!sourceId || !draft.maskId) && (0, react_jsx_runtime.jsx)("p", {
											className: "q2-effect-note",
											children: "请选齐原图和蒙版后再生成。"
										}),
										draft.controlEnabled && draft.sourceId && !draft.maskEnabled && (0, react_jsx_runtime.jsx)("p", {
											className: "q2-effect-note",
											children: "已有参考原图；与结构控制组合使用时，需要开启局部重绘并选择蒙版。只按控制图生图时请移除参考图。"
										})
									]
								})
							]
						}),
						(0, react_jsx_runtime.jsxs)("section", {
							className: "q2-effect-section q2-text-controls",
							"aria-label": "文本控制与采样",
							children: [
								(0, react_jsx_runtime.jsx)("h3", { children: "文本控制与采样" }),
								(0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsxs)("span", {
									className: "q2-field-title",
									children: ["负向提示词", (0, react_jsx_runtime.jsx)(ParameterHelp, {
										name: "负向提示词",
										text: "描述希望避免的内容。普通文生图中，负向词非空且 CFG 大于 1 才启用负向分支。填写负向词但 CFG 为 1 时，插件会自动提升到 2.5，并记录实际值。"
									})]
								}), (0, react_jsx_runtime.jsx)("textarea", {
									"aria-label": "负向提示词",
									rows: 3,
									maxLength: 8e3,
									disabled: remote,
									placeholder: "描述希望避免的内容，留空时不启用负向词",
									value: draft.negativePrompt,
									onChange: (e) => update({ negativePrompt: e.target.value })
								})] }),
								(0, react_jsx_runtime.jsxs)("div", {
									className: "q2-advanced-fields",
									children: [(0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsxs)("span", {
										className: "q2-field-title",
										children: [
											"CFG 引导强度",
											(0, react_jsx_runtime.jsx)(ParameterHelp, {
												name: "CFG 引导强度",
												text: draft.controlEnabled || draft.maskEnabled ? "当前使用结构控制或蒙版：CFG 大于 1 时会启用无条件分支，负向词可以为空。它控制引导强度，不是通用画质旋钮。填写负向词且 CFG 为 1 时会自动使用 2.5。" : "普通文生图中，只有负向词非空且 CFG 大于 1 时才生效；没有负向词时会忽略这个值。它不是通用画质旋钮。填写负向词且 CFG 为 1 时会自动使用 2.5。"
											}),
											draft.negativePrompt.trim() && draft.guidance <= 1 && (0, react_jsx_runtime.jsx)("small", { children: "实际 2.5（自动）" })
										]
									}), (0, react_jsx_runtime.jsx)("input", {
										"aria-label": "CFG 引导强度",
										type: "number",
										min: "1",
										max: "10",
										step: ".1",
										disabled: remote,
										value: draft.guidance,
										onChange: (e) => update({ guidance: Number(e.target.value) })
									})] }), (0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsxs)("span", {
										className: "q2-field-title",
										children: ["调度器", (0, react_jsx_runtime.jsx)(ParameterHelp, {
											name: "调度器",
											text: "控制采样过程中噪声的变化方式。建议先使用 linear；普通文生图还可选择 flow_match_euler_discrete 或 seedvr2_euler。结构控制和蒙版仅支持 linear，不兼容选项会停用。"
										})]
									}), (0, react_jsx_runtime.jsxs)("select", {
										"aria-label": "调度器",
										disabled: remote,
										value: draft.scheduler,
										onChange: (e) => update({ scheduler: e.target.value }),
										children: [
											(0, react_jsx_runtime.jsx)("option", {
												value: "linear",
												children: "linear · 默认"
											}),
											(0, react_jsx_runtime.jsx)("option", {
												value: "flow_match_euler_discrete",
												disabled: draft.controlEnabled || draft.maskEnabled,
												children: "flow_match_euler_discrete"
											}),
											(0, react_jsx_runtime.jsx)("option", {
												value: "seedvr2_euler",
												disabled: draft.controlEnabled || draft.maskEnabled,
												children: "seedvr2_euler"
											})
										]
									})] })]
								}),
								(draft.controlEnabled || draft.maskEnabled) && draft.scheduler !== "linear" && (0, react_jsx_runtime.jsx)("p", {
									role: "alert",
									children: "当前调度器不兼容，请手动切回 linear 再生成。"
								})
							]
						}),
						(0, react_jsx_runtime.jsxs)("details", {
							className: "q2-base-settings",
							children: [(0, react_jsx_runtime.jsx)("summary", { children: "采样、尺寸与参考变体" }), (0, react_jsx_runtime.jsxs)("div", {
								className: "q2-advanced-fields",
								children: [
									(0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsxs)("span", {
										className: "q2-field-title",
										children: ["步数", (0, react_jsx_runtime.jsx)(ParameterHelp, {
											name: "高级步数",
											text: STEPS_HELP
										})]
									}), (0, react_jsx_runtime.jsx)("input", {
										"aria-label": "高级生成步数",
										type: "number",
										min: "1",
										max: "60",
										value: draft.steps,
										onChange: (e) => update({ steps: Number(e.target.value) })
									})] }),
									(0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsxs)("span", {
										className: "q2-field-title",
										children: ["种子", (0, react_jsx_runtime.jsx)(ParameterHelp, {
											name: "高级种子",
											text: SEED_HELP
										})]
									}), (0, react_jsx_runtime.jsx)("input", {
										"aria-label": "高级随机种子",
										inputMode: "numeric",
										placeholder: "留空为随机",
										value: draft.seed,
										onChange: (e) => update({ seed: e.target.value })
									})] }),
									(0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsxs)("span", {
										className: "q2-field-title",
										children: ["输出尺寸", (0, react_jsx_runtime.jsx)(ParameterHelp, {
											name: "输出尺寸",
											text: "更大尺寸通常需要更多内存和时间。蒙版重绘若要保留原图像素，请使用与原图一致的输出尺寸。"
										})]
									}), (0, react_jsx_runtime.jsx)("select", {
										"aria-label": "高级画面尺寸",
										value: draft.size,
										onChange: (e) => update({ size: e.target.value }),
										children: [
											"1024x1024",
											"1344x768",
											"768x1344",
											"1216x832",
											"832x1216",
											"512x512"
										].map((size) => (0, react_jsx_runtime.jsx)("option", {
											value: size,
											children: size.replace("x", " × ")
										}, size))
									})] }),
									(0, react_jsx_runtime.jsxs)("div", { children: [
										(0, react_jsx_runtime.jsx)(AssetUpload, {
											kind: "source",
											label: "选择参考图",
											disabled,
											onError: setError,
											onAssets: ([a]) => a && importedImage({
												sourceId: a.id,
												sourceName: a.name
											})
										}),
										(0, react_jsx_runtime.jsx)(ResourcePicker, {
											resources: catalog.items,
											kind: "source",
											label: "参考图",
											disabled,
											selected: [draft.sourceId],
											onChoose: (r) => update({
												sourceId: r.id,
												sourceName: r.name
											})
										}),
										draft.sourceId && (0, react_jsx_runtime.jsx)(SelectedImage, {
											id: draft.sourceId,
											name: draft.sourceName || "参考图",
											remove: () => update({
												sourceId: "",
												sourceName: ""
											})
										})
									] }),
									!draft.maskEnabled && draft.sourceId && (0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsxs)("span", {
										className: "q2-field-title",
										children: ["参考图用法", (0, react_jsx_runtime.jsx)(ParameterHelp, {
											name: "参考图用法",
											text: "参考变体按变化幅度保留原图，可能难以换画风。原生参考编辑把图片与指令一起交给 Qwen 2.1，适合水彩化、换颜色等编辑，按完整步数生成，不使用变化幅度。本机需兼容 MFLUX 和完整视觉编码器，远程需配套 Qwen 网关；仅支持 linear，不能叠加控制图或蒙版；旧预设保持参考变体。"
										})]
									}), (0, react_jsx_runtime.jsxs)("select", {
										"aria-label": "参考图用法",
										value: draft.referenceMode ?? "variation",
										onChange: (e) => update({ referenceMode: e.target.value }),
										children: [(0, react_jsx_runtime.jsx)("option", {
											value: "variation",
											children: "参考变体"
										}), (0, react_jsx_runtime.jsx)("option", {
											value: "edit",
											disabled: !nativeEdit,
											children: "按指令编辑 · Qwen 原生"
										})]
									})] }),
									!draft.maskEnabled && draft.sourceId && draft.referenceMode !== "edit" && (0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsxs)("span", {
										className: "q2-field-title",
										children: [
											"参考图变化幅度 · ",
											Math.round(draft.changeStrength * 100),
											"%",
											(0, react_jsx_runtime.jsx)(ParameterHelp, {
												name: "参考图变化幅度",
												text: "较低值更接近参考原图，较高值变化更大。仅用于参考变体，蒙版重绘不使用这个参数。"
											})
										]
									}), (0, react_jsx_runtime.jsx)("input", {
										"aria-label": "高级变化幅度",
										type: "range",
										min: "0.05",
										max: "0.95",
										step: "0.05",
										value: draft.changeStrength,
										onChange: (e) => update({ changeStrength: Number(e.target.value) })
									})] })
								]
							})]
						}),
						(0, react_jsx_runtime.jsxs)("footer", { children: [
							(0, react_jsx_runtime.jsxs)("button", {
								onClick: () => void defaultDraft().then(({ prompt: _, ...values }) => update(values)).catch((e) => setError(e.message)),
								children: [(0, react_jsx_runtime.jsx)(RotateCcw, {}), "恢复默认参数"]
							}),
							(0, react_jsx_runtime.jsx)(ParameterHelp, {
								name: "恢复默认参数",
								text: "加载默认预设；未设默认预设时使用内置参数。保留当前画面描述，不更改已提交的任务，也不删除文件。"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								className: "q2-primary",
								onClick: close,
								children: "完成设置"
							})
						] })
					]
				})]
			});
		}
		//#endregion
		//#region lib/types/client/gallery-preferences.js
		const KEY = "qwen-studio-private-gallery-v1";
		const EVENT = "qwen-studio-gallery-preference";
		function privacyEnabled() {
			try {
				return localStorage.getItem(KEY) !== "false";
			} catch {
				return true;
			}
		}
		function setPrivacyEnabled(enabled) {
			localStorage.setItem(KEY, String(enabled));
			window.dispatchEvent(new Event(EVENT));
		}
		function subscribe(listener) {
			const storage = (event) => {
				if (event.key === KEY || event.key === null) listener();
			};
			window.addEventListener(EVENT, listener);
			window.addEventListener("storage", storage);
			return () => {
				window.removeEventListener(EVENT, listener);
				window.removeEventListener("storage", storage);
			};
		}
		function usePrivacyGallery() {
			return (0, react.useSyncExternalStore)(subscribe, privacyEnabled, () => true);
		}
		function defaultGallery(privacy) {
			return privacy ? "favorites" : "all";
		}
		function galleryMatches(job, filter, privacy, query) {
			const effective = privacy && filter === "all" ? "favorites" : !privacy && filter === "private" ? "all" : filter;
			if (effective === "trash" ? !job.deleted : job.deleted) return false;
			if (effective === "archived" ? !job.archived : effective !== "trash" && job.archived) return false;
			if (effective === "favorites" && !job.favorite) return false;
			if (effective === "private" && job.favorite) return false;
			return job.prompt.toLowerCase().includes(query.toLowerCase());
		}
		//#endregion
		//#region lib/types/client/preview-follow.js
		function previewCandidate(jobs, selected, dismissed, seen, since = Infinity) {
			const running = jobs.filter((j) => active(j) && !j.deleted && !dismissed.has(j.id));
			if (running.some((j) => j.id === selected)) return void 0;
			return running.find((j) => !seen.has(j.id)) ?? jobs.find((j) => j.status === "complete" && !j.deleted && !dismissed.has(j.id) && !seen.has(j.id) && j.started_at > since);
		}
		//#endregion
		//#region lib/types/client/studio.js
		const DRAFT = "qwen-studio-draft-v1";
		const RECEIPT = "qwen-studio-submission-v1";
		function readDraft() {
			try {
				return {
					...draftDefaults,
					...JSON.parse(localStorage.getItem(DRAFT) ?? "{}")
				};
			} catch {
				return draftDefaults;
			}
		}
		let submitting;
		function dispatch(payload) {
			if (!submitting) submitting = request("jobs", payload).then((v) => {
				localStorage.removeItem(RECEIPT);
				return v;
			}).finally(() => {
				submitting = void 0;
			});
			return submitting;
		}
		function Studio() {
			const privacy = usePrivacyGallery();
			const [advancedOpen, setAdvancedOpen] = (0, react.useState)(false);
			const closeAdvanced = (0, react.useCallback)(() => setAdvancedOpen(false), []);
			const [draft, setDraft] = (0, react.useState)(readDraft), [snapshot, setSnapshot] = (0, react.useState)(lastSnapshot), [error, setError] = (0, react.useState)(""), [busy, setBusy] = (0, react.useState)(Boolean(submitting)), [view, setViewState] = (0, react.useState)(() => localStorage.getItem("qwen-studio-view") || "create");
			const enabledLoraCount = draft.loras.filter((l) => l.enabled !== false).length;
			const setView = (value) => {
				if (value === "gallery") {
					setFilter(defaultGallery(privacy));
					setSelection(/* @__PURE__ */ new Set());
				}
				localStorage.setItem("qwen-studio-view", value);
				setViewState(value);
			};
			const [selectedId, setSelectedId] = (0, react.useState)(() => localStorage.getItem("qwen-studio-selected") || "");
			const [historyIds, setHistoryIds] = (0, react.useState)(() => {
				try {
					return JSON.parse(localStorage.getItem("qwen-studio-history") || "[]");
				} catch {
					return [];
				}
			});
			const chooseResult = (id) => {
				setSelectedId(id);
				localStorage.setItem("qwen-studio-selected", id);
			};
			const remember = (id) => {
				chooseResult(id);
				setHistoryIds((old) => {
					const next = [id, ...old.filter((v) => v !== id)].slice(0, 16);
					localStorage.setItem("qwen-studio-history", JSON.stringify(next));
					return next;
				});
			};
			const [query, setQuery] = (0, react.useState)(""), [filter, setFilter] = (0, react.useState)(() => defaultGallery(privacy)), [selection, setSelection] = (0, react.useState)(/* @__PURE__ */ new Set()), [selecting, setSelecting] = (0, react.useState)(false), [detailId, setDetailId] = (0, react.useState)(null);
			const [confirm, setConfirm] = (0, react.useState)(null), [retry, setRetry] = (0, react.useState)(Boolean(localStorage.getItem(RECEIPT))), [notice, setNotice] = (0, react.useState)(""), [connectionError, setConnectionError] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				setFilter(defaultGallery(privacy));
				setSelection(/* @__PURE__ */ new Set());
				setDetailId(null);
			}, [privacy]);
			const dismissed = (0, react.useRef)(new Set((() => {
				try {
					return JSON.parse(localStorage.getItem("qwen-studio-dismissed") || "[]");
				} catch {
					return [];
				}
			})()));
			const seenActive = (0, react.useRef)(/* @__PURE__ */ new Set());
			const previewCursor = (0, react.useRef)(Number(localStorage.getItem("qwen-studio-preview-cursor")) || Date.now() / 1e3);
			(0, react.useEffect)(() => {
				const jobs = snapshot?.jobs ?? [];
				const candidate = previewCandidate(jobs, selectedId, dismissed.current, seenActive.current, previewCursor.current);
				for (const job of jobs) seenActive.current.add(job.id);
				if (snapshot) {
					previewCursor.current = jobs.reduce((cursor, job) => Number.isFinite(job.started_at) ? Math.max(cursor, job.started_at) : cursor, previewCursor.current);
					localStorage.setItem("qwen-studio-preview-cursor", String(previewCursor.current));
				}
				if (candidate) remember(candidate.id);
			}, [snapshot]);
			const clearPreview = () => {
				for (const job of snapshot?.jobs ?? []) dismissed.current.add(job.id);
				localStorage.setItem("qwen-studio-dismissed", JSON.stringify([...dismissed.current].slice(-128)));
				chooseResult("");
				setHistoryIds([]);
				localStorage.removeItem("qwen-studio-history");
				update({
					sourceId: "",
					sourceName: "",
					maskId: "",
					maskName: "",
					maskEnabled: false,
					maskSourceId: "",
					maskSourceName: ""
				});
				setNotice("已清除预览，图库原图和后台任务均保留");
			};
			const closeRef = (0, react.useRef)(null);
			const update = (patch) => setDraft((old) => {
				const missingResources = { ...old.missingResources };
				for (const key of [
					"sourceId",
					"controlId",
					"maskId",
					"maskSourceId"
				]) if (Object.prototype.hasOwnProperty.call(patch, key)) delete missingResources[key];
				const value = {
					...old,
					missingResources,
					...patch
				};
				localStorage.setItem(DRAFT, JSON.stringify(value));
				return value;
			});
			(0, react.useEffect)(() => {
				if (localStorage.getItem(DRAFT)) return;
				let alive = true;
				defaultDraft().then(({ prompt: _, ...values }) => {
					if (alive && !localStorage.getItem(DRAFT)) update(values);
				}).catch(() => {});
				return () => {
					alive = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				let alive = true, pending = false;
				const poll = async () => {
					if (pending) return;
					pending = true;
					try {
						const s = await pollSnapshot(lastSnapshot);
						cache(s);
						if (alive) {
							setSnapshot(s);
							setRetry(Boolean(localStorage.getItem(RECEIPT)));
							setConnectionError("");
						}
					} catch (e) {
						if (alive) setConnectionError(e instanceof APIError ? e.message : "连接中断，后台任务仍保留。正在重试…");
					} finally {
						pending = false;
					}
				};
				poll();
				const timer = setInterval(() => void poll(), 1500);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, []);
			(0, react.useEffect)(() => {
				if (!detailId && !confirm) return;
				closeRef.current?.focus();
				const key = (e) => {
					if (e.key === "Escape") {
						setConfirm(null);
						setDetailId(null);
					}
				};
				window.addEventListener("keydown", key);
				return () => window.removeEventListener("keydown", key);
			}, [detailId, confirm]);
			async function refresh() {
				const s = await pollSnapshot(lastSnapshot);
				cache(s);
				setSnapshot(s);
			}
			async function submit(reuseReceipt = false) {
				setError("");
				setBusy(true);
				try {
					const saved = reuseReceipt ? localStorage.getItem(RECEIPT) : null;
					const payload = saved ? JSON.parse(saved) : generationPayload(draft, snapshot?.mode === "remote" && !snapshot?.remoteAdvanced, crypto.randomUUID().replaceAll("-", ""));
					if ((enabledLoraCount || draft.controlEnabled || draft.maskEnabled) && (snapshot?.apiVersion ?? 0) < 5) throw Error("请先重新打开 DSH，加载高级创作服务");
					localStorage.setItem(RECEIPT, JSON.stringify(payload));
					setRetry(true);
					remember(payload.id);
					await dispatch(payload);
					setRetry(false);
					await refresh();
					setNotice("");
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
				} finally {
					setBusy(false);
					setRetry(Boolean(localStorage.getItem(RECEIPT)));
				}
			}
			async function action(name, ids, value) {
				setError("");
				setBusy(true);
				try {
					await request("action", {
						action: name,
						ids,
						id: ids[0],
						value,
						confirm: name === "purge"
					});
					await refresh();
					setSelection(/* @__PURE__ */ new Set());
					setConfirm(null);
					if ([
						"delete",
						"restore",
						"purge"
					].includes(name)) setDetailId(null);
					setNotice({
						delete: "已移到回收站，可在筛选中恢复",
						restore: "已从回收站恢复",
						purge: "已永久删除",
						archived: value ? "已归档" : "已取消归档",
						favorite: value ? "已收藏" : "已取消收藏"
					}[name] ?? "已完成");
					if (draft.sourceId && (snapshot?.apiVersion ?? 0) < 4) throw Error("请先重新打开DSH，加载支持图生图的新插件服务");
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
				} finally {
					setBusy(false);
				}
			}
			const jobs = snapshot?.jobs ?? [], running = jobs.filter((j) => active(j) && !j.deleted), health = snapshot?.health;
			const visible = jobs.filter((job) => galleryMatches(job, filter, privacy, query));
			const detail = jobs.find((j) => j.id === detailId), remote = (snapshot?.mode ?? "local") === "remote", referenceId = draft.maskEnabled ? draft.maskSourceId || draft.sourceId : draft.sourceId, referenceName = draft.maskEnabled ? draft.maskSourceName || draft.sourceName : draft.sourceName;
			const status = !snapshot ? "连接中" : remote ? health?.busy ? "远程正在创作" : health?.loaded ? "远程模型已就绪" : health?.ssh_status === "disconnected" ? "远程待调用 · SSH 未连接" : "远程按需启动" : health?.busy ? "正在创作" : health?.loaded ? "模型已就绪" : "按需启动";
			const toggle = (id) => setSelection((old) => {
				const next = new Set(old);
				next.has(id) ? next.delete(id) : next.add(id);
				return next;
			});
			const reuse = (job, asReference = false) => {
				update(reuseDraft(job, asReference));
				remember(job.id);
				setDetailId(null);
				setView("create");
			};
			const save = async (id) => {
				try {
					await download(id);
				} catch (e) {
					setError(String(e));
				}
			};
			const ids = [...selection], allSelected = visible.length > 0 && visible.every((j) => selection.has(j.id));
			return (0, react_jsx_runtime.jsxs)("section", {
				className: "q2 q2-studio",
				"aria-label": "图像",
				children: [
					(0, react_jsx_runtime.jsx)("style", { children: STYLE }),
					(0, react_jsx_runtime.jsxs)("header", {
						className: "q2-brand",
						children: [
							(0, react_jsx_runtime.jsx)("h2", { children: "图像" }),
							(0, react_jsx_runtime.jsxs)("nav", {
								className: "q2-nav",
								"aria-label": "工作室视图",
								children: [
									(0, react_jsx_runtime.jsx)("button", {
										"aria-pressed": view === "gallery",
										onClick: () => setView("gallery"),
										children: "图库"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										"aria-pressed": view === "create",
										onClick: () => setView("create"),
										children: "创作"
									}),
									health?.loaded && !health.busy && (!remote || snapshot?.remoteAdvanced) && (0, react_jsx_runtime.jsx)("button", {
										className: "q2-unload",
										onClick: () => void action("unload", []),
										children: "释放内存"
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "q2-status",
								children: [(0, react_jsx_runtime.jsx)("i", { className: running.length ? "working" : "" }), status]
							})
						]
					}),
					health?.connection_error && (0, react_jsx_runtime.jsxs)("div", {
						role: "status",
						className: "q2-alert",
						children: [health.connection_error, "。模型卸载未确认，SSH 连接已保留并会重试。"]
					}),
					connectionError && (0, react_jsx_runtime.jsx)("div", {
						role: "status",
						className: "q2-alert",
						children: connectionError
					}),
					error && (0, react_jsx_runtime.jsxs)("div", {
						role: "alert",
						className: "q2-alert",
						children: [error, (0, react_jsx_runtime.jsx)("button", {
							"aria-label": "关闭提示",
							onClick: () => setError(""),
							children: (0, react_jsx_runtime.jsx)(X, { size: 13 })
						})]
					}),
					notice && (0, react_jsx_runtime.jsxs)("div", {
						role: "status",
						className: "q2-notice",
						children: [notice, (0, react_jsx_runtime.jsx)("button", {
							"aria-label": "关闭操作提示",
							onClick: () => setNotice(""),
							children: (0, react_jsx_runtime.jsx)(X, { size: 12 })
						})]
					}),
					view === "create" ? (0, react_jsx_runtime.jsxs)("div", {
						className: "q2-create",
						children: [(0, react_jsx_runtime.jsx)(CreationPreview, {
							job: jobs.find((j) => j.id === selectedId && !j.deleted),
							history: historyIds.map((id) => jobs.find((j) => j.id === id && !j.deleted)).filter((j) => Boolean(j)),
							remote: remote && !snapshot?.remoteAdvanced,
							clear: clearPreview,
							favorite: (job) => void action("favorite", [job.id], !job.favorite),
							select: chooseResult,
							reuse,
							reference: (j) => reuse(j, true),
							save: (id) => void save(id),
							cancel: (id) => void action("cancel", [id])
						}), (0, react_jsx_runtime.jsxs)("div", {
							className: "q2-editor",
							children: [(0, react_jsx_runtime.jsxs)("div", {
								className: "q2-editor-scroll",
								children: [
									(0, react_jsx_runtime.jsxs)("label", {
										className: "q2-prompt-label",
										children: ["画面描述", (0, react_jsx_runtime.jsx)("textarea", {
											"aria-label": "画面描述",
											value: draft.prompt,
											placeholder: "一座山间小屋，晨雾与松林，柔和的胶片光影…",
											onChange: (e) => update({ prompt: e.target.value }),
											onKeyDown: (e) => {
												if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !busy && !retry) {
													e.preventDefault();
													submit();
												}
											}
										})]
									}),
									referenceId && (0, react_jsx_runtime.jsxs)("div", {
										className: "q2-reference",
										"aria-label": "参考图设置",
										children: [(0, react_jsx_runtime.jsxs)("div", {
											className: "q2-reference-head",
											children: [
												(0, react_jsx_runtime.jsx)("img", {
													src: imageURL(referenceId),
													alt: "参考图"
												}),
												(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("span", { children: referenceName || "参考图" }), (0, react_jsx_runtime.jsx)("small", { children: draft.maskEnabled ? "局部重绘的原图 · 蒙版黑色区域保留" : "以这张图的构图与色彩为起点" })] }),
												(0, react_jsx_runtime.jsx)("button", {
													"aria-label": "移除参考图",
													onClick: () => update({
														sourceId: "",
														sourceName: "",
														maskId: "",
														maskEnabled: false,
														maskSourceId: "",
														maskSourceName: ""
													}),
													children: (0, react_jsx_runtime.jsx)(X, {})
												})
											]
										}), !draft.maskEnabled && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("label", { children: [
											"变化幅度",
											" ",
											(0, react_jsx_runtime.jsxs)("span", { children: [Math.round(draft.changeStrength * 100), "%"] }),
											(0, react_jsx_runtime.jsx)("input", {
												"aria-label": "变化幅度",
												type: "range",
												min: "5",
												max: "95",
												step: "5",
												value: draft.changeStrength * 100,
												onChange: (e) => update({ changeStrength: Number(e.target.value) / 100 })
											})
										] }), (0, react_jsx_runtime.jsx)("small", { children: "越低越接近原图，越高变化越多。请描述目标画面；此模式不保证精准局部编辑。" })] })]
									}),
									(0, react_jsx_runtime.jsxs)("div", {
										className: "q2-options",
										children: [
											(0, react_jsx_runtime.jsx)("div", {
												className: "q2-option-label",
												children: "画面比例"
											}),
											(0, react_jsx_runtime.jsx)("div", {
												className: "q2-presets",
												"aria-label": "画面比例",
												children: [
													["1024x1024", "1:1"],
													["1344x768", "16:9"],
													["768x1344", "9:16"],
													["1216x832", "3:2"]
												].map(([size, label]) => (0, react_jsx_runtime.jsx)("button", {
													"aria-pressed": draft.size === size || label === "1:1" && draft.size === "512x512",
													onClick: () => update({ size }),
													children: label
												}, size))
											}),
											(0, react_jsx_runtime.jsxs)("section", {
												className: "q2-advanced",
												"aria-label": "生成参数",
												children: [(0, react_jsx_runtime.jsxs)("div", {
													className: "q2-parameter-heading",
													children: [(0, react_jsx_runtime.jsx)("span", { children: "生成参数" }), (0, react_jsx_runtime.jsxs)("button", {
														className: "q2-advanced-link",
														onClick: () => setAdvancedOpen(true),
														children: [(0, react_jsx_runtime.jsx)(SlidersHorizontal, {}), "高级设置"]
													})]
												}), (0, react_jsx_runtime.jsxs)("div", {
													className: "q2-param-grid",
													children: [
														(0, react_jsx_runtime.jsxs)("label", { children: ["尺寸", (0, react_jsx_runtime.jsx)("select", {
															"aria-label": "画面尺寸",
															value: draft.size,
															onChange: (e) => update({ size: e.target.value }),
															children: [
																"1024x1024",
																"1344x768",
																"768x1344",
																"1216x832",
																"832x1216",
																"512x512"
															].map((s) => (0, react_jsx_runtime.jsx)("option", {
																value: s,
																children: s.replace("x", " × ")
															}, s))
														})] }),
														(0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsxs)("span", {
															className: "q2-field-title",
															children: ["步数", (0, react_jsx_runtime.jsx)(ParameterHelp, {
																name: "步数",
																text: STEPS_HELP
															})]
														}), (0, react_jsx_runtime.jsx)("input", {
															"aria-label": "生成步数",
															type: "number",
															min: "1",
															max: "60",
															value: draft.steps,
															onChange: (e) => update({ steps: Number(e.target.value) })
														})] }),
														(0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsxs)("span", {
															className: "q2-field-title",
															children: ["种子", (0, react_jsx_runtime.jsx)(ParameterHelp, {
																name: "种子",
																text: SEED_HELP
															})]
														}), (0, react_jsx_runtime.jsx)("input", {
															"aria-label": "随机种子",
															inputMode: "numeric",
															placeholder: "随机",
															value: draft.seed,
															onChange: (e) => update({ seed: e.target.value })
														})] })
													]
												})]
											})
										]
									})
								]
							}), (0, react_jsx_runtime.jsxs)("div", {
								className: "q2-submit",
								children: [
									running.some((j) => j.id !== selectedId) && (0, react_jsx_runtime.jsx)("div", {
										className: "q2-live-tasks",
										"aria-label": "后台生图任务",
										children: running.filter((j) => j.id !== selectedId).map((j) => (0, react_jsx_runtime.jsxs)("button", {
											onClick: () => remember(j.id),
											children: [
												statusLabel(j.status),
												" · ",
												j.step ?? 0,
												"/",
												j.sampling_steps ?? j.steps,
												" 步"
											]
										}, j.id))
									}),
									(enabledLoraCount > 0 || draft.controlEnabled || draft.maskEnabled) && (0, react_jsx_runtime.jsxs)("button", {
										className: "q2-advanced-summary",
										onClick: () => setAdvancedOpen(true),
										children: [(0, react_jsx_runtime.jsx)(SlidersHorizontal, {}), [
											enabledLoraCount ? `LoRA ${enabledLoraCount}` : "",
											draft.controlEnabled ? "结构控制" : "",
											draft.maskEnabled ? "局部重绘" : ""
										].filter(Boolean).join(" · ")]
									}),
									(0, react_jsx_runtime.jsxs)("p", { children: [
										remote ? "由你配置的远程 Qwen 服务生成" : "本机 Qwen Image · MLX",
										" ",
										"· ",
										privacy ? "默认存入隐私图库" : "自动保存"
									] }),
									retry && (0, react_jsx_runtime.jsxs)("div", {
										className: "q2-retry",
										children: [(0, react_jsx_runtime.jsx)("button", {
											disabled: busy,
											onClick: () => void submit(true),
											children: "确认上次提交 / 重试"
										}), (0, react_jsx_runtime.jsx)("button", {
											disabled: busy,
											onClick: () => {
												localStorage.removeItem(RECEIPT);
												setRetry(false);
												setError("已清除提交收据，请先检查图库是否已有任务，避免重复生成。");
											},
											children: "放弃重试"
										})]
									}),
									(0, react_jsx_runtime.jsxs)("button", {
										className: "q2-primary",
										disabled: busy || retry || !snapshot || !draft.prompt.trim() || running.length >= 4,
										onClick: () => void submit(),
										children: [
											busy ? (0, react_jsx_runtime.jsx)(LoaderCircle, {
												size: 17,
												className: "q2-spin"
											}) : (0, react_jsx_runtime.jsx)(ArrowUp, { size: 17 }),
											draft.sourceId ? "生成变体" : "生成图片",
											" ",
											(0, react_jsx_runtime.jsx)("small", { children: "⌘ ↵" })
										]
									})
								]
							})]
						})]
					}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: "q2-toolbar",
							children: [
								(0, react_jsx_runtime.jsxs)("label", {
									className: "q2-search",
									children: [(0, react_jsx_runtime.jsx)(Search, { size: 14 }), (0, react_jsx_runtime.jsx)("input", {
										"aria-label": "搜索图片",
										placeholder: "搜索画面…",
										value: query,
										onChange: (e) => {
											setQuery(e.target.value);
											setSelection(/* @__PURE__ */ new Set());
										}
									})]
								}),
								(0, react_jsx_runtime.jsxs)("select", {
									"aria-label": "图库筛选",
									value: filter,
									onChange: (e) => {
										setFilter(e.target.value);
										setSelection(/* @__PURE__ */ new Set());
									},
									children: [
										!privacy && (0, react_jsx_runtime.jsx)("option", {
											value: "all",
											children: "全部作品"
										}),
										(0, react_jsx_runtime.jsx)("option", {
											value: "favorites",
											children: "收藏"
										}),
										privacy && (0, react_jsx_runtime.jsx)("option", {
											value: "private",
											children: "隐私图库"
										}),
										(0, react_jsx_runtime.jsx)("option", {
											value: "archived",
											children: "已归档"
										}),
										(0, react_jsx_runtime.jsx)("option", {
											value: "trash",
											children: "回收站"
										})
									]
								}),
								(0, react_jsx_runtime.jsx)("button", {
									"aria-pressed": selecting,
									onClick: () => {
										setSelecting(!selecting);
										setSelection(/* @__PURE__ */ new Set());
									},
									children: selecting ? "完成" : "选择"
								})
							]
						}),
						privacy && filter === "private" && (0, react_jsx_runtime.jsx)("p", {
							className: "q2-gallery-hint",
							children: "未收藏的作品只在这里显示。点击星标后，会移入收藏图库。"
						}),
						selecting && (0, react_jsx_runtime.jsxs)("div", {
							className: "q2-batch",
							role: "toolbar",
							"aria-label": "批量操作",
							children: [
								(0, react_jsx_runtime.jsxs)("button", {
									onClick: () => setSelection(allSelected ? /* @__PURE__ */ new Set() : new Set(visible.map((j) => j.id))),
									children: [(0, react_jsx_runtime.jsx)(Check, { size: 13 }), allSelected ? "取消全选" : "全选当前结果"]
								}),
								(0, react_jsx_runtime.jsxs)("span", { children: ["已选 ", ids.length] }),
								filter === "trash" ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("button", {
									disabled: !ids.length || busy,
									onClick: () => void action("restore", ids),
									children: "恢复"
								}), (0, react_jsx_runtime.jsx)("button", {
									className: "q2-danger",
									disabled: !ids.length || busy,
									onClick: () => setConfirm({
										action: "purge",
										ids
									}),
									children: "彻底删除"
								})] }) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									(0, react_jsx_runtime.jsxs)("button", {
										disabled: !ids.length || busy,
										onClick: () => void action("favorite", ids, filter !== "favorites"),
										children: [(0, react_jsx_runtime.jsx)(Star, {}), filter === "favorites" ? "取消收藏" : "收藏"]
									}),
									(0, react_jsx_runtime.jsx)("button", {
										disabled: !ids.length || busy,
										onClick: () => void action("archived", ids, filter !== "archived"),
										children: filter === "archived" ? "取消归档" : "归档"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										className: "q2-danger",
										disabled: !ids.length || busy,
										onClick: () => setConfirm({
											action: "delete",
											ids
										}),
										children: "删除"
									})
								] })
							]
						}),
						running.length > 0 && (0, react_jsx_runtime.jsxs)("div", {
							className: "q2-running",
							children: [
								(0, react_jsx_runtime.jsx)(LoaderCircle, {
									size: 14,
									className: "q2-spin"
								}),
								(0, react_jsx_runtime.jsxs)("span", { children: [running.length, " 个任务正在创作"] }),
								(0, react_jsx_runtime.jsx)("small", { children: "离开也会继续" })
							]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: "q2-gallery-scroll",
							children: [(0, react_jsx_runtime.jsx)("div", {
								className: "q2-masonry",
								children: visible.map((job) => (0, react_jsx_runtime.jsxs)("article", {
									className: `q2-card ${selection.has(job.id) ? "selected" : ""}`,
									children: [(0, react_jsx_runtime.jsxs)("button", {
										className: "q2-thumb",
										"aria-label": selecting ? `选择图片：${job.prompt}` : `查看图片：${job.prompt}`,
										"aria-pressed": selecting ? selection.has(job.id) : void 0,
										onClick: () => selecting ? toggle(job.id) : setDetailId(job.id),
										children: [
											job.status === "complete" ? (0, react_jsx_runtime.jsx)("img", {
												src: imageURL(job.id),
												alt: job.prompt,
												loading: "lazy",
												width: job.width,
												height: job.height
											}) : (0, react_jsx_runtime.jsxs)("div", {
												className: "q2-task",
												children: [
													(0, react_jsx_runtime.jsx)(Image, { size: 24 }),
													(0, react_jsx_runtime.jsx)("strong", { children: statusLabel(job.status) }),
													active(job) && (0, react_jsx_runtime.jsx)("div", {
														className: `q2-progress ${job.source === "remote" && !job.progress_supported ? "q2-indeterminate" : ""}`,
														children: (0, react_jsx_runtime.jsx)("i", { style: job.source === "remote" && !job.progress_supported ? void 0 : { width: `${Math.min(100, Math.max(3, (job.step ?? 0) / (job.sampling_steps ?? job.steps) * 100))}%` } })
													}),
													(0, react_jsx_runtime.jsx)("span", { children: job.source === "remote" && !job.progress_supported && active(job) ? "远程服务处理中" : job.status === "running" ? `${job.step ?? 0} / ${job.sampling_steps ?? job.steps} 步` : job.error ?? "任务已记录" })
												]
											}),
											selecting && (0, react_jsx_runtime.jsx)("span", {
												className: "q2-check",
												children: selection.has(job.id) && (0, react_jsx_runtime.jsx)(Check, { size: 13 })
											}),
											job.archived && (0, react_jsx_runtime.jsx)("span", {
												className: "q2-archived",
												children: "已归档"
											})
										]
									}), (0, react_jsx_runtime.jsxs)("div", {
										className: "q2-caption",
										children: [(0, react_jsx_runtime.jsx)("span", {
											title: job.prompt,
											children: job.prompt
										}), (0, react_jsx_runtime.jsx)("button", {
											"aria-label": job.favorite ? "取消收藏" : "收藏图片",
											"aria-pressed": Boolean(job.favorite),
											onClick: () => void action("favorite", [job.id], !job.favorite),
											children: (0, react_jsx_runtime.jsx)(Star, {
												size: 13,
												fill: job.favorite ? "currentColor" : "none"
											})
										})]
									})]
								}, job.id))
							}), !visible.length && (0, react_jsx_runtime.jsxs)("div", {
								className: "q2-empty",
								children: [
									(0, react_jsx_runtime.jsx)(Image, { size: 28 }),
									(0, react_jsx_runtime.jsx)("h3", { children: filter === "trash" ? "回收站是空的" : query ? "没有找到这幅画面" : filter === "favorites" ? "还没有收藏" : filter === "private" ? "隐私图库是空的" : "留一点空间给想象" }),
									(0, react_jsx_runtime.jsx)("p", { children: filter === "trash" ? "删除的图片可以在这里恢复。" : filter === "favorites" ? "点击作品的星标，即可在这里查看。" : privacy ? "新生成的作品默认进入隐私图库，收藏后移入普通图库。" : "从一句描述开始，作品会自动出现在这里。" }),
									filter !== "trash" && (0, react_jsx_runtime.jsxs)("button", {
										onClick: () => setView("create"),
										children: [(0, react_jsx_runtime.jsx)(Plus, { size: 14 }), "创作第一张"]
									})
								]
							})]
						})
					] }),
					advancedOpen && (0, react_jsx_runtime.jsx)(AdvancedSettings, {
						draft,
						update,
						nativeEdit: Boolean(snapshot?.referenceEditSupported),
						remote: remote && !snapshot?.remoteAdvanced,
						ready: (snapshot?.apiVersion ?? 0) >= 6,
						close: closeAdvanced
					}),
					detail && (0, react_jsx_runtime.jsx)("div", {
						className: "q2-overlay",
						role: "dialog",
						"aria-modal": "true",
						"aria-label": "图片详情",
						children: (0, react_jsx_runtime.jsxs)("div", {
							className: "q2-detail",
							children: [
								(0, react_jsx_runtime.jsxs)("header", { children: [
									(0, react_jsx_runtime.jsx)("button", {
										ref: closeRef,
										"aria-label": "关闭详情",
										onClick: () => setDetailId(null),
										children: (0, react_jsx_runtime.jsx)(ArrowLeft, { size: 17 })
									}),
									(0, react_jsx_runtime.jsx)("span", { children: detail.deleted ? "回收站" : detail.archived ? "已归档" : "作品详情" }),
									(0, react_jsx_runtime.jsx)("button", {
										"aria-label": "下载原图",
										disabled: detail.status !== "complete",
										onClick: () => void save(detail.id),
										children: (0, react_jsx_runtime.jsx)(Download, { size: 17 })
									})
								] }),
								(0, react_jsx_runtime.jsxs)("div", {
									className: "q2-detail-scroll",
									children: [detail.status === "complete" ? (0, react_jsx_runtime.jsx)("img", {
										className: "q2-original",
										src: imageURL(detail.id),
										alt: detail.prompt
									}) : (0, react_jsx_runtime.jsxs)("div", {
										className: "q2-task",
										children: [(0, react_jsx_runtime.jsx)("strong", { children: statusLabel(detail.status) }), (0, react_jsx_runtime.jsx)("span", { children: detail.error ?? `${detail.step ?? 0}/${detail.sampling_steps ?? detail.steps}` })]
									}), (0, react_jsx_runtime.jsxs)("div", {
										className: "q2-detail-copy",
										children: [
											(0, react_jsx_runtime.jsx)("span", {
												className: "q2-eyebrow",
												children: "PROMPT"
											}),
											(0, react_jsx_runtime.jsx)("p", { children: detail.prompt }),
											(0, react_jsx_runtime.jsxs)("div", {
												className: "q2-metadata",
												children: [
													(0, react_jsx_runtime.jsxs)("span", { children: [
														detail.width,
														" × ",
														detail.height
													] }),
													(0, react_jsx_runtime.jsxs)("span", { children: [detail.steps, " 步"] }),
													(0, react_jsx_runtime.jsxs)("span", { children: ["种子 ", detail.seed] })
												]
											})
										]
									})]
								}),
								(0, react_jsx_runtime.jsx)("footer", { children: active(detail) ? (0, react_jsx_runtime.jsx)("button", {
									onClick: () => void action("cancel", [detail.id]),
									children: "取消任务"
								}) : detail.deleted ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("button", {
									onClick: () => void action("restore", [detail.id]),
									children: [(0, react_jsx_runtime.jsx)(RotateCcw, { size: 14 }), "恢复"]
								}), (0, react_jsx_runtime.jsx)("button", {
									className: "q2-danger",
									onClick: () => setConfirm({
										action: "purge",
										ids: [detail.id]
									}),
									children: "彻底删除"
								})] }) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									(0, react_jsx_runtime.jsxs)("button", {
										onClick: () => reuse(detail),
										children: [(0, react_jsx_runtime.jsx)(RotateCcw, { size: 14 }), "复用参数"]
									}),
									detail.status === "complete" && (!remote || snapshot?.remoteAdvanced) && (0, react_jsx_runtime.jsx)("button", {
										onClick: () => reuse(detail, true),
										children: "用作参考"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										"aria-label": detail.archived ? "取消归档" : "归档图片",
										onClick: () => void action("archived", [detail.id], !detail.archived),
										children: (0, react_jsx_runtime.jsx)(Archive, { size: 15 })
									}),
									(0, react_jsx_runtime.jsx)("button", {
										className: "q2-danger",
										"aria-label": "删除图片",
										onClick: () => setConfirm({
											action: "delete",
											ids: [detail.id]
										}),
										children: (0, react_jsx_runtime.jsx)(Trash, { size: 15 })
									})
								] }) })
							]
						})
					}),
					confirm && (0, react_jsx_runtime.jsx)("div", {
						className: "q2-confirm-backdrop",
						role: "alertdialog",
						"aria-modal": "true",
						"aria-label": "确认删除",
						children: (0, react_jsx_runtime.jsxs)("div", {
							className: "q2-confirm",
							children: [
								(0, react_jsx_runtime.jsx)(Trash, { size: 23 }),
								(0, react_jsx_runtime.jsxs)("h3", { children: [
									confirm.action === "purge" ? "永久删除" : "删除",
									" ",
									confirm.ids.length,
									" 张图片？"
								] }),
								(0, react_jsx_runtime.jsx)("p", { children: confirm.action === "purge" ? "原图和任务文件将永久删除，此操作无法撤销。" : "图片将移到回收站，可以从图库筛选中恢复。已归档的图片也可以删除。" }),
								(0, react_jsx_runtime.jsxs)("div", {
									className: "q2-actions",
									children: [(0, react_jsx_runtime.jsx)("button", {
										ref: closeRef,
										onClick: () => setConfirm(null),
										children: "取消"
									}), (0, react_jsx_runtime.jsx)("button", {
										className: "q2-danger-fill",
										disabled: busy,
										onClick: () => void action(confirm.action, confirm.ids),
										children: confirm.action === "purge" ? "永久删除" : "移到回收站"
									})]
								})
							]
						})
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/conversation-result.js
		const RESULT_KIND = "qwen-studio-image-result";
		function parseResult(event) {
			if (event.type !== "tool/result") return;
			const meta = event.data.meta;
			if (meta?.kind === "qwen-studio" && typeof meta.id === "string" && meta.attachment?.attachmentId) return {
				id: meta.id,
				prompt: meta.prompt ?? "生成的图片",
				attachment: meta.attachment,
				seq: event.seq
			};
			const content = event.data.message?.content;
			if (!Array.isArray(content)) return;
			const id = (content.find((b) => b.type === "text" && /^(Qwen Studio|图像)任务[a-f0-9]{32}已完成/.test(b.text ?? ""))?.text)?.match(/任务([a-f0-9]{32})已完成/)?.[1];
			const attachment = content.find((b) => b.type === "image")?.attachment;
			if (id && attachment?.attachmentId) return {
				id,
				prompt: "生成的图片",
				attachment,
				seq: event.seq
			};
		}
		const resultDefinition = {
			kind: RESULT_KIND,
			target: "chat",
			match(event) {
				return parseResult(event) ? {
					id: `result:${event.seq}`,
					role: "start"
				} : null;
			},
			start(_context, match) {
				return parseResult(match.event);
			},
			update(context) {
				return context.state;
			},
			buildViewNode(context) {
				if (!context.state) return null;
				return {
					key: context.key,
					kind: RESULT_KIND,
					id: context.id,
					target: "chat",
					anchorSeq: context.state.seq,
					location: { kind: "session" },
					visibility: "visible",
					data: context.state
				};
			}
		};
		function ConversationImage({ node }) {
			const { id, attachment, prompt } = node.data, [url, setUrl] = (0, react.useState)(""), [error, setError] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				let objectURL = "";
				setUrl("");
				setError("");
				fetch(API + "/attachment", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ attachment }),
					signal: controller.signal
				}).then(async (response) => {
					if (response.status === 404) response = await fetch(API + "/image?id=" + encodeURIComponent(id), { signal: controller.signal });
					if (!response.ok) throw Error("无法读取对话图片附件");
					return response.blob();
				}).then((blob) => {
					if (controller.signal.aborted) return;
					objectURL = URL.createObjectURL(blob);
					setUrl(objectURL);
				}).catch((e) => {
					if (!controller.signal.aborted) setError(String(e));
				});
				return () => {
					controller.abort();
					if (objectURL) URL.revokeObjectURL(objectURL);
				};
			}, [id, attachment.attachmentId]);
			return (0, react_jsx_runtime.jsx)("figure", {
				style: {
					margin: "16px 0",
					font: "inherit"
				},
				"aria-label": "生成的图片",
				children: url ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("a", {
					href: url,
					target: "_blank",
					rel: "noreferrer",
					"aria-label": "查看生成的图片",
					children: (0, react_jsx_runtime.jsx)("img", {
						src: url,
						alt: prompt,
						width: attachment.width,
						height: attachment.height,
						style: {
							display: "block",
							width: "min(100%, 512px)",
							height: "auto",
							borderRadius: "var(--dsw-radius-md,8px)"
						}
					})
				}), (0, react_jsx_runtime.jsx)("figcaption", {
					style: {
						marginTop: 8,
						color: "var(--dsw-alias-label-secondary)",
						fontSize: ".875em"
					},
					children: "图片已保存到左侧「图像」图库"
				})] }) : (0, react_jsx_runtime.jsx)("p", {
					role: "status",
					children: error || "正在加载图片…"
				})
			});
		}
		//#endregion
		//#region lib/types/client/path-field.js
		function PathField({ label, name, value, placeholder, kind = "directory", onChange, onError }) {
			const id = (0, react.useId)(), input = (0, react.useRef)(null), [picking, setPicking] = (0, react.useState)(false);
			const desktop = window;
			async function pick() {
				onError("");
				if (kind === "file") {
					if (!desktop.__DSH_HOST_PATHS__) {
						onError("当前环境无法取得本机文件路径，请手动输入。");
						return;
					}
					input.current?.click();
					return;
				}
				if (!desktop.__DSH_DIRECTORY_PICKER__) {
					onError("当前环境不支持本机文件夹选择，请手动输入。");
					return;
				}
				setPicking(true);
				try {
					const path = await desktop.__DSH_DIRECTORY_PICKER__.pick();
					if (path) onChange(kind === "python" ? path.replace(/\/$/, "") + "/bin/python" : path);
				} catch (e) {
					onError(e instanceof Error ? e.message : String(e));
				} finally {
					setPicking(false);
				}
			}
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "q2-path-field",
				children: [
					(0, react_jsx_runtime.jsx)("label", {
						htmlFor: id,
						children: label
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "q2-path-row",
						children: [(0, react_jsx_runtime.jsx)("input", {
							id,
							"aria-label": name,
							value,
							placeholder,
							onChange: (e) => onChange(e.target.value)
						}), (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							disabled: picking,
							"aria-label": `选择${name}`,
							onClick: () => void pick(),
							children: [kind === "file" ? (0, react_jsx_runtime.jsx)(File, {}) : (0, react_jsx_runtime.jsx)(FolderOpen, {}), kind === "file" ? "选择文件" : kind === "python" ? "选择 Python 环境" : "选择文件夹"]
						})]
					}),
					kind === "file" && (0, react_jsx_runtime.jsx)("input", {
						type: "file",
						ref: input,
						hidden: true,
						tabIndex: -1,
						onChange: (e) => {
							const file = e.target.files?.[0];
							if (file) try {
								const path = desktop.__DSH_HOST_PATHS__?.pathFor(file);
								if (!path) throw Error("没有取得本机文件路径，请手动输入。");
								onChange(path);
							} catch (error) {
								onError(error instanceof Error ? error.message : String(error));
							}
							e.target.value = "";
						}
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/update-settings.js
		function UpdateSettings() {
			const [value, setValue] = (0, react.useState)(), [busy, setBusy] = (0, react.useState)(false), [error, setError] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				let alive = true;
				request("updates").then((v) => {
					if (!v.preferences) throw Error("更新服务尚未加载，请重新打开 DSH");
					if (alive) setValue(v);
				}).catch((e) => {
					if (alive) setError(e.message);
				});
				return () => {
					alive = false;
				};
			}, []);
			async function action(data) {
				setBusy(true);
				setError("");
				try {
					await request("updates", data);
					setValue(await request("updates"));
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
				} finally {
					setBusy(false);
				}
			}
			const toggle = (key) => void action({
				action: "preferences",
				preferences: { [key]: !value?.preferences[key] }
			});
			return (0, react_jsx_runtime.jsxs)("section", {
				className: "q2-update-settings",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "q2-field-title",
						children: [(0, react_jsx_runtime.jsx)("h3", { children: "插件更新" }), (0, react_jsx_runtime.jsx)(ParameterHelp, {
							name: "插件更新",
							text: "默认每 6 小时自动检查，自动安装默认关闭。安装前校验 SHA256 并保留可回滚安装包。上传、排队、生成期间延后；不会自动重启 DSH。模型、图库、预设和服务器依赖不随插件升级。"
						})]
					}),
					value && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						(0, react_jsx_runtime.jsxs)("p", {
							className: "q2-muted",
							children: [
								"运行版本 ",
								value.runningVersion,
								value.availableVersion ? ` · 最新 ${value.availableVersion}` : "",
								value.checkedAt ? ` · 检查于 ${new Date(value.checkedAt).toLocaleString()}` : ""
							]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: "q2-update-toggles",
							children: [(0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: value.preferences.autoCheck,
								disabled: busy,
								onChange: () => toggle("autoCheck")
							}), "自动检查更新"] }), (0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: value.preferences.autoInstall,
								disabled: busy,
								onChange: () => toggle("autoInstall")
							}), "自动安装更新"] })]
						}),
						(0, react_jsx_runtime.jsxs)("label", { children: ["检查间隔（小时）", (0, react_jsx_runtime.jsx)("select", {
							"aria-label": "更新检查间隔",
							value: value.preferences.intervalHours,
							disabled: busy,
							onChange: (e) => void action({
								action: "preferences",
								preferences: { intervalHours: Number(e.target.value) }
							}),
							children: [.../* @__PURE__ */ new Set([
								1,
								6,
								12,
								24,
								value.preferences.intervalHours
							])].sort((a, b) => a - b).map((n) => (0, react_jsx_runtime.jsx)("option", {
								value: n,
								children: n
							}, n))
						})] }),
						value.restartRequired && (0, react_jsx_runtime.jsxs)("p", {
							role: "status",
							children: [
								"已安装 ",
								value.pendingVersion,
								"，请方便时手动退出并重新打开 DSH。"
							]
						}),
						value.error && (0, react_jsx_runtime.jsx)("p", {
							role: "status",
							children: value.error
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: "q2-actions",
							children: [(0, react_jsx_runtime.jsx)("button", {
								disabled: busy,
								onClick: () => void action({ action: "check" }),
								children: "检查更新"
							}), (0, react_jsx_runtime.jsx)("button", {
								disabled: busy || !value.hasUpdate || value.restartRequired,
								onClick: () => void action({ action: "install" }),
								children: "安装新版"
							})]
						}),
						!!value.backups?.length && (0, react_jsx_runtime.jsxs)("details", { children: [(0, react_jsx_runtime.jsx)("summary", { children: "安装备份与回滚" }), value.backups.map((b) => (0, react_jsx_runtime.jsxs)("div", {
							className: "q2-actions",
							children: [(0, react_jsx_runtime.jsxs)("span", { children: [
								b.version,
								" · ",
								b.id.slice(0, 13)
							] }), (0, react_jsx_runtime.jsx)("button", {
								disabled: busy,
								onClick: () => {
									if (window.confirm(`回滚插件到 ${b.version}？设置、预设和图库保留，完成后需手动重启。`)) action({
										action: "rollback",
										id: b.id,
										confirm: true
									});
								},
								children: "回滚"
							})]
						}, b.id))] })
					] }),
					error && (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: error
					}),
					(0, react_jsx_runtime.jsxs)("details", { children: [
						(0, react_jsx_runtime.jsx)("summary", { children: "收藏记录恢复" }),
						(0, react_jsx_runtime.jsx)("p", {
							className: "q2-muted",
							children: "仅在收藏记录损坏时使用。恢复上一次操作前的标记，损坏文件另存保留，不修改图片原件。"
						}),
						(0, react_jsx_runtime.jsx)("button", {
							disabled: busy,
							onClick: async () => {
								if (!window.confirm("恢复上一次收藏/归档标记备份？当前记录会先另存，图片原件保留。")) return;
								setBusy(true);
								try {
									await request("gallery-restore", { confirm: true });
									setError("收藏记录已恢复，请重新打开图库");
								} catch (e) {
									setError(e instanceof Error ? e.message : String(e));
								} finally {
									setBusy(false);
								}
							},
							children: "恢复收藏备份"
						})
					] })
				]
			});
		}
		//#endregion
		//#region lib/types/client/settings.js
		const rawDefaults = {
			localMfluxDirectory: "",
			localMfluxIdleMinutes: 10,
			connectionMode: "local",
			pythonPath: "",
			modelPath: "",
			hfHome: "",
			loraDirectory: "",
			remoteBaseURL: "",
			remoteModel: "qwen-image",
			remoteApiKey: "",
			remoteSshHost: "",
			remoteSshPort: 19488
		};
		function Settings({ scope }) {
			const privacy = usePrivacyGallery(), [snapshot, setSnapshot] = (0, react.useState)(() => scope?.getSnapshot()), [value, setValue] = (0, react.useState)(() => scope?.getSnapshot().value ?? {}), [dirty, setDirty] = (0, react.useState)({}), [effective, setEffective] = (0, react.useState)(), [health, setHealth] = (0, react.useState)(), [message, setMessage] = (0, react.useState)(""), [busy, setBusy] = (0, react.useState)(false);
			const editingRevision = (0, react.useRef)(void 0);
			const dirtyRef = (0, react.useRef)(dirty);
			dirtyRef.current = dirty;
			(0, react.useEffect)(() => scope?.subscribe(() => {
				const next = scope.getSnapshot();
				setSnapshot(next);
				setValue((old) => ({
					...next.value,
					...Object.fromEntries(Object.keys(dirtyRef.current).map((k) => [k, old[k]]))
				}));
			}), [scope]);
			(0, react.useEffect)(() => {
				let alive = true;
				const timer = setTimeout(() => {
					const { remoteApiKey: _, ...config } = value;
					request("settings", { config }).then((r) => {
						if (alive) {
							setEffective(r.effective);
							setHealth(r.health);
						}
					}).catch((e) => {
						if (alive) setMessage(e.message);
					});
				}, 150);
				return () => {
					alive = false;
					clearTimeout(timer);
				};
			}, [value]);
			const change = (key, v) => {
				if (!Object.keys(dirtyRef.current).length) editingRevision.current = snapshot?.revision;
				setValue((old) => ({
					...old,
					[key]: v
				}));
				setDirty((old) => ({
					...old,
					[key]: "set"
				}));
			};
			const reset = (key) => {
				if (!Object.keys(dirtyRef.current).length) editingRevision.current = snapshot?.revision;
				const base = snapshot?.base;
				setValue((old) => ({
					...old,
					[key]: base?.[key] ?? rawDefaults[key]
				}));
				setDirty((old) => ({
					...old,
					[key]: "unset"
				}));
			};
			function source(key) {
				if (dirty[key] === "set") return "未保存";
				const inherited = dirty[key] === "unset" || !Object.prototype.hasOwnProperty.call(snapshot?.user ?? {}, key);
				if (key === "remoteApiKey") return dirty[key] === "unset" ? "未配置" : effective?.remoteApiKeyConfigured ? "已配置" : "未配置";
				if (key === "remoteBaseURL" && !value[key]) return "未配置";
				if (key === "hfHome" && !value[key] && effective?.hfHomeSource === "environment") return "环境变量";
				return inherited || value[key] === "" ? "默认" : "已设置";
			}
			const hint = (key) => (0, react_jsx_runtime.jsxs)("div", {
				className: "q2-config-origin",
				children: [(0, react_jsx_runtime.jsx)("span", { children: source(key) }), (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: busy,
					"aria-label": `恢复 ${key} 默认`,
					onClick: () => reset(key),
					children: "恢复默认"
				})]
			});
			async function save(check = false) {
				if (!scope) return setMessage("设置接口尚未加载，请重新打开 DSH");
				setBusy(true);
				setMessage("");
				try {
					await request("settings", { config: value });
					const ops = Object.entries(dirty).map(([key, action]) => ({
						op: action,
						path: [key],
						...action === "set" ? { value: value[key] } : {}
					}));
					if (ops.length && !await scope.mutate(ops, editingRevision.current)) throw Error("设置未保存，可能已被其他页面修改；请刷新核对");
					setDirty({});
					editingRevision.current = void 0;
					setSnapshot(scope.getSnapshot());
					setValue(scope.getSnapshot().value ?? {});
					const r = check ? await request("check", {}) : null;
					setMessage(r?.message ?? "设置已保存；已启动模型的路径设置在下次启动生效");
				} catch (e) {
					setMessage(e instanceof Error ? e.message : String(e));
				} finally {
					setBusy(false);
				}
			}
			return (0, react_jsx_runtime.jsxs)("section", {
				className: "q2 q2-settings",
				children: [
					(0, react_jsx_runtime.jsx)("style", { children: STYLE }),
					(0, react_jsx_runtime.jsxs)("fieldset", {
						disabled: busy,
						className: "q2-settings-fields",
						children: [
							(0, react_jsx_runtime.jsx)("header", {
								className: "q2-brand",
								children: (0, react_jsx_runtime.jsx)("h2", { children: "图像" })
							}),
							(0, react_jsx_runtime.jsx)("p", {
								className: "q2-muted",
								children: "显示解析后的实际配置。默认值随数据目录和运行环境变化，保存不会将未修改的默认值固定下来。"
							}),
							(0, react_jsx_runtime.jsxs)("section", {
								className: "q2-privacy-setting",
								children: [(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("h3", { children: "隐私图库" }), (0, react_jsx_runtime.jsx)("p", { children: "仅控制图库分类，对话中的图片和进度始终可见。" })] }), (0, react_jsx_runtime.jsx)("button", {
									role: "switch",
									"aria-label": "启用隐私图库",
									"aria-checked": privacy,
									className: "q2-switch",
									onClick: () => {
										setPrivacyEnabled(!privacy);
									}
								})]
							}),
							(0, react_jsx_runtime.jsxs)("label", { children: [
								"运行位置",
								(0, react_jsx_runtime.jsxs)("select", {
									"aria-label": "运行位置",
									value: value.connectionMode ?? "local",
									onChange: (e) => change("connectionMode", e.target.value),
									children: [(0, react_jsx_runtime.jsx)("option", {
										value: "local",
										children: "本地 Mac"
									}), (0, react_jsx_runtime.jsx)("option", {
										value: "remote",
										children: "远程服务器"
									})]
								}),
								hint("connectionMode")
							] }),
							(0, react_jsx_runtime.jsxs)("div", { children: [
								(0, react_jsx_runtime.jsxs)("div", {
									className: "q2-field-title",
									children: [(0, react_jsx_runtime.jsx)("label", {
										htmlFor: "qwen-idle-minutes",
										children: "空闲后释放模型（分钟）"
									}), (0, react_jsx_runtime.jsx)(ParameterHelp, {
										name: "空闲卸载时间",
										text: "本地与配套 Qwen 网关共用此时间，从最后一个任务结束开始计时。上传、排队和生成时不会断开；按需 SSH 在确认远程模型卸载后断开。普通 Images API 不支持卸载控制。"
									})]
								}),
								(0, react_jsx_runtime.jsx)("input", {
									id: "qwen-idle-minutes",
									"aria-label": "空闲卸载时间",
									type: "number",
									min: ".1",
									max: "1440",
									step: ".1",
									value: value.localMfluxIdleMinutes ?? effective?.localMfluxIdleMinutes ?? 10,
									onChange: (e) => change("localMfluxIdleMinutes", Number(e.target.value))
								}),
								hint("localMfluxIdleMinutes")
							] }),
							(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)(PathField, {
								label: "图库与任务目录",
								name: "图库与任务目录",
								value: dirty.localMfluxDirectory === "set" ? value.localMfluxDirectory ?? "" : effective?.localMfluxDirectory ?? "",
								placeholder: "正在解析默认目录…",
								onChange: (v) => change("localMfluxDirectory", v),
								onError: setMessage
							}), hint("localMfluxDirectory")] }),
							value.connectionMode !== "remote" ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								[
									[
										"pythonPath",
										"Python 可执行文件",
										"Python路径",
										"python"
									],
									[
										"modelPath",
										"Qwen Image 2.1 MLX 模型目录",
										"模型目录",
										"directory"
									],
									[
										"hfHome",
										"Hugging Face 缓存目录",
										"缓存目录",
										"directory"
									],
									[
										"loraDirectory",
										"LoRA 文件夹",
										"LoRA 文件夹",
										"directory"
									]
								].map(([key, label, name, kind]) => (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)(PathField, {
									label,
									name,
									kind,
									value: dirty[key] === "set" ? value[key] ?? "" : effective?.[key] ?? "",
									placeholder: "正在解析实际路径…",
									onChange: (v) => change(key, v),
									onError: setMessage
								}), hint(key)] }, key)),
								health?.runtime && (0, react_jsx_runtime.jsxs)("details", { children: [(0, react_jsx_runtime.jsx)("summary", { children: "当前运行配置 · 已保存路径在下次启动生效" }), (0, react_jsx_runtime.jsx)("dl", { children: [
									"pythonPath",
									"modelPath",
									"hfHome"
								].map((key) => (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: key }), (0, react_jsx_runtime.jsxs)("dd", { children: [health.runtime[key] || "由运行环境确定", effective?.[key] !== health.runtime[key] ? " · 与已保存值不同" : ""] })] }, key)) })] }),
								(0, react_jsx_runtime.jsx)("p", {
									className: "q2-muted",
									children: "可选 LoRA 会合并托管资源、图库下的 loras 和自定义文件夹。在高级设置中可直接选择已导入资源。"
								})
							] }) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								(0, react_jsx_runtime.jsxs)("label", { children: [
									"接口地址",
									(0, react_jsx_runtime.jsx)("input", {
										"aria-label": "远程接口地址",
										value: value.remoteBaseURL ?? "",
										placeholder: "https://你的服务器/v1",
										onChange: (e) => change("remoteBaseURL", e.target.value)
									}),
									hint("remoteBaseURL")
								] }),
								(0, react_jsx_runtime.jsxs)("label", { children: [
									"模型名称",
									(0, react_jsx_runtime.jsx)("input", {
										"aria-label": "远程模型名称",
										value: value.remoteModel || effective?.remoteModel || "qwen-image",
										onChange: (e) => change("remoteModel", e.target.value)
									}),
									hint("remoteModel")
								] }),
								(0, react_jsx_runtime.jsxs)("label", { children: [
									"API Key",
									(0, react_jsx_runtime.jsx)("input", {
										"aria-label": "远程API Key",
										type: "password",
										autoComplete: "off",
										value: dirty.remoteApiKey === "set" ? value.remoteApiKey ?? "" : "",
										placeholder: effective?.remoteApiKeyConfigured ? "已配置，输入新值替换" : "未配置，服务无需鉴权时可留空",
										onChange: (e) => change("remoteApiKey", e.target.value)
									}),
									hint("remoteApiKey")
								] }),
								(0, react_jsx_runtime.jsxs)("label", { children: [
									"按需 SSH 主机",
									(0, react_jsx_runtime.jsx)("input", {
										"aria-label": "按需 SSH 主机",
										value: value.remoteSshHost ?? "",
										placeholder: "留空直接连接；例如 my-qwen-server",
										onChange: (e) => change("remoteSshHost", e.target.value)
									}),
									hint("remoteSshHost")
								] }),
								value.remoteSshHost?.trim() && (0, react_jsx_runtime.jsxs)("label", { children: [
									"服务器网关端口",
									(0, react_jsx_runtime.jsx)("input", {
										"aria-label": "服务器网关端口",
										type: "number",
										min: "1",
										max: "65535",
										value: value.remoteSshPort ?? 19488,
										onChange: (e) => change("remoteSshPort", Number(e.target.value))
									}),
									hint("remoteSshPort")
								] }),
								(0, react_jsx_runtime.jsx)(ParameterHelp, {
									name: "按需 SSH",
									text: "SSH 复用本机已配置的密钥和主机别名；首次信任主机请先在终端完成。留空时直接访问接口。填入后只有提交生图才连接，浏览图库、预设和检查配置都不建立隧道。接口地址须为 http://127.0.0.1:本机端口/v1。"
								}),
								(0, react_jsx_runtime.jsx)("p", {
									className: "q2-muted",
									children: "使用自部署 OpenAI 兼容 Images API。使用配套 Qwen 网关可同步 LoRA、控制图、蒙版与采样进度；普通 Images API 仍仅支持基础文生图。"
								})
							] }),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "q2-actions",
								children: [
									(0, react_jsx_runtime.jsx)("button", {
										className: "q2-primary",
										disabled: busy || !effective,
										onClick: () => void save(),
										children: "保存设置"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										disabled: busy || !effective,
										onClick: () => void save(true),
										children: "保存并检查连接"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										disabled: busy || !Object.keys(dirty).length,
										onClick: () => {
											setDirty({});
											editingRevision.current = void 0;
											setSnapshot(scope?.getSnapshot());
											setValue(scope?.getSnapshot().value ?? {});
											setMessage("已放弃未保存修改，重新读取当前设置");
										},
										children: "放弃修改并重新读取"
									})
								]
							}),
							(0, react_jsx_runtime.jsx)("p", {
								role: "status",
								className: "q2-message",
								children: message
							})
						]
					}),
					(0, react_jsx_runtime.jsx)(UpdateSettings, {})
				]
			});
		}
		//#endregion
		//#region lib/types/client/index.js
		const inject = [
			"slots",
			"connection",
			"remote"
		];
		function apply(ctx) {
			const scope = ctx.get("configForms")?.get("qwen-studio");
			const register = ctx.slots.register.bind(ctx.slots);
			const mount = ctx.slots.inject.bind(ctx.slots);
			mount("plugins.bundle.config", () => register({
				name: "plugins.bundle.config",
				key: "dsh-qwen-studio",
				inject: () => ({ scope })
			}, Settings));
			ctx.inject(["uiConversation"], (owner) => {
				const conversation = owner.get("uiConversation");
				owner.effect(() => conversation.events.register(progressDefinition), "image progress");
				owner.effect(() => conversation.events.register(resultDefinition), "image result");
				const reg = owner.slots.register.bind(owner.slots);
				owner.slots.inject("conversation.chat.node", () => reg({
					name: "conversation.chat.node",
					key: PROGRESS_KIND,
					inject: (sessionId) => ({ sessionId })
				}, ConversationProgress));
				owner.slots.inject("conversation.chat.node", () => reg({
					name: "conversation.chat.node",
					key: RESULT_KIND,
					inject: () => ({})
				}, ConversationImage));
			});
			mount("main", () => register({
				name: "main",
				key: "qwen-studio",
				inject: () => ({})
			}, StudioPage));
			mount("sidebar.panellist", () => register({
				name: "sidebar.panellist",
				id: "qwen-studio",
				order: 10,
				label: "图像"
			}, StudioIcon));
		}
		function StudioIcon({ size = 16 }) {
			return (0, react_jsx_runtime.jsx)(Images, {
				size,
				"aria-hidden": "true"
			});
		}
		function StudioPage() {
			return (0, react_jsx_runtime.jsx)("div", {
				style: {
					height: "100%",
					minHeight: 0,
					boxSizing: "border-box",
					paddingTop: "min(var(--dsh-frame-top-clearance, 0px), 28px)"
				},
				children: (0, react_jsx_runtime.jsx)(Studio, {})
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map