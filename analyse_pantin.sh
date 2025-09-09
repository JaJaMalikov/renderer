#!/bin/bash

niveau=0
while IFS= read -r line; do
  line=$(echo "$line" | sed 's/^[ \t]*//')

  if echo "$line" | grep -q '</g'; then
    ((niveau--))
    continue
  fi

  if echo "$line" | grep -q '<g'; then
    id=$(echo "$line" | grep -o 'id="[^"]*"' | cut -d'"' -f2)
    indent=$(printf '%*s' $((niveau * 2)) '')
    echo "${indent}<g id=\"${id:-—}\">"
    ((niveau++))
  fi
done < "$1"

