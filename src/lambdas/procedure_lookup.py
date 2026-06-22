import os
from typing import Any

import boto3

PROCEDURE_CODES_TABLE_NAME = os.environ["PROCEDURE_CODES_TABLE_NAME"]
FORMULARY_TABLE_NAME = os.environ["FORMULARY_TABLE_NAME"]

dynamodb = boto3.resource("dynamodb")
procedure_codes_table = dynamodb.Table(PROCEDURE_CODES_TABLE_NAME)
formulary_table = dynamodb.Table(FORMULARY_TABLE_NAME)


def handler(event: dict[str, Any], _context: object) -> dict[str, Any]:
    params = event.get("Details", {}).get("Parameters", {})
    procedure_code = params.get("procedureCode")
    plan_id = params.get("planId")

    if not procedure_code or not plan_id:
        return {"found": "false", "errorMessage": "procedureCode and planId are required"}

    # Step 1 — does the procedure code exist?
    response = procedure_codes_table.get_item(Key={"procedureCode": procedure_code})
    procedure = response.get("Item")

    if not procedure:
        return {"found": "false", "errorMessage": f"Procedure code {procedure_code} not found"}

    # Step 2 — is it covered under this plan?
    covered_plans = procedure.get("coveredPlans", [])
    if plan_id not in covered_plans:
        return {
            "found": "true",
            "covered": "false",
            "errorMessage": f"Procedure {procedure_code} is not covered under your plan",
            "procedureCode": procedure_code,
            "description": str(procedure.get("description", "")),
        }

    requires_prior_auth = procedure.get("requiresPriorAuth", False)

    return {
        "found": "true",
        "covered": "true",
        "requiresPriorAuth": "true" if requires_prior_auth else "false",
        "procedureCode": procedure_code,
        "description": str(procedure.get("description", "")),
        "category": str(procedure.get("category", "")),
    }
