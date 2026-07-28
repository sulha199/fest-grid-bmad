import os

files_to_fix = {
    "_bmad-output/implementation-artifacts/1-3-display-a-list-of-events-on-the-main-page.md": {
        "inside `packages/domain` or `packages/ui`": "strictly inside `packages/ui/src/hooks/` (NO React code is allowed in `packages/domain`)"
    },
    "_bmad-output/implementation-artifacts/1-6-view-event-details.md": {
        "inside `packages/domain`": "strictly inside `packages/ui/src/hooks/` (NO React code is allowed in `packages/domain`)",
        "- **Hooks (List Context):**": "- **UI Components (Loaders):** Create a reusable `Skeleton` loader component for the detail view to use during initial load or when transitioning between next/previous items.\n- **Hooks (List Context):**"
    }
}

for filepath, replacements in files_to_fix.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed {filepath}")
