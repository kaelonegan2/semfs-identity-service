#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createContainer } from "../services/container.js";
import { selectMcpPrincipal } from "./principal.js";
import { createMcpServer } from "./server.js";

const container = createContainer();
await createMcpServer(container, selectMcpPrincipal(container, process.env.SEMFS_MCP_AUTH_TOKEN)).connect(new StdioServerTransport());
