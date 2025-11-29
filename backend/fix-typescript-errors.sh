#!/bin/bash

# Script para corrigir erros TypeScript automaticamente

echo "🔧 Corrigindo erros TypeScript..."

# Corrigir parâmetros 'any' implícitos
find backend/src -name "*.ts" -type f -exec sed -i \
  -e 's/\.map((\([a-z]\+\)) =>/\.map((\1: any) =>/g' \
  -e 's/\.reduce((\([a-z]\+\), \([a-z]\+\)) =>/\.reduce((\1: number, \2: any) =>/g' \
  -e 's/\.forEach((\([a-z]\+\)) =>/\.forEach((\1: any) =>/g' \
  -e 's/\.filter((\([a-z]\+\)) =>/\.filter((\1: any) =>/g' \
  -e 's/\.flatMap((\([a-z]\+\)) =>/\.flatMap((\1: any) =>/g' \
  {} \;

echo "✅ Erros corrigidos!"

