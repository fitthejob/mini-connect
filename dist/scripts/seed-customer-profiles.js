/**
 * Seeds the Customer Profiles domain with 20 dummy member records for testing.
 *
 * Each profile is created with:
 *   - FirstName, LastName, PhoneNumber
 *   - Custom attributes: memberId, planId, coverageStatus
 *   - _phone key so the flow's GetCustomerProfile block can find them by ANI
 *
 * Usage:
 *   npm run seed:profiles -- dev
 *   npm run seed:profiles -- dev +12125550101   (override phone for record 0 — your test number)
 *
 * Prerequisites: MiniConnect-CustomerProfiles stack must be deployed.
 */
import { CustomerProfilesClient, CreateProfileCommand, AddProfileKeyCommand, } from "@aws-sdk/client-customer-profiles";
const env = process.argv[2] ?? "dev";
const testPhoneOverride = process.argv[3]; // optional: your real phone for record 0
const DOMAIN_NAME = `mini-connect-${env}`;
const REGION = process.env.AWS_REGION ?? "us-east-1";
const client = new CustomerProfilesClient({ region: REGION });
const members = [
    { firstName: "James", lastName: "Harrington", phone: "+12125550101", memberId: "MBR-100001", planId: "PLAN-GOLD-001", coverageStatus: "ACTIVE" },
    { firstName: "Maria", lastName: "Santos", phone: "+12125550102", memberId: "MBR-100002", planId: "PLAN-SILVER-002", coverageStatus: "ACTIVE" },
    { firstName: "David", lastName: "Okafor", phone: "+12125550103", memberId: "MBR-100003", planId: "PLAN-PLATINUM-004", coverageStatus: "ACTIVE" },
    { firstName: "Priya", lastName: "Nair", phone: "+12125550104", memberId: "MBR-100004", planId: "PLAN-BRONZE-003", coverageStatus: "ACTIVE" },
    { firstName: "Carlos", lastName: "Mendez", phone: "+12125550105", memberId: "MBR-100005", planId: "PLAN-GOLD-001", coverageStatus: "ACTIVE" },
    { firstName: "Aisha", lastName: "Williams", phone: "+12125550106", memberId: "MBR-100006", planId: "PLAN-SILVER-002", coverageStatus: "SUSPENDED" },
    { firstName: "Thomas", lastName: "Kowalski", phone: "+12125550107", memberId: "MBR-100007", planId: "PLAN-BRONZE-003", coverageStatus: "ACTIVE" },
    { firstName: "Yuki", lastName: "Tanaka", phone: "+12125550108", memberId: "MBR-100008", planId: "PLAN-PLATINUM-004", coverageStatus: "ACTIVE" },
    { firstName: "Robert", lastName: "Dubois", phone: "+12125550109", memberId: "MBR-100009", planId: "PLAN-GOLD-001", coverageStatus: "ACTIVE" },
    { firstName: "Fatima", lastName: "Al-Rashid", phone: "+12125550110", memberId: "MBR-100010", planId: "PLAN-SILVER-002", coverageStatus: "PENDING" },
    { firstName: "Michael", lastName: "Chen", phone: "+12125550111", memberId: "MBR-100011", planId: "PLAN-BRONZE-003", coverageStatus: "ACTIVE" },
    { firstName: "Sofia", lastName: "Reyes", phone: "+12125550112", memberId: "MBR-100012", planId: "PLAN-PLATINUM-004", coverageStatus: "ACTIVE" },
    { firstName: "Kwame", lastName: "Asante", phone: "+12125550113", memberId: "MBR-100013", planId: "PLAN-GOLD-001", coverageStatus: "ACTIVE" },
    { firstName: "Ingrid", lastName: "Lindqvist", phone: "+12125550114", memberId: "MBR-100014", planId: "PLAN-SILVER-002", coverageStatus: "ACTIVE" },
    { firstName: "Ahmed", lastName: "Hassan", phone: "+12125550115", memberId: "MBR-100015", planId: "PLAN-BRONZE-003", coverageStatus: "SUSPENDED" },
    { firstName: "Elena", lastName: "Petrov", phone: "+12125550116", memberId: "MBR-100016", planId: "PLAN-PLATINUM-004", coverageStatus: "ACTIVE" },
    { firstName: "Marcus", lastName: "Thompson", phone: "+12125550117", memberId: "MBR-100017", planId: "PLAN-GOLD-001", coverageStatus: "ACTIVE" },
    { firstName: "Leila", lastName: "Moradi", phone: "+12125550118", memberId: "MBR-100018", planId: "PLAN-SILVER-002", coverageStatus: "ACTIVE" },
    { firstName: "Patrick", lastName: "O'Brien", phone: "+12125550119", memberId: "MBR-100019", planId: "PLAN-BRONZE-003", coverageStatus: "PENDING" },
    { firstName: "Vanessa", lastName: "Nguyen", phone: "+12125550120", memberId: "MBR-100020", planId: "PLAN-PLATINUM-004", coverageStatus: "ACTIVE" },
];
// Override first record's phone with your real test number if provided
if (testPhoneOverride) {
    members[0].phone = testPhoneOverride;
    console.log(`Overriding record 0 phone to ${testPhoneOverride} (${members[0].firstName} ${members[0].lastName})`);
}
async function seedProfile(member) {
    const createResponse = await client.send(new CreateProfileCommand({
        DomainName: DOMAIN_NAME,
        FirstName: member.firstName,
        LastName: member.lastName,
        PhoneNumber: member.phone,
        Attributes: {
            memberId: member.memberId,
            planId: member.planId,
            coverageStatus: member.coverageStatus,
        },
    }));
    const profileId = createResponse.ProfileId;
    // Register _phone key so GetCustomerProfile can find this profile by ANI
    await client.send(new AddProfileKeyCommand({
        DomainName: DOMAIN_NAME,
        ProfileId: profileId,
        KeyName: "_phone",
        Values: [member.phone],
    }));
    console.log(`  ✓ ${member.firstName} ${member.lastName} | ${member.phone} | ${member.memberId} | ${member.coverageStatus} → ProfileId: ${profileId}`);
}
async function main() {
    console.log(`\nSeeding ${members.length} profiles into domain: ${DOMAIN_NAME} (${REGION})\n`);
    let succeeded = 0;
    let failed = 0;
    for (const member of members) {
        try {
            await seedProfile(member);
            succeeded++;
        }
        catch (err) {
            console.error(`  ✗ Failed ${member.memberId} (${member.phone}):`, err.message);
            failed++;
        }
    }
    console.log(`\nDone. ${succeeded} succeeded, ${failed} failed.`);
    if (succeeded > 0) {
        console.log("\nTo test ANI lookup, call in from one of these numbers:");
        members.slice(0, 5).forEach((m) => console.log(`  ${m.phone}  →  ${m.firstName} ${m.lastName} (${m.memberId})`));
        if (testPhoneOverride) {
            console.log(`\n  Your test number ${testPhoneOverride} is mapped to ${members[0].firstName} ${members[0].lastName} (${members[0].memberId})`);
        }
    }
}
main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
