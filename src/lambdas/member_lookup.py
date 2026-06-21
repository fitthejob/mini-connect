import os
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ["MEMBER_TABLE_NAME"]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


def handler(event: dict[str, Any], _context: object) -> dict[str, Any]:

    member_id = event.get("Details", {}).get("Parameters", {}).get("memberId")

    if not member_id:
        return {"found": "false", "errorMessage": "memberId not provided"}
    response = table.query(KeyConditionExpression=Key("memberId").eq(member_id))
    items = response.get("Items", [])
    if not items:
        return {"found": "false", "errorMessage": "Member not found"}

    member = items[0]

    return {
        "found": "true",
        "memberId": str(member.get("memberId", "")),
        "firstName": str(member.get("firstName", "")),
        "lastName": str(member.get("lastName", "")),
        "planId": str(member.get("planId", "")),
        "coverageStatus": str(member.get("coverageStatus", "")),
        "dateOfBirth": str(member.get("dateOfBirth", "")),
    }
