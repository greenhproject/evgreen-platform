#!/bin/bash
cd /home/ubuntu/green-ev-platform

# Generate migrations - pipe yes to auto-accept all "create column" prompts
# The drizzle-kit generate uses interactive prompts for column conflicts
expect -c '
set timeout 300
spawn npx drizzle-kit generate
while {1} {
  expect {
    "create column" { send "\r"; exp_continue }
    "rename column" { exp_continue }
    eof { break }
    timeout { break }
  }
}
wait
'

echo "=== Generate complete, running migrate ==="

# Run migrate (non-interactive)
npx drizzle-kit migrate

echo "=== Migration complete ==="
