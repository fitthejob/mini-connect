import os
import re
from typing import Any

import boto3

TABLE_NAME = os.environ["MEMBER_TABLE_NAME"]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


def _normalize_dob(value: str) -> str:
    """Strip non-digits and return 8-digit MMDDYYYY string, or empty string."""
    return re.sub(r"\D", "", value)


def handler(event: dict[str, Any], _context: object) -> dict[str, Any]:
    attrs = event.get("Details", {}).get("ContactData", {}).get("Attributes", {})
    member_id = attrs.get("memberId")
    dtmf_dob = attrs.get("dtmfDateOfBirth", "")

    if not member_id:
        return {"verified": "false", "errorMessage": "memberId not present in contact attributes"}

    if not dtmf_dob or len(_normalize_dob(dtmf_dob)) != 8:
        return {"verified": "false", "errorMessage": "dtmfDateOfBirth missing or not 8 digits"}

    response = table.get_item(Key={"memberId": member_id})
    member = response.get("Item")

    if not member:
        return {"verified": "false", "errorMessage": "Member record not found"}

    stored_dob = _normalize_dob(str(member.get("dateOfBirth", "")))
    entered_dob = _normalize_dob(dtmf_dob)

    if stored_dob and stored_dob == entered_dob:
        return {"verified": "true"}

    return {"verified": "false", "errorMessage": "Date of birth did not match"}
