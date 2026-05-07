#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createContainer } from "../services/container.js";
import { createMcpServer } from "./server.js";

await createMcpServer(createContainer()).connect(new StdioServerTransport());
