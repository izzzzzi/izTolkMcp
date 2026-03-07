#!/usr/bin/env node
import { cpSync, rmSync } from "node:fs";

rmSync("dist/content", { recursive: true, force: true });
cpSync("src/content", "dist/content", { recursive: true });
