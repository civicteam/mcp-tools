#!/bin/bash
cd "$(dirname "$0")"
npx tsx src/cli.ts --stdio 2> err.log