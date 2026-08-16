#!/bin/zsh
set -euo pipefail

readonly service_label="com.zappy.local"
readonly user_id="501"
readonly project_dir="/Users/thersz/Documents/Codex/2026-07-26/th"
readonly source_plist="$project_dir/support/com.zappy.local.plist"
readonly launch_agents_dir="/Users/thersz/Library/LaunchAgents"
readonly installed_plist="$launch_agents_dir/$service_label.plist"

/bin/launchctl bootout "gui/$user_id/$service_label" >/dev/null 2>&1 || true

listeners="$(/usr/sbin/lsof -nP -tiTCP:3000 -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$listeners" ]]; then
  while IFS= read -r process_id; do
    [[ -z "$process_id" ]] && continue
    process_cwd="$(/usr/sbin/lsof -a -p "$process_id" -d cwd -Fn 2>/dev/null | /usr/bin/sed -n 's/^n//p' | /usr/bin/head -n 1)"
    if [[ "$process_cwd" != "$project_dir" ]]; then
      print -u2 "Port 3000 belongs to another app at: ${process_cwd:-unknown location}. Zappy did not stop it."
      exit 20
    fi
    /bin/kill -TERM "$process_id"
  done <<< "$listeners"
  /bin/sleep 1
fi

/bin/mkdir -p "$launch_agents_dir"
/usr/bin/install -m 600 "$source_plist" "$installed_plist"
/bin/launchctl bootstrap "gui/$user_id" "$installed_plist"
/bin/launchctl enable "gui/$user_id/$service_label"
/bin/launchctl kickstart -k "gui/$user_id/$service_label"

for attempt in {1..30}; do
  if /usr/bin/curl -fsS http://localhost:3000/ >/dev/null 2>&1; then
    print "Zappy is managed and responding at http://localhost:3000/"
    exit 0
  fi
  /bin/sleep 1
done

print -u2 "Zappy's service started but did not answer within 30 seconds."
/usr/bin/tail -n 30 /private/tmp/zappy-local.err.log 2>/dev/null || true
exit 1
