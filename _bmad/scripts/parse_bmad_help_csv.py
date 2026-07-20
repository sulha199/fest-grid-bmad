import csv
import json
import os
import sys

def parse_and_resolve_csv(csv_file_path, config_file_path, project_root):
    skills = []

    with open(csv_file_path, 'r', encoding='utf-8') as f:
        csv_content = f.read()

    with open(config_file_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    # Replace placeholders in paths from config
    resolved_config = json.loads(json.dumps(config).replace("{project-root}", project_root))

    # Extract relevant paths from resolved config
    output_folder = resolved_config["core"]["output_folder"]
    project_knowledge = resolved_config["modules"]["bmm"]["project_knowledge"]
    planning_artifacts = resolved_config["modules"]["bmm"]["planning_artifacts"]
    implementation_artifacts = resolved_config["modules"]["bmm"]["implementation_artifacts"]
    test_artifacts = resolved_config["modules"]["tea"]["test_artifacts"]
    design_artifacts = resolved_config["modules"]["wds"]["design_artifacts"]

    path_map = {
        'output_folder': output_folder,
        'project-knowledge': project_knowledge, # This might be project_knowledge or project-knowledge
        'planning_artifacts': planning_artifacts,
        'implementation_artifacts': implementation_artifacts,
        'test_artifacts': test_artifacts,
        'design_artifacts': design_artifacts,
        '{project-root}/_bmad/custom': os.path.join(project_root, '_bmad', 'custom'),
        '{project-root}/_bmad/custom/': os.path.join(project_root, '_bmad', 'custom') + os.sep, # Ensure trailing slash for directory checks
        '_bmad/_memory/tech-writer-sidecar': os.path.join(project_root, '_bmad', '_memory', 'tech-writer-sidecar'),
        '{output_folder}/brainstorming': os.path.join(output_folder, 'brainstorming'),
        '{output_folder}/specs/spec-{slug}': os.path.join(output_folder, 'specs', 'spec-{slug}'),
        '{output_folder}/forge': os.path.join(output_folder, 'forge'),
    }

    # Add a fallback for project_knowledge key if it's different in CSV or needed dynamically
    if 'project_knowledge' not in path_map:
        path_map['project_knowledge'] = project_knowledge

    reader = csv.reader(csv_content.strip().splitlines())
    header = next(reader)

    for row in reader:
        skill_data = dict(zip(header, row))
        resolved_output_location = skill_data.get('output-location', '')

        # Replace placeholders in output-location
        for placeholder, path_val in path_map.items():
            resolved_output_location = resolved_output_location.replace(placeholder, path_val)

        # Handle specific cases for output-location that might have dynamic parts like {slug}
        # For now, let's just make sure the base path is resolved.
        # The full file existence check will handle the actual output file patterns.

        skill_data['resolved-output-location'] = resolved_output_location
        skills.append(skill_data)

    return skills

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python parse_bmad_help_csv.py <csv_file_path> <config_file_path> <project_root>")
        sys.exit(1)

    csv_file_path = sys.argv[1]
    config_file_path = sys.argv[2]
    project_root = sys.argv[3]

    parsed_skills = parse_and_resolve_csv(csv_file_path, config_file_path, project_root)
    print(json.dumps(parsed_skills, indent=2))