import os
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ["PROVIDERS_TABLE_NAME"]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


def normalize(value: str) -> str:
    return value.strip().lower()


def handler(event: dict[str, Any], _context: object) -> dict[str, Any]:
    attrs = event.get("Details", {}).get("ContactData", {}).get("Attributes", {})
    plan_id = attrs.get("planId")
    specialty = attrs.get("slotSpecialty")
    zip_code = attrs.get("slotZipCode")
    provider_name = attrs.get("slotProviderName")

    if not plan_id:
        return {"found": "false", "errorMessage": "planId is required"}

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

    return {"found": "false", "missingSlot": "true", "errorMessage": "providerName or specialty+zipCode required"}
