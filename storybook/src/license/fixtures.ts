import type { LicensePackage } from "@/routes/_app/license/-components/license-group";

export const buildPackage = (overrides: Partial<LicensePackage> = {}): LicensePackage => ({
  name: "@chakra-ui/react",
  versions: ["3.31.0"],
  author: "Segun Adebayo",
  homepage: "https://chakra-ui.com",
  ...overrides,
});

export const mitPackages: LicensePackage[] = [
  buildPackage(),
  buildPackage({
    name: "@tanstack/react-router",
    versions: ["1.139.3"],
    author: "Tanner Linsley",
    homepage: "https://tanstack.com/router",
  }),
  buildPackage({
    name: "hono",
    versions: ["4.10.6"],
    author: "Yusuke Wada",
    homepage: "https://hono.dev",
  }),
  buildPackage({
    name: "lucide-react",
    versions: ["0.553.0"],
    author: "Eric Fennis",
    homepage: "https://lucide.dev",
  }),
  buildPackage({
    name: "zod",
    versions: ["4.1.12", "3.25.76"],
    author: "Colin McDonnell",
    homepage: null,
  }),
  buildPackage({
    name: "a-very-long-package-name-that-keeps-going-and-going",
    versions: ["0.0.1-beta.12"],
    author: null,
    homepage: "https://example.com",
  }),
];

export const groups = [
  {
    license: "Apache-2.0",
    packages: [
      buildPackage({
        name: "@internationalized/date",
        versions: ["3.12.4"],
        author: null,
        homepage: "https://github.com/adobe/react-spectrum",
      }),
      buildPackage({
        name: "typescript",
        versions: ["5.9.3"],
        author: "Microsoft Corp.",
        homepage: "https://www.typescriptlang.org/",
      }),
    ],
  },
  {
    license: "ISC",
    packages: [
      buildPackage({ name: "semver", versions: ["7.7.3"], author: "GitHub Inc.", homepage: null }),
    ],
  },
  { license: "MIT", packages: mitPackages },
];
