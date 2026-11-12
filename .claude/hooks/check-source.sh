#!/bin/bash
# .claude/hooks/check-source.sh
#
# PostToolUse hook for Write|Edit on Python source files (Claude Code).
# PostToolUse hook for apply_patch|Edit|Write in Codex (via
# .codex/hooks.json).
# postToolUse / afterFileEdit / afterTabFileEdit hook for Cursor (via
# .cursor/hooks.json).
# Deterministic checks: no trailing whitespace, modeline at EOF,
# <=79-char lines. UTF-8 (Japanese text) is allowed, so there is no
# ASCII check. TypeScript is covered by ESLint instead.
# Claude: exit 2 with violations on stderr. Cursor postToolUse: JSON
# additional_context on stdout. Cursor afterFileEdit/afterTabFileEdit:
# stderr only. Codex:
# JSON systemMessage on stdout.

input=$(cat)

hook_event=""
codex_hook=""
files=""
if command -v jq >/dev/null 2>&1; then
    hook_event=$(printf '%s' "$input" | jq -r '.hook_event_name // empty')
    codex_hook=$(printf '%s' "$input" | jq -r '
        if has("model") then "1" else empty end
    ')
    files=$(printf '%s' "$input" | jq -r '
        .file_path //
        .tool_input.file_path //
        .tool_input.path //
        empty
    ')

    if [ -z "$files" ]; then
        # Codex edits through apply_patch. Depending on the version, the
        # patch text arrives as a string field, a bare string, or one
        # element of a `command` argv array.
        patch=$(printf '%s' "$input" | jq -r '
            .tool_input.patch //
            .tool_input.input //
            (if (.tool_input | type) == "string" then .tool_input
             else empty end) //
            (if (.tool_input.command | type) == "array"
             then (.tool_input.command[]
                   | select(type == "string" and contains("*** ")))
             else empty end) //
            empty
        ')
        files=$(printf '%s\n' "$patch" | sed -nE \
            -e 's/^\*\*\* (Add|Update) File: (.*)$/\2/p' \
            -e 's/^\*\*\* Move to: (.*)$/\1/p')
    fi
else
    files=$(printf '%s' "$input" \
        | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
        | head -1)
fi

[ -z "$files" ] && exit 0

violations=""
add() { violations="${violations}  $1"$'\n'; }

check_file() {
    file="$1"

    [ ! -f "$file" ] && return
    case "$file" in
        *.py) ;;
        *) return ;;
    esac

    # Trailing whitespace.
    tws_line=$(grep -nE $'[ \t]+$' "$file" | head -1 | cut -d: -f1)
    [ -n "$tws_line" ] && add "$file:$tws_line -- trailing whitespace -- strip (run \`make checktws\`)"

    # Modeline at EOF (last non-empty line).
    last=$(awk 'NF { l = $0 } END { print l }' "$file")
    echo "$last" | grep -qE '^[[:space:]]*#[[:space:]]*vim:[[:space:]]+set' \
        || add "$file:EOF -- missing modeline -- append \`# vim: set ff=unix fenc=utf8 et sw=4 ts=4 sts=4 tw=79:\`"

    # Python <=79 chars per line. Count characters, not bytes, as flake8
    # does, so a line of Japanese text is measured correctly.
    long_line=$(python3 - "$file" <<'PY'
import sys
with open(sys.argv[1], encoding="utf-8", errors="replace") as f:
    for i, line in enumerate(f, 1):
        if len(line.rstrip("\r\n")) > 79:
            print(i)
            break
PY
    )
    [ -n "$long_line" ] && add "$file:$long_line -- line >79 chars -- wrap (PEP-8)"
}

while IFS= read -r file; do
    [ -n "$file" ] && check_file "$file"
done < <(printf '%s\n' "$files" | awk '!seen[$0]++')

if [ -z "$violations" ]; then
    exit 0
fi

msg=$(printf 'Hook violations:\n%sverdict: issues found\n' "$violations")

if [ -n "$hook_event" ]; then
    case "$hook_event" in
    postToolUse)
        if command -v jq >/dev/null 2>&1; then
            jq -n --arg ctx "$msg" '{additional_context: $ctx}'
        fi
        exit 0
        ;;
    afterFileEdit|afterTabFileEdit)
        printf '%s' "$msg" >&2
        exit 0
        ;;
    PostToolUse)
        if [ -n "$codex_hook" ] && command -v jq >/dev/null 2>&1; then
            jq -n --arg message "$msg" '{systemMessage: $message}'
            exit 0
        fi
        ;;
    esac
fi

{
    echo "Hook violations:"
    printf '%s' "$violations"
    echo "verdict: issues found"
} >&2
exit 2
