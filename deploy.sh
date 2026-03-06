#!/bin/bash
cd "$(dirname "$0")"
MESSAGE="${1:-deploy}"
git add -A && git commit -m "$MESSAGE" && git push origin master
