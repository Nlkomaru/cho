import { mkdir, writeFile } from "node:fs/promises";

const outputPath = new URL(
	"../src/routes/_app/license/-data.json",
	import.meta.url,
);

let input = "";
for await (const chunk of process.stdin) {
	input += chunk;
}

const rawLicenseGroups = JSON.parse(input);
if (!isRecord(rawLicenseGroups)) {
	throw new TypeError("Expected pnpm license data to be an object.");
}

const licenseGroups = Object.entries(rawLicenseGroups)
	.map(([license, packages]) => ({
		license,
		packages: parsePackages(packages),
	}))
	.sort((left, right) => left.license.localeCompare(right.license));

await mkdir(new URL(".", outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(licenseGroups, null, "\t")}\n`);

function parsePackages(value) {
	if (!Array.isArray(value)) {
		throw new TypeError("Expected each license group to contain an array.");
	}

	return value
		.map((packageInfo) => {
			if (!isRecord(packageInfo) || typeof packageInfo.name !== "string") {
				throw new TypeError("Expected each package to have a name.");
			}
			if (
				!Array.isArray(packageInfo.versions) ||
				!packageInfo.versions.every((version) => typeof version === "string")
			) {
				throw new TypeError(`Expected ${packageInfo.name} versions.`);
			}

			return {
				name: packageInfo.name,
				versions: packageInfo.versions,
				author: typeof packageInfo.author === "string" ? packageInfo.author : null,
				homepage: parseHttpUrl(packageInfo.homepage),
			};
		})
		.sort((left, right) => left.name.localeCompare(right.name));
}

function parseHttpUrl(value) {
	if (typeof value !== "string") {
		return null;
	}

	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
	} catch {
		return null;
	}
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
