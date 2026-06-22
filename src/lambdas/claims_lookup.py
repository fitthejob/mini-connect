import os
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ["CLAIMS_TABLE_NAME"]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


def handler(event: dict[str, Any], _context: object) -> dict[str, Any]:
    params = event.get("Details", {}).get("Parameters", {})
    claim_id = params.get("claimId")
    member_id = params.get("memberId")

    if not claim_id or not member_id:
        return {"found": "false", "errorMessage": "claimId and memberId are required"}

    response = table.get_item(Key={"claimId": claim_id, "memberId": member_id})
    claim = response.get("Item")

    if not claim:
        return {"found": "false", "errorMessage": "Claim not found for this member"}

    return {
        "found": "true",
        "claimId": str(claim.get("claimId", "")),
        "status": str(claim.get("status", "")),
        "dateOfService": str(claim.get("dateOfService", "")),
        "providerName": str(claim.get("providerName", "")),
        "procedureCode": str(claim.get("procedureCode", "")),
        "billedAmount": str(claim.get("billedAmount", "")),
        "paidAmount": str(claim.get("paidAmount", "")),
        "denialReason": str(claim.get("denialReason", "")),
    }
