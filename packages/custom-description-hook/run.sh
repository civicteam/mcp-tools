#!/bin/bash
cd "$(dirname "$0")"
exec node dist/index.js "$@"