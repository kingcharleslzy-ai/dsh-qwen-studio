#!/usr/bin/env node
import { main } from '../lib/maintenance.js';
main().catch(error=>{console.error(error.message);process.exitCode=1;});
