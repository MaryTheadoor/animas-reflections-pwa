import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  // `roots` already keeps the run inside src, but _backups/ holds copies of test
  // files (named *__tests__-*.ts) and a second exclusion is cheap insurance.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/_backups/", "<rootDir>/functions/", "<rootDir>/.next/"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
};

export default config;
