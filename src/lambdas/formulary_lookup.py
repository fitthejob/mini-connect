import os
from typing import Any

import boto3

FORMULARY_TABLE_NAME = os.environ["FORMULARY_TABLE_NAME"]

dynamodb = boto3.resource("dynamodb")
formulary_table = dynamodb.Table(FORMULARY_TABLE_NAME)


def normalize(value: str) -> str:
    return value.strip().lower()


def handler(event: dict[str, Any], _context: object) -> dict[str, Any]:
    attrs = event.get("Details", {}).get("ContactData", {}).get("Attributes", {})
    plan_id = attrs.get("planId")
    medication_name = attrs.get("slotMedicationName")

    if not plan_id or not medication_name:
        return {"found": "false", "missingSlot": "true", "errorMessage": "planId and medicationName are required"}

    normalized_name = normalize(medication_name)

    response = formulary_table.get_item(
        Key={"planId": plan_id, "normalizedMedicationName": normalized_name}
    )
    entry = response.get("Item")

    if not entry:
        return {
            "found": "false",
            "covered": "false",
            "errorMessage": f"{medication_name} is not found in your plan's formulary",
        }

    covered = entry.get("covered", False)
    requires_prior_auth = entry.get("requiresPriorAuth", False)

    return {
        "found": "true",
        "covered": "true" if covered else "false",
        "requiresPriorAuth": "true" if requires_prior_auth else "false",
        "tier": str(entry.get("tier", "")),
        "copay": str(entry.get("copay", "")),
        "quantityLimit": str(entry.get("quantityLimit", "")),
        "medicationName": medication_name,
    }
