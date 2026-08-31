#!/bin/zsh
set -euo pipefail

repo_dir="${0:A:h:h}"
host_dir="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
host_name="br.gov.sjduaspontes.scriptprefeitura.ocr.json"
extension_id="${1:-}"

if [[ -z "$extension_id" ]]; then
  path_hash="$(printf '%s' "$repo_dir" | shasum -a 256 | cut -c1-32)"
  extension_id="$(printf '%s' "$path_hash" | tr '0123456789abcdef' 'abcdefghijklmnop')"
fi
if ! printf '%s' "$extension_id" | grep -Eq '^[a-p]{32}$'; then
  echo "ID da extensão inválido: $extension_id" >&2
  exit 1
fi

swiftc "$repo_dir/native-host/main.swift" -o "$repo_dir/native-host/script-prefeitura-ocr"
mkdir -p "$host_dir"
cp "$repo_dir/native-host/$host_name" "$host_dir/$host_name"
/usr/bin/plutil -replace path -string "$repo_dir/native-host/script-prefeitura-ocr" "$host_dir/$host_name"
/usr/bin/plutil -replace allowed_origins -json "[\"chrome-extension://$extension_id/\"]" "$host_dir/$host_name"

echo "Leitor local instalado para a extensão $extension_id."
