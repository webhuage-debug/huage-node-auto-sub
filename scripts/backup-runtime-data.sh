#!/usr/bin/env bash
set -euo pipefail

timestamp="$(date +%Y%m%d-%H%M%S)"
backup_root="backups"
backup_name="huage-node-auto-sub-runtime-${timestamp}"
backup_file="${backup_root}/${backup_name}.tar.gz"
tmp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_dir"
}

trap cleanup EXIT

mkdir -p "$backup_root"
mkdir -p "$tmp_dir/$backup_name"

copy_if_exists() {
  local source="$1"
  local target="$2"
  if [ -e "$source" ]; then
    mkdir -p "$(dirname "$tmp_dir/$backup_name/$target")"
    cp -a "$source" "$tmp_dir/$backup_name/$target"
  fi
}

copy_if_exists "data" "data"
copy_if_exists "docker-compose.override.yml" "docker-compose.override.yml"
copy_if_exists "README.md" "README.md"
copy_if_exists "docs" "docs"

if [ -f ".env" ]; then
  cp -a ".env" "$tmp_dir/$backup_name/.env.backup"
fi

tar \
  --exclude='cores' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  -czf "$backup_file" \
  -C "$tmp_dir" \
  "$backup_name"

printf 'Runtime backup created: %s\n' "$backup_file"
printf 'The backup script does not print .env contents and does not upload files.\n'
