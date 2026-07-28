import os
import glob
import re

directory = '_bmad-output/implementation-artifacts/'

state_mgmt_rules = {
    "1-3-display-a-list-of-events-on-the-main-page.md": "Server State (React Query) for fetching events data, and Client Global State (zustand) if any ephemeral UI state crosses boundaries.",
    "1-4-search-for-events.md": "URL State (nuqs) to manage the search query parameters, enabling shareable URLs and SSR.",
    "1-5-filter-events-by-type-and-category.md": "URL State (nuqs) to manage the selected event types and categories in the URL.",
    "1-6-view-event-details.md": "URL State (nuqs) to capture the previous list context, and Server State (React Query) to fetch specific event details from the cache or backend.",
    "1-7-user-signup-and-login-with-google.md": "Server State (React Query) to cache and manage the user profile and authentication session.",
    "1-8-setup-posthog-analytics.md": "No specific state management tier required, but the analytics provider acts as an external side-effect."
}

files = glob.glob(os.path.join(directory, '1-*.md'))

for file in files:
    filename = os.path.basename(file)
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # check if '### Dev Notes (Custom Rules)' exists
    if '### Dev Notes (Custom Rules)' in content:
        # Check if already updated
        if '- **State Management:**' in content:
            continue
            
        if filename in state_mgmt_rules:
            sm_text = f"- **State Management:** Because this story requires state management, explicitly categorize the state into {state_mgmt_rules[filename]}."
            
            # append right after '### Dev Notes (Custom Rules)'
            content = content.replace('### Dev Notes (Custom Rules)\n', f'### Dev Notes (Custom Rules)\n{sm_text}\n')
            
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filename}")
