#!/bin/zsh
set -euo pipefail

readonly service_label="com.zappy.local"
readonly user_id="501"
readonly installed_plist="/Users/thersz/Library/LaunchAgents/$service_label.plist"

/bin/launchctl bootout "gui/$user_id/$service_label" >/dev/null 2>&1 || true
if [[ -f "$installed_plist" ]]; then
  /bin/mv "$installed_plist" "/Users/thersz/.Trash/$service_label.plist"
fi
print "Zappy's automatic local service is off. Its setup file was moved to Trash."
