#!/usr/bin/env node
import { createContainer } from "./services/container.js";
import { startServer } from "./server/app.js";

await startServer(createContainer());
