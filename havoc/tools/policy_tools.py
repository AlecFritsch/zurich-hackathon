"""Policy compilation, validation, and evaluation tools."""

from __future__ import annotations

import json
import logging

from langchain_core.tools import tool

from models import ExecutablePolicy, PolicyValidation

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Policy Validation
# ---------------------------------------------------------------------------

def validate_policy(policy: ExecutablePolicy) -> PolicyValidation:
    """Validate a compiled policy for completeness."""
    missing: list[str] = []
    ambiguities: list[str] = []
    severity = "OK"

    if not policy.decision_rules:
        missing.append("no_decision_rules")
        severity = "CRITICAL"

    if not policy.safety_constraints:
        missing.append("no_safety_constraints")
        if severity != "CRITICAL":
            severity = "WARNING"

    if not policy.vision_instructions:
        missing.append("no_vision_instructions")
        if severity != "CRITICAL":
            severity = "WARNING"

    if not policy.inspection_criteria:
        missing.append("no_inspection_criteria")

    rule_count = len(policy.decision_rules)
    coverage = min(rule_count / 5.0, 1.0)

    return PolicyValidation(
        is_complete=severity != "CRITICAL",
        missing_elements=missing,
        severity=severity,
        coverage_pct=round(coverage, 2),
        ambiguities=ambiguities,
        conflicts=policy.conflicts,
        recommendations=[],
    )



# ---------------------------------------------------------------------------
# LangChain Tools (for agent use)
# ---------------------------------------------------------------------------

@tool
def compile_policy_tool(document_markdown: str, document_name: str) -> str:
    """Compile a parsed document into an executable policy.

    This tool takes the markdown output from Docling and returns instructions
    for the LLM to compile it into a structured policy JSON.

    Args:
        document_markdown: The markdown content from Docling parsing.
        document_name: Name of the source document.

    Returns:
        Instructions for policy compilation.
    """
    return (
        f"Analyze the following document content from '{document_name}' and compile it into "
        "an executable policy. Extract:\n"
        "1. Decision rules (sorting criteria, routing rules)\n"
        "2. Safety constraints (speed limits, force limits)\n"
        "3. Inspection criteria (what to check, thresholds)\n"
        "4. Vision prompts (what the camera should look for)\n"
        "5. Operator workflow steps\n\n"
        "Return a JSON object matching the ExecutablePolicy schema.\n\n"
        f"Document content:\n{document_markdown[:8000]}"
    )


@tool
def validate_policy_tool(policy_json: str) -> str:
    """Validate a compiled policy for completeness and conflicts.

    Args:
        policy_json: JSON string of the ExecutablePolicy.

    Returns:
        Validation results as JSON.
    """
    try:
        policy = ExecutablePolicy.model_validate_json(policy_json)
        validation = validate_policy(policy)
        return validation.model_dump_json(indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})
