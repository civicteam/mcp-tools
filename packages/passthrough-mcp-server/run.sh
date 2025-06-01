#!/bin/bash
cd "$(dirname "$0")"
npx tsx src/index.ts --stdio 2> err.log