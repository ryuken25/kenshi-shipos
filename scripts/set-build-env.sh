#!/bin/bash
# Set build SHA and time for production builds
export NEXT_PUBLIC_BUILD_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
export NEXT_PUBLIC_BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "Build SHA: $NEXT_PUBLIC_BUILD_SHA"
echo "Build Time: $NEXT_PUBLIC_BUILD_TIME"
