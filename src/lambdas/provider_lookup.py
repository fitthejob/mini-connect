import os
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ["PROVIDERS_TABLE_NAME"]
PLAN_ID_PARAM = "planId"
SPECIALTY_PARAM = "specialty"
ZIP_CODE_PARAM = "zipCode"
PROVIDER_NAME_PARAM = "providerName"

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


def normalize(value: str) -> str:
    return value.strip().lower()


def handler(event: dict[str, Any], _context: object) -> dict[str, Any]:
    params = event.get("Details", {}).get("Parameters", {})
    plan_id = params.get(PLAN_ID_PARAM)
    specialty = params.get(SPECIALTY_PARAM)
    zip_code = params.get(ZIP_CODE_PARAM)
    provider_name = params.get(PROVIDER_NAME_PARAM)

    if not plan_id:
        return {"found": "false", "errorMessage": "planId is required"}

    # Name-based lookup via GSI
    if provider_name:
        response = table.query(
            IndexName="name-index",
            KeyConditionExpression=Key("normalizedName").eq(normalize(provider_name)),
        )
        providers = response.get("Items", [])
        in_network = [p for p in providers if plan_id in p.get("acceptedPlans", [])]
        if not in_network:
            return {"found": "false", "inNetwork": "false", "errorMessage": "Provider not found in network for your plan"}
        provider = in_network[0]
        return {
            "found": "true",
            "inNetwork": "true",
            "providerId": str(provider.get("providerId", "")),
            "name": str(provider.get("name", "")),
            "specialty": str(provider.get("specialty", "")),
            "networkStatus": str(provider.get("networkStatus", "")),
            "phone": str(provider.get("phone", "")),
            "address": str(provider.get("address", "")),
        }

    # Specialty + zip lookup via GSI
    if specialty and zip_code:
        response = table.query(
            IndexName="specialty-zip-index",
            KeyConditionExpression=(
                Key("specialty").eq(normalize(specialty)) &
                Key("zipCode").eq(zip_code)
            ),
        )
        providers = response.get("Items", [])
        in_network = [p for p in providers if plan_id in p.get("acceptedPlans", [])]
        if not in_network:
            return {"found": "false", "inNetwork": "false", "errorMessage": "No in-network providers found for your plan in that area"}
        provider = in_network[0]
        return {
            "found": "true",
            "inNetwork": "true",
            "providerId": str(provider.get("providerId", "")),
            "name": str(provider.get("name", "")),
            "specialty": str(provider.get("specialty", "")),
            "networkStatus": str(provider.get("networkStatus", "")),
            "phone": str(provider.get("phone", "")),
            "address": str(provider.get("address", "")),
        }

    return {"found": "false", "errorMessage": "providerName or specialty+zipCode required"}
