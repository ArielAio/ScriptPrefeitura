#!/bin/zsh
set -euo pipefail

repo_dir="${0:A:h:h}"
host_dir="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
host_name="br.gov.sjduaspontes.scriptprefeitura.ocr.json"

swiftc "$repo_dir/native-host/main.swift" -o "$repo_dir/native-host/script-prefeitura-ocr"
mkdir -p "$host_dir"
cp "$repo_dir/native-host/$host_name" "$host_dir/$host_name"

echo "Leitor local instalado."
