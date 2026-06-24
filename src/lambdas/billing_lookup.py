import os
from typing import Any

import boto3

TABLE_NAME = os.environ["BILLING_TABLE_NAME"]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


def handler(event: dict[str, Any], _context: object) -> dict[str, Any]:
    attrs = event.get("Details", {}).get("ContactData", {}).get("Attributes", {})
    invoice_id = attrs.get("slotInvoiceNumber")
    member_id = attrs.get("memberId")

    if not invoice_id or not member_id:
        return {"found": "false", "missingSlot": "true", "errorMessage": "invoiceId and memberId are required"}

    response = table.get_item(Key={"invoiceId": invoice_id, "memberId": member_id})
    invoice = response.get("Item")

    if not invoice:
        return {"found": "false", "errorMessage": "Invoice not found for this member"}

    return {
        "found": "true",
        "invoiceId": str(invoice.get("invoiceId", "")),
        "amount": str(invoice.get("amount", "")),
        "status": str(invoice.get("status", "")),
        "dateIssued": str(invoice.get("dateIssued", "")),
        "dueDate": str(invoice.get("dueDate", "")),
        "serviceDate": str(invoice.get("serviceDate", "")),
        "description": str(invoice.get("description", "")),
        "claimId": str(invoice.get("claimId", "")),
    }
