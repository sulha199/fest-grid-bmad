
import json
import os
import sys
import re

def analyze_skills(completed_skills, all_skills):
    # Group skills by phase
    skills_by_phase = {}
    for skill in all_skills:
        phase = skill.get("phase", "anytime")
        if phase not in skills_by_phase:
            skills_by_phase[phase] = []
        skills_by_phase[phase].append(skill)

    # Sort phases to determine the current progress
    # Custom sort for phases: "anytime" first, then numerical phases
    def sort_key(phase):
        if phase == "anytime":
            return 0, ""
        # Extract numerical part and then alphabetical for phases like "1-analysis", "2-planning"
        match = re.match(r"^(\\d+)-(.*)$", phase)
        if match:
            return int(match.group(1)), match.group(2)
        return sys.maxsize, phase # Put other phases last

    sorted_phases = sorted(skills_by_phase.keys(), key=sort_key)

    current_phase = "anytime"
    next_required_skills = []
    next_recommended_skills = []

    # Determine the current phase and find required skills in it
    for phase in sorted_phases:
        if phase == "anytime":
            continue

        required_in_phase = [s for s in skills_by_phase[phase] if s.get("required") == "true"]
        incomplete_required_in_phase = [s for s in required_in_phase if s["skill"] not in completed_skills]

        if incomplete_required_in_phase:
            current_phase = phase
            next_required_skills.extend(incomplete_required_in_phase)
            break

    # If no incomplete required skills found in numbered phases, we are in the last phase or done with them.
    # In this case, consider 'anytime' skills or skills that follow from the last completed phase.
    if not next_required_skills:
        # Look for the highest numbered phase that has completed skills
        last_completed_numbered_phase = "anytime"
        for phase in sorted_phases:
            if phase == "anytime":
                continue
            phase_skills = skills_by_phase.get(phase, [])
            if any(s["skill"] in completed_skills for s in phase_skills):
                last_completed_numbered_phase = phase

        if last_completed_numbered_phase != "anytime":
            # Find skills that follow the last completed phase
            for skill in all_skills:
                if skill["skill"] not in completed_skills:
                    # Check if all 'preceded-by' skills are completed
                    preceded_by = skill.get("preceded-by", "").split(",")
                    all_preceded_completed = True
                    for pre_skill_ref in preceded_by:
                        if pre_skill_ref.strip() and pre_skill_ref.strip() not in completed_skills:
                            all_preceded_completed = False
                            break
                    if all_preceded_completed:
                        # If it's a required skill, add to next_required, otherwise next_recommended
                        if skill.get("required") == "true":
                            next_required_skills.append(skill)
                        else:
                            next_recommended_skills.append(skill)

        # Add 'anytime' skills if no specific phase-based recommendations
        anytime_skills = [s for s in skills_by_phase.get("anytime", []) if s["skill"] not in completed_skills]
        next_recommended_skills.extend(anytime_skills)


    return current_phase, next_required_skills, next_recommended_skills

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python analyze_skills.py <detect_completed_skills_json_path>")
        sys.exit(1)

    detected_skills_json_path = sys.argv[1]

    with open(detected_skills_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    completed_skills_set = set(data["completed_skills"])
    all_skills_list = data["all_skills"]

    current_phase, next_required, next_recommended = analyze_skills(completed_skills_set, all_skills_list)

    result = {
        "current_phase": current_phase,
        "next_required_skills": [
            {
                "skill": s["skill"],
                "display-name": s["display-name"],
                "menu-code": s["menu-code"],
                "description": s["description"],
                "action": s["action"],
                "args": s["args"],
                "phase": s["phase"]
            } for s in next_required
        ],
        "next_recommended_skills": [
            {
                "skill": s["skill"],
                "display-name": s["display-name"],
                "menu-code": s["menu-code"],
                "description": s["description"],
                "action": s["action"],
                "args": s["args"],
                "phase": s["phase"]
            } for s in next_recommended
        ]
    }
    print(json.dumps(result, indent=2))
