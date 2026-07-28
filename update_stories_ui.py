import os
import glob
import re

directory = '_bmad-output/implementation-artifacts/'

ui_rules = {
    "1-3-display-a-list-of-events-on-the-main-page.md": [
        "- **UI Components (Loaders):** Create reusable `Skeleton` screens for initial load and a `LocalizedSpinner` for infinite scroll inside `packages/ui`.",
        "- **Hooks (Infinite Scroll):** Create a reusable `useInfiniteScroll` hook or component mechanism inside `packages/domain` or `packages/ui` to handle the intersection observer and fetching next pages."
    ],
    "1-6-view-event-details.md": [
        "- **UI Components (Navigation):** Create a reusable `ContextAwareNavigation` (Next/Prev) component inside `packages/ui` that reads the list context.",
        "- **Hooks (List Context):** Create a reusable hook (e.g., `useListContext`) inside `packages/domain` to easily pass and retrieve list context (search, filters, sort) for the detail view navigation."
    ],
    "1-7-user-signup-and-login-with-google.md": [
        "- **UI Components (Loaders):** Create a reusable `BlockingLoader` component (full-screen semi-transparent overlay) inside `packages/ui` to use during the authentication redirect/processing."
    ]
}

files = glob.glob(os.path.join(directory, '1-*.md'))

for file in files:
    filename = os.path.basename(file)
    if filename in ui_rules:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()

        if '### Dev Notes (Custom Rules)' in content:
            # Check if already added
            if '- **UI Components (Loaders):**' in content or '- **UI Components (Navigation):**' in content:
                continue
                
            rules_to_add = "\n".join(ui_rules[filename])
            content = content.replace('### Dev Notes (Custom Rules)\n', f'### Dev Notes (Custom Rules)\n{rules_to_add}\n')
            
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filename} with new reusable component rules")
        elif '## Dev Notes' in content:
            if '- **UI Components (Loaders):**' in content or '- **UI Components (Navigation):**' in content:
                continue
            rules_to_add = "\n".join(ui_rules[filename])
            content = content.replace('## Dev Notes\n', f'## Dev Notes\n\n{rules_to_add}\n')
            
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filename} with new reusable component rules")
