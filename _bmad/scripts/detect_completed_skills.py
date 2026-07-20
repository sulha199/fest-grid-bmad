
import json
import os
import sys
import re

def detect_completed_skills(parsed_skills_path, all_files):
    with open(parsed_skills_path, 'r', encoding='utf-8') as f:
        parsed_skills = json.load(f)

    completed_skills = set()
    for skill_data in parsed_skills:
        outputs_pattern = skill_data.get("outputs", "").strip()
        resolved_output_location_raw = skill_data.get("resolved-output-location", "").strip()

        if not outputs_pattern or not resolved_output_location_raw:
            continue

        # Handle multiple output locations and patterns
        output_locations = resolved_output_location_raw.split("|")
        outputs_patterns = re.split(r'[| ]', outputs_pattern) # Split by | or space

        is_completed = False
        for location in output_locations:
            location = location.strip()
            if not location: # Skip empty locations
                continue

            # Resolve absolute paths and normalize them
            base_path = os.path.abspath(location)

            for pattern in outputs_patterns:
                if not pattern:
                    continue

                # Handle wildcards and specific file names
                # For simplicity, if pattern contains '*', we just check if any file in location starts with a relevant name
                # A more robust solution would involve fnmatch or regex for glob patterns
                if "." in pattern and "*" not in pattern: # Specific file name expected
                    expected_file = os.path.join(base_path, pattern).replace("\\", "/")
                    if any(f.endswith(expected_file) for f in all_files): # Check for exact match or endswith for subdirectories
                        is_completed = True
                        break
                elif outputs_pattern == "*" or outputs_pattern.endswith("/"): # Directory or any file in directory
                    # Check if the directory exists and has any files
                    if any(f.startswith(base_path.replace("\\", "/")) and f != base_path.replace("\\", "/") for f in all_files):
                         is_completed = True
                         break
                else: # General pattern, check if base_path is part of any file
                    if any(re.search(re.escape(pattern).replace("\\*", ".*"), f) for f in all_files):
                        is_completed = True
                        break
            if is_completed:
                break

        if is_completed:
            completed_skills.add(skill_data["skill"])

    return list(completed_skills), parsed_skills


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python detect_completed_skills.py <parsed_skills_json_path> <all_files_json_path>")
        sys.exit(1)

    parsed_skills_json_path = sys.argv[1]
    all_files_json_path = sys.argv[2]

    # Read all_files from the JSON file
    with open(all_files_json_path, 'r', encoding='utf-8') as f:
        all_files = json.load(f)

    completed, all_skills = detect_completed_skills(parsed_skills_json_path, all_files)
    print(json.dumps({"completed_skills": completed, "all_skills": all_skills}, indent=2))
